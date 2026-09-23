// telegram-ingest
// ----------------------------------------------------------------------------
// Ingestion endpoint for the personal-account Telegram userbot (MTProto). The
// userbot can't run in an Edge Function (it needs a persistent connection), so
// it runs off-platform and POSTs each mirrored message here. This function:
//   * resolves who the chat belongs to (identity spine; auto-links by the
//     student's known phone)
//   * creates a lead for a new person writing to us in a private chat, the
//     same way an Instagram DM does (see "A person writing to us" below)
//   * upserts the thread (both directions, unread bookkeeping)
//   * stores the message, de-duplicated by a composite external id
//   * heals rows stored before media handling worked, by attaching the file
//     when a later backfill re-delivers the same message
//
// Auth: shared secret in the `x-ingest-secret` header (== TELEGRAM_INGEST_SECRET).
// Accepts a single event or a batch ({ events: [...] }) for backfill.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureIdentity, resolveIdentity } from "../_shared/identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

interface TgUser {
  id: string | number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

interface IngestEvent {
  account?: { staff_user_id?: string | null; label?: string | null };

  /** The THREAD key. For 1:1 this is the other person; for a group/channel the
   *  userbot sets it to the chat id, so one thread per conversation either way. */
  peer: TgUser;

  /** Conversation kind + title. Absent on older userbot builds => treat as private. */
  chat?: {
    id?: string | number;
    type?: "private" | "group" | "channel" | "saved" | string | null;
    title?: string | null;
  };

  /** Who actually wrote it. Only meaningful in groups/channels, where it differs
   *  from `peer`. Falls back to `peer` when absent (1:1). */
  sender?: TgUser | null;

  message: {
    id: string | number;
    text?: string | null;
    date?: number | null; // unix seconds
    out?: boolean;
    media_type?: string | null; // image | file | voice | video | sticker | ...
    /** Small media inlined by the userbot (legacy path, still supported). */
    media_base64?: string | null;
    /** Preferred path: the userbot already uploaded the bytes to chat-media
     *  via a signed upload URL and just tells us where they landed. */
    media_path?: string | null;
    media_mime?: string | null;
    media_filename?: string | null;
    media_duration?: number | null; // seconds (voice/audio/video)
    media_size?: number | null;
    /** Telegram threading extras, kept in metadata for context. */
    reply_to_msg_id?: number | null;
    forwarded_from?: string | null;
    edited?: boolean;
  };
}

// messages.message_type is CHECK-constrained to text | image | file | voice,
// so richer Telegram kinds collapse into those four. The precise kind is kept
// in metadata.media_type so the UI can still render it properly.
const MEDIA_TO_TYPE: Record<string, string> = {
  image: "image",
  photo: "image",
  sticker: "image",
  animation: "image", // GIFs
  voice: "voice",
  audio: "voice",
  video: "file",
  video_note: "file", // round "telescope" videos
  document: "file",
  file: "file",
  contact: "file",
  location: "file",
  poll: "file",
  media: "file",
};

/** Human label used when a message has media but no caption. */
const MEDIA_PLACEHOLDER: Record<string, string> = {
  voice: "🎤 Voice message",
  audio: "🎵 Audio",
  photo: "🖼 Photo",
  image: "🖼 Photo",
  sticker: "🌟 Sticker",
  animation: "🎬 GIF",
  video: "🎬 Video",
  video_note: "🎬 Video message",
  document: "📎 Document",
  file: "📎 File",
  contact: "👤 Contact",
  location: "📍 Location",
  poll: "📊 Poll",
};

/** Older than this, a message is history being replayed, not someone writing now. */
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

const CHAT_MEDIA_BUCKET = "chat-media";
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB hard cap

const EXT_BY_MIME: Record<string, string> = {
  // audio
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/webm": "webm",
  // images
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/x-tgsticker": "tgs",
  // video
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  // documents
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Upload inlined media bytes to the private chat-media bucket. Best-effort:
 *  a failure here must not drop the message, so callers tolerate a null. */
async function storeMedia(
  supabase: any,
  opts: { source: string; senderId: string; externalId: string; base64: string; mime?: string | null; filename?: string | null },
): Promise<{ path: string; size: number; mime: string } | null> {
  try {
    const bytes = decodeBase64(opts.base64);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) return null;
    const mime = opts.mime || "application/octet-stream";
    const ext = EXT_BY_MIME[mime] ||
      (opts.filename && opts.filename.includes(".") ? opts.filename.split(".").pop()! : "bin");
    const safeId = String(opts.externalId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeSender = String(opts.senderId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${opts.source}/${safeSender}/${safeId}.${ext}`;
    const up = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (up.error) {
      console.error("chat-media upload failed:", up.error.message);
      return null;
    }
    return { path, size: bytes.byteLength, mime };
  } catch (e) {
    console.error("storeMedia error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("TELEGRAM_INGEST_SECRET");
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid JSON" }, 400);
  }

  // ---- Media upload handshake -------------------------------------------
  // Base64-inlining only works for small files. For anything bigger the userbot
  // asks for a signed upload URL, PUTs the bytes straight to storage, then sends
  // the resulting path on the event. Keeps big video out of the JSON payload and
  // means the userbot never holds storage credentials.
  if (body?.action === "media-upload-url") {
    const senderId = String(body.sender_id ?? "unknown");
    const externalId = String(body.external_id ?? crypto.randomUUID());
    const mime = body.mime ? String(body.mime) : "application/octet-stream";
    const filename = body.filename ? String(body.filename) : null;

    const ext = EXT_BY_MIME[mime] ||
      (filename && filename.includes(".") ? filename.split(".").pop()! : "bin");
    const safeId = externalId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeSender = senderId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `telegram/${safeSender}/${safeId}.${ext}`;

    const signed = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (signed.error) {
      console.error("createSignedUploadUrl failed:", signed.error.message);
      return json({ error: signed.error.message }, 500);
    }
    return json({
      ok: true,
      path,
      signed_url: signed.data?.signedUrl ?? null,
      token: signed.data?.token ?? null,
    });
  }

  const events: IngestEvent[] = Array.isArray(body?.events)
    ? body.events
    : body?.peer && body?.message
    ? [body as IngestEvent]
    : [];

  if (events.length === 0) return json({ error: "No events" }, 400);
  if (events.length > 500) return json({ error: "Batch too large (max 500)" }, 400);

  let stored = 0;
  let linked = 0;
  let skipped = 0;
  let reconciled = 0;
  let healed = 0;
  const errors: string[] = [];

  for (const ev of events) {
    try {
      const r = await ingestOne(supabase, ev);
      if (r.status === "stored") stored++;
      else if (r.status === "reconciled") reconciled++;
      else if (r.status === "healed") healed++;
      else skipped++;
      if (r.linked) linked++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return json({
    ok: true,
    received: events.length,
    stored,
    skipped,
    reconciled,
    healed,
    linked,
    errors: errors.slice(0, 10),
  });
});

async function ingestOne(
  supabase: any,
  ev: IngestEvent,
): Promise<{ status: "stored" | "duplicate" | "reconciled" | "healed"; linked: boolean }> {
  // `identifier` is the THREAD key: the other person in a 1:1, the chat in a group.
  const identifier = String(ev.peer.id);
  const chatType = ev.chat?.type ?? "private";
  const isGroupLike = chatType === "group" || chatType === "channel";

  // The author. In a 1:1 that's the same entity as the thread; in a group it isn't.
  const author = ev.sender ?? ev.peer;
  const authorId = String(author.id ?? identifier);
  const authorUsername = author.username ? author.username.replace(/^@/, "") : null;
  const authorName = nameOf(author, authorUsername);

  // Thread label: the group's title, or the person's name for a 1:1.
  const threadName = isGroupLike
    ? (ev.chat?.title || authorName || `Chat ${identifier}`)
    : authorName;

  // Identity resolution keys off the AUTHOR — that's the human we might know.
  // Auto-linking a whole group to one student would be wrong, so groups only
  // resolve/remember the identity, they don't attach the thread to a student.
  const identityOpts = {
    displayName: authorName,
    phone: author.phone ?? null,
    identifierLabel: authorUsername ? `@${authorUsername}` : author.phone ?? null,
  };
  let identity = await resolveIdentity(supabase, "telegram", authorId, identityOpts);
  let linked = !!(identity.studentId || identity.leadId);

  // A group thread stays unlinked; staff attach it manually if it matters.
  const threadStudentId = isGroupLike ? null : identity.studentId;

  const direction = ev.message.out ? "outgoing" : "incoming";
  const externalId = `${identifier}:${ev.message.id}`;
  const sentAt = ev.message.date ? new Date(ev.message.date * 1000) : new Date();
  const createdAt = sentAt.toISOString();

  // De-dupe: the userbot may re-send on reconnect / during backfill.
  const { data: existing } = await supabase
    .from("messages")
    .select("id, message_type, metadata")
    .eq("source", "telegram")
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) {
    // Heal history rather than blindly skipping. Messages mirrored before media
    // storage worked kept their text but lost the file. If this event carries
    // the bytes and the stored row has none, attach them — so re-running the
    // backfill fills in old attachments with nobody deleting and re-importing.
    const already = ((existing as any).metadata ?? {}) as Record<string, any>;
    const carriesMedia = !!(ev.message.media_path || ev.message.media_base64);

    if (carriesMedia && !already.media_path) {
      const m = await resolveMedia(supabase, ev, identifier, externalId);
      if (m.path) {
        const kind = ev.message.media_type ?? already.media_type ?? null;
        const { error: healErr } = await supabase
          .from("messages")
          .update({
            message_type: kind ? (MEDIA_TO_TYPE[kind] ?? "file") : (existing as any).message_type,
            metadata: {
              ...already,
              media_type: kind,
              media_path: m.path,
              media_mime: m.mime ?? already.media_mime ?? null,
              media_size: m.size ?? already.media_size ?? null,
              media_filename: ev.message.media_filename ?? already.media_filename ?? null,
              media_duration: ev.message.media_duration ?? already.media_duration ?? null,
            },
          })
          .eq("id", (existing as any).id);
        if (healErr) throw new Error(`media heal: ${healErr.message}`);
        return { status: "healed", linked };
      }
    }
    return { status: "duplicate", linked };
  }

  // A person writing to us in a private chat is a lead, exactly as an
  // Instagram DM is. ensureIdentity creates it — hidden as unqualified until a
  // phone number arrives, which fn_capture_phone_from_message then reads off
  // this very message: the moment it lands in CRM → Aloqa → "Yangi lid".
  // Only a live, new, incoming 1:1 message does this; staff writing first,
  // groups, saved messages and history replayed by a backfill only look the
  // person up, so old conversations never become new leads.
  const isLive = Date.now() - sentAt.getTime() < LIVE_WINDOW_MS;
  if (!linked && direction === "incoming" && chatType === "private" && isLive) {
    identity = await ensureIdentity(supabase, "telegram", authorId, {
      ...identityOpts,
      leadFields: { contact_channel: "Telegram" },
    });
    linked = !!(identity.studentId || identity.leadId);
  }

  // Thread bookkeeping (atomic; preserves a manual student link).
  const { error: threadErr } = await supabase.rpc("upsert_message_thread", {
    p_source: "telegram",
    p_sender_id: identifier,
    p_sender_name: threadName,
    p_sender_avatar: null,
    p_student_id: threadStudentId,
    p_last_message_at: createdAt,
    p_direction: direction,
  });
  if (threadErr) throw new Error(`thread upsert: ${threadErr.message}`);

  const mediaKind = ev.message.media_type ?? null;
  const messageType = mediaKind ? (MEDIA_TO_TYPE[mediaKind] ?? "file") : "text";

  const media = await resolveMedia(supabase, ev, identifier, externalId);
  const mediaPath = media.path;
  const mediaSize = media.size;
  const mediaMime = media.mime;

  const content = ev.message.text?.trim() ||
    (mediaKind ? (MEDIA_PLACEHOLDER[mediaKind] ?? `[${mediaKind}]`) : "[empty]");

  const metadata = {
    // thread-level
    telegram_chat_id: identifier,
    chat_type: chatType,
    chat_title: ev.chat?.title ?? null,
    // author-level
    telegram_user_id: authorId,
    username: authorUsername,
    phone: author.phone ?? null,
    author_name: authorName,
    lead_id: identity.leadId,
    // resolved student even for groups, so the UI can offer "link this person"
    resolved_student_id: identity.studentId,
    // which staff account mirrored it
    staff_label: ev.account?.label ?? null,
    staff_user_id: ev.account?.staff_user_id ?? null,
    out: !!ev.message.out,
    // media
    media_type: mediaKind,
    media_path: mediaPath,
    media_mime: mediaMime,
    media_filename: ev.message.media_filename ?? null,
    media_duration: ev.message.media_duration ?? null,
    media_size: mediaSize,
    // telegram threading context
    reply_to_msg_id: ev.message.reply_to_msg_id ?? null,
    forwarded_from: ev.message.forwarded_from ?? null,
    edited: !!ev.message.edited,
  };

  // Reconcile CRM-originated sends. When staff reply from the CRM we insert a
  // row immediately (so the UI is instant), then the userbot sends it and the
  // message comes back to us mirrored. Without this we'd store it twice — once
  // as the optimistic CRM row, once as the mirror. Match on the Telegram message
  // id the userbot reported to the outbox and stamp the real ids onto the
  // existing row instead of inserting a second one.
  if (direction === "outgoing") {
    const { data: queued } = await supabase
      .from("telegram_outbox")
      .select("id, message_id")
      .eq("chat_id", identifier)
      .eq("tg_message_id", Number(ev.message.id))
      .not("message_id", "is", null)
      .maybeSingle();

    if (queued?.message_id) {
      const { error: recErr } = await supabase
        .from("messages")
        .update({ external_id: externalId, message_type: messageType, metadata })
        .eq("id", queued.message_id);
      if (recErr) throw new Error(`reconcile update: ${recErr.message}`);
      return { status: "reconciled", linked };
    }
  }

  const { error: msgErr } = await supabase.from("messages").insert({
    source: "telegram",
    external_id: externalId,
    sender_id: identifier,
    // In a group the row shows who actually wrote it; the thread carries the title.
    sender_name: isGroupLike ? (authorName ?? "Unknown") : threadName,
    content,
    message_type: messageType,
    direction,
    status: direction === "incoming" ? "unread" : "read",
    student_id: threadStudentId,
    created_at: createdAt,
    metadata,
  });
  if (msgErr) throw new Error(`message insert: ${msgErr.message}`);

  return { status: "stored", linked };
}

/** Work out where this message's attachment lives, storing it if needed.
 *  Two ways media arrives:
 *    1. media_path   — the userbot already uploaded it via a signed URL
 *                      (preferred; works for video and big documents)
 *    2. media_base64 — small files inlined on the event, stored here */
async function resolveMedia(
  supabase: any,
  ev: IngestEvent,
  identifier: string,
  externalId: string,
): Promise<{ path: string | null; mime: string | null; size: number | null }> {
  if (ev.message.media_path) {
    return {
      path: ev.message.media_path,
      mime: ev.message.media_mime ?? null,
      size: ev.message.media_size ?? null,
    };
  }
  if (ev.message.media_base64) {
    const stored = await storeMedia(supabase, {
      source: "telegram",
      senderId: identifier,
      externalId,
      base64: ev.message.media_base64,
      mime: ev.message.media_mime,
      filename: ev.message.media_filename,
    });
    if (stored) return { path: stored.path, mime: stored.mime, size: stored.size };
  }
  return { path: null, mime: null, size: ev.message.media_size ?? null };
}

/** Best available human name for a Telegram user. */
function nameOf(u: TgUser, username: string | null): string | null {
  return (
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
    (username ? `@${username}` : null) ||
    (u.phone ? `+${String(u.phone).replace(/^\+/, "")}` : null)
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

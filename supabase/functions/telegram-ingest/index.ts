// telegram-ingest
// ----------------------------------------------------------------------------
// Ingestion endpoint for the personal-account Telegram userbot (MTProto). The
// userbot can't run in an Edge Function (it needs a persistent connection), so
// it runs off-platform and POSTs each mirrored message here. This function:
//   * resolves who the chat belongs to (identity spine; auto-links by the
//     student's known phone)
//   * upserts the thread (both directions, unread bookkeeping)
//   * stores the message, de-duplicated by a composite external id
//
// Auth: shared secret in the `x-ingest-secret` header (== TELEGRAM_INGEST_SECRET).
// Accepts a single event or a batch ({ events: [...] }) for backfill.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveIdentity } from "../_shared/identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

interface IngestEvent {
  account?: { staff_user_id?: string | null; label?: string | null };
  peer: {
    id: string | number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  };
  message: {
    id: string | number;
    text?: string | null;
    date?: number | null; // unix seconds
    out?: boolean;
    media_type?: string | null; // image | file | voice | video | ...
    media_base64?: string | null; // raw media bytes (e.g. a voice note), inlined by the userbot
    media_mime?: string | null;
    media_filename?: string | null;
    media_duration?: number | null; // seconds (voice/audio)
  };
}

const MEDIA_TO_TYPE: Record<string, string> = {
  image: "image",
  photo: "image",
  voice: "voice",
  audio: "voice",
  video: "file",
  document: "file",
  file: "file",
};

const CHAT_MEDIA_BUCKET = "chat-media";
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB hard cap

const EXT_BY_MIME: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/webm": "webm",
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
  const errors: string[] = [];

  for (const ev of events) {
    try {
      const r = await ingestOne(supabase, ev);
      if (r.status === "stored") stored++;
      else skipped++;
      if (r.linked) linked++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return json({ ok: true, received: events.length, stored, skipped, linked, errors: errors.slice(0, 10) });
});

async function ingestOne(
  supabase: any,
  ev: IngestEvent,
): Promise<{ status: "stored" | "duplicate"; linked: boolean }> {
  const identifier = String(ev.peer.id);
  const username = ev.peer.username ? ev.peer.username.replace(/^@/, "") : null;
  const displayName =
    [ev.peer.first_name, ev.peer.last_name].filter(Boolean).join(" ").trim() ||
    (username ? `@${username}` : null) ||
    (ev.peer.phone ? `+${String(ev.peer.phone).replace(/^\+/, "")}` : null);
  const identifierLabel = username ? `@${username}` : ev.peer.phone ?? null;

  // Who is this? Exact telegram identity, else auto-link via known phone.
  const identity = await resolveIdentity(supabase, "telegram", identifier, {
    displayName,
    phone: ev.peer.phone ?? null,
    identifierLabel,
  });
  const linked = !!(identity.studentId || identity.leadId);

  const direction = ev.message.out ? "outgoing" : "incoming";
  const externalId = `${identifier}:${ev.message.id}`;
  const createdAt = ev.message.date
    ? new Date(ev.message.date * 1000).toISOString()
    : new Date().toISOString();

  // De-dupe: the userbot may re-send on reconnect / during backfill.
  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("source", "telegram")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existing) return { status: "duplicate", linked };

  // Thread bookkeeping (atomic; preserves a manual student link).
  const { error: threadErr } = await supabase.rpc("upsert_message_thread", {
    p_source: "telegram",
    p_sender_id: identifier,
    p_sender_name: displayName,
    p_sender_avatar: null,
    p_student_id: identity.studentId,
    p_last_message_at: createdAt,
    p_direction: direction,
  });
  if (threadErr) throw new Error(`thread upsert: ${threadErr.message}`);

  const messageType = ev.message.media_type
    ? (MEDIA_TO_TYPE[ev.message.media_type] ?? "file")
    : "text";

  // Persist inlined media bytes (e.g. a voice note) so staff can play it back.
  const media = ev.message.media_base64
    ? await storeMedia(supabase, {
        source: "telegram",
        senderId: identifier,
        externalId,
        base64: ev.message.media_base64,
        mime: ev.message.media_mime,
        filename: ev.message.media_filename,
      })
    : null;

  const content = ev.message.text?.trim() ||
    (ev.message.media_type === "voice"
      ? "🎤 Voice message"
      : ev.message.media_type
      ? `[${ev.message.media_type}]`
      : "[empty]");

  const { error: msgErr } = await supabase.from("messages").insert({
    source: "telegram",
    external_id: externalId,
    sender_id: identifier,
    sender_name: displayName,
    content,
    message_type: messageType,
    direction,
    status: direction === "incoming" ? "unread" : "read",
    student_id: identity.studentId,
    created_at: createdAt,
    metadata: {
      telegram_user_id: identifier,
      username,
      phone: ev.peer.phone ?? null,
      lead_id: identity.leadId,
      staff_label: ev.account?.label ?? null,
      staff_user_id: ev.account?.staff_user_id ?? null,
      out: !!ev.message.out,
      media_type: ev.message.media_type ?? null,
      media_path: media?.path ?? null,
      media_mime: media?.mime ?? ev.message.media_mime ?? null,
      media_duration: ev.message.media_duration ?? null,
      media_size: media?.size ?? null,
    },
  });
  if (msgErr) throw new Error(`message insert: ${msgErr.message}`);

  return { status: "stored", linked };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

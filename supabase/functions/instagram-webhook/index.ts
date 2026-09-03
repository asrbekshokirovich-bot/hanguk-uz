// instagram-webhook — Meta webhook endpoint for Instagram DMs + comments.
// GET  = subscription verification handshake (hub.verify_token).
// POST = event delivery, authenticated via X-Hub-Signature-256 (HMAC-SHA256 with app secret).
// DMs land in messages/message_threads (source='instagram'); comments land in instagram_comments.
//
// NOTE ON HISTORY: what this repo held until 2026-09-03 was an older, simpler
// version of this function that had not run in production for months — the
// deployed one had been edited in the Supabase dashboard and never committed.
// This file is now the deployed implementation, brought back under version
// control, plus the two fixes below. Editing a function in the dashboard means
// the next `supabase functions deploy` from a checkout silently reverts it;
// deploy from the repo.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureIdentity, resolveIdentity } from "../_shared/identity.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CHAT_MEDIA_BUCKET = "chat-media";
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

const MEDIA_TO_TYPE: Record<string, string> = {
  image: "image", video: "file", audio: "voice", file: "file",
  share: "text", story_mention: "text", ig_reel: "text", reel: "text", template: "text", like_heart: "text",
};

async function getConfig(): Promise<any | null> {
  const { data } = await admin.from("instagram_app_config").select("*").eq("id", "main").maybeSingle();
  return data ?? null;
}

async function getAccount(igUserId?: string | null): Promise<any | null> {
  if (igUserId) {
    const { data } = await admin.from("instagram_accounts").select("*").eq("ig_user_id", String(igUserId)).eq("active", true).maybeSingle();
    if (data) return data;
  }
  const { data } = await admin.from("instagram_accounts").select("*").eq("active", true).order("connected_at").limit(1).maybeSingle();
  return data ?? null;
}

async function verifySignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time compare
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

/**
 * Copy an attachment out of Meta's CDN and into our own storage.
 *
 * `payload.url` is a signed CDN link that expires within days, so a picture a
 * student sent worked in the hour it arrived and was a dead link by the time
 * anyone went back to look at it. Both Telegram ingest paths already download
 * into the `chat-media` bucket; this is the same thing, keyed the same way.
 *
 * Best-effort: a failure keeps the message (with the original URL still in
 * metadata) rather than dropping it, and an oversized file is skipped, not
 * truncated.
 */
async function storeMedia(
  igsid: string,
  mid: string,
  index: number,
  att: any,
): Promise<{ path: string; mime: string; size: number } | null> {
  const url = att?.payload?.url;
  if (!url) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`ig media fetch failed for ${mid}: ${res.status}`);
      return null;
    }

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_MEDIA_BYTES) {
      console.warn(`ig media ${mid} too large (${declared}b) — keeping link only`);
      return null;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_MEDIA_BYTES) {
      console.warn(`ig media ${mid} too large (${bytes.byteLength}b) — keeping link only`);
      return null;
    }

    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    const safeSender = igsid.replace(/[^A-Za-z0-9_-]/g, "");
    const safeId = mid.replace(/[^A-Za-z0-9_-]/g, "").slice(-64) || crypto.randomUUID();
    const path = `instagram/${safeSender}/${safeId}-${index}.${extensionFor(mime, att?.type)}`;

    const { error } = await admin.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });

    if (error) {
      console.error("ig media upload failed:", error.message);
      return null;
    }
    return { path, mime, size: bytes.byteLength };
  } catch (e) {
    console.warn("ig media store error:", e);
    return null;
  }
}

function extensionFor(mime: string, attType?: string): string {
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "application/pdf": "pdf",
  };
  if (known[mime]) return known[mime];
  const sub = mime.split("/")[1];
  if (sub && /^[a-z0-9]{1,5}$/.test(sub)) return sub;
  return attType === "audio" ? "m4a" : "bin";
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    const cfg = await getConfig();
    const expected = Deno.env.get("IG_VERIFY_TOKEN") || cfg?.verify_token;
    if (mode === "subscribe" && expected && token === expected) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const raw = await req.text();
  const cfg = await getConfig();
  const appSecret = Deno.env.get("IG_APP_SECRET") || cfg?.app_secret;
  if (appSecret) {
    const sigOk = await verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret);
    if (!sigOk) return new Response("Invalid signature", { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

  // Store raw first, then process — always ACK 200 so Meta doesn't disable the subscription.
  const { data: eventRow } = await admin.from("instagram_webhook_events")
    .insert({ event_kind: classify(body), payload: body, processed: false, error: appSecret ? null : "WARNING: processed without signature check (app_secret not configured)" })
    .select("id").single();

  try {
    await processPayload(body, cfg);
    if (eventRow) await admin.from("instagram_webhook_events").update({ processed: true }).eq("id", eventRow.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("instagram-webhook processing error:", msg);
    if (eventRow) await admin.from("instagram_webhook_events").update({ error: msg }).eq("id", eventRow.id);
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
});

function classify(body: any): string {
  const entry = body?.entry?.[0];
  if (entry?.messaging?.length) {
    const m = entry.messaging[0];
    if (m.message) return "message";
    if (m.reaction) return "reaction";
    if (m.read) return "seen";
    return "messaging_other";
  }
  const field = entry?.changes?.[0]?.field;
  if (field === "comments" || field === "live_comments") return "comment";
  return "other";
}

async function processPayload(body: any, cfg: any): Promise<void> {
  if (body?.object !== "instagram" || !Array.isArray(body?.entry)) return;
  const ver = cfg?.graph_version || "v25.0";
  const errors: string[] = [];

  for (const entry of body.entry) {
    const account = await getAccount(entry?.id ? String(entry.id) : null);

    for (const m of entry?.messaging ?? []) {
      try { await handleMessage(m, account, ver); }
      catch (e) { errors.push(`message: ${e instanceof Error ? e.message : e}`); }
    }
    for (const ch of entry?.changes ?? []) {
      if (ch?.field !== "comments" && ch?.field !== "live_comments") continue;
      try { await handleComment(ch.value, entry, account); }
      catch (e) { errors.push(`comment: ${e instanceof Error ? e.message : e}`); }
    }
  }
  if (errors.length) throw new Error(errors.join(" | "));
}

async function handleMessage(m: any, account: any, ver: string): Promise<void> {
  const msg = m?.message;
  if (!msg || m.reaction || m.read) return; // reactions/read receipts: raw log only
  if (msg.is_deleted) return;

  const isEcho = msg.is_echo === true;
  const partnerRaw = isEcho ? m.recipient?.id : m.sender?.id;
  if (!partnerRaw) return;
  const partnerId = String(partnerRaw);
  const mid = String(msg.mid ?? `${partnerId}:${m.timestamp}`);

  // Dedupe (echoes of messages we sent via API are already inserted by instagram-send).
  const { data: existing } = await admin.from("messages").select("id").eq("source", "instagram").eq("external_id", mid).maybeSingle();
  if (existing) return;

  // Display name: reuse existing thread's name, else fetch profile from Graph (best effort).
  let displayName: string | null = null;
  let username: string | null = null;
  const { data: thread } = await admin.from("message_threads").select("id, sender_name").eq("source", "instagram").eq("sender_id", partnerId).maybeSingle();
  if (thread?.sender_name) displayName = thread.sender_name;
  if (!displayName && account?.access_token) {
    try {
      const r = await fetch(`https://graph.instagram.com/${ver}/${partnerId}?fields=name,username&access_token=${encodeURIComponent(account.access_token)}`);
      if (r.ok) {
        const p = await r.json();
        username = p?.username ?? null;
        displayName = p?.name || (username ? `@${username}` : null);
      }
    } catch { /* best effort */ }
  }
  displayName = displayName ?? `IG ${partnerId.slice(-6)}`;

  // Whose conversation is this? resolveIdentity alone answers "nobody" for
  // every Instagram account, because an IGSID matches no phone, no student and
  // no lead — which is why all 226 of these threads were anonymous. A person
  // who writes to the school is a lead whether or not they typed a phone
  // number, so ensureIdentity creates one on first contact (keyed on
  // source+source_id, so a second message reuses it) and records the mapping.
  //
  // Echoes are OUR outgoing messages: they must resolve the person, never
  // invent one, or a staff reply to a thread nobody answered would create a
  // second lead for the same account.
  const identity = isEcho
    ? await resolveIdentity(admin as any, "instagram", partnerId, {})
    : await ensureIdentity(admin as any, "instagram", partnerId, {
      displayName,
      identifierLabel: username ? `@${username}` : null,
      leadFields: { contact_channel: "instagram" },
    });
  if (identity.displayName && !thread?.sender_name) displayName = identity.displayName;

  const attachments: any[] = Array.isArray(msg.attachments) ? msg.attachments : [];
  const attachType = attachments[0]?.type ?? null;
  const messageType = attachType ? (MEDIA_TO_TYPE[attachType] ?? "file") : "text";
  let content = (msg.text ?? "").trim();
  if (!content && attachments.length) {
    content = attachments.map((a) => `[${a?.type ?? "attachment"}]${a?.payload?.url ? " " + a.payload.url : ""}`).join("\n");
  }
  if (!content) content = "[empty]";

  const direction = isEcho ? "outgoing" : "incoming";
  const createdAt = m.timestamp ? new Date(Number(m.timestamp)).toISOString() : new Date().toISOString();

  const { error: threadErr } = await admin.rpc("upsert_message_thread", {
    p_source: "instagram", p_sender_id: partnerId, p_sender_name: displayName, p_sender_avatar: null,
    p_student_id: identity.studentId, p_last_message_at: createdAt, p_direction: direction,
  });
  if (threadErr) throw new Error(`thread upsert: ${threadErr.message}`);

  // Pull every attachment out of Meta's expiring CDN before storing the row.
  const storedMedia = await Promise.all(
    attachments.map((a, i) => storeMedia(partnerId, mid, i, a)),
  );
  const primary = storedMedia.find((s) => s !== null) ?? null;

  const { error: msgErr } = await admin.from("messages").insert({
    source: "instagram", external_id: mid, sender_id: partnerId, sender_name: displayName,
    content, message_type: messageType, direction,
    status: direction === "incoming" ? "unread" : "read",
    student_id: identity.studentId, created_at: createdAt,
    metadata: {
      igsid: partnerId, mid, username, lead_id: identity.leadId, is_echo: isEcho,
      account_ig_id: account?.ig_user_id ?? null,
      reply_to: msg.reply_to ?? null,
      attachments: attachments.map((a, i) => ({
        type: a?.type ?? null,
        url: a?.payload?.url ?? null,
        media_path: storedMedia[i]?.path ?? null,
        media_mime: storedMedia[i]?.mime ?? null,
        media_size: storedMedia[i]?.size ?? null,
      })),
      // Mirrored at the top level too: the message renderer reads these keys
      // for Telegram media and now finds them for Instagram as well.
      ...(primary ? { media_path: primary.path, media_mime: primary.mime, media_size: primary.size } : {}),
    },
  });
  if (msgErr) throw new Error(`message insert: ${msgErr.message}`);
}

async function handleComment(value: any, entry: any, account: any): Promise<void> {
  if (!value?.id) return;
  const fromId = value?.from?.id ? String(value.from.id) : null;
  const fromUsername = value?.from?.username ?? null;
  const isFromMe = !!(account && fromId && (fromId === String(account.ig_user_id) || (fromUsername && fromUsername === account.username)));

  let identity = { studentId: null as string | null, leadId: null as string | null };
  if (!isFromMe && fromId) {
    const r = await resolveIdentity(admin as any, "instagram", fromId, {
      displayName: fromUsername ? `@${fromUsername}` : null,
      identifierLabel: fromUsername ? `@${fromUsername}` : null,
    });
    identity = { studentId: r.studentId, leadId: r.leadId };
  }

  const ts = value?.timestamp ? new Date(isNaN(Number(value.timestamp)) ? value.timestamp : Number(value.timestamp) * (String(value.timestamp).length <= 10 ? 1000 : 1)).toISOString()
    : entry?.time ? new Date(Number(entry.time) * (String(entry.time).length <= 10 ? 1000 : 1)).toISOString()
    : new Date().toISOString();

  const { error } = await admin.from("instagram_comments").upsert({
    comment_id: String(value.id),
    media_id: value?.media?.id ? String(value.media.id) : null,
    media_product_type: value?.media?.media_product_type ?? null,
    parent_comment_id: value?.parent_id ? String(value.parent_id) : null,
    from_ig_id: fromId,
    from_username: fromUsername,
    text: value?.text ?? null,
    commented_at: ts,
    is_from_me: isFromMe,
    status: isFromMe ? "ignored" : "new",
    student_id: identity.studentId,
    lead_id: identity.leadId,
    raw: value,
  }, { onConflict: "comment_id", ignoreDuplicates: true });
  if (error) throw new Error(`comment upsert: ${error.message}`);
}

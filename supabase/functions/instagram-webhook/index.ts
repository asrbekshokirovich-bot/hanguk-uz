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
import { ensureIdentity, extractHandleFromText, extractPhoneFromText, resolveIdentity } from "../_shared/identity.ts";

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

  // Upkeep, not Meta: the instagram-maintenance cron job, authenticated like
  // instagram-token-refresh (header == instagram_app_config.verify_token).
  const upkeepSecret = req.headers.get("x-maintenance-secret");
  if (upkeepSecret !== null) {
    const expectedSecret = Deno.env.get("IG_VERIFY_TOKEN") || cfg?.verify_token;
    if (!expectedSecret || !sameSecret(upkeepSecret, expectedSecret)) {
      return new Response("Forbidden", { status: 403 });
    }
    const report = await runMaintenance(cfg);
    return new Response(JSON.stringify(report), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  // Fail closed. This used to skip verification entirely when no app secret was
  // configured, so an unauthenticated POST to a known URL was written straight
  // into `messages` and `instagram_comments` — and the only trace was a warning
  // string stashed in a column nobody reads. The secret is configured; a
  // request arriving without a valid signature is not from Meta.
  //
  // Note `getConfig()` swallows its own error, so a transient failure reading
  // instagram_app_config would leave `cfg` null: with the old code that turned
  // signature checking OFF for that request. Now it turns the request away.
  const appSecret = Deno.env.get("IG_APP_SECRET") || cfg?.app_secret;
  if (!appSecret) {
    console.error("instagram-webhook: no app secret available — refusing to process unverified payload");
    return new Response("Signature verification unavailable", { status: 503 });
  }
  const sigOk = await verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret);
  if (!sigOk) return new Response("Invalid signature", { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

  // Store raw first, then process — always ACK 200 so Meta doesn't disable the subscription.
  const { data: eventRow } = await admin.from("instagram_webhook_events")
    .insert({ event_kind: classify(body), payload: body, processed: false })
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
    if (m.message_edit) return "message_edit";
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
  // An edit or an unsend changes a message we have; both used to be ignored,
  // so the CRM kept showing text the person had changed or taken back.
  if (m?.message_edit?.mid) return await applyEdit(String(m.message_edit.mid), m.message_edit.text ?? null);
  const msg = m?.message;
  if (!msg || m.reaction || m.read) return; // reactions/read receipts: raw log only
  if (msg.is_deleted) return await markDeleted(String(msg.mid ?? ""));

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
  // A thread still named "IG xxxxxx" never got its profile: ask again.
  const knownName = thread?.sender_name && !isPlaceholderName(partnerId, thread.sender_name) ? thread.sender_name : null;
  if (knownName) displayName = knownName;
  if (!displayName) {
    const profile = await fetchProfile(partnerId, account, ver);
    if (profile) {
      username = profile.username;
      displayName = profile.name;
      if (thread?.sender_name) await renameEverywhere(partnerId, profile);
    }
  }
  displayName = displayName ?? placeholderName(partnerId);

  // Whose conversation is this? resolveIdentity alone answers "nobody" for
  // every Instagram account, because an IGSID matches no phone, no student and
  // no lead — which is why all 226 of these threads were anonymous. A person
  // who writes to the school is a lead whether or not they typed a phone
  // number, so ensureIdentity creates one on first contact (keyed on
  // source+source_id, so a second message reuses it) and records the mapping.
  //
  // But check the phone FIRST: a large share of Instagram DMs open with a
  // Meta lead-ad form reply ("Full name: ... / Phone number: ...") typed
  // right into the message text, and that customer very often already has a
  // lead from a call or the intake form. Without this, ensureIdentity had no
  // phone to try and created a second, empty lead every time — the split
  // this session spent 2026-09-22 cleaning up by hand for ~85 people. Passing
  // the typed number in lets resolveIdentity (inside ensureIdentity) find
  // that existing lead and reuse it; only a genuinely new phone, or no phone
  // at all, still creates a fresh one.
  //
  // Same idea for a Telegram handle ("telegramim @asilbek123"): if we
  // already have a real Telegram identity under that @handle — meaning they
  // actually wrote to us there before — this is the same person, so reuse
  // that lead/student instead of the phone-only check leaving it to create
  // a new one. A handle nobody has written to us from yet matches nothing
  // and is quietly skipped, same as a phone that matches no one.
  const typedPhone = isEcho ? null : extractPhoneFromText(msg.text);
  const typedTgHandle = isEcho ? null : extractHandleFromText(msg.text);

  // Echoes are OUR outgoing messages: they must resolve the person, never
  // invent one, or a staff reply to a thread nobody answered would create a
  // second lead for the same account.
  const identity = isEcho
    ? await resolveIdentity(admin as any, "instagram", partnerId, {})
    : await ensureIdentity(admin as any, "instagram", partnerId, {
      displayName,
      phone: typedPhone,
      crossHandle: typedTgHandle ? { channel: "telegram", handle: typedTgHandle } : null,
      identifierLabel: username ? `@${username}` : null,
      leadFields: { contact_channel: "instagram" },
    });
  if (identity.displayName && !knownName && !isPlaceholderName(partnerId, identity.displayName)) displayName = identity.displayName;

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
  const autoReply = isEcho ? await isInstantReply(partnerId, createdAt) : false;

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
      ...(autoReply ? { auto_reply: "instant" } : {}),
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

/** The new text on the stored message; the first version stays in metadata. */
async function applyEdit(mid: string, text: string | null): Promise<void> {
  const { data: row } = await admin.from("messages").select("id, content, metadata")
    .eq("source", "instagram").eq("external_id", mid).maybeSingle();
  const after = text?.trim() || null;
  if (!row || !after || after === row.content) return;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.from("messages").update({
    content: after,
    metadata: {
      ...meta,
      edited: true,
      edited_at: new Date().toISOString(),
      original_content: meta.original_content ?? row.content,
    },
  }).eq("id", row.id);
  if (error) throw new Error(`edit update: ${error.message}`);
}

/** Unsent by the person: kept for the record, shown as deleted. */
async function markDeleted(mid: string): Promise<void> {
  if (!mid) return;
  const { data: row } = await admin.from("messages").select("id, metadata")
    .eq("source", "instagram").eq("external_id", mid).maybeSingle();
  if (!row) return;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  if (meta.deleted) return;
  const { error } = await admin.from("messages").update({
    metadata: { ...meta, deleted: true, deleted_at: new Date().toISOString() },
  }).eq("id", row.id);
  if (error) throw new Error(`delete mark: ${error.message}`);
}

/** Faster than anyone types: an echo this soon after the person's message. */
const INSTANT_REPLY_MS = 3000;

/**
 * An echo that left within 3 seconds of the person's message was sent by a
 * machine — Meta's instant reply, a saved-reply or lead-form flow — not by
 * staff in the Instagram app (those flows answered in about a second until
 * 2026-09-15). Marked auto_reply, it does not count as an answer, so the lead
 * stays in "Yangi lid" (fn_is_automatic_outgoing).
 *
 * Messages sent from the CRM never get here: instagram-send stores them
 * first, and their echo is dropped as a duplicate above.
 */
async function isInstantReply(partnerId: string, sentAt: string): Promise<boolean> {
  const { data: last } = await admin.from("messages")
    .select("created_at")
    .eq("source", "instagram")
    .eq("sender_id", partnerId)
    .eq("direction", "incoming")
    .lte("created_at", sentAt)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last?.created_at) return false;
  return new Date(sentAt).getTime() - new Date(last.created_at).getTime() <= INSTANT_REPLY_MS;
}

async function handleComment(value: any, entry: any, account: any): Promise<void> {
  if (!value?.id) return;
  const fromId = value?.from?.id ? String(value.from.id) : null;
  const fromUsername = value?.from?.username ?? null;
  const isFromMe = !!(account && fromId && (fromId === String(account.ig_user_id) || (fromUsername && fromUsername === account.username)));

  let identity = { studentId: null as string | null, leadId: null as string | null };
  if (!isFromMe && fromId) {
    // Lead module v2 (spec §3.2, F2): somebody who comments is a lead, like
    // somebody who writes a DM — ensureIdentity finds the person's card or
    // creates it (keyed on the commenter's Instagram scoped id, the same key a
    // DM from them uses, so a later DM lands on the same card), and the
    // database starts the 10-minute timer on the insert. Our own comments never
    // reach this branch.
    const r = await ensureIdentity(admin as any, "instagram", fromId, {
      displayName: fromUsername ? `@${fromUsername}` : null,
      identifierLabel: fromUsername ? `@${fromUsername}` : null,
      leadFields: { contact_channel: "instagram", ...(fromUsername ? { instagram_handle: String(fromUsername).toLowerCase() } : {}) },
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

  if (!isFromMe) await recordSocialComment(value, fromId, fromUsername, ts, identity.leadId);
}

/**
 * The comment for the comments panel (spec §3.2): a social_comments row, linked
 * to the commenter's lead. Idempotent on (platform, comment_id): this inserts
 * and treats "already there" (23505) as done.
 */
async function recordSocialComment(
  value: any,
  fromId: string | null,
  fromUsername: string | null,
  ts: string,
  leadId: string | null,
): Promise<void> {
  const { error } = await admin.from("social_comments").insert({
    platform: "instagram",
    post_id: value?.media?.id ? String(value.media.id) : null,
    post_label: value?.media?.media_product_type ? String(value.media.media_product_type).toLowerCase() : null,
    comment_id: String(value.id),
    author_username: fromUsername,
    author_id: fromId,
    text: value?.text ?? null,
    created_at: ts,
    lead_id: leadId,
  });
  if (error) {
    if (error.code === "23505") return; // the same comment delivered twice
    throw new Error(`social comment insert: ${error.message}`);
  }

  // A commenter who already had a card (an answered DM lead) wrote again: tell
  // the engine, which starts the right timer unless one is already running. A
  // brand-new lead already has its first-contact timer from the insert trigger.
  // Old comments (a replayed delivery) never start one.
  if (leadId && Date.now() - Date.parse(ts) < 30 * 60_000) {
    const { error: reErr } = await admin.rpc("lead_reengage", { p_lead_id: leadId, p_at: ts });
    if (reErr) console.error("lead_reengage failed:", reErr.message);
  }
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** The name a person gets while their profile cannot be read. */
function placeholderName(igsid: string): string {
  return `IG ${igsid.slice(-6)}`;
}

function isPlaceholderName(igsid: string, name: string | null | undefined): boolean {
  return !name || name === placeholderName(igsid);
}

/** Name and @username from the person's profile, or null when Meta won't say. */
async function fetchProfile(
  igsid: string,
  account: any,
  ver: string,
): Promise<{ name: string; username: string | null } | null> {
  if (!account?.access_token) return null;
  try {
    const r = await fetch(`https://graph.instagram.com/${ver}/${igsid}?fields=name,username&access_token=${encodeURIComponent(account.access_token)}`);
    if (!r.ok) return null;
    const p = await r.json();
    const username = p?.username ?? null;
    const name = p?.name || (username ? `@${username}` : null);
    return name ? { name, username } : null;
  } catch {
    return null;
  }
}

/**
 * A profile that could not be read once used to keep "IG xxxxxx" for good: the
 * thread kept the placeholder, every later message reused it and nobody asked
 * again. Once the profile reads, the placeholder is replaced wherever it
 * stands — never a name staff typed over it.
 */
async function renameEverywhere(igsid: string, profile: { name: string; username: string | null }): Promise<void> {
  const old = placeholderName(igsid);
  const label = profile.username ? `@${profile.username}` : null;
  const updates = [
    admin.from("message_threads").update({ sender_name: profile.name })
      .eq("source", "instagram").eq("sender_id", igsid).eq("sender_name", old),
    admin.from("messages").update({ sender_name: profile.name })
      .eq("source", "instagram").eq("sender_id", igsid).eq("sender_name", old),
    admin.from("leads").update({ full_name: profile.name })
      .eq("source", "instagram").eq("source_id", igsid).eq("full_name", old),
    admin.from("communication_identities").update({ display_name: profile.name })
      .eq("channel", "instagram").eq("identifier", igsid).eq("display_name", old),
  ];
  if (label) {
    updates.push(
      admin.from("communication_identities").update({ identifier_label: label })
        .eq("channel", "instagram").eq("identifier", igsid).is("identifier_label", null),
    );
  }
  for (const { error } of await Promise.all(updates)) {
    if (error) console.error("instagram rename:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Upkeep (cron: instagram-maintenance, every 15 minutes)
// ---------------------------------------------------------------------------

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A failed event is tried again this many times, then left for a person. */
const MAX_EVENT_RETRIES = 5;
/** Placeholder names asked again per run — one profile request each. */
const RENAMES_PER_RUN = 15;
const MAX_PROFILE_ATTEMPTS = 7;
/** How far back a sync reads when it has never run, and at most after a gap. */
const FIRST_SYNC_LOOKBACK_MS = 60 * 60 * 1000;
const MAX_SYNC_LOOKBACK_MS = 48 * 60 * 60 * 1000;
/** Each run re-reads a little of the previous one, so nothing falls between. */
const SYNC_OVERLAP_MS = 10 * 60 * 1000;

async function runMaintenance(cfg: any): Promise<Record<string, unknown>> {
  const ver = cfg?.graph_version || "v25.0";
  const report: Record<string, unknown> = {};
  for (const [name, step] of [
    ["retried", () => retryFailedEvents(cfg)],
    ["synced", () => syncConversations(ver)],
    ["renamed", () => refreshPlaceholderNames(ver)],
  ] as const) {
    try {
      report[name] = await step();
    } catch (e) {
      report[name] = { error: e instanceof Error ? e.message : String(e) };
      console.error(`instagram maintenance ${name}:`, report[name]);
    }
  }
  return report;
}

/**
 * Events whose processing failed were acknowledged to Meta (it would disable
 * the subscription otherwise), so Meta never sends them again. Run them again
 * here; handleMessage skips a message it already stored, so a retry is safe.
 */
async function retryFailedEvents(cfg: any): Promise<number> {
  const { data: failed, error } = await admin.from("instagram_webhook_events")
    .select("id, payload, retries")
    .eq("processed", false)
    .not("error", "is", null)
    .lt("retries", MAX_EVENT_RETRIES)
    .gte("created_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at")
    .limit(50);
  if (error) throw new Error(`failed events: ${error.message}`);

  let fixed = 0;
  for (const row of failed ?? []) {
    try {
      await processPayload((row as any).payload, cfg);
      await admin.from("instagram_webhook_events").update({ processed: true, error: null }).eq("id", (row as any).id);
      fixed++;
    } catch (e) {
      await admin.from("instagram_webhook_events").update({
        error: e instanceof Error ? e.message : String(e),
        retries: Number((row as any).retries ?? 0) + 1,
      }).eq("id", (row as any).id);
    }
  }
  return fixed;
}

/**
 * The webhook is the only way Instagram messages arrive; when Meta stops
 * delivering (a subscription dropped, an outage) nothing else would notice the
 * gap. Read the recent conversations from the API and store whatever the
 * webhook missed, through the same handleMessage — so a missed first message
 * still makes its lead.
 */
async function syncConversations(ver: string): Promise<number> {
  const { data: state } = await admin.from("instagram_sync_state").select("last_success_at").eq("id", "main").maybeSingle();
  const now = Date.now();
  const lastOk = state?.last_success_at ? new Date(state.last_success_at).getTime() : now - FIRST_SYNC_LOOKBACK_MS;
  const since = Math.max(lastOk - SYNC_OVERLAP_MS, now - MAX_SYNC_LOOKBACK_MS);

  const { data: accounts } = await admin.from("instagram_accounts").select("*").eq("active", true);
  let stored = 0;
  try {
    for (const account of accounts ?? []) {
      stored += await syncAccount(account, ver, since);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("instagram_sync_state").upsert({
      id: "main", last_run_at: new Date(now).toISOString(), last_error: msg.slice(0, 500),
    });
    throw e;
  }
  await admin.from("instagram_sync_state").upsert({
    id: "main",
    last_run_at: new Date(now).toISOString(),
    last_success_at: new Date(now).toISOString(),
    last_error: null,
  });
  return stored;
}

async function graphGet(url: string): Promise<any> {
  const r = await fetch(url);
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`graph ${r.status}: ${JSON.stringify(body?.error ?? body).slice(0, 300)}`);
  return body;
}

async function syncAccount(account: any, ver: string, since: number): Promise<number> {
  if (!account?.access_token) return 0;
  const token = encodeURIComponent(account.access_token);
  const me = String(account.ig_user_id ?? "");
  let stored = 0;

  // Newest first; stop paging at the first conversation older than `since`.
  let url: string | null =
    `https://graph.instagram.com/${ver}/me/conversations?platform=instagram&fields=id,updated_time&limit=25&access_token=${token}`;
  const conversations: string[] = [];
  for (let page = 0; url && page < 8; page++) {
    const body = await graphGet(url);
    let older = false;
    for (const c of body?.data ?? []) {
      if (new Date(c.updated_time).getTime() < since) { older = true; break; }
      conversations.push(String(c.id));
    }
    url = older ? null : body?.paging?.next ?? null;
  }

  for (const id of conversations) {
    const body = await graphGet(
      `https://graph.instagram.com/${ver}/${id}?fields=messages.limit(25){id,created_time,from,to,message,attachments}&access_token=${token}`,
    );
    const messages = (body?.messages?.data ?? [])
      .filter((m: any) => new Date(m.created_time).getTime() >= since)
      .sort((a: any, b: any) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime());

    for (const m of messages) {
      const fromId = String(m.from?.id ?? "");
      const isEcho = (!!me && fromId === me) || (!!account.username && m.from?.username === account.username);
      const partnerId = isEcho ? String(m.to?.data?.[0]?.id ?? "") : fromId;
      if (!partnerId) continue;
      const at = new Date(m.created_time).getTime();
      const text = (m.message ?? "").trim();
      if (await alreadyStored(partnerId, isEcho ? "outgoing" : "incoming", at, text)) continue;

      await handleMessage({
        sender: { id: isEcho ? me : partnerId },
        recipient: { id: isEcho ? partnerId : me },
        timestamp: at,
        message: {
          mid: String(m.id),
          text: m.message ?? undefined,
          is_echo: isEcho,
          attachments: toWebhookAttachments(m.attachments?.data ?? []),
        },
      }, account, ver);
      stored++;
    }
  }
  return stored;
}

/**
 * The webhook stored the message under its own id; the conversations API may
 * report another. Same person, same direction, same text within 5 seconds is
 * the same message.
 */
async function alreadyStored(partnerId: string, direction: string, at: number, text: string): Promise<boolean> {
  let q = admin.from("messages").select("id")
    .eq("source", "instagram")
    .eq("sender_id", partnerId)
    .eq("direction", direction)
    .gte("created_at", new Date(at - 5000).toISOString())
    .lte("created_at", new Date(at + 5000).toISOString());
  if (text) q = q.eq("content", text);
  const { data } = await q.limit(1).maybeSingle();
  return !!data;
}

/** The conversations API's attachment shapes, as the webhook delivers them. */
function toWebhookAttachments(list: any[]): any[] {
  return list.map((a: any) => {
    if (a?.image_data?.url) return { type: "image", payload: { url: a.image_data.url } };
    if (a?.video_data?.url) return { type: "video", payload: { url: a.video_data.url } };
    if (a?.audio_data?.url) return { type: "audio", payload: { url: a.audio_data.url } };
    if (a?.file_url) return { type: "file", payload: { url: a.file_url } };
    return { type: a?.type ?? "file", payload: { url: a?.url ?? null } };
  });
}

/** Ask again for the profiles that are still "IG xxxxxx". */
async function refreshPlaceholderNames(ver: string): Promise<number> {
  const { data: threads, error } = await admin.from("message_threads")
    .select("sender_id, sender_name")
    .eq("source", "instagram")
    .like("sender_name", "IG %")
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`placeholder threads: ${error.message}`);

  // A profile that would not read is asked again a day later, at most
  // MAX_PROFILE_ATTEMPTS times (a deleted account never reads).
  const ids = (threads ?? [])
    .map((t: any) => String(t.sender_id))
    .filter((id, i) => isPlaceholderName(id, (threads as any[])[i].sender_name));
  if (!ids.length) return 0;
  const { data: checks } = await admin.from("instagram_profile_checks")
    .select("igsid, attempts, checked_at").in("igsid", ids);
  const byId = new Map((checks ?? []).map((c: any) => [String(c.igsid), c]));
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const due = ids.filter((id) => {
    const c = byId.get(id);
    return !c || (c.attempts < MAX_PROFILE_ATTEMPTS && new Date(c.checked_at).getTime() < dayAgo);
  }).slice(0, RENAMES_PER_RUN);

  const account = await getAccount(null);
  let renamed = 0;
  for (const igsid of due) {
    const profile = await fetchProfile(igsid, account, ver);
    await admin.from("instagram_profile_checks").upsert({
      igsid,
      attempts: Number(byId.get(igsid)?.attempts ?? 0) + 1,
      checked_at: new Date().toISOString(),
      found: !!profile,
    });
    if (!profile) continue;
    await renameEverywhere(igsid, profile);
    renamed++;
  }
  return renamed;
}

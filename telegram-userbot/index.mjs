// Hanguk Telegram userbot.
//
// Logs in as one or more PERSONAL Telegram accounts (MTProto) and carries the
// CRM's Telegram traffic in both directions:
//
//   inbound   every 1:1 chat message — incoming and the account's own outgoing
//             replies — is POSTed to the `telegram-ingest` edge function, which
//             resolves the student/lead (auto-linking by known phone) and stores it.
//   outbound  replies written in the CRM inbox are claimed from the
//             `telegram-outbox` queue and sent AS the account.
//   liveness  a heartbeat every minute, so a dead session is visible instead of
//             a silent inbox. On 2026-07-28 this process stopped and nobody
//             noticed for a week; that is what the heartbeat is for.
//
// Sending as the account is the point. The supported alternative, a bot
// connected via Telegram Business, makes Telegram's Android app open the BOT
// when anyone adds the account's phone number as a contact
// (bugs.telegram.org/c/65751). No bot is connected on this path, so that
// cannot happen.
//
//   LOGIN_MODE=1  -> serves the browser login page (one-time, get a session)
//   otherwise     -> runs the bot
//
// Run: `npm start`   ·   First-time backfill: `npm run backfill`
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { CustomFile } from "telegram/client/uploads.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const ingestUrl = process.env.INGEST_URL;
const ingestSecret = process.env.TELEGRAM_INGEST_SECRET;

// The queue lives next to the ingest function, so derive it rather than asking
// for a second URL that can only ever be wrong if it differs.
const outboxUrl = process.env.OUTBOX_URL
  || (ingestUrl ? ingestUrl.replace(/telegram-ingest\/?$/, "telegram-outbox") : null);

const outboxPollMs = Number(process.env.OUTBOX_POLL_MS || 3000);
const heartbeatMs = Number(process.env.HEARTBEAT_MS || 60_000);
/** Replies are text or a document; anything larger than this is a mistake upstream. */
const MAX_OUTBOUND_BYTES = 50 * 1024 * 1024;

const backfillOnStart = process.env.BACKFILL_ON_START === "1";
const backfillDialogs = Number(process.env.BACKFILL_DIALOGS || 50);
const backfillPerChat = Number(process.env.BACKFILL_LIMIT || 100);

/** Accounts come from TG_ACCOUNTS (JSON) or a single TG_SESSION. */
function loadAccounts() {
  if (process.env.TG_ACCOUNTS) {
    const arr = JSON.parse(process.env.TG_ACCOUNTS);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error("TG_ACCOUNTS must be a non-empty JSON array");
    return arr.map((a, i) => ({ label: a.label || `account_${i + 1}`, staffUserId: a.staffUserId ?? null, session: a.session }));
  }
  if (process.env.TG_SESSION) {
    return [{ label: process.env.TG_LABEL || "default", staffUserId: process.env.TG_STAFF_USER_ID || null, session: process.env.TG_SESSION }];
  }
  throw new Error("Set TG_SESSION (from login) or TG_ACCOUNTS.");
}

const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10MB — voice notes are tiny; this keeps the ingest payload sane.

function mediaType(message) {
  const m = message.media;
  if (!m) return null;
  const cls = m.className || "";
  if (cls.includes("Photo")) return "photo";
  if (cls.includes("Document")) {
    const attrs = m.document?.attributes || [];
    if (attrs.some((a) => a.className === "DocumentAttributeAudio" && a.voice)) return "voice";
    if (attrs.some((a) => a.className === "DocumentAttributeVideo")) return "video";
    return "document";
  }
  return "media";
}

/** Length (seconds) of a voice/audio document, if Telegram reported it. */
function voiceDuration(message) {
  const attrs = message.media?.document?.attributes || [];
  const audio = attrs.find((a) => a.className === "DocumentAttributeAudio");
  return audio?.duration ?? null;
}

function voiceMime(message) {
  return message.media?.document?.mimeType || "audio/ogg";
}

/** Download a voice note's bytes and inline them (base64) onto the event so the
 *  ingest function can store them. Best-effort: on any failure we just mirror
 *  the message without audio. Only voice is fetched (keeps payloads small). */
async function attachMedia(client, message, event) {
  if (event.message.media_type !== "voice") return event;
  try {
    const buf = await client.downloadMedia(message, {});
    if (buf && buf.length && buf.length <= MAX_MEDIA_BYTES) {
      event.message.media_base64 = Buffer.from(buf).toString("base64");
      event.message.media_mime = voiceMime(message);
      event.message.media_duration = voiceDuration(message);
    }
  } catch (e) {
    console.error("media download failed:", e?.message || e);
  }
  return event;
}

function toEvent(account, peer, message) {
  return {
    account: { label: account.label, staff_user_id: account.staffUserId ?? null },
    peer: {
      id: String(peer.id),
      username: peer.username ?? null,
      first_name: peer.firstName ?? null,
      last_name: peer.lastName ?? null,
      phone: peer.phone ?? null,
    },
    message: {
      id: message.id,
      text: message.message ?? "",
      date: message.date ?? null,
      out: !!message.out,
      media_type: mediaType(message),
    },
  };
}

async function postEvents(events) {
  if (!events.length) return;
  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-secret": ingestSecret },
      body: JSON.stringify(events.length === 1 ? events[0] : { events }),
    });
    if (!res.ok) console.error("ingest non-200:", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error("ingest post failed:", e?.message || e);
  }
}

/** True for a real 1:1 human chat we want to mirror. */
function isMirrorablePeer(peer, selfId) {
  return peer && peer.className === "User" && !peer.bot && String(peer.id) !== selfId;
}

async function backfill(client, account, selfId) {
  console.log(`[${account.label}] backfilling up to ${backfillPerChat} msgs across ${backfillDialogs} chats…`);
  const dialogs = await client.getDialogs({ limit: backfillDialogs });
  for (const dlg of dialogs) {
    const peer = dlg.entity;
    if (!isMirrorablePeer(peer, selfId)) continue;
    try {
      const msgs = await client.getMessages(peer, { limit: backfillPerChat });
      const raw = msgs.filter((m) => m && (m.message || m.media));
      const events = [];
      for (const m of raw) events.push(await attachMedia(client, m, toEvent(account, peer, m)));
      events.reverse(); // oldest first so threads order naturally
      // Size-aware posting: a media-bearing event (base64 audio) goes on its own
      // so a backfill batch never balloons past the ingest request limit.
      let batch = [];
      for (const ev of events) {
        if (ev.message.media_base64) {
          if (batch.length) { await postEvents(batch); batch = []; }
          await postEvents([ev]);
        } else {
          batch.push(ev);
          if (batch.length >= 200) { await postEvents(batch); batch = []; }
        }
      }
      if (batch.length) await postEvents(batch);
    } catch (e) {
      console.error(`[${account.label}] backfill chat ${peer?.id}:`, e?.message || e);
    }
  }
  console.log(`[${account.label}] backfill done.`);
}

// ---------------------------------------------------------------- outbound
//
// The CRM cannot call this process: it runs off-platform, usually behind NAT.
// So the queue is polled instead of pushed, and every row is claimed
// atomically by `claim_telegram_outbox` — two workers can never take the same
// reply and send it twice.

async function postOutbox(action, payload) {
  if (!outboxUrl) return null;
  try {
    const res = await fetch(outboxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-secret": ingestSecret },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) {
      console.error(`outbox ${action} non-200:`, res.status, (await res.text()).slice(0, 200));
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`outbox ${action} failed:`, e?.message || e);
    return null;
  }
}

/**
 * Turn a chat id from the queue into something MTProto can address.
 *
 * GramJS resolves an id only if the entity is in its session cache, and a
 * freshly restored session starts empty — so the first reply after a restart
 * would fail with "Could not find the input entity". Pulling the dialog list
 * once fills the cache with every chat the account actually has, which is
 * exactly the set the CRM can be replying to.
 */
async function resolvePeer(client, chatId) {
  const id = Number(chatId);
  if (!Number.isSafeInteger(id)) throw new Error(`unusable chat_id: ${chatId}`);
  try {
    return await client.getInputEntity(id);
  } catch (_first) {
    if (!client._hangukDialogsPrimed) {
      await client.getDialogs({ limit: 200 }).catch(() => {});
      client._hangukDialogsPrimed = true;
    }
    return await client.getInputEntity(id);
  }
}

/** Send one queued reply. Returns the Telegram message id. */
async function sendOutboxRow(client, row) {
  const peer = await resolvePeer(client, row.chat_id);
  const replyTo = row.reply_to_msg_id ? Number(row.reply_to_msg_id) : undefined;

  if (!row.media_path) {
    if (!row.text) throw new Error("row has neither text nor media");
    const sent = await client.sendMessage(peer, { message: String(row.text), replyTo });
    return sent.id;
  }

  // The claim response carries a short-lived signed URL, so this process never
  // holds storage credentials.
  if (!row.media_url) throw new Error("attachment has no signed URL");
  const res = await fetch(row.media_url);
  if (!res.ok) throw new Error(`attachment fetch failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_OUTBOUND_BYTES) {
    throw new Error(`attachment too large: ${bytes.length} bytes`);
  }

  const mime = String(row.media_mime || "application/octet-stream");
  const name = row.media_filename || row.media_path.split("/").pop() || "file";
  // Same distinction the bot path makes: a voice note sent as a document
  // arrives as a file to download instead of a playable bubble.
  const voiceNote = mime.startsWith("audio/ogg");
  const sent = await client.sendFile(peer, {
    file: new CustomFile(name, bytes.length, "", bytes),
    caption: row.text ? String(row.text) : undefined,
    forceDocument: !voiceNote && !mime.startsWith("image/") && !mime.startsWith("video/"),
    voiceNote,
    replyTo,
  });
  return sent.id;
}

/**
 * Claim and send whatever is waiting, reporting each outcome individually.
 *
 * One bad row must not stall the queue behind it, so every send is reported on
 * its own; `complete_telegram_outbox` decides whether a failure goes back to
 * pending for another attempt or is given up on.
 */
async function drainOutbox(client, account) {
  const claimed = await postOutbox("claim", { account_label: account.label, limit: 10 });
  const rows = claimed?.rows ?? [];
  for (const row of rows) {
    try {
      const tgMessageId = await sendOutboxRow(client, row);
      await postOutbox("complete", { id: row.id, ok: true, tg_message_id: tgMessageId });
      console.log(`[${account.label}] sent outbox ${row.id} -> chat ${row.chat_id} msg ${tgMessageId}`);
    } catch (e) {
      const error = e?.errorMessage || e?.message || String(e);
      await postOutbox("complete", { id: row.id, ok: false, error });
      console.error(`[${account.label}] outbox ${row.id} failed:`, error);
    }
  }
  return rows.length;
}

/** Poll the queue, never letting two drains overlap. */
function startOutboxLoop(client, account) {
  if (!outboxUrl) {
    console.warn(`[${account.label}] no OUTBOX_URL — this account can receive but not send.`);
    return null;
  }
  let running = false;
  return setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await drainOutbox(client, account);
    } catch (e) {
      console.error(`[${account.label}] outbox loop:`, e?.message || e);
    } finally {
      running = false;
    }
  }, outboxPollMs);
}

/**
 * Say "still here" on a timer.
 *
 * This doubles as the keepalive: `getMe` is a real round-trip, so a heartbeat
 * that reaches the CRM proves the MTProto session is alive rather than that
 * the process merely has not crashed — which is the distinction that was
 * missing when this stopped on 2026-07-28.
 */
function startHeartbeat(client, account, me) {
  const beat = async () => {
    let detail = null;
    try {
      await client.getMe();
    } catch (e) {
      detail = `getMe failed: ${e?.message || e}`;
      console.error(`[${account.label}] keepalive:`, detail);
    }
    await postOutbox("heartbeat", {
      account_label: account.label,
      tg_user_id: String(me.id),
      username: me.username ?? null,
      detail,
    });
  };
  beat();
  return setInterval(beat, heartbeatMs);
}

async function startAccount(account) {
  const client = new TelegramClient(new StringSession(account.session), apiId, apiHash, {
    connectionRetries: 5,
    autoReconnect: true,
  });
  await client.connect();
  if (!(await client.checkAuthorization())) {
    console.error(`[${account.label}] session is not authorized — log in again for this account.`);
    return null;
  }
  const me = await client.getMe();
  const selfId = String(me.id);
  console.log(`[${account.label}] connected as ${me.username ? "@" + me.username : me.firstName} (${selfId})`);

  // Fill the entity cache before listening, or nothing will be mirrored.
  //
  // Telegram delivers a private message as `UpdateShortMessage`, which carries
  // the peer's id and nothing else. `message.getChat()` then has to look that
  // peer up, and on a freshly restored session the cache is empty, so it
  // returns undefined — which `isMirrorablePeer` rejects, dropping the message
  // with no error and no log. Every incoming message vanished exactly that way
  // until the dialog list was pulled once. Pulling it here is what fills the
  // cache, and it is the same set of chats the account can receive from.
  await client.getDialogs({ limit: 200 })
    .then(() => { client._hangukDialogsPrimed = true; })
    .catch((e) => console.error(`[${account.label}] could not prime dialogs:`, e?.message || e));

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message || !message.isPrivate) return; // 1:1 chats only
      const peer = await message.getChat();
      // Say so rather than dropping it silently. An unresolvable chat is the
      // failure that cost an evening: the mirror looked healthy, the logs were
      // empty, and every message was going in the bin one line below this.
      if (!peer) {
        console.error(
          `[${account.label}] message ${message.id} skipped: chat could not be resolved`,
        );
        return;
      }
      if (!isMirrorablePeer(peer, selfId)) return;
      // Named `payload`, not `event`. It used to be `const event`, which is
      // block-scoped and so shadowed the parameter for the whole try — making
      // `event.message` on the first line read the not-yet-initialised inner
      // binding. Every live message threw "Cannot access 'event' before
      // initialization" into the catch below, so real-time mirroring never
      // worked at all; only `npm run backfill`, which takes another path, did.
      const payload = await attachMedia(client, message, toEvent(account, peer, message));
      await postEvents([payload]);
    } catch (e) {
      console.error(`[${account.label}] handler error:`, e?.message || e);
    }
  }, new NewMessage({ incoming: true, outgoing: true }));

  if (backfillOnStart) await backfill(client, account, selfId);

  // The heartbeat replaces the old bare keepalive: same getMe round-trip, but
  // the result is reported, so a session that dies is visible in the CRM.
  const timers = [startHeartbeat(client, account, me), startOutboxLoop(client, account)];
  client._hangukTimers = timers.filter(Boolean);
  return client;
}

async function runBot() {
  for (const [k, v] of Object.entries({ TELEGRAM_API_ID: apiId, TELEGRAM_API_HASH: apiHash, INGEST_URL: ingestUrl, TELEGRAM_INGEST_SECRET: ingestSecret })) {
    if (!v) { console.error(`Missing required env var: ${k}`); process.exit(1); }
  }

  const accounts = loadAccounts();
  const clients = [];
  for (const acc of accounts) {
    const c = await startAccount(acc);
    if (c) clients.push(c);
  }
  if (clients.length === 0) {
    console.error("No accounts connected. Exiting.");
    process.exit(1);
  }
  console.log(`Userbot running for ${clients.length} account(s). Listening for messages…`);

  async function shutdown() {
    console.log("Shutting down…");
    // Stop the timers first. A poll that fires mid-disconnect would claim rows
    // this process can no longer send, leaving them 'sending' until they age
    // out — a reply the operator watched leave the CRM and never arrive.
    for (const c of clients) for (const t of c._hangukTimers ?? []) clearInterval(t);
    for (const c of clients) await c.disconnect().catch(() => {});
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise(() => {}); // keep the process alive
}

// ---- Entry point -----------------------------------------------------------
if (process.env.LOGIN_MODE === "1") {
  await import("./login-web.mjs"); // serves the one-time browser login page
} else {
  await runBot();
}

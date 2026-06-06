// Hanguk Telegram userbot.
//
// Logs in as one or more staff PERSONAL Telegram accounts (MTProto) and mirrors
// every 1:1 chat message — incoming and the staff's own outgoing replies — into
// the CRM by POSTing to the `telegram-ingest` edge function. The edge function
// resolves which student/lead the chat belongs to (auto-linking by the student's
// known phone) and stores it.
//
// Run: `npm start`   ·   First-time backfill: `npm run backfill`
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const ingestUrl = process.env.INGEST_URL;
const ingestSecret = process.env.TELEGRAM_INGEST_SECRET;

const backfillOnStart = process.env.BACKFILL_ON_START === "1";
const backfillDialogs = Number(process.env.BACKFILL_DIALOGS || 50);
const backfillPerChat = Number(process.env.BACKFILL_LIMIT || 100);

for (const [k, v] of Object.entries({ TELEGRAM_API_ID: apiId, TELEGRAM_API_HASH: apiHash, INGEST_URL: ingestUrl, TELEGRAM_INGEST_SECRET: ingestSecret })) {
  if (!v) { console.error(`Missing required env var: ${k}`); process.exit(1); }
}

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
  throw new Error("Set TG_SESSION (from `npm run login`) or TG_ACCOUNTS.");
}

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
  for (const d of dialogs) {
    const peer = d.entity;
    if (!isMirrorablePeer(peer, selfId)) continue;
    try {
      const msgs = await client.getMessages(peer, { limit: backfillPerChat });
      const events = msgs.filter((m) => m && (m.message || m.media)).map((m) => toEvent(account, peer, m));
      events.reverse(); // oldest first so threads order naturally
      for (let i = 0; i < events.length; i += 200) await postEvents(events.slice(i, i + 200));
    } catch (e) {
      console.error(`[${account.label}] backfill chat ${peer?.id}:`, e?.message || e);
    }
  }
  console.log(`[${account.label}] backfill done.`);
}

async function startAccount(account) {
  const client = new TelegramClient(new StringSession(account.session), apiId, apiHash, {
    connectionRetries: 5,
    autoReconnect: true,
  });
  await client.connect();
  if (!(await client.checkAuthorization())) {
    console.error(`[${account.label}] session is not authorized — re-run \`npm run login\` for this account.`);
    return null;
  }
  const me = await client.getMe();
  const selfId = String(me.id);
  console.log(`[${account.label}] connected as ${me.username ? "@" + me.username : me.firstName} (${selfId})`);

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message || !message.isPrivate) return; // 1:1 chats only
      const peer = await message.getChat();
      if (!isMirrorablePeer(peer, selfId)) return;
      await postEvents([toEvent(account, peer, message)]);
    } catch (e) {
      console.error(`[${account.label}] handler error:`, e?.message || e);
    }
  }, new NewMessage({ incoming: true, outgoing: true }));

  if (backfillOnStart) await backfill(client, account, selfId);

  // Keepalive: surfaces a dropped connection in logs; autoReconnect handles recovery.
  setInterval(() => { client.getMe().catch((e) => console.error(`[${account.label}] keepalive:`, e?.message || e)); }, 4 * 60 * 1000);
  return client;
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
  for (const c of clients) await c.disconnect().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise(() => {}); // keep the process alive

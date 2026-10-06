// telegram-poll
// ----------------------------------------------------------------------------
// The company Telegram account, connected directly — no bot, and no server of
// our own.
//
// Until 2026-09-16 this account was carried by the userbot in
// telegram-userbot/, a Node process that has to stay connected around the
// clock and so ran on Railway. When the Railway trial expired the process
// stopped, and every message written to the account after that reached
// nothing. This function does the same job from inside Supabase instead:
//
//   * pg_cron calls it every minute (telegram-poll-1min);
//   * it logs in with the account's MTProto session (TG_SESSION, the same
//     string the userbot used) and keeps the connection for about 45 seconds;
//   * every few seconds it asks Telegram for what happened since the last ask
//     (updates.getDifference, resumed from telegram_poll_state) and hands each
//     private-chat message to telegram-ingest — which stores it, and creates
//     the lead that lands in CRM → Aloqa → "Yangi lid";
//   * in between it sends the replies the CRM queued in telegram_outbox, as
//     the account, and reports a heartbeat so send-telegram knows the account
//     can deliver.
//
// So a message reaches the CRM within seconds while a run is open and within
// about a minute at worst, and nothing is lost across a gap: getDifference
// returns everything since the saved position, however long ago that was.
//
// Required secrets: TELEGRAM_API_ID, TELEGRAM_API_HASH, TG_SESSION, and the
// TELEGRAM_INGEST_SECRET the ingest and outbox functions already use.
// `{ "action": "status" }` reports what is configured and whether the session
// is still logged in, without starting a run.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Buffer } from "node:buffer";
import { Api, TelegramClient } from "npm:telegram@2.26.22";
import { StringSession } from "npm:telegram@2.26.22/sessions/index.js";
import { CustomFile } from "npm:telegram@2.26.22/client/uploads.js";
import { returnBigInt } from "npm:telegram@2.26.22/Helpers.js";
import { downloadBudget, ingestErrors, mediaVerdict, withTimeout, youngEnough } from "./media.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_ID = Number(Deno.env.get("TELEGRAM_API_ID") ?? 0);
const API_HASH = (Deno.env.get("TELEGRAM_API_HASH") ?? "").trim();
const SESSION = (Deno.env.get("TG_SESSION") ?? "").trim();
const INGEST_SECRET = Deno.env.get("TELEGRAM_INGEST_SECRET") ?? "";
/** Same label the Railway userbot reported under, so the outbox and the
 *  liveness check carry on unchanged. */
const LABEL = (Deno.env.get("TG_LABEL") ?? "").trim() || "hanguk";

const INGEST_URL = `${SUPABASE_URL}/functions/v1/telegram-ingest`;
const OUTBOX_URL = `${SUPABASE_URL}/functions/v1/telegram-outbox`;

/** How long one run keeps the connection. The next run starts at the next
 *  minute, so the gap between runs stays around a quarter of a minute. */
const RUN_BUDGET_MS = 45_000;
/** Longer than a run, so a run that dies without releasing it only costs the
 *  next minute's run, never a second session on the same account. */
const LEASE_SECONDS = 75;
const DIFFERENCE_EVERY_MS = 5_000;
/** After a pull that failed (telegram-ingest refused a message, a save failed)
 *  the same slice is asked for again after this. */
const DIFFERENCE_RETRY_MS = 10_000;
const OUTBOX_EVERY_MS = 3_000;
/** Attachments are downloaded after their message is stored AND the position
 *  is saved (see pullDifference), so a large or stuck one costs only its own
 *  file, never the message or the poller. A file Telegram says is bigger than
 *  this is not fetched at all. */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
/** One download may take this long. A download that never finished stalled the
 *  poller on 2026-09-30. */
const MEDIA_TIMEOUT_MS = 15_000;
/** Downloads may run this long past RUN_BUDGET_MS, so a photo that arrives in
 *  the last seconds still gets its file. RUN_BUDGET_MS + this + INGEST_TIMEOUT_MS
 *  (the re-delivery that carries the file) stays under LEASE_SECONDS. */
const MEDIA_GRACE_MS = 10_000;
/** A request to telegram-ingest that takes longer than this is given up: nothing
 *  is saved, the slice comes back on the next pull. */
const INGEST_TIMEOUT_MS = 15_000;
/** A message telegram-ingest keeps rejecting holds the position only this long;
 *  after that it is logged and let go, so one bad message cannot stall the rest. */
const INGEST_RETRY_WINDOW_S = 10 * 60;
const MAX_OUTBOUND_BYTES = 50 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Supabase = any;
interface PollState { pts: number | null; qts: number | null; date: number | null; seq: number | null }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!authorized(req)) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const missing = missingConfig();

  if (body?.action === "status") return json(await status(missing));

  if (missing.length) {
    // Not an error worth retrying every minute: the secrets are simply not set
    // yet. Said plainly so the cron's responses explain the silence.
    return json({ ok: false, reason: "not configured", missing });
  }

  const work = run().catch((e) => console.error("telegram-poll run failed:", errText(e)));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // Answer the cron at once and keep the connection open in the background;
    // pg_net would otherwise hold a request open for the whole run.
    EdgeRuntime.waitUntil(work);
    return json({ ok: true, started: true }, 202);
  }
  await work;
  return json({ ok: true, finished: true });
});

function missingConfig(): string[] {
  const missing: string[] = [];
  if (!API_ID) missing.push("TELEGRAM_API_ID");
  if (!API_HASH) missing.push("TELEGRAM_API_HASH");
  if (!SESSION) missing.push("TG_SESSION");
  if (!INGEST_SECRET) missing.push("TELEGRAM_INGEST_SECRET");
  return missing;
}

// ---------------------------------------------------------------------- run

async function run(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: leased, error: leaseErr } = await supabase.rpc("telegram_poll_acquire", {
    p_label: LABEL,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (leaseErr) throw new Error(`lease: ${leaseErr.message}`);
  const row = Array.isArray(leased) ? leased[0] : leased;
  if (!row) {
    console.log("telegram-poll: previous run still holds the lease — skipping");
    return;
  }

  let state: PollState = { pts: row.pts, qts: row.qts, date: row.date, seq: row.seq };
  let client: TelegramClient | null = null;
  let failure: string | null = null;

  try {
    client = await connect();
    if (!(await client.checkAuthorization())) {
      failure = "TG_SESSION is not logged in any more — log in again and replace the secret";
      await reportTrouble(supabase, failure);
      return;
    }
    const me = (await client.getMe()) as Api.User;
    const selfId = String(me.id);
    await heartbeat(supabase, me);

    const startedAt = Date.now();
    let nextDifference = 0;
    let nextOutbox = 0;
    while (Date.now() - startedAt < RUN_BUDGET_MS) {
      const now = Date.now();
      if (now >= nextDifference) {
        try {
          state = await pullDifference(client, supabase, selfId, state, startedAt + RUN_BUDGET_MS + MEDIA_GRACE_MS);
          failure = null;
          nextDifference = Date.now() + DIFFERENCE_EVERY_MS;
        } catch (e) {
          // telegram-ingest refused a message, or the position could not be
          // saved. The position was not moved past it, so the same slice comes
          // back; meanwhile the outbox keeps draining.
          failure = errText(e);
          console.error("telegram-poll: difference:", failure);
          nextDifference = Date.now() + DIFFERENCE_RETRY_MS;
        }
      }
      if (now >= nextOutbox) {
        // Sending trouble must not stop messages coming in.
        await drainOutbox(client, supabase).catch((e) => console.error("telegram-poll: outbox:", errText(e)));
        nextOutbox = Date.now() + OUTBOX_EVERY_MS;
      }
      await sleep(500);
    }
  } catch (e) {
    failure = errText(e);
    console.error("telegram-poll:", failure);
  } finally {
    if (client) await client.destroy().catch(() => {});
    await supabase.rpc("telegram_poll_release", { p_label: LABEL, p_error: failure });
  }
}

async function connect(): Promise<TelegramClient> {
  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
    connectionRetries: 2,
    autoReconnect: false,
  });
  client.setLogLevel("error" as any);
  await client.connect();
  return client;
}

// ------------------------------------------------------------------ inbound

/**
 * Fetch everything since the saved position and hand it to telegram-ingest.
 *
 * The very first run has no position. It takes Telegram's current one rather
 * than importing history: the conversations up to 2026-09-16 are already in
 * the CRM from the userbot, and replaying them would only be duplicates.
 */
async function pullDifference(
  client: TelegramClient,
  supabase: Supabase,
  selfId: string,
  state: PollState,
  /** epoch ms: no download starts, and no further slice is pulled, past this */
  deadline: number,
): Promise<PollState> {
  // `state` is updated IN PLACE as each position is saved, so a caller that
  // catches a throw from a later step still holds the position that was saved.
  if (state.pts == null || state.date == null) {
    return Object.assign(state, await restart(client, supabase));
  }

  // A long gap comes back in slices; keep going until Telegram says we are
  // current, but never spend a whole run on one backlog.
  for (let i = 0; i < 20 && Date.now() < deadline; i++) {
    const diff: any = await client.invoke(new Api.updates.GetDifference({
      pts: state.pts!,
      date: state.date!,
      qts: state.qts ?? 0,
    }));

    if (diff.className === "updates.DifferenceEmpty") {
      Object.assign(state, { date: diff.date, seq: diff.seq });
      await save(supabase, state);
      return state;
    }
    if (diff.className === "updates.DifferenceTooLong") {
      // Too far behind to page through. Nothing better exists than resuming
      // from now; say so, because the messages in the gap are not coming.
      console.error("telegram-poll: difference too long — resuming from the current position");
      return Object.assign(state, await restart(client, supabase));
    }

    await rememberPeers(supabase, diff.users ?? []);
    // 1. The text of every message goes to telegram-ingest first. This throws
    //    if telegram-ingest refused a message that is still young, and then
    //    nothing below runs: the position stays, the slice comes back.
    const withMedia = await ingestMessages(selfId, diff.newMessages ?? [], diff.users ?? []);

    // 2. The position is saved BEFORE any attachment is touched. It used to be
    //    saved after the downloads, and one download that never finished held
    //    it — and the poller — for good (2026-09-30).
    const next = diff.className === "updates.DifferenceSlice" ? diff.intermediateState : diff.state;
    Object.assign(state, { pts: next.pts, qts: next.qts, date: next.date, seq: next.seq });
    await save(supabase, state);

    // 3. Attachments: bounded, best effort, and never able to hold anything.
    await fetchAttachments(client, withMedia, deadline);

    if (diff.className === "updates.Difference") return state;
  }
  return state;
}

async function restart(client: TelegramClient, supabase: Supabase): Promise<PollState> {
  const s: any = await client.invoke(new Api.updates.GetState());
  const state = { pts: s.pts, qts: s.qts, date: s.date, seq: s.seq };
  await save(supabase, state);
  return state;
}

async function save(supabase: Supabase, s: PollState): Promise<void> {
  const { error } = await supabase.rpc("telegram_poll_save", {
    p_label: LABEL, p_pts: s.pts, p_qts: s.qts, p_date: s.date, p_seq: s.seq,
  });
  if (error) throw new Error(`save state: ${error.message}`);
}

/**
 * Store the 1:1 messages of a slice — their text — and hand back the ones that
 * carry an attachment, for fetchAttachments to download.
 *
 * Text first, files second, on purpose. A download that fails, hangs or runs
 * the run out of time must not take the message down with it — and it must not
 * hold the poller's position either: pullDifference saves the position between
 * the two steps. telegram-ingest attaches a file to a message it already has
 * when the same message is delivered again with the bytes (it "heals" the row,
 * see ingestOne there), so the second delivery in fetchAttachments is a plain
 * re-delivery. What is NOT retried is a file whose download failed or was
 * skipped: the position has moved on, so Telegram does not hand the message
 * over again; its text stays, its file is missing.
 *
 * telegram-ingest answers HTTP 200 even when single events failed (errors[]),
 * without saying which. Those are found by re-delivering one by one, and a
 * failure that is still young stops the position from advancing (it throws), so
 * the slice comes back instead of the message being lost.
 */
async function ingestMessages(selfId: string, messages: any[], users: any[]): Promise<{ message: any; event: any }[]> {
  const byId = new Map<string, any>(users.map((u: any) => [String(u.id), u]));
  const kept: { message: any; event: any }[] = [];

  for (const m of messages) {
    if (m?.className !== "Message") continue; // service messages: joins, calls…
    if (m.peerId?.className !== "PeerUser") continue; // private chats only
    const peerId = String(m.peerId.userId);
    if (peerId === selfId) continue; // Saved Messages
    const peer = byId.get(peerId);
    if (!peer || peer.className !== "User" || peer.bot) continue;
    if (!m.message && !mediaType(m)) continue;
    kept.push({ message: m, event: toEvent(peer, m) });
  }
  if (!kept.length) return [];

  if ((await postEvents(kept.map((k) => k.event))).length) await settleRejected(kept.map((k) => k.event));

  return kept.filter((k) => k.event.message.media_type);
}

/**
 * telegram-ingest returned errors[] for a batch. Deliver the events one at a
 * time (the ones it already stored come back as duplicates) to find the ones it
 * really refuses. Throws — so the position is not saved — if any of those is
 * young enough to be a passing failure; an old one is logged and let go.
 */
async function settleRejected(events: any[]): Promise<void> {
  const refused: { event: any; error: string }[] = [];
  for (const ev of events) {
    const errors = await postEvents([ev]).catch((e) => [errText(e)]);
    if (errors.length) refused.push({ event: ev, error: errors[0] });
  }
  if (!refused.length) return; // it was a passing failure: everything is in now

  const nowSec = Math.floor(Date.now() / 1000);
  const hold = refused.filter((r) => youngEnough(r.event.message.date, nowSec, INGEST_RETRY_WINDOW_S));
  for (const r of refused) {
    console.error(
      `telegram-poll: telegram-ingest rejected message ${r.event.message.id} of chat ${r.event.peer.id}: ${r.error}` +
        (hold.includes(r) ? " — position held, will retry" : " — older than the retry window, dropped"),
    );
  }
  if (hold.length) throw new Error(`telegram-ingest rejected ${hold.length} message(s); position not advanced`);
}

function toEvent(peer: any, message: any) {
  return {
    account: { label: LABEL, staff_user_id: null },
    peer: {
      id: String(peer.id),
      username: peer.username ?? null,
      first_name: peer.firstName ?? null,
      last_name: peer.lastName ?? null,
      phone: peer.phone ?? null,
    },
    chat: { type: "private" },
    message: {
      id: message.id,
      text: message.message ?? "",
      date: message.date ?? null,
      out: !!message.out,
      media_type: mediaType(message),
    } as Record<string, unknown>,
  };
}

/** Delivered, or thrown — the caller must not save its position past a
 *  message telegram-ingest did not take. Returns the errors[] telegram-ingest
 *  reports inside its 200 for events it could not store (empty = all in). */
async function postEvents(events: any[]): Promise<string[]> {
  if (!events.length) return [];
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ingest-secret": INGEST_SECRET },
    body: JSON.stringify(events.length === 1 ? events[0] : { events }),
    signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`telegram-ingest ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ingestErrors(await res.json().catch(() => null));
}

function mediaType(message: any): string | null {
  const m = message.media;
  if (!m) return null;
  const cls = m.className || "";
  // A link preview is decoration on a text message, not an attachment.
  if (cls === "MessageMediaWebPage") return null;
  if (cls.includes("Photo")) return "photo";
  if (cls.includes("Document")) {
    const attrs = m.document?.attributes || [];
    if (attrs.some((a: any) => a.className === "DocumentAttributeAudio" && a.voice)) return "voice";
    if (attrs.some((a: any) => a.className === "DocumentAttributeVideo")) return "video";
    return "document";
  }
  return "media";
}

/**
 * Download the attachments of messages that are already stored and re-deliver
 * each message with its bytes. Best effort: nothing in here may throw, hold the
 * position or outlast the run — a file is skipped when the deadline is near,
 * abandoned after MEDIA_TIMEOUT_MS, and not fetched at all when Telegram says it
 * is over MAX_MEDIA_BYTES.
 */
async function fetchAttachments(client: TelegramClient, jobs: { message: any; event: any }[], deadline: number) {
  for (const job of jobs) {
    try {
      const withMedia = await attachMedia(client, job.message, job.event, deadline);
      if (withMedia) {
        const errors = await postEvents([withMedia]).catch((e) => [errText(e)]);
        if (errors.length) console.error(`telegram-poll: media post of message ${job.message.id}:`, errors[0]);
      }
    } catch (e) {
      console.error(`telegram-poll: attachment of message ${job.message.id} skipped:`, errText(e));
    }
  }
}

/** A copy of the event carrying the file, or null when it cannot be had. */
async function attachMedia(client: TelegramClient, message: any, event: any, deadline: number): Promise<any | null> {
  const kind = event.message.media_type;
  const doc = message.media?.document;
  const verdict = mediaVerdict(message.media, MAX_MEDIA_BYTES);
  if (!verdict.download) {
    console.error(`telegram-poll: ${kind} on message ${message.id} not mirrored: ${verdict.size} bytes is over the limit`);
    return null;
  }
  const budget = downloadBudget(Date.now(), deadline, MEDIA_TIMEOUT_MS);
  if (!budget) {
    console.error(`telegram-poll: ${kind} on message ${message.id} not mirrored: the run is out of time`);
    return null;
  }
  try {
    const buf = await withTimeout(client.downloadMedia(message, {}), budget, `download of message ${message.id}`);
    if (!buf || !(buf as any).length || (buf as any).length > MAX_MEDIA_BYTES) return null;
    const named = (doc?.attributes || []).find((a: any) => a.className === "DocumentAttributeFilename");
    const audio = (doc?.attributes || []).find((a: any) => a.className === "DocumentAttributeAudio");
    return {
      ...event,
      message: {
        ...event.message,
        media_base64: Buffer.from(buf as Uint8Array).toString("base64"),
        media_mime: doc ? (doc.mimeType || "application/octet-stream") : "image/jpeg",
        media_filename: named?.fileName ?? null,
        media_duration: audio?.duration ?? null,
      },
    };
  } catch (e) {
    console.error(`telegram-poll: download of message ${message.id} failed:`, errText(e));
    return null;
  }
}

/** Keep each chat's access_hash, so a reply can be sent to it in a later run. */
async function rememberPeers(supabase: Supabase, users: any[]) {
  const rows = users
    .filter((u: any) => u?.className === "User" && !u.bot && u.accessHash != null)
    .map((u: any) => ({
      account_label: LABEL,
      peer_id: String(u.id),
      access_hash: String(u.accessHash),
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("telegram_peer_cache").upsert(rows, { onConflict: "account_label,peer_id" });
  if (error) console.error("telegram-poll: peer cache:", error.message);
}

// ----------------------------------------------------------------- outbound

async function postOutbox(action: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(OUTBOX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ingest-secret": INGEST_SECRET },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`telegram-outbox ${action} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

/**
 * Send what the CRM queued, reporting each row on its own so one bad reply
 * never stalls the ones behind it. Same contract as the userbot's drain.
 */
async function drainOutbox(client: TelegramClient, supabase: Supabase) {
  const claimed = await postOutbox("claim", { account_label: LABEL, limit: 10 });
  for (const row of claimed?.rows ?? []) {
    try {
      const tgMessageId = await sendOutboxRow(client, supabase, row);
      await postOutbox("complete", { id: row.id, ok: true, tg_message_id: tgMessageId });
    } catch (e) {
      const error = (e as any)?.errorMessage || errText(e);
      await postOutbox("complete", { id: row.id, ok: false, error }).catch(() => {});
      console.error(`telegram-poll: outbox ${row.id} failed:`, error);
    }
  }
}

/**
 * Address a chat by id. The session is restored fresh every run, so GramJS
 * only knows the people seen in this run; everyone else comes from the
 * access_hash remembered in telegram_peer_cache, and only failing that from
 * the dialog list.
 */
async function resolvePeer(client: TelegramClient, supabase: Supabase, chatId: string): Promise<any> {
  const id = String(chatId);
  // A big integer, never the string: GramJS reads an uncached string as a
  // username and goes looking for "@123456789".
  const userId = returnBigInt(id);
  try {
    return await client.getInputEntity(userId);
  } catch (_first) {
    const { data } = await supabase.from("telegram_peer_cache")
      .select("access_hash").eq("account_label", LABEL).eq("peer_id", id).maybeSingle();
    if (data?.access_hash) {
      return new Api.InputPeerUser({ userId, accessHash: returnBigInt((data as any).access_hash) });
    }
    await client.getDialogs({ limit: 200 });
    return await client.getInputEntity(userId);
  }
}

async function sendOutboxRow(client: TelegramClient, supabase: Supabase, row: any): Promise<number> {
  const peer = await resolvePeer(client, supabase, row.chat_id);
  const replyTo = row.reply_to_msg_id ? Number(row.reply_to_msg_id) : undefined;

  if (!row.media_path) {
    if (!row.text) throw new Error("row has neither text nor media");
    const sent = await client.sendMessage(peer, { message: String(row.text), replyTo });
    return sent.id;
  }

  if (!row.media_url) throw new Error("attachment has no signed URL");
  const res = await fetch(row.media_url);
  if (!res.ok) throw new Error(`attachment fetch failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_OUTBOUND_BYTES) throw new Error(`attachment too large: ${bytes.length} bytes`);

  const mime = String(row.media_mime || "application/octet-stream");
  const name = row.media_filename || String(row.media_path).split("/").pop() || "file";
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

// ------------------------------------------------------------------ liveness

/** "The account can deliver" — what send-telegram and infra-health-check read. */
async function heartbeat(supabase: Supabase, me: Api.User) {
  const { error } = await supabase.from("telegram_userbot_status").upsert({
    account_label: LABEL,
    tg_user_id: String(me.id),
    username: me.username ?? null,
    last_seen_at: new Date().toISOString(),
    detail: null,
  }, { onConflict: "account_label" });
  if (error) console.error("telegram-poll: heartbeat:", error.message);
}

/** Record a problem WITHOUT moving last_seen_at: a session that cannot log in
 *  must read as down, or replies would be queued where nothing sends them. */
async function reportTrouble(supabase: Supabase, detail: string) {
  await supabase.from("telegram_userbot_status")
    .update({ detail: detail.slice(0, 500) })
    .eq("account_label", LABEL);
}

async function status(missing: string[]) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: state } = await supabase.from("telegram_poll_state")
    .select("pts, lease_until, last_run_at, last_error, updated_at")
    .eq("account_label", LABEL).maybeSingle();
  const out: Record<string, unknown> = { label: LABEL, missing, state };
  if (missing.length) return out;
  let client: TelegramClient | null = null;
  try {
    client = await connect();
    out.authorized = await client.checkAuthorization();
    if (out.authorized) {
      const me = (await client.getMe()) as Api.User;
      out.account = me.username ? `@${me.username}` : String(me.id);
    }
  } catch (e) {
    out.error = errText(e);
  } finally {
    if (client) await client.destroy().catch(() => {});
  }
  return out;
}

// ------------------------------------------------------------------- helpers

/** Service-role callers only: pg_cron with the vault JWT, or an operator. */
function authorized(req: Request): boolean {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  if (bearer === SUPABASE_SERVICE_ROLE_KEY) return true;
  try {
    const payload = bearer.split(".")[1];
    const pad = payload + "=".repeat((4 - payload.length % 4) % 4);
    const claims = JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/")));
    return claims?.role === "service_role";
  } catch (_e) {
    return false;
  }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

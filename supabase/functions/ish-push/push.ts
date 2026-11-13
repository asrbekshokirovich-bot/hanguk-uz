// ish-push — what a Hanguk Ish push says and to whom (P56), apart from the
// server so it can be tested.
//
// A push is the notification A12 (worker app) or 알림 (사장님 app) shows,
// in the reader's language (ish.profiles.language):
//   worker   the A12 title; under it the business, as A12 names it
//            («Dalbit Kafe · Sinchon»). The detail is in the app;
//   사장님    the 알림 title and line («Aziz Karimov: «홀 서빙» 지원»).
// The strings are the apps' own (texts.json, made from their ARB files by
// hanguk_ish/tool/push_texts.py — texts_test.ts fails when they drift); the
// rules below are those of lib/data/backend/json.dart, models/business.dart
// and core/format/dates.dart (countdown).
// deno-lint-ignore-file no-explicit-any
import texts from "./texts.json" with { type: "json" };

export const APP_LANGS = ["uz", "ru", "en", "ko"] as const;
type Lang = typeof APP_LANGS[number];
export type App = "worker" | "employer";

/** A row as ish.push_claim gives it. */
export interface PushJob {
  id: number;
  attempts: number;
  app: App;
  lang: string;
  tokens: string[];
  /** ish.notification_card — what my_notifications returns for it. */
  card: Record<string, any>;
}

export interface PushText {
  title: string;
  body: string;
}

export interface PushStore {
  claim(limit: number): Promise<PushJob[]>;
  done(job: PushJob): Promise<void>;
  fail(job: PushJob, error: string): Promise<void>;
  /** A token FCM says no longer exists. */
  dropToken(token: string): Promise<void>;
}

/** Sends one push to one token; [ttl]: seconds FCM keeps it for a phone that is off. */
export type Sender = (
  token: string,
  text: PushText,
  data: Record<string, string>,
  ttl: number,
) => Promise<{ ok: boolean; gone: boolean; error?: string }>;

export interface PushStats {
  sent: number;
  failed: number;
  dropped: number;
  silent: number;
}

const STRINGS = texts.strings as Record<Lang, Record<string, string>>;
const DISTRICTS = texts.districts as Record<string, Record<Lang, string>>;
const SEOUL = texts.seoul as Record<Lang, string>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? v as any : {});
const int = (v: unknown): number | null =>
  typeof v === "number" ? Math.trunc(v) : typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : null;

/** {"uz": "…"} → its non-empty strings (json.dart _texts). */
function textsOf(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, s] of Object.entries(obj(v))) if (typeof s === "string" && s) out[k] = s;
  return out;
}

/** One field of {"uz": {"area": …}} per language (json.dart _field). */
function fieldOf(translations: unknown, key: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, t] of Object.entries(obj(translations))) {
    const s = obj(t)[key];
    if (typeof s === "string" && s) out[k] = s;
  }
  return out;
}

const lang = (l: string): Lang => ((APP_LANGS as readonly string[]).includes(l) ? l as Lang : "uz");

// ---------------------------------------------------------------------------
// ICU messages as gen-l10n writes them: {name} and {n, plural, …}
// ---------------------------------------------------------------------------

function matching(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return s.length - 1;
}

/** CLDR plural categories of the four languages (integers). */
export function pluralCategory(n: number, l: string): string {
  if (l === "ko") return "other";
  if (l === "ru") {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "one";
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "few";
    return "many";
  }
  return n === 1 ? "one" : "other";
}

function plural(body: string, n: number, params: Record<string, string | number>, l: string): string {
  const options = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const start = i;
    while (i < body.length && body[i] !== "{") i++;
    if (i >= body.length) break;
    const close = matching(body, i);
    options.set(body.slice(start, i).trim(), body.slice(i + 1, close));
    i = close + 1;
  }
  const pick = options.get(`=${n}`) ?? options.get(pluralCategory(n, l)) ?? options.get("other") ?? "";
  return icu(pick, params, l);
}

export function icu(template: string, params: Record<string, string | number>, l: string): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    if (template[i] !== "{") {
      out += template[i++];
      continue;
    }
    const close = matching(template, i);
    const inner = template.slice(i + 1, close);
    const m = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/.exec(inner);
    if (m) out += plural(m[2], Number(params[m[1]] ?? 0), params, l);
    else out += inner.trim() in params ? String(params[inner.trim()]) : `{${inner}}`;
    i = close + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// What A12 and 알림 compute
// ---------------------------------------------------------------------------

/** HiDates.countdown: «1 kun 5 soat», «2 soat 40 daq», «4 daq». */
export function countdown(minutes: number, l: string): string {
  const m = Math.abs(minutes);
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const mins = m % 60;
  const [du, hu, mu] = l === "ru"
    ? ["д", "ч", "мин"]
    : l === "en"
    ? ["d", "h", "min"]
    : l === "ko"
    ? ["일", "시간", "분"]
    : ["kun", "soat", "daq"];
  const sep = l === "ko" ? "" : " ";
  if (days > 0) return hours === 0 ? `${days}${sep}${du}` : `${days}${sep}${du} ${hours}${sep}${hu}`;
  if (hours > 0) return mins === 0 ? `${hours}${sep}${hu}` : `${hours}${sep}${hu} ${mins}${sep}${mu}`;
  return `${mins}${sep}${mu}`;
}

/** Business.nameWithArea: «Dalbit Kafe · Sinchon» (the Korean original where nothing else is). */
export function businessName(business: unknown, l: string): string {
  const b = obj(business);
  if (!Object.keys(b).length) return "";
  const name = str(b.name);
  const area = str(b.area);
  const names: Record<string, string> = { ko: name, ...textsOf(b.name_i18n) };
  const areas: Record<string, string> = { ...(area ? { ko: area } : {}), ...fieldOf(b.translations, "area") };
  const shown = names[l] ?? names.en ?? name;
  const where = areas[l] ?? areas.en ?? area;
  return where ? `${shown} · ${where}` : shown;
}

/** HiNotification.areaName of the evening digest: the worker's district, else the area written. */
function areaName(data: Record<string, any>, l: string): string {
  const names: Record<string, string> = {};
  const code = typeof data.area_code === "string" && data.area_code ? data.area_code : null;
  if (code !== null) {
    const place = code.trim() ? DISTRICTS[code] ?? Object.fromEntries(APP_LANGS.map((x) => [x, code.trim()])) : SEOUL;
    Object.assign(names, place);
  }
  const area = str(data.area);
  if (area) names.ko = area;
  Object.assign(names, textsOf(data.area_i18n));
  return names[l] ?? names.en ?? names.ko ?? "";
}

/** The push for [card] in [l]; null for what the app does not show (pay not marked). */
export function pushText(card: Record<string, any>, readerLang: string): PushText | null {
  const l = lang(readerLang);
  const s = STRINGS[l];
  const data = obj(card.data);
  const kind = str(card.kind);
  const forOwner = (kind === "chat_message" && "worker_id" in data) ||
    ["new_applicant", "worker_cancelled", "no_show"].includes(kind);
  if (forOwner) {
    const worker = obj(card.worker);
    const who = `${str(worker.first_name)} ${str(worker.last_name)}`.trim();
    const shift = str(obj(card.shift).title);
    const p = { worker: who, shift };
    switch (kind) {
      case "new_applicant":
        return data.auto_confirmed === true
          ? { title: s.bizNotifAutoConfirmed, body: icu(s.bizNotifAutoConfirmedText, p, l) }
          : { title: s.bizNotifNewApplicant, body: icu(s.bizNotifNewApplicantText, p, l) };
      case "worker_cancelled":
        return { title: s.bizNotifCancelled, body: icu(s.bizNotifCancelledText, p, l) };
      case "no_show":
        return { title: s.bizNotifNoShow, body: icu(s.bizNotifNoShowText, p, l) };
      default:
        return { title: s.bizNotifMessage, body: icu(s.bizNotifMessageText, p, l) };
    }
  }
  const business = businessName(card.business, l);
  const title = (() => {
    switch (kind) {
      case "shift_reminder":
        return icu(s.notifReminderTitle, { time: countdown(int(data.minutes_before) ?? 0, l) }, l);
      case "application_confirmed":
        return s.notifConfirmedTitle;
      case "application_rejected":
        return data.reason === "shift_cancelled"
          ? s.notifCancelledTitle
          : data.reason === "time_changed"
          ? s.notifTimeChangedTitle
          : s.notifRejectedTitle;
      case "payment_marked":
        return data.paid === true ? s.notifPaidTitle : null;
      case "chat_message":
        return s.notifMessageTitle;
      case "new_shift_match":
      case "request_again":
        return s.notifNewShiftTitle;
      case "nearby_digest":
        return icu(s.notifNearbyTitle, { area: areaName(data, l), n: int(data.count) ?? 0 }, l);
      case "job_offer":
        return s.notifOfferTitle;
      default:
        return null;
    }
  })();
  if (title === null) return null;
  return { title, body: kind === "nearby_digest" ? "" : business };
}

// ---------------------------------------------------------------------------
// Working the queue
// ---------------------------------------------------------------------------

/**
 * How long FCM keeps a push for a phone that is off: a reminder until the
 * shift starts (later it would be wrong), the rest a day (A12 has them).
 */
export function ttlSeconds(card: Record<string, any>): number {
  const data = obj(card.data);
  if (str(card.kind) === "shift_reminder") {
    const minutes = int(data.minutes_before);
    if (minutes !== null) return Math.min(86_400, Math.max(60, minutes * 60));
  }
  return 86_400;
}

/** The FCM HTTP v1 message (projects.messages.send). */
export function fcmMessage(token: string, text: PushText, data: Record<string, string>, ttl: number) {
  return {
    token,
    notification: text.body ? { title: text.title, body: text.body } : { title: text.title },
    data,
    android: { priority: "high", ttl: `${ttl}s`, notification: { sound: "default" } },
    apns: {
      headers: { "apns-expiration": String(Math.floor(Date.now() / 1000) + ttl) },
      payload: { aps: { sound: "default" } },
    },
  };
}

/**
 * Whether FCM's refusal means the token is gone for good: the app was
 * removed or the token replaced (404 UNREGISTERED), or it is not a token
 * (400 «registration token»). Anything else is retried — quota, 5xx, and
 * SENDER_ID_MISMATCH too: that is our key of another Firebase project, and
 * dropping every phone's token over it would be wrong.
 */
export function tokenGone(status: number, body: string): boolean {
  if (status === 404 || body.includes("UNREGISTERED")) return true;
  return status === 400 && /registration token/i.test(body);
}

/**
 * Sends what is due until nothing is or [budgetMs] passes (the next run
 * goes on; the database asks again every minute). The pushes of one batch
 * go out together. A push FCM refuses waits for its next try (the database
 * pushed it back when it was taken); a token FCM no longer knows is dropped.
 */
export async function runPush(
  store: PushStore,
  send: Sender,
  opts: { budgetMs?: number; now?: () => number; batch?: number } = {},
): Promise<PushStats> {
  const now = opts.now ?? Date.now;
  const budget = opts.budgetMs ?? 40_000;
  const started = now();
  const stats: PushStats = { sent: 0, failed: 0, dropped: 0, silent: 0 };
  const one = async (job: PushJob) => {
    const text = pushText(job.card, job.lang);
    if (!text) {
      stats.silent++;
      await store.done(job);
      return;
    }
    const data: Record<string, string> = {
      kind: str(job.card.kind),
      notification_id: String(job.id),
      app: job.app,
    };
    const ttl = ttlSeconds(job.card);
    let delivered = 0;
    const errors: string[] = [];
    for (const token of job.tokens) {
      let r: { ok: boolean; gone: boolean; error?: string };
      try {
        r = await send(token, text, data, ttl);
      } catch (e) {
        r = { ok: false, gone: false, error: e instanceof Error ? e.message : String(e) };
      }
      if (r.ok) delivered++;
      else if (r.gone) {
        stats.dropped++;
        await store.dropToken(token);
      } else errors.push(r.error ?? "not sent");
    }
    if (delivered > 0 || errors.length === 0) {
      if (delivered > 0) stats.sent++;
      await store.done(job);
    } else {
      stats.failed++;
      const why = errors.join(" | ").slice(0, 500);
      console.error(`[ish-push] ${job.id} (try ${job.attempts}): ${why}`);
      await store.fail(job, why);
    }
  };
  while (now() - started < budget) {
    const jobs = await store.claim(opts.batch ?? 20);
    if (!jobs.length) break;
    await Promise.all(jobs.map(one));
  }
  return stats;
}

interface RpcClient {
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<{ data: any; error: any }>;
}

/** ish.push_claim / _done / _fail / _drop_token through PostgREST (the client's schema: ish). */
export function pushStore(db: RpcClient): PushStore {
  const call = async (fn: string, params: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, params);
    if (error) throw new Error(`${fn}: ${error.message ?? error}`);
    return data;
  };
  return {
    async claim(limit) {
      const rows = await call("push_claim", { p_limit: limit });
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({
        id: Number(r.id),
        attempts: Number(r.attempts ?? 0),
        app: r.app === "employer" ? "employer" : "worker",
        lang: str(r.lang) || "uz",
        tokens: Array.isArray(r.tokens) ? r.tokens.filter((t: unknown) => typeof t === "string") : [],
        card: obj(r.card),
      }));
    },
    async done(job) {
      await call("push_done", { p_id: job.id });
    },
    async fail(job, message) {
      await db.rpc("push_fail", { p_id: job.id, p_error: message });
    },
    async dropToken(token) {
      await db.rpc("push_drop_token", { p_token: token });
    },
  };
}

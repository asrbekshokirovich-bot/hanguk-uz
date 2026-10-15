// Text of the Telegram alerts (spec §4, §11, §14) and the choice of who gets
// them. Pure: no imports, so vitest runs it. Plain text, no parse mode.
//
// The rows come from lead_alert_outbox (see 20261015001000_lead_v2_schema.sql);
// what is in `payload` is decided by the SQL that enqueues them:
//   escalation  name, username, phone, source, channel, campaign, form, timer,
//               attempt, minutes_late, repeat, owner_id        (fn_lead_timer_scan)
//   promise     promise_id, name, kind, text, reason, operator_id
//   keyword     name, word, text
//   contract    name, stage, owner_id
//   student     name, student_id
//   report      text                                           (not enqueued by SQL today)

export const DEFAULT_CRM_BASE_URL = "https://hanguk.uz";

/** The ladder has 5 attempts (spec §9): 4 steps in lead_settings.ladder + the first call. */
const LADDER_ATTEMPTS = 5;

/** Telegram refuses a text over 4096 characters. */
export const MAX_TEXT = 4000;

export interface AlertRow {
  id: number;
  lead_id: string | null;
  kind: string;
  audience: string;
  payload: Record<string, unknown> | null;
}

export interface RecipientRow {
  chat_id: string | number | null;
  enabled?: boolean | null;
  escalate?: boolean | null;
  boss_alerts?: boolean | null;
  reports_daily?: boolean | null;
  reports_weekly?: boolean | null;
}

export interface FormatContext {
  /** CRM_BASE_URL, default https://hanguk.uz */
  crmBaseUrl?: string | null;
  /** user id -> display name (owner / operator), from profiles */
  names?: Record<string, string | undefined>;
  /** lead_settings.timer_minutes (default 10) */
  timerMinutes?: number;
}

const s = (v: unknown): string => (v == null ? "" : String(v).trim());

export function clip(text: string, max = MAX_TEXT): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

/** `<base>/crm/desk?lead=<id>` — opens the card on the desk. */
export function crmLink(base: string | null | undefined, leadId: string | null | undefined): string {
  const root = (s(base) || DEFAULT_CRM_BASE_URL).replace(/\/+$/, "");
  return leadId ? `${root}/crm/desk?lead=${encodeURIComponent(leadId)}` : `${root}/crm/desk`;
}

const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram",
  telegram: "Telegram",
  facebook: "Facebook",
  meta_form: "Meta forma",
  app: "Ilova",
  manual: "Qo'lda",
  phone: "Telefon",
  call: "Telefon",
  "Public Registration": "Sayt formasi",
  learning_center: "O'quv markaz",
};

export function sourceLabel(source: unknown): string {
  const v = s(source);
  return v ? (SOURCE_LABEL[v] ?? v) : "";
}

/**
 * The timer kind in words. `attempt` is how many calls have been made already,
 * so the ladder timer that has just run out is for the NEXT one (spec §9:
 * "2-urinish, +15 daq"): zinapoya 2/5 after the first miss.
 */
export function timerLabel(kind: unknown, attempt: unknown): string {
  switch (s(kind)) {
    case "first":
      return "yangi lid";
    case "reply":
      return "mijoz yozdi";
    case "ladder": {
      const n = Math.min(LADDER_ATTEMPTS, Math.max(1, (Number(attempt) || 0) + 1));
      return `zinapoya ${n}/${LADDER_ATTEMPTS}`;
    }
    case "callback":
      return "qayta qo'ng'iroq";
    default:
      return "";
  }
}

/**
 * How long the client has really been without an answer. `minutes_late` counts
 * from the deadline, so for a first / reply timer the 10 minutes of the window
 * come on top ("lid 0 daqiqa javobsiz" at the first alert would read as a bug).
 * A ladder / callback timer is late from the planned time.
 */
export function waitedMinutes(timerKind: unknown, minutesLate: unknown, windowMinutes = 10): number {
  const late = Math.max(0, Math.floor(Number(minutesLate) || 0));
  const k = s(timerKind);
  return k === "first" || k === "reply" || k === "" ? late + windowMinutes : late;
}

function promiseKindLabel(kind: unknown): string {
  switch (s(kind)) {
    case "discount":
      return "Chegirma";
    case "installment":
      return "Bo'lib to'lash";
    case "other":
      return "Boshqa shart";
    default:
      return s(kind);
  }
}

function leadName(p: Record<string, unknown>): string {
  return s(p.name) || "(ismsiz lid)";
}

function who(p: Record<string, unknown>): string {
  const name = s(p.name);
  const user = s(p.username).replace(/^@/, "");
  if (name && user) return `${name} (@${user})`;
  if (user) return `@${user}`;
  return name || "(ismsiz lid)";
}

function lines(parts: (string | null | undefined | false)[]): string {
  return parts.filter((x): x is string => typeof x === "string" && x !== "").join("\n");
}

function escalationText(row: AlertRow, p: Record<string, unknown>, ctx: FormatContext): string {
  const n = Math.max(1, Number(p.repeat) || 1);
  const waited = waitedMinutes(p.timer, p.minutes_late, ctx.timerMinutes ?? 10);
  const channel = s(p.channel);
  const source = sourceLabel(p.source);
  const sourceLine = [source, channel && channel.toLowerCase() !== source.toLowerCase() ? channel : ""]
    .filter(Boolean)
    .join(" · ");
  const campaign = s(p.campaign);
  const form = s(p.form);
  const ad = [campaign, form ? `forma: ${form}` : ""].filter(Boolean).join(" · ");
  const timer = timerLabel(p.timer, p.attempt);
  const ownerId = s(p.owner_id);
  const owner = ownerId ? (ctx.names?.[ownerId] ?? "") : "";

  return lines([
    `🔴 ${n}. ogohlantirish — lid ${waited} daqiqa javobsiz`,
    "",
    who(p),
    sourceLine && `Manba: ${sourceLine}`,
    ad && `Kampaniya: ${ad}`,
    s(p.phone) && `Telefon: ${s(p.phone)}`,
    timer && `Taymer: ${timer}`,
    owner && `Egasi: ${owner}`,
    "",
    `CRM: ${crmLink(ctx.crmBaseUrl, row.lead_id)}`,
  ]);
}

function promiseText(row: AlertRow, p: Record<string, unknown>, ctx: FormatContext): string {
  const opId = s(p.operator_id);
  const operator = opId ? (ctx.names?.[opId] ?? "") : "";
  return lines([
    `🟠 Chegirma / maxsus shart so'rovi`,
    "",
    `Lid: ${leadName(p)}`,
    operator && `Operator: ${operator}`,
    promiseKindLabel(p.kind) && `Turi: ${promiseKindLabel(p.kind)}`,
    `So'rov: ${s(p.text)}`,
    s(p.reason) && `Sabab: ${s(p.reason)}`,
    "",
    `Tasdiqlash/Rad etish: ${crmLink(ctx.crmBaseUrl, row.lead_id)}`,
  ]);
}

function keywordText(row: AlertRow, p: Record<string, unknown>, ctx: FormatContext): string {
  return lines([
    `⚠️ Mijoz xabarida muhim so'z: «${s(p.word)}»`,
    "",
    `Lid: ${leadName(p)}`,
    `Xabar: ${s(p.text).slice(0, 300)}`,
    "",
    `CRM: ${crmLink(ctx.crmBaseUrl, row.lead_id)}`,
  ]);
}

function contractText(row: AlertRow, p: Record<string, unknown>, ctx: FormatContext): string {
  const ownerId = s(p.owner_id);
  const owner = ownerId ? (ctx.names?.[ownerId] ?? "") : "";
  return lines([
    `✅ Shartnoma / to'lov: ${leadName(p)}`,
    owner && `Operator: ${owner}`,
    "",
    `CRM: ${crmLink(ctx.crmBaseUrl, row.lead_id)}`,
  ]);
}

function studentText(row: AlertRow, p: Record<string, unknown>, ctx: FormatContext): string {
  return lines([`ℹ️ Talaba yozdi: ${leadName(p)}`, "", `CRM: ${crmLink(ctx.crmBaseUrl, row.lead_id)}`]);
}

/** The message for an outbox row, or null for a kind this function does not know. */
export function formatAlert(row: AlertRow, ctx: FormatContext = {}): string | null {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  switch (row.kind) {
    case "escalation":
      return clip(escalationText(row, p, ctx));
    case "promise":
      return clip(promiseText(row, p, ctx));
    case "keyword":
      return clip(keywordText(row, p, ctx));
    case "contract":
      return clip(contractText(row, p, ctx));
    case "student":
      return clip(studentText(row, p, ctx));
    case "report":
      return s(p.text) ? clip(s(p.text)) : null;
    default:
      return null;
  }
}

/**
 * Who receives an alert: audience `everyone` -> recipients with `escalate`,
 * audience `boss` -> recipients with `boss_alerts`; the staff channel from the
 * environment (ALERT_TELEGRAM_CHAT_ID) gets both. Each chat once.
 */
export function pickRecipients(
  audience: string,
  rows: RecipientRow[],
  envChatId?: string | null,
): string[] {
  const chats = new Set<string>();
  const env = s(envChatId);
  if (env) chats.add(env);
  for (const r of rows) {
    if (r.enabled === false) continue;
    const chat = s(r.chat_id);
    if (!chat) continue;
    if (audience === "everyone" ? r.escalate === true : r.boss_alerts === true) chats.add(chat);
  }
  return [...chats];
}

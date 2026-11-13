// ish-staff-alerts — what the staff are told on Telegram, apart from the
// server so it can be tested (P57).
//
// Two messages, in Uzbek with the CRM's own words (src/locales/uz.json →
// ish.category, ish.reports.reasons, the tab names), each with the link to
// the CRM tab where it is acted on:
//   business_opened  the 사장님 app opened a business: name it or suspend it;
//   report           a worker's complaint (A11): who, about what, the text.
// deno-lint-ignore-file no-explicit-any

export type AlertKind = "business_opened" | "report";

/** A row as ish.staff_alerts_claim gives it. */
export interface Alert {
  id: number;
  kind: AlertKind;
  attempts: number;
  data: Record<string, any>;
}

export interface Outbox {
  claim(limit: number): Promise<Alert[]>;
  done(alert: Alert): Promise<void>;
  fail(alert: Alert, error: string): Promise<void>;
}

/** Sends one message to the staff's chat. */
export type Send = (text: string) => Promise<{ ok: boolean; description?: string }>;

export interface AlertStats {
  sent: number;
  failed: number;
}

const CRM = "https://hanguk.uz/crm/ish";

const CATEGORY: Record<string, string> = {
  cafe: "Kafe",
  restaurant: "Restoran",
  retail: "Do'kon",
  logistics: "Logistika",
  event: "Tadbir",
  office: "Ofis",
  other: "Boshqa",
};

const REASON: Record<string, string> = {
  employer: "Ish beruvchi",
  payment: "Maosh",
  safety: "Xavfsizlik",
  other: "Boshqa",
  unpaid: "To'lanmagan",
  not_as_described: "Ta'rifga mos emas",
  time_dispute: "Vaqt bo'yicha kelishmovchilik",
  no_show: "Kelmagan",
  behaviour: "Xulq-atvor",
};

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const BODY_MAX = 600;

/** Text for Telegram's HTML mode. */
export const html = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** An instant → «14-noyabr, 14:00» on Seoul's clock (UTC+9, no daylight saving). */
export function seoulTime(iso: unknown): string {
  const t = new Date(String(iso ?? "")).getTime();
  if (Number.isNaN(t)) return "";
  const d = new Date(t + 9 * 3600_000);
  const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}, ${hm}`;
}

/** «달빛카페 신촌점 (Dalbit Kafe · Sinchon)»: the Korean name, and the staff's when there is one. */
function businessLine(b: any): string {
  const name = text(b?.name);
  const uz = text(b?.name_uz);
  if (!name) return "";
  return uz && uz !== name ? `${html(name)} (${html(uz)})` : html(name);
}

/** The message for [alert]; null when there is nothing to say. */
export function alertText(alert: Alert): string | null {
  const d = alert.data ?? {};
  if (alert.kind === "business_opened") {
    const name = businessLine(d);
    if (!name) return null;
    const kind = CATEGORY[text(d.category)] ?? CATEGORY.other;
    const pending = d.status === "pending" ? " · Tekshiruvda" : "";
    return [
      "🆕 <b>Hanguk Ish</b> — sajangnim ilovasida yangi biznes",
      `<b>${name}</b> · ${kind}${pending}`,
      "Haqiqiy nomi va manzilini qo'ying, shubhali bo'lsa to'xtating: CRM → Hanguk Ish → «Ilovadagi bizneslar».",
      `${CRM}?tab=appBusinesses`,
    ].join("\n");
  }
  if (alert.kind === "report") {
    const reason = REASON[text(d.reason)] ?? REASON.other;
    const worker = [text(d.worker?.first_name), text(d.worker?.last_name)].filter(Boolean).join(" ");
    const business = businessLine(d.business);
    const shiftTitle = text(d.shift?.title);
    const shiftTime = seoulTime(d.shift?.starts_at);
    let body = text(d.body);
    if (body.length > BODY_MAX) body = `${body.slice(0, BODY_MAX)}…`;
    const lines = [
      `⚠️ <b>Hanguk Ish</b> — yangi shikoyat: <b>${html(reason)}</b>`,
      `Ishchi: ${worker ? html(worker) : "Ismi kiritilmagan"}`,
    ];
    if (business) lines.push(`Biznes: ${business}`);
    if (shiftTitle) lines.push(`Smena: ${html(shiftTitle)}${shiftTime ? ` · ${shiftTime}` : ""}`);
    if (body) lines.push(`«${html(body)}»`);
    lines.push("CRM → Hanguk Ish → «Shikoyatlar»:", `${CRM}?tab=reports`);
    return lines.join("\n");
  }
  return null;
}

/**
 * Sends what is due until nothing is, a message does not go (the rest wait
 * for their next try rather than meet the same wall) or [budgetMs] passes.
 */
export async function runAlerts(
  outbox: Outbox,
  send: Send,
  opts: { budgetMs?: number; now?: () => number } = {},
): Promise<AlertStats> {
  const now = opts.now ?? Date.now;
  const budget = opts.budgetMs ?? 40_000;
  const started = now();
  const stats: AlertStats = { sent: 0, failed: 0 };
  while (now() - started < budget) {
    const alerts = await outbox.claim(10);
    if (!alerts.length) break;
    for (const alert of alerts) {
      const message = alertText(alert);
      if (message === null) {
        await outbox.done(alert);
        continue;
      }
      let result: { ok: boolean; description?: string };
      try {
        result = await send(message);
      } catch (e) {
        result = { ok: false, description: e instanceof Error ? e.message : String(e) };
      }
      if (result.ok) {
        await outbox.done(alert);
        stats.sent++;
        continue;
      }
      stats.failed++;
      const why = (result.description || "not sent").slice(0, 500);
      console.error(`[ish-staff-alerts] ${alert.kind} ${alert.id} (try ${alert.attempts}): ${why}`);
      await outbox.fail(alert, why);
      return stats;
    }
  }
  return stats;
}

interface RpcClient {
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<{ data: any; error: any }>;
}

/** ish.staff_alerts_claim / _done / _fail through PostgREST (the client's schema: ish). */
export function outboxStore(db: RpcClient): Outbox {
  return {
    async claim(limit) {
      const { data, error } = await db.rpc("staff_alerts_claim", { p_limit: limit });
      if (error) throw new Error(`staff_alerts_claim: ${error.message ?? error}`);
      return (Array.isArray(data) ? data : []).map((r: any) => ({
        id: Number(r.id),
        kind: r.kind as AlertKind,
        attempts: Number(r.attempts ?? 0),
        data: r.data && typeof r.data === "object" ? r.data : {},
      }));
    },
    async done(alert) {
      const { error } = await db.rpc("staff_alerts_done", { p_id: alert.id });
      if (error) throw new Error(`staff_alerts_done: ${error.message ?? error}`);
    },
    async fail(alert, message) {
      await db.rpc("staff_alerts_fail", { p_id: alert.id, p_error: message });
    },
  };
}

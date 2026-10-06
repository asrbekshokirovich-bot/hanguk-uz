// The Telegram reports of the lead module (spec §14): the 09:30 daily one and
// the Monday weekly one. Pure: no imports, so vitest runs it. Plain text.
//
// The numbers come from fn_lead_report(p_from, p_to) — results only, never the
// number of calls (spec §2 8.1: "qo'ng'iroq soni uchun to'lamaymiz").

export interface ReportTotals {
  leads: number;
  answered: number;
  answered_in_10: number;
  talked: number;
  offers: number;
  contracts_sent: number;
  students: number;
}

export interface SourceRow {
  source: string | null;
  leads: number;
  answered?: number;
  talked?: number;
  offers?: number;
  students?: number;
}

export interface LeadReport {
  from: string;
  to: string;
  totals: Partial<ReportTotals>;
  by_source?: SourceRow[] | null;
  by_ad?: { ad: string | null; leads: number; students: number }[] | null;
  by_operator?: { operator_id: string | null; students: number }[] | null;
  lost?: { reason: string | null; n: number }[] | null;
}

export interface FormatOptions {
  /** lead_settings.control_line_10min (Q64) — the "10 daqiqada javob %" line. */
  showControlLine?: boolean;
  /** Leads on BUGUN right now (daily report); null/undefined = unknown, line left out. */
  bugunCount?: number | null;
  /** lost_reasons key -> label */
  lostLabels?: Record<string, string>;
  /** user id -> name */
  names?: Record<string, string | undefined>;
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const TASHKENT_OFFSET_MS = 5 * 3600 * 1000; // UTC+5 all year, no DST

/** YYYY-MM-DD of an instant, in Tashkent. */
export function tashkentDate(ms: number): string {
  return new Date(ms + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type ReportKind = "daily" | "weekly";

/**
 * The days a report covers, given today's Tashkent date:
 * daily  = yesterday; weekly = the 7 days before today (Monday's report covers Monday..Sunday).
 */
export function reportRange(kind: ReportKind, today: string): { from: string; to: string } {
  const to = addDays(today, -1);
  return kind === "daily" ? { from: to, to } : { from: addDays(today, -7), to };
}

/** "4-oktabr" */
export function dayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${d}-${MONTHS[m - 1]}`;
}

export function rangeLabel(from: string, to: string): string {
  return from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
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

export function sourceName(source: string | null | undefined): string {
  const v = (source ?? "").trim();
  if (!v || v === "—") return "Noma'lum";
  return SOURCE_LABEL[v] ?? v;
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function pct(part: number, whole: number): string | null {
  return whole > 0 ? `${Math.round((part * 100) / whole)}%` : null;
}

function lostName(reason: string | null | undefined, labels: Record<string, string> | undefined): string {
  if (!reason) return "Sabab ko'rsatilmagan";
  return labels?.[reason] ?? reason;
}

function joinTop(items: string[], max = 8): string {
  return items.length > max ? `${items.slice(0, max).join(" · ")} · +${items.length - max}` : items.join(" · ");
}

function operatorName(id: string | null | undefined, names: FormatOptions["names"]): string {
  if (!id) return "Operatorsiz";
  return names?.[id] ?? `Operator ${id.slice(0, 6)}`;
}

/** 09:30: yesterday's numbers (spec §14 "kunlik"). */
export function formatDailyReport(r: LeadReport, o: FormatOptions = {}): string {
  const t = r.totals ?? {};
  const leads = n(t.leads);
  const answered = n(t.answered);
  const sources = (r.by_source ?? [])
    .filter((s) => n(s.leads) > 0)
    .map((s) => `${sourceName(s.source)} ${n(s.leads)}`);
  const lost = (r.lost ?? []).filter((x) => n(x.n) > 0);
  const lostTotal = lost.reduce((a, x) => a + n(x.n), 0);

  const out: string[] = [`📊 Kechagi lidlar (${rangeLabel(r.from, r.to)})`, ""];
  out.push(`Yangi lidlar: ${leads}`);
  if (sources.length) out.push(`Manba bo'yicha: ${joinTop(sources)}`);
  out.push(`Javob berilgan: ${answered} · Javobsiz: ${Math.max(0, leads - answered)}`);
  if (o.showControlLine) {
    const p = pct(n(t.answered_in_10), leads);
    out.push(`10 daqiqada javob: ${p ?? "—"}`);
  }
  out.push(`Gaplashildi: ${n(t.talked)} · Taklif: ${n(t.offers)}`);
  out.push(`Shartnoma yuborilgan: ${n(t.contracts_sent)} · Talaba bo'lgan (to'lov): ${n(t.students)}`);
  if (lostTotal > 0) {
    out.push(`Yo'qotilganlar: ${lostTotal} — ${joinTop(lost.map((x) => `${lostName(x.reason, o.lostLabels)} ${n(x.n)}`))}`);
  } else {
    out.push("Yo'qotilganlar: 0");
  }
  if (o.bugunCount != null) {
    out.push("", `Bugungi BUGUN hajmi: ${o.bugunCount}`);
  }
  return out.join("\n");
}

/** The ad with the most students, then the most leads. */
export function bestAd(
  byAd: LeadReport["by_ad"],
): { ad: string; leads: number; students: number } | null {
  const rows = (byAd ?? [])
    .filter((a) => a.ad && a.ad !== "—")
    .map((a) => ({ ad: String(a.ad), leads: n(a.leads), students: n(a.students) }))
    .sort((a, b) => b.students - a.students || b.leads - a.leads);
  return rows[0] ?? null;
}

/** Monday 09:30: the last 7 days (spec §14 "haftalik"). */
export function formatWeeklyReport(r: LeadReport, o: FormatOptions = {}): string {
  const t = r.totals ?? {};
  const leads = n(t.leads);
  const out: string[] = [`📈 Haftalik hisobot (${rangeLabel(r.from, r.to)})`, ""];

  out.push(`Shartnoma / to'lov (talaba bo'lganlar): ${n(t.students)}`);
  const byOperator = (r.by_operator ?? []).filter((x) => n(x.students) > 0);
  if (byOperator.length) {
    out.push(`Operator bo'yicha: ${joinTop(byOperator.map((x) => `${operatorName(x.operator_id, o.names)} ${n(x.students)}`))}`);
  }
  const bySource = (r.by_source ?? []).filter((x) => n(x.students) > 0);
  if (bySource.length) {
    out.push(`Manba bo'yicha: ${joinTop(bySource.map((x) => `${sourceName(x.source)} ${n(x.students)}`))}`);
  }

  out.push("", "Voronka:");
  const stage = (label: string, v: number, withPct = true) => {
    const p = withPct ? pct(v, leads) : null;
    out.push(`• ${label}: ${v}${p ? ` (${p})` : ""}`);
  };
  stage("Lid", leads, false);
  stage("Javob berildi", n(t.answered));
  stage("Gaplashildi", n(t.talked));
  stage("Taklif", n(t.offers));
  stage("Shartnoma yuborildi", n(t.contracts_sent));
  stage("Talaba", n(t.students));

  const lost = (r.lost ?? []).filter((x) => n(x.n) > 0);
  out.push("");
  out.push(
    lost.length
      ? `Yo'qotish sabablari: ${joinTop(lost.map((x) => `${lostName(x.reason, o.lostLabels)} ${n(x.n)}`))}`
      : "Yo'qotish sabablari: yo'q",
  );

  const best = bestAd(r.by_ad);
  if (best) {
    out.push(
      best.students > 0
        ? `🏆 Eng yaxshi reklama: «${best.ad}» — ${best.students} talaba / ${best.leads} lid`
        : `Eng ko'p lid bergan reklama: «${best.ad}» — ${best.leads} lid (talaba yo'q)`,
    );
  } else {
    out.push("Reklama ma'lumoti yo'q");
  }
  return out.join("\n");
}

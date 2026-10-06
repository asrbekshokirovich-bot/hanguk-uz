/**
 * The arithmetic of the report page (spec §3.5 / §14). Everything the page
 * shows is derived here from the `lead_report()` payload, so it is testable
 * without rendering. Results only: no call counts are produced as a KPI.
 */
import { dayKey } from '../time';
import type { LeadReport } from '../types';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** n / d as a percentage, or null when there is nothing to divide by. */
export function pct(n: number, d: number): number | null {
  return d > 0 ? (num(n) / d) * 100 : null;
}

/** "33%", "—" for null. */
export function formatPct(value: number | null, digits = 0): string {
  return value == null ? '—' : `${value.toFixed(digits)}%`;
}

// ---- period ------------------------------------------------------------------

export type PeriodKind = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  today: 'Bugun',
  yesterday: 'Kecha',
  '7d': '7 kun',
  '30d': '30 kun',
  custom: 'Boshqa',
};

/** "2026-10-05" + n days (calendar arithmetic, no time zone involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The inclusive Tashkent day range `lead_report(from, to)` is called with.
 * "7 kun" / "30 kun" end today and include it.
 */
export function periodRange(
  kind: PeriodKind,
  now: Date = new Date(),
  custom?: { from: string; to: string },
): { from: string; to: string } {
  const today = dayKey(now);
  switch (kind) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    default: {
      const a = custom?.from || today;
      const b = custom?.to || a;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
  }
}

// ---- headline tiles ---------------------------------------------------------------

export interface Tiles {
  students: number;
  offers: number;
  talked: number;
  leads: number;
  /** contracts / leads, in % */
  conversion: number | null;
  /** true when the numbers are the leads of one source rather than the whole period */
  scoped: boolean;
}

/**
 * Shartnomalar · Taklif · Gaplashildi · Lidlar.
 *
 * With no source selected these are the report's own `totals` (what happened in
 * the period). With a source selected the report has no per-source totals, so
 * the tiles are that source's row of `by_source`: the leads that arrived in the
 * period from there and how far they got.
 */
export function headlineTiles(report: LeadReport, source = ''): Tiles {
  if (source) {
    const row = report.by_source.find((s) => s.source === source);
    const leads = num(row?.leads);
    const students = num(row?.students);
    return {
      students,
      offers: num(row?.offers),
      talked: num(row?.talked),
      leads,
      conversion: pct(students, leads),
      scoped: true,
    };
  }
  const t = report.totals;
  return {
    students: num(t.students),
    offers: num(t.offers),
    talked: num(t.talked),
    leads: num(t.leads),
    conversion: pct(num(t.students), num(t.leads)),
    scoped: false,
  };
}

// ---- funnel by source -------------------------------------------------------------

export interface FunnelStep {
  key: 'leads' | 'answered' | 'talked' | 'offers' | 'students';
  label: string;
  count: number;
  /** % of the leads of this row */
  pct: number | null;
}

export interface FunnelRow {
  source: string;
  leads: number;
  steps: FunnelStep[];
  /** contracts / leads, in % */
  conversion: number | null;
}

export const FUNNEL_LABELS: Record<FunnelStep['key'], string> = {
  leads: 'Lid',
  answered: 'Javob',
  talked: 'Gaplashildi',
  offers: 'Taklif',
  students: 'Shartnoma',
};

const FUNNEL_KEYS: FunnelStep['key'][] = ['leads', 'answered', 'talked', 'offers', 'students'];

function funnelFrom(source: string, c: Record<FunnelStep['key'], number>): FunnelRow {
  return {
    source,
    leads: c.leads,
    steps: FUNNEL_KEYS.map((key) => ({ key, label: FUNNEL_LABELS[key], count: c[key], pct: pct(c[key], c.leads) })),
    conversion: pct(c.students, c.leads),
  };
}

/** One funnel row per source (lid → javob → gaplashildi → taklif → shartnoma), optionally just one source. */
export function funnelRows(report: LeadReport, source = ''): FunnelRow[] {
  return report.by_source
    .filter((s) => !source || s.source === source)
    .map((s) =>
      funnelFrom(s.source, {
        leads: num(s.leads),
        answered: num(s.answered),
        talked: num(s.talked),
        offers: num(s.offers),
        students: num(s.students),
      }),
    );
}

/** The "Jami" row: the sum of the rows shown. */
export function funnelTotal(rows: FunnelRow[]): FunnelRow {
  const sum = (key: FunnelStep['key']) => rows.reduce((acc, r) => acc + (r.steps.find((s) => s.key === key)?.count ?? 0), 0);
  return funnelFrom('Jami', {
    leads: sum('leads'),
    answered: sum('answered'),
    talked: sum('talked'),
    offers: sum('offers'),
    students: sum('students'),
  });
}

// ---- ad performance ---------------------------------------------------------------

/** What the user typed into a spend cell: "1 200 000", "350,5" -> number; blank / junk / negative -> null. */
export function parseSpend(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Spend for an ad is for one period: the key says which. */
export const spendKey = (from: string, to: string, ad: string): string => `${from}..${to}|${ad}`;

/** cost of one contract; null when the ad has no contract (or no spend typed yet). */
export function costPerContract(spend: number | null, students: number): number | null {
  if (spend == null || !(students > 0)) return null;
  return spend / students;
}

export interface AdRow {
  ad: string;
  leads: number;
  students: number;
  conversion: number | null;
  spend: number | null;
  costPerContract: number | null;
}

export function adRows(report: LeadReport, spend: Record<string, number>, from: string, to: string): AdRow[] {
  return report.by_ad.map((a) => {
    const leads = num(a.leads);
    const students = num(a.students);
    const s = spend[spendKey(from, to, a.ad)];
    const spent = s == null ? null : s;
    return {
      ad: a.ad,
      leads,
      students,
      conversion: pct(students, leads),
      spend: spent,
      costPerContract: costPerContract(spent, students),
    };
  });
}

/** Spend and contracts over the ads that have a spend typed in. */
export function adTotals(rows: AdRow[]): { spend: number; students: number; costPerContract: number | null } {
  const withSpend = rows.filter((r) => r.spend != null);
  const spend = withSpend.reduce((acc, r) => acc + (r.spend ?? 0), 0);
  const students = withSpend.reduce((acc, r) => acc + r.students, 0);
  return { spend, students, costPerContract: costPerContract(withSpend.length ? spend : null, students) };
}

// ---- lost reasons ---------------------------------------------------------------

export interface LostShare {
  reason: string | null;
  label: string;
  n: number;
  /** share of all lost in the period, in % */
  share: number;
}

export const NO_REASON_LABEL = "Sabab ko'rsatilmagan";

export function lostShares(report: LeadReport, labelOf: (key: string) => string): LostShare[] {
  const total = report.lost.reduce((acc, l) => acc + num(l.n), 0);
  return report.lost
    .map((l) => ({
      reason: l.reason,
      label: l.reason ? labelOf(l.reason) : NO_REASON_LABEL,
      n: num(l.n),
      share: total > 0 ? (num(l.n) / total) * 100 : 0,
    }))
    .sort((a, b) => b.n - a.n);
}

// ---- old vs new ------------------------------------------------------------------

export interface GenerationStats {
  generation: 'old' | 'new';
  leads: number;
  answered: number;
  /** answered / leads, in % */
  answeredPct: number | null;
  students: number;
  /** students / leads, in % */
  conversion: number | null;
}

export function generationCompare(report: LeadReport): { old: GenerationStats; new: GenerationStats } {
  const stats = (generation: 'old' | 'new'): GenerationStats => {
    const row = report.generation.find((g) => g.generation === generation);
    const leads = num(row?.leads);
    const answered = num(row?.answered);
    const students = num(row?.students);
    return {
      generation,
      leads,
      answered,
      answeredPct: pct(answered, leads),
      students,
      conversion: pct(students, leads),
    };
  };
  return { old: stats('old'), new: stats('new') };
}

// ---- control line ---------------------------------------------------------------

/** "10 daqiqa ichida javob %": answered_in_10 / leads (a control line, not a KPI). */
export function controlLine(report: LeadReport): { answeredIn10: number; leads: number; pct: number | null } {
  const leads = num(report.totals.leads);
  const answeredIn10 = num(report.totals.answered_in_10);
  return { answeredIn10, leads, pct: pct(answeredIn10, leads) };
}

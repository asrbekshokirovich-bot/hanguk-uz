import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * The Marketing panel's data (migration 20261030090000_app_marketing):
 * analytics_marketing for a period and the one before it (S8), the channel
 * names, the retention cohorts, and spend (S9).
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export interface MarketingKpi {
  new_devices: number;
  new_active: number;
  requests: number;
  requests_form: number;
  requests_telegram: number;
  new_leads: number;
  contracts: number;
  app_contracts: number;
  test_devices: number;
}

export interface ChannelRow {
  key: string;
  new_devices: number;
  active: number;
  requests: number;
  contracts: number;
  /** Spend by currency. */
  spend: Record<string, number>;
}

export interface SpendRow {
  week: string;
  channel: string;
  amount: number;
  currency: 'USD' | 'UZS';
  note: string | null;
}

export interface Marketing {
  from: string;
  to: string;
  include_test: boolean;
  kpi: MarketingKpi;
  channels: ChannelRow[];
  /** 'all' and each channel → the eight steps. */
  funnel: Record<string, number[]>;
  demand: {
    filters: { field: string; value: string; devices: number }[];
    answers: { form: string; q: string; band: string; devices: number }[];
    universities: {
      institution_id: string;
      name_en: string | null;
      name_ko: string | null;
      devices: number;
      opens: number;
      avg_position: number | null;
      seen: number;
    }[];
  };
  stops: {
    exit_screens: { screen: string; sessions: number }[];
    language_exits: number;
    client_code_seen: number;
    client_code_left: number;
    locked_tabs: { tab: string; devices: number }[];
    lead_form: { opened: number; field_error: number; submitted: number };
  };
  returning: { active: number; new: number; returning: number };
  spend: SpendRow[];
}

export interface Cohort {
  week: string;
  devices: number;
  d1: number | null;
  d7: number | null;
  d30: number | null;
}

/** The funnel's eight steps (S2), in order. */
export const FUNNEL_STEPS = ['opened', 'active', 'university', 'intent', 'report', 'request', 'talked', 'contract'] as const;

export type PeriodKey = 'today' | '7' | '30' | '90' | 'range';

/** Tashkent's date today, as YYYY-MM-DD. */
export function tashkentToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

/** The period for a choice (both ends inclusive), and the one just before it, as long. */
export function periodOf(key: PeriodKey, range: { from: string; to: string }, today = tashkentToday()) {
  let from = today;
  let to = today;
  if (key === '7') from = addDays(today, -6);
  else if (key === '30') from = addDays(today, -29);
  else if (key === '90') from = addDays(today, -89);
  else if (key === 'range') {
    from = range.from <= range.to ? range.from : range.to;
    to = range.from <= range.to ? range.to : range.from;
  }
  const len = daysBetween(from, to) + 1;
  return { from, to, prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
}

/** «20–26-okt», «28-sen – 4-okt», «26-okt». */
export function periodLabel(from: string, to: string): string {
  const m = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (from === to) return `${td}-${m[tm - 1]}`;
  if (fm === tm) return `${fd}–${td}-${m[tm - 1]}`;
  return `${fd}-${m[fm - 1]} – ${td}-${m[tm - 1]}`;
}

function call<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  return db.rpc(fn, args).then(({ data, error }: { data: T | null; error: { message: string } | null }) => ({
    data,
    error: error ? error.message : null,
  }));
}

/** The period and the one before it. */
export function useMarketing(from: string, to: string, prevFrom: string, prevTo: string, includeTest: boolean) {
  const [data, setData] = useState<Marketing | null>(null);
  const [prev, setPrev] = useState<Marketing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      call<Marketing>('analytics_marketing', { p_from: from, p_to: to, p_include_test: includeTest }),
      call<Marketing>('analytics_marketing', { p_from: prevFrom, p_to: prevTo, p_include_test: includeTest }),
    ]).then(([a, b]) => {
      if (!alive) return;
      setError(a.error ?? b.error);
      setData(a.data);
      setPrev(b.data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [from, to, prevFrom, prevTo, includeTest, tick]);

  return { data, prev, loading, error, reload: useCallback(() => setTick((n) => n + 1), []) };
}

export function useRetention(includeTest: boolean) {
  const [data, setData] = useState<Cohort[] | null>(null);
  useEffect(() => {
    let alive = true;
    void call<Cohort[]>('analytics_retention', { p_weeks: 8, p_include_test: includeTest }).then((r) => {
      if (alive) setData(r.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [includeTest]);
  return data;
}

/** «Qayerdan topdingiz?» answers by key, in their order (lead_how_heard). */
export function useChannelNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    db.from('lead_how_heard')
      .select('key, label_uz, sort')
      .order('sort')
      .then(({ data }: { data: { key: string; label_uz: string }[] | null }) => {
        if (alive && data) setNames(Object.fromEntries(data.map((r) => [r.key, r.label_uz])));
      });
    return () => {
      alive = false;
    };
  }, []);
  return names;
}

export async function setSpend(week: string, channel: string, amount: number | null, currency: string, note: string) {
  return call<{ status: string }>('analytics_spend_set', {
    p_week: week,
    p_channel: channel,
    p_amount: amount,
    p_currency: currency,
    p_note: note || null,
  });
}

/** A whole number in groups of three: 500 000, 1,200. */
function group(v: number, sep: string): string {
  return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** "$120", "500 000 so'm"; several currencies joined with « + ». */
export function money(by: Record<string, number> | null | undefined): string | null {
  if (!by) return null;
  const parts = Object.entries(by)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => (c === 'USD' ? `$${group(v, ',')}` : `${group(v, ' ')} so'm`));
  return parts.length ? parts.join(' + ') : null;
}

/** Spend over a count (cost of one request or contract), per currency. */
export function perOne(by: Record<string, number> | null | undefined, n: number): string | null {
  if (!by || n <= 0) return null;
  const each = Object.fromEntries(Object.entries(by).map(([c, v]) => [c, v / n]));
  return money(each);
}

type T = (k: string, o?: Record<string, unknown>) => string;

export function channelName(key: string, names: Record<string, string>, t: T): string {
  return key === 'unknown' ? t('marketing.unknown') : names[key] ?? key;
}

export const ANSWER_QS = ['route', 'topik', 'ielts', 'bank', 'income', 'income_documented', 'age'] as const;

/** A range as the person sees it: «TOPIK 2», «5–10 mln won», «$5–10 ming». */
export function bandLabel(q: string, band: string, t: T): string {
  const n = Number(band);
  switch (q) {
    case 'topik':
      return n > 0 ? `TOPIK ${n}` : t('marketing.bands.none');
    case 'ielts':
      return n > 0 ? `IELTS ${band}` : t('marketing.bands.none');
    case 'bank':
      return n >= 30 ? t('marketing.bands.bankMax') : t('marketing.bands.bank', { from: n, to: n + 5 });
    case 'income':
      return t(`marketing.bands.income${n}`, { defaultValue: band });
    case 'income_documented':
      return t(band === 'true' ? 'marketing.bands.yes' : 'marketing.bands.no');
    case 'route':
      return t(`marketing.bands.route.${band}`, { defaultValue: band });
    case 'age':
      return t(`marketing.bands.age${n}`, { defaultValue: band });
    default:
      return band;
  }
}

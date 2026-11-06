import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Ushlab qolish rejasi P02 (Claude Design D1): the «Qaytish» tab reads
 * analytics_retention_v2 (P01): day-N return per cohort week and audience,
 * with the Adjust education benchmark.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type Audience = 'mehmon' | 'talaba';
export type Day = 'd1' | 'd3' | 'd7' | 'd14' | 'd30';
export const DAYS: Day[] = ['d1', 'd3', 'd7', 'd14', 'd30'];

export interface RetentionRow {
  week: string | null;
  audience: Audience;
  devices: number;
  d1: number; d1_base: number;
  d3: number; d3_base: number;
  d7: number; d7_base: number;
  w7: number;
  d14: number; d14_base: number;
  d30: number; d30_base: number;
}

export interface Retention {
  from: string;
  to: string;
  rows: RetentionRow[];
  benchmark: { source: string; d1: number; d3: number; d7: number; d30: number };
}

/** Share in percent with one decimal, null when no device could count yet. */
export function rate(row: RetentionRow | undefined, day: Day): number | null {
  if (!row) return null;
  const base = row[`${day}_base` as const];
  if (!base) return null;
  return Math.round((row[day] / base) * 1000) / 10;
}

/** «11,8%» — Uzbek decimal comma. */
export function pct(v: number | null): string {
  return v === null ? '—' : `${String(v).replace('.', ',')}%`;
}

export function totalOf(data: Retention | null, aud: Audience): RetentionRow | undefined {
  return data?.rows.find((r) => r.week === null && r.audience === aud);
}

export function weeksOf(data: Retention | null, aud: Audience): RetentionRow[] {
  return (data?.rows ?? []).filter((r) => r.week !== null && r.audience === aud);
}

export function useRetention(from: string, includeTest = false) {
  const [data, setData] = useState<Retention | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    db.rpc('analytics_retention_v2', { p_from: from, p_include_test: includeTest }).then(
      ({ data, error }: { data: Retention | null; error: { message: string } | null }) => {
        if (!alive) return;
        setError(error ? error.message : null);
        if (!error) setData(data);
      },
    );
    return () => {
      alive = false;
    };
  }, [from, includeTest]);
  return { data, error };
}

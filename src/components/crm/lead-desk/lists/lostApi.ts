/**
 * One extra read for the "Yo'qotilganlar" tab: how many lost leads there are
 * per reason (the chips above the table). It is the single `lost_reason`
 * column of the lost leads, read a thousand at a time.
 */
import { supabase } from '@/integrations/supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as { from: (table: string) => any };
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface LostReasonCount {
  /** null = lost without a recorded reason */
  reason: string | null;
  n: number;
}

export async function fetchLostReasonCounts(): Promise<LostReasonCount[]> {
  const counts = new Map<string | null, number>();
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await db
      .from('leads')
      .select('lost_reason')
      .eq('stage', 'lost')
      .is('merged_into_id', null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as { lost_reason: string | null }[];
    for (const r of page) counts.set(r.lost_reason ?? null, (counts.get(r.lost_reason ?? null) ?? 0) + 1);
    if (page.length < 1000) break;
  }
  return [...counts.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n);
}

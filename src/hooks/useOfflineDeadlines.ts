/**
 * Each chosen university's offline-document deadline, read from the
 * "Offline hujjat topshirish" stage of its uploaded guideline(s)
 * (university_guideline_rounds). A university with several guidelines or
 * rounds gets the nearest deadline that is still ahead; if every one has
 * passed, the most recent one (so the page can say the post was missed).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUniversityCatalog } from '@/hooks/useUniversityCatalog';
import { toIsoDay } from '@/lib/postSchedule';

export const OFFLINE_STAGE = 'Offline hujjat topshirish';

interface RoundRow {
  guideline_uuid: string;
  bosqich: number;
  tugash_sana: string | null;
}

interface Result {
  data: unknown;
  error: { message: string } | null;
}
interface UntypedQuery extends PromiseLike<Result> {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  in: (column: string, values: unknown[]) => UntypedQuery;
}
const db = supabase as unknown as { from: (table: string) => UntypedQuery };

export interface OfflineDeadline {
  date: string;
  bosqich: number;
}

/** Nearest deadline on or after today, else the latest past one. */
export function pickDeadline(rounds: OfflineDeadline[], todayIso: string): OfflineDeadline | null {
  if (rounds.length === 0) return null;
  const sorted = [...rounds].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((r) => r.date >= todayIso) ?? sorted[sorted.length - 1];
}

export function useOfflineDeadlines(institutionIds: string[]) {
  const catalog = useUniversityCatalog();

  const guidelineToInstitution = useMemo(() => {
    const wanted = new Set(institutionIds);
    const m = new Map<string, string>();
    for (const e of catalog.entries) {
      if (!wanted.has(e.institution.id)) continue;
      for (const g of e.guidelines) m.set(g.id, e.institution.id);
    }
    return m;
  }, [catalog.entries, institutionIds]);

  const guidelineIds = useMemo(() => [...guidelineToInstitution.keys()].sort(), [guidelineToInstitution]);

  const rounds = useQuery<RoundRow[], Error>({
    queryKey: ['offline-deadlines', guidelineIds],
    enabled: guidelineIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from('university_guideline_rounds')
        .select('guideline_uuid, bosqich, tugash_sana')
        .eq('etap_nomi', OFFLINE_STAGE)
        .in('guideline_uuid', guidelineIds);
      if (error) throw new Error(error.message);
      return (data ?? []) as RoundRow[];
    },
  });

  const byInstitution = useMemo(() => {
    const grouped = new Map<string, OfflineDeadline[]>();
    for (const r of rounds.data ?? []) {
      const inst = guidelineToInstitution.get(r.guideline_uuid);
      if (!inst || !r.tugash_sana) continue;
      grouped.set(inst, [...(grouped.get(inst) ?? []), { date: r.tugash_sana, bosqich: r.bosqich }]);
    }
    const today = toIsoDay(new Date());
    const out = new Map<string, OfflineDeadline>();
    for (const [inst, list] of grouped) {
      const pick = pickDeadline(list, today);
      if (pick) out.set(inst, pick);
    }
    return out;
  }, [rounds.data, guidelineToInstitution]);

  return { byInstitution, loading: catalog.loading || rounds.isLoading };
}

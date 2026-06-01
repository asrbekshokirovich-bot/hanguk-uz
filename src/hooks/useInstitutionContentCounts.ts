/**
 * One-query content-availability summary for every institution, backed by the
 * v_institution_content_counts view. Lets the student browse list show which
 * universities actually have admissions info (and how much) without firing a
 * query per card.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstitutionContentCounts {
  institution_id: string;
  cycles: number;
  requirements: number;
  documents: number;
  scholarships: number;
  tuition: number;
  periods: number;
}

export type ContentCountsMap = Record<string, InstitutionContentCounts>;

export function hasAnyContent(c?: InstitutionContentCounts): boolean {
  if (!c) return false;
  return (
    c.requirements > 0 ||
    c.documents > 0 ||
    c.scholarships > 0 ||
    c.tuition > 0 ||
    c.periods > 0
  );
}

export function useInstitutionContentCounts() {
  return useQuery<ContentCountsMap, Error>({
    queryKey: ['institution-content-counts'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        // @ts-expect-error - view not in generated types
        .from('v_institution_content_counts')
        .select('*');
      if (error) throw error;
      const rows = (data ?? []) as unknown as InstitutionContentCounts[];
      const map: ContentCountsMap = {};
      for (const r of rows) map[r.institution_id] = r;
      return map;
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * One pending row of `public.proposed_sources` — a guideline URL the nightly
 * Routine found but could NOT ingest itself.
 *
 * Korean university sites block the crawler often enough that the finder is
 * built to fail closed: when a fetch is refused (HTTP block, non-PDF, network
 * error) the worker files the URL here with `review_notes` explaining why,
 * instead of dropping it (see guideline_finder_worker.record_proposed_note /
 * ingest_one_url). So this queue is exactly "the Routine could not open the
 * site — here is the original link", which a human can open by hand.
 *
 * Read/update is gated by RLS to admin + uni_db_reviewer, the same audience as
 * the approval queue. The generated Supabase types cover this table, but the
 * row shape is declared inline to match the sibling review hooks.
 */
export interface ProposedSourceRow {
  id: string;
  url_ko: string;
  source_type: string;
  /** 'manual' = the Routine's own researched URL; otherwise the search adapter. */
  proposed_by: string;
  proposed_at: string;
  candidate_title: string | null;
  candidate_snippet: string | null;
  /** Why it was not ingested — the blocked/failed reason line. */
  review_notes: string | null;
}

const PROPOSED_SOURCES_KEY = ['uni_db', 'proposed_sources'] as const;

export function useProposedSources(enabled = true) {
  return useQuery<ProposedSourceRow[], Error>({
    queryKey: PROPOSED_SOURCES_KEY,
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposed_sources')
        .select(
          'id, url_ko, source_type, proposed_by, proposed_at, candidate_title, candidate_snippet, review_notes',
        )
        .eq('status', 'pending_review')
        .order('proposed_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ProposedSourceRow[];
    },
  });
}

/**
 * Dismiss a link once a human has dealt with it (opened it, uploaded the PDF
 * by hand, or judged it useless). Only `rejected` is offered: `approved` fires
 * `trg_proposed_source_promote`, which promotes the URL into
 * `announcement_sources` and puts it back in the crawler's path — the wrong
 * outcome for a host that is blocking us.
 */
export function useDismissProposedSource() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('proposed_sources')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user?.id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROPOSED_SOURCES_KEY }),
  });
}

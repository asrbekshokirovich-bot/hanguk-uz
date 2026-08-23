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
  /** Added by migration 20260823170000. Optional so the UI degrades if the
   *  view is not deployed yet. */
  status?: string | null;
  /** True when this link was closed before and has been brought back. */
  was_closed?: boolean | null;
  /** True when a person closed it, false when the crawler did. */
  closed_by_person?: boolean | null;
  reviewed_at?: string | null;
}

const PROPOSED_SOURCES_KEY = ['uni_db', 'proposed_sources'] as const;

export function useProposedSources(enabled = true) {
  return useQuery<ProposedSourceRow[], Error>({
    queryKey: PROPOSED_SOURCES_KEY,
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      // The view, not the table: which closed links deserve to come back is a
      // rule with four cases behind it (see migration 20260823170000), and it
      // belongs next to the data rather than restated in every client.
      const { data, error } = await supabase
        .from('v_proposed_links_dashboard')
        .select(
          'id, url_ko, source_type, proposed_by, proposed_at, candidate_title, ' +
            'candidate_snippet, review_notes, status, was_closed, closed_by_person, reviewed_at',
        )
        .order('proposed_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ProposedSourceRow[];
    },
  });
}

/**
 * Dismiss a link once a human has dealt with it (opened it, uploaded the PDF
 * by hand, or judged it useless). `approved` is deliberately not offered: it
 * fires `trg_proposed_source_promote`, which promotes the URL into
 * `announcement_sources` and puts it back in the crawler's path — the wrong
 * outcome for a host that is blocking us.
 *
 * Writes `dismissed`, not `rejected`. Since migration 20260823170000 the tab
 * shows rejected links again, so writing `rejected` here would put the card
 * straight back on the screen the moment it was closed.
 */
export function useDismissProposedSource() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('proposed_sources')
        .update({
          status: 'dismissed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user?.id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROPOSED_SOURCES_KEY }),
  });
}

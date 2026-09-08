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
  dismiss_reason?: string | null;
  dismiss_detail?: string | null;
}

/**
 * Why a reviewer closed a link. Drawn from what actually happened to the 407
 * links reopened on 2026-08-23, so picking one describes a real case rather
 * than a category invented for the dropdown.
 */
export type LinkDismissReason =
  | 'not_2027'
  | 'already_have'
  | 'uploaded'
  | 'no_guideline'
  | 'site_dead'
  | 'not_relevant'
  | 'other';

export const LINK_DISMISS_REASONS: LinkDismissReason[] = [
  'not_2027',
  'already_have',
  'uploaded',
  'no_guideline',
  'site_dead',
  'not_relevant',
  'other',
];

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
            'candidate_snippet, review_notes, status, was_closed, closed_by_person, ' +
            'reviewed_at, dismiss_reason, dismiss_detail',
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
  return useMutation<void, Error,
    { id: string; reason: LinkDismissReason; detail?: string }>({
    mutationFn: async ({ id, reason, detail }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('proposed_sources')
        .update({
          status: 'dismissed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user?.id ?? null,
          // The reason is the point. Closing 2 511 links without one is why
          // working out which deserved to come back meant regex over prose.
          dismiss_reason: reason,
          dismiss_detail: detail?.trim() || null,
        })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      // 2026-09-01: RLS on proposed_sources admits only
      // profiles.role in ('admin', 'uni_db_reviewer') — narrower than
      // fn_can_review_uni_db, which is what actually gates who sees this
      // tab (any user_roles staff: owner, call_operator, document_handler,
      // university_staff). Without checking the returned rows, an update
      // from one of those wider roles matched zero rows, came back with no
      // error, and this mutation still reported success — the operator saw
      // the link disappear from the list on refetch and believed it was
      // closed, while it stayed live and reachable by the crawler.
      if (!data || data.length === 0) {
        throw new Error(
          'This account cannot close links — ask an admin or reviewer, ' +
            'or the link may already be handled.',
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROPOSED_SOURCES_KEY }),
  });
}

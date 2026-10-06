import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDesk } from '../api';
import { groupByBucket } from '../desk/deskModel';
import type { DeskRow } from '../types';
import { useLeadRealtime } from './useLeadRealtime';

export const DESK_KEY = ['lead-v2', 'desk'] as const;

/** Safety net under the realtime subscription: the desk re-reads every 30 s. */
export const DESK_POLL_MS = 30_000;

/**
 * The rows of `lead_desk()` (already ordered by the database) grouped by block.
 *
 * Kept fresh three ways: Supabase realtime on `leads`, `lead_drafts` and
 * `lead_events` (debounced ~800 ms), a 30-second poll (also in a background tab,
 * so the HOZIR alerts still fire), and a refetch when the tab regains focus.
 */
export function useDesk() {
  const query = useQuery<DeskRow[]>({
    queryKey: DESK_KEY,
    queryFn: async () => (await fetchDesk()) ?? [],
    staleTime: 10_000,
    refetchInterval: DESK_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useLeadRealtime('lead-v2-desk', DESK_KEY);

  const rows = query.data;
  const grouped = useMemo(() => groupByBucket(rows), [rows]);

  return {
    /** undefined until the first successful load */
    rows,
    grouped,
    loading: query.isLoading,
    /** the last error, kept while stale rows are still on screen */
    error: query.error as Error | null,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}


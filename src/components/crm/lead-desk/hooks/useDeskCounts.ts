import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDeskCounts } from '../api';
import type { DeskCounts } from '../types';
import { DESK_TABLES, useLeadRealtime } from './useLeadRealtime';

export const COUNTS_KEY = ['lead-v2', 'counts'] as const;

/** The desk tables, plus the comments that feed the "Izohlar" badge. */
const COUNT_TABLES = [...DESK_TABLES, 'social_comments'] as const;

export const EMPTY_COUNTS: DeskCounts = { hozir: 0, breached: 0, barcha: 0, yoqotilgan: 0, baza: 0, comments: 0 };

/**
 * The sidebar badges and the desk header's "Izohlar · N": `lead_desk_counts()`.
 * Same freshness as the desk: realtime (plus `social_comments`, which feeds the
 * comments badge), a 30-second poll, and a refetch on focus.
 *
 * `enabled: false` (an operator-less role) neither calls the RPC nor subscribes.
 */
export function useDeskCounts(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const query = useQuery<DeskCounts>({
    queryKey: COUNTS_KEY,
    queryFn: fetchDeskCounts,
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useLeadRealtime('lead-v2-counts', COUNTS_KEY, { tables: COUNT_TABLES, enabled });

  const data = query.data;
  // all zeros until the first load, so a badge never renders against `undefined`
  const counts = useMemo<DeskCounts>(() => ({ ...EMPTY_COUNTS, ...(data ?? {}) }), [data]);

  return {
    counts,
    loaded: query.data !== undefined,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

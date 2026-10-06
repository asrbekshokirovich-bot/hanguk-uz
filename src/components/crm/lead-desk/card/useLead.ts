import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchLead, saveFields } from '../api';
import { explainError } from '../copy';
import type { LeadV2 } from '../types';

export const leadKey = (leadId: string) => ['lead-v2', 'lead', leadId] as const;

let channelSeq = 0;

/**
 * Everything a write on a lead can change: the desk row, the sidebar counts,
 * the card, its timeline — and the side tables a given action touches.
 */
export function invalidateLead(
  qc: QueryClient,
  leadId: string,
  extra: ('drafts' | 'promises' | 'contacts' | 'merges' | 'chat' | 'suggestions')[] = [],
): void {
  void qc.invalidateQueries({ queryKey: ['lead-v2', 'desk'] });
  void qc.invalidateQueries({ queryKey: ['lead-v2', 'counts'] });
  void qc.invalidateQueries({ queryKey: leadKey(leadId) });
  void qc.invalidateQueries({ queryKey: ['lead-v2', 'timeline', leadId] });
  for (const key of extra) void qc.invalidateQueries({ queryKey: ['lead-v2', key, leadId] });
}

/**
 * One lead, live: react-query ['lead-v2','lead',id] + a realtime subscription
 * on that row (`postgres_changes`, filter `id=eq.<id>`) that invalidates it.
 */
export function useLead(leadId: string | null | undefined) {
  const qc = useQueryClient();
  const id = leadId ?? '';
  const query = useQuery({
    queryKey: leadKey(id),
    queryFn: () => fetchLead(id),
    enabled: !!leadId,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!leadId) return;
    // a topic is shared by name: two cards of the same lead must not share (and re-subscribe) one channel
    const channel = supabase
      .channel(`lead-v2-lead-${leadId}-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` }, () => {
        void qc.invalidateQueries({ queryKey: leadKey(leadId) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [leadId, qc]);

  const refetch = useCallback(() => query.refetch(), [query]);
  return {
    lead: (query.data ?? null) as LeadV2 | null,
    loading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
    refetch,
  };
}

/**
 * Saving card fields on change: optimistic, rolled back with a toast
 * (`explainError`) when the database refuses.
 */
export function useLeadWriter(leadId: string) {
  const qc = useQueryClient();

  const write = useCallback(
    async (patch: Record<string, unknown>, apply: () => Promise<unknown>): Promise<boolean> => {
      const key = leadKey(leadId);
      const before = qc.getQueryData<LeadV2 | null>(key);
      if (before) qc.setQueryData<LeadV2 | null>(key, { ...before, ...patch } as LeadV2);
      try {
        await apply();
        void qc.invalidateQueries({ queryKey: ['lead-v2', 'desk'] });
        void qc.invalidateQueries({ queryKey: key });
        return true;
      } catch (e) {
        if (before) qc.setQueryData<LeadV2 | null>(key, before);
        toast.error(explainError(e instanceof Error ? e.message : String(e)));
        return false;
      }
    },
    [leadId, qc],
  );

  /** Card fields (phone and @handles included): `lead_save_fields`. Resolves false when the database refused. */
  const saveField = useCallback(
    (patch: Record<string, unknown>) => write(patch, () => saveFields(leadId, patch)),
    [leadId, write],
  );

  return { saveField };
}

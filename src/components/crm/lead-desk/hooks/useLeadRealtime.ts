import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Tables whose changes can move a lead between the desk's blocks. */
export const DESK_TABLES = ['leads', 'lead_drafts', 'lead_events'] as const;

/**
 * Invalidate `queryKey` whenever one of `tables` changes (Supabase realtime
 * `postgres_changes`), at most once per `debounceMs`: a webhook that touches a
 * dozen rows should cost one refetch, not twelve.
 *
 * The realtime channel is a convenience on top of the polling each query already
 * does — a missing publication or a dropped socket only makes the desk a few
 * seconds slower, never wrong — so every failure here is swallowed.
 */
export function useLeadRealtime(
  channelName: string,
  queryKey: QueryKey,
  options: { tables?: readonly string[]; debounceMs?: number; enabled?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const { tables = DESK_TABLES, debounceMs = 800, enabled = true } = options;
  const tablesKey = tables.join(',');
  const queryKeyHash = JSON.stringify(queryKey);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void queryClient.invalidateQueries({ queryKey });
      }, debounceMs);
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(channelName);
      for (const table of tablesKey.split(',')) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
      }
      channel.subscribe();
    } catch (error) {
      console.warn('[lead-desk] realtime unavailable, falling back to polling', error);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (channel) {
        try {
          void supabase.removeChannel(channel);
        } catch {
          /* already gone */
        }
      }
    };
    // `queryKey` is an array literal at the call site; its hash is the stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, queryKeyHash, tablesKey, debounceMs, enabled, queryClient]);
}

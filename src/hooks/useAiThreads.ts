import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sortThreads, type AiThread } from '@/lib/aiThreads';

// ai_threads is newer than the generated types.
const db = supabase as unknown as SupabaseClient;

/** The signed-in user's Hanguk AI conversations (RLS: own rows only). */
export function useAiThreads() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['ai-threads', user?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<AiThread[]> => {
      const { data, error } = await db
        .from('ai_threads')
        .select('id, title, pinned, message_count, last_preview, created_at, updated_at')
        .eq('user_id', user!.id)
        .gt('message_count', 0)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return sortThreads((data ?? []) as AiThread[]);
    },
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['ai-threads'] });
  }, [qc]);

  const togglePin = useCallback(async (thread: AiThread) => {
    await db.from('ai_threads').update({ pinned: !thread.pinned }).eq('id', thread.id);
    refresh();
  }, [refresh]);

  return { threads: query.data ?? [], isLoading: query.isLoading, refresh, togglePin };
}

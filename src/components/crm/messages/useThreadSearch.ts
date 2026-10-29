import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ThreadSearchHit {
  matched: 'name' | 'lead' | 'phone' | 'student' | 'message' | string;
  snippet: string | null;
}

const DEBOUNCE_MS = 300;

/** True when the query is worth a database round trip. */
export function isServerQuery(query: string): boolean {
  const q = query.trim();
  const digits = q.replace(/\D/g, '');
  return q.length >= 3 || digits.length >= 4;
}

/**
 * Server-side search (`search_threads`): lead and student names and phones,
 * @usernames and everything ever written in the chat. The queue merges the
 * result with its own local match, so typing feels instant and the database
 * fills in the rest a moment later.
 */
export function useThreadSearch(query: string) {
  const [hits, setHits] = useState<Map<string, ThreadSearchHit>>(new Map());
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!isServerQuery(q)) {
      setHits(new Map());
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await (supabase.rpc as any)('search_threads', { p_query: q, p_limit: 80 });
      if (cancelled) return;
      if (error) {
        console.error('search_threads failed', error);
        setHits(new Map());
      } else {
        const map = new Map<string, ThreadSearchHit>();
        for (const row of (data ?? []) as { thread_id: string; matched: string; snippet: string | null }[]) {
          map.set(row.thread_id, { matched: row.matched, snippet: row.snippet });
        }
        setHits(map);
      }
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { hits, searching };
}

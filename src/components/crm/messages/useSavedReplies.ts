import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SAVED_REPLIES } from './savedReplies';

/** A row of `saved_replies` as the composer and Settings use it. */
export interface SavedReplyRow {
  id: string;
  key: string;
  title: string;
  body: string;
  sort_order: number;
  active: boolean;
}

/** The pre-database defaults, used only if the table cannot be read. */
const FALLBACK: SavedReplyRow[] = SAVED_REPLIES.map((r, i) => ({
  id: `builtin-${r.key}`,
  key: r.key,
  title: r.titleKey,
  body: r.body,
  sort_order: (i + 1) * 10,
  active: true,
}));

/**
 * Saved replies from the database (audit 2026-10-29, finding 16: they were
 * five constants in the bundle). Owners and admins edit them in Settings;
 * everyone with inbox access reads them.
 */
export function useSavedReplies(options: { includeInactive?: boolean } = {}) {
  const [replies, setReplies] = useState<SavedReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromFallback, setFromFallback] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase.from as any)('saved_replies')
      .select('id, key, title, body, sort_order, active')
      .order('sort_order', { ascending: true })
      .order('key', { ascending: true });
    if (!options.includeInactive) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) {
      console.error('saved_replies failed', error);
      setReplies(FALLBACK);
      setFromFallback(true);
    } else {
      setReplies((data ?? []) as SavedReplyRow[]);
      setFromFallback(false);
    }
    setLoading(false);
  }, [options.includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  return { replies, loading, fromFallback, reload: load };
}

/**
 * Fills the template's variables. `{{ism}}` (also `{{name}}`) becomes the
 * person's first name; with no usable name the placeholder and the space or
 * comma before it are dropped, so "Assalomu alaykum, {{ism}}!" reads
 * "Assalomu alaykum!" rather than greeting nobody by name.
 */
export function fillReply(body: string, fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  const usable = first && !/^[@.+\d]/.test(first) && first.length > 1 ? first : '';
  return body.replace(/([,\s]*)\{\{\s*(ism|name)\s*\}\}/gi, (_m, lead: string) => (usable ? `${lead}${usable}` : ''));
}

/** Replies whose key starts with what the operator typed after "/". */
export function matchReplies(replies: SavedReplyRow[], draft: string): SavedReplyRow[] {
  const typed = draft.trim().toLowerCase();
  if (!typed.startsWith('/') || typed.length < 2) return replies;
  return replies.filter((r) => r.key.toLowerCase().startsWith(typed));
}

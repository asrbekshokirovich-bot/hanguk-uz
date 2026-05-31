import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Translates a review item's `parsed_output` to English for display only.
 *
 * The extractor stores Korean source text (notes_ko, prose_ko, name_ko, …) and
 * the review UI is built to show the exact stored payload. This hook produces an
 * English-rendered copy on demand via the `translate-parsed-output` edge
 * function; it never mutates the stored data, so the Korean original remains the
 * source of truth for editing, the diff, and accept.
 */

// Hangul Jamo + precomposed syllables.
const HANGUL_RE = /[\u3130-\u318F\uAC00-\uD7A3]/;

/** True when the value (or any nested string) contains Korean characters. */
export function containsHangul(value: unknown): boolean {
  if (value == null) return false;
  try {
    return HANGUL_RE.test(typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    return false;
  }
}

// Stable, compact cache key for an immutable JSON payload (djb2 + length) so we
// don't keep the whole blob in the query key.
function hashJson(value: unknown): string {
  let s = '';
  try {
    s = JSON.stringify(value) ?? '';
  } catch {
    s = '';
  }
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

export interface ReviewTranslation {
  /** Translated payload to render, or the original when there's no Korean. */
  data: unknown;
  isLoading: boolean;
  isError: boolean;
}

export function useReviewTranslation(
  itemId: string,
  parsedOutput: unknown,
  enabled: boolean,
): ReviewTranslation {
  const hasKorean = containsHangul(parsedOutput);

  const query = useQuery({
    queryKey: ['review-translation', itemId, hashJson(parsedOutput)],
    enabled: enabled && hasKorean,
    // The stored payload is immutable for a given item revision, so a successful
    // translation never goes stale within a session.
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('translate-parsed-output', {
        body: { parsed_output: parsedOutput },
      });
      if (error) throw new Error(error.message);
      const translated = (data as { translated?: unknown } | null)?.translated;
      if (translated === undefined) throw new Error('No translation returned');
      return translated;
    },
  });

  return {
    // Nothing to translate → render the payload as-is (it has no Korean).
    data: hasKorean ? query.data : parsedOutput,
    isLoading: enabled && hasKorean && query.isLoading,
    isError: query.isError,
  };
}

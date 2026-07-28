import type { MessageTranslation } from './types';

/**
 * Translation adapter — currently a stub.
 *
 * The design's inline UZ/RU→EN translation reads from a cache written into
 * `messages.metadata.translation`; anything already cached renders without a
 * round-trip. Producing a NEW translation needs a short-text translate
 * endpoint, and the repo has none: `translate-document` and
 * `translate-parsed-output` are both document/PDF oriented and the wrong shape
 * for a one-line chat message.
 *
 * So this function is the single seam where that service plugs in. It resolves
 * to `null` today, which the UI renders as "translation service not
 * configured" rather than a silent no-op. When a `translate-message` edge
 * function exists, this body becomes one `supabase.functions.invoke` call and
 * a write-back to `messages.metadata.translation`; no component changes.
 */
export interface TranslateRequest {
  messageId: string;
  text: string;
  /** Human-readable target language, e.g. "English". */
  targetLang: string;
}

export const TRANSLATION_CONFIGURED = false;

export async function translateMessage(_req: TranslateRequest): Promise<MessageTranslation | null> {
  return null;
}

/**
 * Reads a cached translation off a `messages.metadata` blob. Tolerates the
 * column being null, a string, or a shape written by an older producer.
 */
export function readCachedTranslation(metadata: unknown): MessageTranslation | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).translation;
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const text = typeof t.text === 'string' ? t.text.trim() : '';
  if (!text) return null;
  return {
    text,
    sourceLang: typeof t.source_lang === 'string' ? t.source_lang : String(t.sourceLang ?? 'Auto'),
    targetLang: typeof t.target_lang === 'string' ? t.target_lang : String(t.targetLang ?? 'English'),
  };
}

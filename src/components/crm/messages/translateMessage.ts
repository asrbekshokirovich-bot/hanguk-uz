import { supabase } from '@/integrations/supabase/client';
import type { MessageTranslation } from './types';

/**
 * Translation adapter.
 *
 * Inline translation reads from a cache in `messages.metadata.translation`, so
 * anything already translated renders with no round-trip. A new translation
 * goes through the `translate-message` edge function and is written back to
 * that cache, which means each message is paid for once however many operators
 * open the conversation afterwards.
 *
 * This was a stub returning null until 2026-09-03 — the button was in the UI
 * and did nothing. The audit suggested wiring it to the existing
 * `translate-fields`; reading that function showed it is gated on the
 * university-data reviewer role and prompted for admission documents, so the
 * inbox would have got a 403 and, past that, the wrong register. Hence a
 * function of its own.
 */
export interface TranslateRequest {
  messageId: string;
  text: string;
  /** Human-readable target language, e.g. "English". */
  targetLang: string;
}

export const TRANSLATION_CONFIGURED = true;

/** UI language code -> the code translate-message expects. */
const TARGET_CODE: Record<string, string> = {
  English: 'en',
  Uzbek: 'uz',
  Russian: 'ru',
  Korean: 'ko',
  UZ: 'uz',
  RU: 'ru',
  EN: 'en',
  KO: 'ko',
};

/** Translate several strings at once. Returns [] on any failure. */
export async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  const target = TARGET_CODE[targetLang] ?? targetLang.toLowerCase();
  const { data, error } = await supabase.functions.invoke('translate-message', {
    body: { texts, target_lang: target },
  });
  if (error) {
    console.error('translate-message failed', error);
    return [];
  }
  const out = (data as { translations?: unknown })?.translations;
  return Array.isArray(out) ? out.map((x) => String(x ?? '')) : [];
}

export async function translateMessage(req: TranslateRequest): Promise<MessageTranslation | null> {
  const text = req.text.trim();
  if (!text) return null;

  const [translated] = await translateTexts([text], req.targetLang);
  // The model is told to return the input unchanged when it is already in the
  // target language, so an identical string means "nothing to show" rather
  // than a failure — rendering it would give the operator two copies of the
  // same sentence stacked on top of each other.
  if (!translated || translated.trim() === text) return null;

  const result: MessageTranslation = {
    text: translated,
    sourceLang: 'Auto',
    targetLang: req.targetLang,
  };

  // Cache it on the message so the next operator to open this conversation
  // pays nothing. A failed write costs a re-translation, not correctness, so
  // it does not block the return.
  void supabase
    .from('messages')
    .select('metadata')
    .eq('id', req.messageId)
    .maybeSingle()
    .then(({ data }) => {
      const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
      return supabase
        .from('messages')
        .update({
          metadata: {
            ...metadata,
            translation: {
              text: result.text,
              source_lang: result.sourceLang,
              target_lang: result.targetLang,
            },
          },
        })
        .eq('id', req.messageId);
    })
    .then(({ error }) => {
      if (error) console.error('translation cache write failed', error);
    });

  return result;
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

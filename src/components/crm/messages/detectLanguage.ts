/**
 * Rough language of a chat message: enough to decide whether "Tarjima
 * qilish" is worth offering in the operator's interface language.
 *
 * The old check only asked "is it not English?", so with an Uzbek interface
 * every Uzbek message offered a translation — into English (audit
 * 2026-10-29, finding 8). Uzbek is written in both scripts here, so Cyrillic
 * alone does not mean Russian: Uzbek-only letters (ў қ ғ ҳ) and common Uzbek
 * words decide it.
 */
export type ChatLanguage = 'uz' | 'ru' | 'ko' | 'en' | 'unknown';

const UZ_CYR_LETTERS = /[ўқғҳЎҚҒҲ]/;
const UZ_CYR_WORDS = /(^|[^а-яё])(ассалому|алайкум|рахмат|раҳмат|керак|қандай|қанча|учун|ҳужжат|хужжат|бор|йўқ|мен|сиз|яхши|ёрдам|ўқиш|укиш|универ\w*|бўлади|булади)(?=$|[^а-яё])/i;
const UZ_LAT_WORDS =
  /\b(va|uchun|men|siz|bor|yo['’`‘]?q|kerak|qancha|qanday|rahmat|salom|assalomu|alaykum|bo['’`‘]l\w*|kel\w*|yubor\w*|hujjat\w*|ariza|yaxshi|qilish|o['’`‘]qish|universitet\w*|iltimos|ha|yo['’`‘]q)\b/i;
const EN_WORDS = /\b(the|and|is|are|you|hello|hi|please|thanks|thank|what|how|when|where|university|documents?)\b/i;

export function detectLanguage(text: string): ChatLanguage {
  const s = text.trim();
  if (!s) return 'unknown';
  if (/[ㄱ-ㆎ가-힣]/.test(s)) return 'ko';
  if (/[Ѐ-ӿ]/.test(s)) {
    return UZ_CYR_LETTERS.test(s) || UZ_CYR_WORDS.test(s.toLowerCase()) ? 'uz' : 'ru';
  }
  if (/[gGoO][‘’'`ʻʼ]/.test(s) || UZ_LAT_WORDS.test(s)) return 'uz';
  if (EN_WORDS.test(s)) return 'en';
  return 'unknown';
}

/** Offer a translation only when the message is in another language than the UI. */
export function needsTranslation(text: string, uiLanguage: string): boolean {
  const lang = detectLanguage(text);
  if (lang === 'unknown') return false;
  return lang !== (uiLanguage || 'uz').slice(0, 2).toLowerCase();
}

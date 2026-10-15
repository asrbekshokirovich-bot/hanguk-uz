/**
 * The words a message to a client must not contain (spec §6 "Taqiq": kafolat,
 * 100%, bepul noutbuk, bitta narx, sertifikatsiz Koreya — the list lives in
 * lead_settings.forbidden_words). Pure, so the composer can call it on every
 * keystroke and tests can run it without a database.
 */
export function findForbidden(text: string, words: string[]): string | null {
  const low = text.toLowerCase();
  for (const w of words) if (w && low.includes(w.toLowerCase())) return w;
  // "10% chegirma", "chegirma 20 foiz": a discount is a promise and needs the boss's approval
  if (/\d+\s*%\s*(chegirma|skidka)|chegirma\s*\d+\s*(%|foiz)/i.test(text)) return '% chegirma';
  return null;
}

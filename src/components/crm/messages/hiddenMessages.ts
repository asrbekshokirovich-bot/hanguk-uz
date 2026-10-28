/**
 * Rows that are stored but say nothing to an operator.
 *
 * Instagram sends an empty card ("template" with no elements) alongside a lead
 * form, and Meta's instant-form reply used to be stored as the bare word
 * "[template]" (Asrbek, 2026-10-28). The webhook no longer stores empty cards
 * and writes a card's words as text; rows still reading "[template]" are the
 * empty ones and stay out of the chat.
 */
export function isHiddenMessage(m: { source?: string | null; content?: string | null }): boolean {
  return m.source === 'instagram' && (m.content ?? '').trim() === '[template]';
}

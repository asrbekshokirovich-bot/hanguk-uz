/**
 * Turns the raw reason a send failed into something an operator can act on.
 *
 * `messages.delivery_error` holds whatever the channel said: Telegram's
 * MTProto codes ("PEER_FLOOD"), Meta's error text in the account's language
 * ("Diese Nachricht wird außerhalb des erlaubten Fensters gesendet…"), or
 * our own English strings. None of that tells a call operator what to do
 * next (audit 2026-10-29, finding 12). The raw text is kept for the tooltip.
 */
export type DeliveryErrorKind =
  | 'peerFlood'
  | 'windowExpired'
  | 'userbotDown'
  | 'tooLong'
  | 'unsupportedMedia'
  | 'blocked'
  | 'unknown';

export function classifyDeliveryError(raw: string | null | undefined): DeliveryErrorKind {
  const s = (raw ?? '').trim();
  if (!s) return 'unknown';
  if (/PEER_FLOOD|FLOOD_WAIT|FLOOD/.test(s)) return 'peerFlood';
  if (/24[- ]?hour|outside.*window|Fenster|messaging window|window expired/i.test(s)) return 'windowExpired';
  if (/userbot|not running|stopped before confirming/i.test(s)) return 'userbotDown';
  if (/exceeds 1000|too long|too large/i.test(s)) return 'tooLong';
  if (/only supports image|unsupported.*attachment|attachment.*not supported/i.test(s)) return 'unsupportedMedia';
  if (/USER_IS_BLOCKED|blocked the bot|USER_DEACTIVATED|INPUT_USER_DEACTIVATED|cannot be reached/i.test(s)) return 'blocked';
  return 'unknown';
}

/** i18n key under `messages.deliveryErrors.*` for the classified reason. */
export function deliveryErrorKey(raw: string | null | undefined): string {
  return `messages.deliveryErrors.${classifyDeliveryError(raw)}`;
}

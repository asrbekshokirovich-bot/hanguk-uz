/**
 * The number a visitor typed into the site's registration form, as the CRM
 * keeps it: "+998XXXXXXXXX" for an Uzbek number however it was written
 * (90 123 45 67, 8 90 123 45 67, 998901234567), "+<digits>" for a number typed
 * with another country's code. null: not a phone number, or one that cannot
 * be told apart without its country code.
 *
 * Kept in step with normalizeGuestPhone in
 * supabase/functions/guest-auth/logic.ts, which checks the same thing again
 * on the server.
 */
export function normalizeVisitorPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const typed = raw.trim();
  const digits = typed.replace(/\D/g, '');
  if (typed.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 10 && digits.startsWith('8')) return `+998${digits.slice(1)}`;
  if (digits.length === 12 && (digits.startsWith('998') || digits.startsWith('996'))) return `+${digits}`;
  return null;
}

/** What may be typed into the field: digits, a leading "+", and the usual separators. */
export function sanitizeVisitorPhone(value: string): string {
  const cleaned = value.replace(/[^\d+ ()-]/g, '');
  // A "+" only means something in front.
  return (cleaned.startsWith('+') ? '+' : '') + cleaned.replace(/\+/g, '').slice(0, 24);
}

/**
 * Display formatting for values the lead record stores in machine form.
 *
 * The worklist reads rows that were written by several different producers —
 * the Telegram bot, the website form, the intake wizard — so the same field
 * arrives as `tashkent_city` from one and `Tashkent` from another. Formatting
 * happens at render time rather than on write, because rewriting stored data
 * to suit one screen is how two producers end up disagreeing permanently.
 */

/**
 * Turn a stored city into something readable: `tashkent_city` → `Tashkent city`.
 * A value that is already prose is left exactly as it is.
 */
export function formatCity(city: string | null): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  if (!trimmed) return null;
  // Only machine values get rewritten — anything with a space is already prose.
  if (!trimmed.includes('_')) return trimmed;
  const words = trimmed.split('_').filter(Boolean).join(' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Group an Uzbek phone number so an operator can read it back down a line:
 * `941966909` → `+998 94 196 69 09`.
 *
 * Anything that is not a recognisable Uzbek number — a foreign number, a
 * half-typed one — is returned untouched. Guessing at an unknown format would
 * make a wrong number look like a valid one.
 */
export function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits;
  if (local.length !== 9) return phone;
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

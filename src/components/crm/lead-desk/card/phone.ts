/**
 * Phone helpers for the card (spec §7, phase 1: "Qo'ng'iroq" shows the number,
 * copies it and hands a `tel:` link to the phone app).
 */

/** A number is dialable once it carries this many digits (same bar as the database's phone key). */
export const MIN_PHONE_DIGITS = 9;

export const phoneDigits = (phone: string | null | undefined): string => (phone ?? '').replace(/\D/g, '');

export const isDialable = (phone: string | null | undefined): boolean => phoneDigits(phone).length >= MIN_PHONE_DIGITS;

/** "tel:+998941966989". A bare 9-digit local number gets the Uzbek country code. */
export function telHref(phone: string): string {
  const raw = (phone ?? '').trim();
  const digits = phoneDigits(raw);
  if (digits.length === 9) return `tel:+998${digits}`;
  return `tel:${raw.startsWith('+') ? '+' : ''}${digits}`;
}

/** Copy text to the clipboard; false when the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea fallback
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand?.('copy') ?? false;
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Hand the number to the phone app through a `tel:` link. */
export function openTel(phone: string): void {
  try {
    const a = document.createElement('a');
    a.href = telHref(phone);
    a.rel = 'noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    // no phone app registered: the number is already copied
  }
}

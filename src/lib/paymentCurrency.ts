/**
 * Money paid in one currency against a payment account kept in another
 * (Davrbek, 2026-11-28: a $3,000 contract paid with 3,000,000 so'm was saved
 * as "3,000 paid" — the form had one currency for both the price and the
 * money received, so the so'm figure went straight into the dollar account,
 * or a dollar price went into a so'm account, and the row showed as paid).
 *
 * The database holds no exchange rate, so the operator types the rate used
 * for this transfer (so'm per 1 USD). The account's paid amount always moves
 * in the account's own currency; the original sum and the rate are written
 * into the transfer's note so the receipt can still be matched to it.
 */

export type Currency = 'UZS' | 'USD';

export const PAYMENT_CURRENCIES: Currency[] = ['UZS', 'USD'];

/** Round to what the currency is counted in: whole so'm, dollar cents. */
export function roundFor(amount: number, currency: string): number {
  return currency === 'UZS' ? Math.round(amount) : Math.round(amount * 100) / 100;
}

/**
 * The paid sum expressed in the account's currency.
 * @param rate so'm per 1 USD; ignored when both currencies are the same.
 * @returns null when a conversion is needed but the rate is missing.
 */
export function toAccountCurrency(
  paid: number,
  paidCurrency: string,
  accountCurrency: string,
  rate: number,
): number | null {
  const value = Number(paid) || 0;
  if (paidCurrency === accountCurrency) return value;
  const r = Number(rate) || 0;
  if (r <= 0) return null;
  if (paidCurrency === 'UZS' && accountCurrency === 'USD') return roundFor(value / r, 'USD');
  if (paidCurrency === 'USD' && accountCurrency === 'UZS') return roundFor(value * r, 'UZS');
  return null;
}

/** A plausible so'm-per-dollar rate (guards against typing 12.5 or 12,500,000). */
export function rateError(rate: number): 'rateMissing' | 'rateOdd' | null {
  const r = Number(rate) || 0;
  if (r <= 0) return 'rateMissing';
  if (r < 5000 || r > 50000) return 'rateOdd';
  return null;
}

/**
 * A price that almost certainly has the wrong currency on it: a contract in
 * so'm is millions, a contract in dollars is thousands.
 */
export function suspiciousPrice(amount: number, currency: string): 'tooSmallForUzs' | 'tooBigForUsd' | null {
  const a = Number(amount) || 0;
  if (a <= 0) return null;
  if (currency === 'UZS' && a < 100000) return 'tooSmallForUzs';
  if (currency === 'USD' && a > 100000) return 'tooBigForUsd';
  return null;
}

/**
 * More than double what is owed: nearly always so'm typed into a dollar
 * account (or the other way round), not a real overpayment.
 */
export function overpaidByFar(paid: number, due: number): boolean {
  const p = Number(paid) || 0;
  const d = Number(due) || 0;
  return d > 0 && p > d * 2;
}

function plain(amount: number, currency: string): string {
  return currency === 'UZS'
    ? `${Math.round(amount).toLocaleString('ru-RU')} so'm`
    : `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** The line kept in the transfer's note when it was paid in another currency. */
export function conversionNote(
  paid: number,
  paidCurrency: string,
  converted: number,
  accountCurrency: string,
  rate: number,
): string {
  return `[${plain(paid, paidCurrency)} → ${plain(converted, accountCurrency)}, kurs 1$ = ${Math.round(rate).toLocaleString('ru-RU')} so'm]`;
}

/** The note with the conversion line in front of what the operator wrote. */
export function withConversionNote(notes: string | null | undefined, line: string | null): string | null {
  const text = (notes ?? '').trim();
  if (!line) return text || null;
  return text ? `${line} ${text}` : line;
}

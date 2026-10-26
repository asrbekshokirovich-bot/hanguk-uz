/**
 * Pure helpers for "Shartnomani bekor qilish" (ContractCancelSection).
 * The database (cancel_student_contract) enforces the same limits; these only
 * let the dialog say what is wrong before the call.
 */

export interface RefundEntry {
  currency: string;
  amount: number;
}

export interface PaidInCurrency {
  currency: string;
  amount: number;
}

/** Money received this season per currency, refunded accounts excluded. */
export function paidByCurrency(
  payments: { currency: string | null; paid_amount: number | string | null; status: string | null }[],
): PaidInCurrency[] {
  const sums = new Map<string, number>();
  for (const p of payments) {
    if (p.status === 'refunded') continue;
    const amount = Number(p.paid_amount ?? 0);
    if (!(amount > 0)) continue;
    const cur = (p.currency || 'UZS').toUpperCase();
    sums.set(cur, (sums.get(cur) ?? 0) + amount);
  }
  return [...sums.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/** "1 000 000" / "1000,5" -> number. Empty or zero inputs are dropped. */
export function parseRefundInput(inputs: Record<string, string>): RefundEntry[] {
  const out: RefundEntry[] = [];
  for (const [currency, raw] of Object.entries(inputs)) {
    const cleaned = (raw ?? '').replace(/\s/g, '').replace(',', '.');
    if (cleaned === '') continue;
    const amount = Number(cleaned);
    if (Number.isNaN(amount)) {
      out.push({ currency, amount: NaN });
      continue;
    }
    if (amount > 0) out.push({ currency, amount });
  }
  return out;
}

export function validateRefunds(
  refunds: RefundEntry[],
  paid: PaidInCurrency[],
): { key: string; params?: Record<string, string> } | null {
  for (const r of refunds) {
    if (Number.isNaN(r.amount) || r.amount < 0) {
      return { key: 'crm.contractCancel.badAmount' };
    }
    const max = paid.find((p) => p.currency === r.currency)?.amount ?? 0;
    if (r.amount > max) {
      return {
        key: 'crm.contractCancel.tooMuch',
        params: { currency: r.currency, max: max.toLocaleString('ru-RU') },
      };
    }
  }
  return null;
}

/**
 * Checks for the CRM payout form, matching the investor_payouts constraints:
 * amount_uzs >= 0, status in (accruing, paid), and paid_at required when paid.
 */
export interface PayoutDraft {
  investor_id: string;
  period_label: string;
  amount: string;
  status: 'accruing' | 'paid';
  due_date: string;
  paid_at: string;
}

/** "12 500 000" / "12500000,5" -> number; NaN if not a number. */
export function parseAmount(raw: string): number {
  const cleaned = (raw ?? '').replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return NaN;
  return Number(cleaned);
}

/** i18n key of the first problem, or null when the draft can be saved. */
export function payoutError(d: PayoutDraft): string | null {
  if (!d.investor_id) return 'crm.investorDesk.errInvestor';
  if (!d.period_label.trim()) return 'crm.investorDesk.errPeriod';
  const amount = parseAmount(d.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'crm.investorDesk.errAmount';
  if (d.status === 'paid' && !d.paid_at) return 'crm.investorDesk.errPaidAt';
  return null;
}

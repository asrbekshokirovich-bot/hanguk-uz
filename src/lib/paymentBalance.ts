import {
  calculateFirstPaymentDueDate,
  formatAmount,
  getPlanByValue,
} from '@/hooks/useStudentPlan';

/**
 * Money owed and paid on a student's payment accounts.
 *
 * Kept free of React and Supabase so the rules the office runs on — the
 * contract is due 7 working days after signing, a part-paid account still
 * counts what was paid — are pinned by unit tests rather than living inside a
 * data hook.
 */

export interface BalancePayment {
  payment_type: string;
  status: string | null;
  amount: number | string | null;
  paid_amount: number | string | null;
  currency: string | null;
}

export interface CurrencyBalance {
  currency: string;
  total: number;
  paid: number;
  left: number;
}

/** Payment types that make up the contract price (not "other" charges). */
export const INITIAL_PAYMENT_TYPES = ['initial_deposit', 'first_payment', 'full_payment'];

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

/**
 * What was paid towards the first (contract) payment.
 *
 * Every status counts. Summing only `completed` rows treated a student who had
 * paid $1,000 of $5,000 as if they had paid nothing. Refunds are the one
 * exception: that money went back.
 */
export function paidTowardsInitial(payments: BalancePayment[]): number {
  return payments
    .filter((p) => p.status !== 'refunded' && INITIAL_PAYMENT_TYPES.includes(p.payment_type))
    .reduce((sum, p) => sum + num(p.paid_amount), 0);
}

/**
 * Totals per currency over a student's accounts. Never adds UZS to USD.
 * Refunded accounts are left out.
 */
export function summarizeBalance(payments: BalancePayment[]): CurrencyBalance[] {
  const byCurrency = new Map<string, CurrencyBalance>();
  for (const p of payments) {
    if (p.status === 'refunded') continue;
    const currency = p.currency || 'UZS';
    const row = byCurrency.get(currency) ?? { currency, total: 0, paid: 0, left: 0 };
    row.total += num(p.amount);
    row.paid += num(p.paid_amount);
    byCurrency.set(currency, row);
  }
  return [...byCurrency.values()].map((row) => ({
    ...row,
    left: Math.max(row.total - row.paid, 0),
  }));
}

/**
 * Balances worth a line in the student list: something paid, something left.
 * A fully paid account says nothing new, and a not-yet-paid one already shows
 * as "Pending".
 */
export function partialBalances(payments: BalancePayment[]): CurrencyBalance[] {
  return summarizeBalance(payments).filter((b) => b.paid > 0 && b.left > 0);
}

export function formatBalanceParts(b: CurrencyBalance) {
  return {
    total: formatAmount(b.total, b.currency),
    paid: formatAmount(b.paid, b.currency),
    left: formatAmount(b.left, b.currency),
  };
}

export interface OverdueInput {
  contractDate: string | null | undefined;
  paymentPlan: string | null | undefined;
  paymentMode: string | null | undefined;
  payments: BalancePayment[];
  /** YYYY-MM-DD; defaults to today. */
  today?: string;
  /** Free re-application: nothing is owed. */
  exempt?: boolean;
}

/**
 * Whether the first (contract) payment is late: the 7 working days after the
 * contract have passed and less than the expected amount has come in.
 *
 * The price is not changed when this happens — the student only turns red,
 * and the staff decide what to do, as before.
 */
export function isInitialPaymentOverdue(input: OverdueInput): boolean {
  if (input.exempt) return false;
  if (!input.contractDate || !input.paymentPlan) return false;
  const plan = getPlanByValue(input.paymentPlan);
  if (!plan || plan.value === 'free') return false;

  // NO RISK is paid in full only, whatever mode the student row carries.
  const installment = input.paymentMode === 'installment' && plan.allowInstallment !== false;
  const expected = installment ? plan.firstPayment : plan.priceOneTime;
  if (expected <= 0) return false;

  const due = calculateFirstPaymentDueDate(input.contractDate);
  const today = input.today ?? new Date().toISOString().split('T')[0];
  if (today <= due) return false;

  return paidTowardsInitial(input.payments) < expected;
}

export interface Transfer {
  amount: number | string;
  paid_on: string | null;
}

/**
 * Whether the transfers reached `expected` by the due date — i.e. a contract
 * paid in several transfers within its 7 working days still counts as paid at
 * once. Uses the date the money was paid, not when it was typed in.
 */
export function paidInFullByDue(transfers: Transfer[], expected: number, dueDate: string): boolean {
  const inTime = transfers
    .filter((t) => t.paid_on && t.paid_on <= dueDate)
    .reduce((sum, t) => sum + num(t.amount), 0);
  return expected > 0 && inTime >= expected;
}

/** Every receipt on a transfer, old single-URL rows included, without repeats. */
export function receiptsOf(tx: { receipt_url?: string | null; receipt_urls?: string[] | null }): string[] {
  const urls = [...(tx.receipt_urls ?? [])];
  if (tx.receipt_url && !urls.includes(tx.receipt_url)) urls.unshift(tx.receipt_url);
  return urls.filter(Boolean);
}

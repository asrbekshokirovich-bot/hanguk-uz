import { supabase } from '@/integrations/supabase/client';
import { allocateOperationalFund } from '@/hooks/useOperationalFund';
import { distributeIncomeFromPayment } from '@/hooks/useIncomeDistribution';
import { allocateBudgetsForPayment } from '@/hooks/useStudentBudgets';
import { createBonusForPayment } from '@/hooks/useStaffBonuses';
import { getPaymentMethodLabel } from '@/lib/paymentUtils';

export interface InstallmentInput {
  paymentId: string;
  studentId: string;
  amount: number;
  /** YYYY-MM-DD — the date on the receipt. */
  paidOn: string;
  method: string;
  gatewayFee: number;
  currency: string;
  notes?: string;
  receiptUrls: string[];
  /** Student's tariff, for budgets and the staff bonus once fully paid. */
  plan?: string | null;
  intakeId?: string | null;
}

export interface InstallmentResult {
  transactionId: string;
  paidAmount: number;
  amount: number;
  completedNow: boolean;
}

/**
 * Record one transfer (bo'lak) against an existing payment account.
 *
 * The transfer and the account's paid amount move together in one database
 * call (record_payment_installment), so a half-written state cannot happen.
 * When this transfer is the one that pays the account in full, the same
 * follow-ups as a one-shot payment run: operational fund, budgets, staff bonus
 * and income distribution — exactly once, on the transition to paid.
 */
export async function recordInstallment(input: InstallmentInput): Promise<InstallmentResult> {
  const { data, error } = await supabase.rpc('record_payment_installment', {
    p_payment_id: input.paymentId,
    p_amount: input.amount,
    p_paid_on: input.paidOn,
    p_method: input.method,
    p_gateway_fee: input.gatewayFee,
    p_notes: input.notes || undefined,
    p_receipt_urls: input.receiptUrls,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Bo'lak saqlanmadi");

  // Gateway commission as an expense, as the one-shot payment flow does.
  if (input.gatewayFee > 0) {
    const label = getPaymentMethodLabel(input.method);
    const { error: expenseError } = await supabase.from('expenses').insert({
      category: 'gateway_fee',
      description: `${label} to'lov komissiyasi`,
      amount: input.gatewayFee,
      currency: input.currency,
      payment_method: input.method,
      recipient: label,
      expense_date: input.paidOn,
      notes: `Auto-generated fee for transaction ${row.transaction_id}`,
      linked_transaction_id: row.transaction_id,
    });
    if (expenseError) console.error('Failed to create gateway fee expense:', expenseError);
  }

  const completedNow = !row.was_completed && row.is_completed;
  if (completedNow) {
    const paid = Number(row.new_paid_amount);
    await allocateOperationalFund(input.paymentId, input.studentId, paid);
    if (input.plan) {
      await allocateBudgetsForPayment(input.studentId, input.plan, input.paymentId, input.intakeId ?? null);
      await createBonusForPayment(input.studentId, input.plan);
    }
    await distributeIncomeFromPayment(input.paymentId, paid, input.studentId);
    window.dispatchEvent(new CustomEvent('operational-fund-updated'));
  }

  return {
    transactionId: row.transaction_id,
    paidAmount: Number(row.new_paid_amount),
    amount: Number(row.payment_amount),
    completedNow,
  };
}

/** Attach more receipt images to a transfer that is already recorded. */
export async function addReceiptsToTransfer(
  transactionId: string,
  existing: string[],
  added: string[],
): Promise<string[]> {
  const urls = [...existing, ...added.filter((u) => !existing.includes(u))];
  const { error } = await supabase
    .from('payment_transactions')
    .update({ receipt_urls: urls, receipt_url: urls[0] ?? null })
    .eq('id', transactionId);
  if (error) throw error;
  return urls;
}

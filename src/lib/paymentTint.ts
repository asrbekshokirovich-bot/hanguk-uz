/**
 * A contracted student's card is tinted by payment alone, with no label:
 * amber while their documents are only being collected (contract signed,
 * nothing paid yet), green once they have paid and work on them starts.
 * No contract yet → the plain card. Shared by the Hujjatlar and
 * Universitet tanlash pages.
 */
export type PaymentTint = 'paid' | 'unpaid';

export function paymentTint(student: { contract_date?: string | null; hasPaid?: boolean }): PaymentTint | null {
  if (!student.contract_date) return null;
  return student.hasPaid ? 'paid' : 'unpaid';
}

export const TINT_CLASS: Record<PaymentTint, string> = {
  paid: 'border-success/50 bg-success/15',
  unpaid: 'border-warning/50 bg-warning/15',
};

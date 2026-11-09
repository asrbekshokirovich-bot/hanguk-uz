/**
 * Discount (chegirma) on a student payment, as a sum (Asrbek, 2026-11-09:
 * "nech pul chegirma bo'lgan bo'lsa kiritish uchun").
 *
 * Stored the way the P&L already reads it: `list_amount` = price before the
 * discount, `amount` = what the student owes. No discount → list_amount null.
 */
export interface DiscountedPrice {
  /** What the student owes (payments.amount). */
  amount: number;
  /** Price before the discount, or null when there is none (payments.list_amount). */
  listAmount: number | null;
  discount: number;
}

/**
 * @param listPrice   price typed by the operator (before any discount)
 * @param discountSum discount typed as a sum; blank/0 = none
 * @param seasonPercent student_intakes.discount_percent, used only when no sum is typed
 */
export function applyDiscount(listPrice: number, discountSum: number, seasonPercent = 0): DiscountedPrice {
  const list = Math.max(0, Number(listPrice) || 0);
  let discount = Math.max(0, Number(discountSum) || 0);
  if (discount === 0 && seasonPercent > 0) discount = Math.round(list * (seasonPercent / 100));
  discount = Math.min(discount, list);
  return discount > 0 ? { amount: list - discount, listAmount: list, discount } : { amount: list, listAmount: null, discount: 0 };
}

/** The error key when the typed discount cannot be applied, else null. */
export function discountError(listPrice: number, discountSum: number): 'discountTooBig' | null {
  const d = Number(discountSum) || 0;
  return d > 0 && d >= (Number(listPrice) || 0) ? 'discountTooBig' : null;
}

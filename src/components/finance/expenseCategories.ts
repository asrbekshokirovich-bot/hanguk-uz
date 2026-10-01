/**
 * Expense categories offered when adding or editing an expense (owner's list,
 * 2026-10-01). Older expenses keep the category they were saved with
 * (marketing, salary, rent, gateway_fee, …); those are no longer offered.
 */
export const EXPENSE_CATEGORIES = [
  { value: 'skillhub', label: 'Skillhub' },
  { value: 'reklama_hanguk', label: 'Reklama hanguk' },
  { value: 'reklama_skillhub', label: 'Reklama skillhub' },
  { value: 'taksi_hanguk', label: 'Taksi hanguk' },
  { value: 'ofis_xarajat', label: 'Ofis xarajat' },
  { value: 'asrbek_uchun', label: 'Asrbek uchun' },
];

/** The label for a category; an older category shows as it was saved. */
export function expenseCategoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

// Payment method gateway fee rates
export const GATEWAY_FEE_RATES: Record<string, number> = {
  payme: 0.015,       // 1.5%
  click: 0.01,        // 1%
  uzum: 0.01,         // 1% (similar to Click)
  cash: 0,            // No fee
  bank_transfer: 0,   // No fee
};

/**
 * Calculate the gateway fee for a given amount and payment method
 * @param amount - The payment amount
 * @param paymentMethod - The payment method (payme, click, uzum, cash, bank_transfer)
 * @returns The gateway fee amount
 */
export function calculateGatewayFee(amount: number, paymentMethod: string): number {
  const rate = GATEWAY_FEE_RATES[paymentMethod.toLowerCase()] || 0;
  return Math.round(amount * rate);
}

/**
 * Get the fee rate for a payment method as a percentage string
 * @param paymentMethod - The payment method
 * @returns The fee rate as a percentage string (e.g., "1.5%")
 */
export function getGatewayFeeRate(paymentMethod: string): string {
  const rate = GATEWAY_FEE_RATES[paymentMethod.toLowerCase()] || 0;
  if (rate === 0) return 'No fee';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Get all payment methods with their fee rates
 */
export const PAYMENT_METHODS_WITH_FEES = [
  { value: 'cash', label: 'Cash', feeRate: 0 },
  { value: 'uzum', label: 'Uzum', feeRate: 0.01 },
  { value: 'payme', label: 'PayMe', feeRate: 0.015 },
  { value: 'click', label: 'Click', feeRate: 0.01 },
  { value: 'bank_transfer', label: 'Bank Transfer', feeRate: 0 },
];

/**
 * Get display label for payment method
 */
export function getPaymentMethodLabel(paymentMethod: string): string {
  const method = PAYMENT_METHODS_WITH_FEES.find(m => m.value === paymentMethod.toLowerCase());
  return method?.label || paymentMethod;
}

import { describe, expect, it } from 'vitest';
import { applyDiscount, discountError } from '../paymentDiscount';

describe('payment discount (2026-11-09)', () => {
  it('subtracts a typed sum and keeps the list price', () => {
    expect(applyDiscount(5000, 500)).toEqual({ amount: 4500, listAmount: 5000, discount: 500 });
  });
  it('no discount leaves list_amount empty', () => {
    expect(applyDiscount(5000, 0)).toEqual({ amount: 5000, listAmount: null, discount: 0 });
  });
  it('falls back to the season percent only when no sum is typed', () => {
    expect(applyDiscount(10_000_000, 0, 50)).toEqual({ amount: 5_000_000, listAmount: 10_000_000, discount: 5_000_000 });
    expect(applyDiscount(10_000_000, 1_000_000, 50).amount).toBe(9_000_000);
  });
  it('rejects a discount as big as the price', () => {
    expect(discountError(5000, 5000)).toBe('discountTooBig');
    expect(discountError(5000, 4999)).toBeNull();
    expect(discountError(5000, 0)).toBeNull();
  });
});

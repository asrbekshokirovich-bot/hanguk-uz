import { describe, it, expect } from 'vitest';
import { applyDiscount, getPlanPrice, getPaymentAmount, getPaymentSchedule } from '../useStudentPlan';

/**
 * The rounding rule (applyDiscount) is the single source of truth for every
 * discounted amount in the app — writers (payment prefills) and readers
 * (expected-payment derivations) must produce byte-identical numbers, or the
 * `paid_amount >= amount` completion test can strand a payment as 'partial'
 * forever. These tests pin the exact rounded values.
 */
describe('applyDiscount', () => {
  it('returns the amount unchanged for 0% (and for null/undefined)', () => {
    expect(applyDiscount(5000000, 0)).toBe(5000000);
    expect(applyDiscount(5000000, null)).toBe(5000000);
    expect(applyDiscount(5000000, undefined)).toBe(5000000);
  });

  it('rounds a UZS amount to the nearest whole unit (15% of 5,000,000)', () => {
    expect(applyDiscount(5000000, 15)).toBe(4250000);
  });

  it('rounds a USD amount to the nearest whole dollar (33% of 5,000)', () => {
    expect(applyDiscount(5000, 33)).toBe(3350);
  });

  it('rounds a non-clean percentage (33% of 4,000,000 standart first payment)', () => {
    expect(applyDiscount(4000000, 33)).toBe(2680000);
  });

  it('clamps a 100% discount to zero', () => {
    expect(applyDiscount(5000000, 100)).toBe(0);
  });

  it('clamps an out-of-range percentage into [0, 100]', () => {
    expect(applyDiscount(5000000, 150)).toBe(0);
    expect(applyDiscount(5000000, -10)).toBe(5000000);
  });
});

describe('getPlanPrice with discount', () => {
  it('discounts the one-time price', () => {
    expect(getPlanPrice('standart', 'one_time', 15).amount).toBe(4250000);
  });

  it('discounts the installment total', () => {
    // standart installment total is 6,000,000 (4M + 2M)
    expect(getPlanPrice('standart', 'installment', 10).amount).toBe(5400000);
  });

  it('defaults to no discount when the parameter is omitted (back-compat)', () => {
    expect(getPlanPrice('standart', 'one_time').amount).toBe(5000000);
  });
});

describe('getPaymentAmount with discount', () => {
  it('discounts the first and second installments independently', () => {
    expect(getPaymentAmount('standart', 'installment', 'initial_deposit', 10).amount).toBe(3600000);
    expect(getPaymentAmount('standart', 'installment', 'remaining_payment', 10).amount).toBe(1800000);
  });
});

describe('getPaymentSchedule with discount', () => {
  it('installment totalAmount equals the sum of the discounted first + second payments', () => {
    const schedule = getPaymentSchedule('standart', 'installment', '2026-01-01', 10);
    const first = schedule?.payments.find((p) => p.type === 'first_payment');
    const second = schedule?.payments.find((p) => p.type === 'second_payment');
    expect(first?.amount).toBe(3600000);
    expect(second?.amount).toBe(1800000);
    expect(schedule?.totalAmount).toBe((first?.amount || 0) + (second?.amount || 0));
    expect(schedule?.totalAmount).toBe(5400000);
  });

  it('one-time totalAmount is the discounted price', () => {
    const schedule = getPaymentSchedule('premium', 'one_time', '2026-01-01', 20);
    expect(schedule?.totalAmount).toBe(8000000);
  });

  it('a fully-paid discounted student sums to exactly totalAmount (no rounding drift)', () => {
    // A student who pays every scheduled installment in full ends up having
    // paid exactly totalAmount — this is what the payments.amount >= paid_amount
    // completion test depends on.
    const schedule = getPaymentSchedule('no_risk', 'installment', '2026-01-01', 33);
    const sum = schedule!.payments.reduce((acc, p) => acc + p.amount, 0);
    expect(sum).toBe(schedule!.totalAmount);
  });
});

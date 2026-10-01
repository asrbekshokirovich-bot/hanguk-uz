import { describe, it, expect } from 'vitest';
import { getPaymentAmount, getPlanPrice, getPaymentSchedule, planAllowsInstallment, PLAN_SERVICES } from '../useStudentPlan';

// The tariffs of 2026-10-01 (owner's tariff cards).
describe('tariffs', () => {
  it('STANDART: 5M at once, or 2M + 5M after the visa', () => {
    expect(getPlanPrice('standart', 'one_time')).toEqual({ amount: 5_000_000, currency: 'UZS' });
    expect(getPlanPrice('standart', 'installment')).toEqual({ amount: 7_000_000, currency: 'UZS' });
    expect(getPaymentAmount('standart', 'installment', 'first_payment').amount).toBe(2_000_000);
    expect(getPaymentAmount('standart', 'installment', 'second_payment').amount).toBe(5_000_000);
  });

  it('PREMIUM: 10M at once, or 3M + 10M after the visa', () => {
    expect(getPlanPrice('premium', 'one_time').amount).toBe(10_000_000);
    expect(getPlanPrice('premium', 'installment').amount).toBe(13_000_000);
    expect(getPaymentAmount('premium', 'installment', 'first_payment').amount).toBe(3_000_000);
    expect(getPaymentAmount('premium', 'installment', 'second_payment').amount).toBe(10_000_000);
  });

  it('NO RISK: $5,000 in one go only', () => {
    expect(getPlanPrice('no_risk', 'one_time')).toEqual({ amount: 5000, currency: 'USD' });
    expect(planAllowsInstallment('no_risk')).toBe(false);
    expect(planAllowsInstallment('standart')).toBe(true);
    expect(planAllowsInstallment('premium')).toBe(true);
    // Even if a split were stored, it never adds up to more than $5,000.
    expect(getPlanPrice('no_risk', 'installment').amount).toBe(5000);
  });

  it('the 2nd payment waits for the visa', () => {
    const second = getPaymentSchedule('premium', 'installment', '2026-10-01')?.payments[1];
    expect(second?.dueDate).toBeNull();
    expect(second?.triggerDescription).toMatch(/visa/);
  });

  it('service lists match the tariff cards', () => {
    expect(PLAN_SERVICES.standart).toHaveLength(5);
    expect(PLAN_SERVICES.premium).toHaveLength(9);
    expect(PLAN_SERVICES.no_risk).toHaveLength(14);
  });
});

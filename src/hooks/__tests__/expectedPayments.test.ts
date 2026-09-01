import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExpectedPayments } from '../useExpectedPayments';

/**
 * Regression cover for the double-billing that free re-application fixes.
 *
 * Two students carried from Fall 2026 into Spring 2027 were charged in both
 * seasons. The payment plan lives on `profiles` — one per student, season
 * independent — while `student_intakes` is deliberately multi-season, so the
 * same plan was expected again in the second season. The exemption is per
 * (student, season) and reaches this hook as `freeReapplication`.
 */

// Only the fields the hook reads; the real row is a full profiles record.
const student = (over = {}) =>
  ({
    user_id: 'student-1',
    full_name: 'Test Student',
    phone: '901234567',
    payment_plan: 'standart',
    payment_mode: 'one_time',
    contract_date: '2026-01-15',
    ...over,
  }) as Parameters<typeof useExpectedPayments>[0][number];

const expectedFor = (students: Parameters<typeof useExpectedPayments>[0]) =>
  renderHook(() => useExpectedPayments(students, [])).result.current.expectedPayments;

describe('useExpectedPayments — free re-application', () => {
  it('expects a payment from a student billed normally', () => {
    const rows = expectedFor([student()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].student_id).toBe('student-1');
    expect(rows[0].expected_amount).toBeGreaterThan(0);
  });

  it('expects nothing from a student exempt for this season', () => {
    expect(expectedFor([student({ freeReapplication: true })])).toHaveLength(0);
  });

  it('exempts only the flagged student, not everyone on the same plan', () => {
    const rows = expectedFor([
      student({ user_id: 'paying', freeReapplication: false }),
      student({ user_id: 'carried-over', freeReapplication: true }),
    ]);
    expect(rows.map((r) => r.student_id)).toEqual(['paying']);
  });

  it('exempts regardless of payment mode, so a split plan cannot leak a second instalment', () => {
    const rows = expectedFor([
      student({ payment_mode: 'installment', freeReapplication: true }),
    ]);
    expect(rows).toHaveLength(0);
  });
});

/**
 * Discount cover — a per-student discount_percent (student_intakes) must
 * reduce expected amounts the same way for a one-time plan and for each
 * installment independently, and must never override the free-reapplication
 * exemption above (0 owed either way, but for different reasons).
 */
describe('useExpectedPayments — discount', () => {
  it('applies a discount to a one-time plan (standart 5,000,000 UZS, 15% off = 4,250,000)', () => {
    const rows = expectedFor([student({ discountPercent: 15 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].expected_amount).toBe(4250000);
  });

  it('applies the same discount independently to each installment (standart 4,000,000 + 2,000,000, 10% off)', () => {
    const rows = expectedFor([
      student({ payment_mode: 'installment', discountPercent: 10 }),
    ]);
    const first = rows.find((r) => r.payment_type === 'first_payment');
    const second = rows.find((r) => r.payment_type === 'second_payment');
    expect(first?.expected_amount).toBe(3600000);
    expect(second?.expected_amount).toBe(1800000);
  });

  it('a 0% discount leaves the amount unchanged (default, no discount field passed)', () => {
    const rows = expectedFor([student()]);
    expect(rows[0].expected_amount).toBe(5000000);
  });

  it('a 100% discount produces an expected row of 0, unlike the exemption which produces no row', () => {
    const rows = expectedFor([student({ discountPercent: 100 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].expected_amount).toBe(0);
  });

  it('free-reapplication exemption wins over a discount value on the same student', () => {
    const rows = expectedFor([
      student({ discountPercent: 15, freeReapplication: true }),
    ]);
    expect(rows).toHaveLength(0);
  });

  it('a discount on a USD plan rounds to whole dollars (no_risk $5,000, 33% off = $3,350)', () => {
    const rows = expectedFor([
      student({ payment_plan: 'no_risk', discountPercent: 33 }),
    ]);
    expect(rows[0].expected_amount).toBe(3350);
    expect(rows[0].currency).toBe('USD');
  });
});

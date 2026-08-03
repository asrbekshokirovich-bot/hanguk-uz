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

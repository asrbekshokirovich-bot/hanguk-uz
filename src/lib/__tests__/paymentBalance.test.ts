import { describe, expect, it } from 'vitest';
import {
  isInitialPaymentOverdue,
  paidInFullByDue,
  paidTowardsInitial,
  receiptsOf,
  partialBalances,
  summarizeBalance,
  type BalancePayment,
} from '../paymentBalance';
import { calculateFirstPaymentDueDate, planAllowsInstallment } from '@/hooks/useStudentPlan';

const pay = (over: Partial<BalancePayment> = {}): BalancePayment => ({
  payment_type: 'initial_deposit',
  status: 'partial',
  amount: 5000,
  paid_amount: 1000,
  currency: 'USD',
  ...over,
});

describe('paidTowardsInitial', () => {
  it('counts a part-paid account, not only completed ones', () => {
    expect(paidTowardsInitial([pay({ status: 'partial', paid_amount: 1000 })])).toBe(1000);
  });

  it('adds every initial account and skips refunds and other charges', () => {
    expect(
      paidTowardsInitial([
        pay({ paid_amount: 1000 }),
        pay({ paid_amount: 4000, status: 'completed' }),
        pay({ paid_amount: 500, status: 'refunded' }),
        pay({ payment_type: 'other', paid_amount: 700 }),
      ]),
    ).toBe(5000);
  });
});

describe('summarizeBalance', () => {
  it('sums paid amounts per account and never mixes currencies', () => {
    const rows = summarizeBalance([
      pay({ amount: 5000, paid_amount: 1000, currency: 'USD' }),
      pay({ payment_type: 'remaining_payment', amount: 5000000, paid_amount: 2000000, currency: 'UZS' }),
    ]);
    expect(rows).toEqual([
      { currency: 'USD', total: 5000, paid: 1000, left: 4000 },
      { currency: 'UZS', total: 5000000, paid: 2000000, left: 3000000 },
    ]);
  });

  it('two transfers into one account add up', () => {
    // 1 000 + 4 000 recorded as two transfers raise paid_amount to 5 000.
    const [row] = summarizeBalance([pay({ paid_amount: 1000 + 4000, status: 'completed' })]);
    expect(row.left).toBe(0);
  });

  it('only part-paid balances get a line in the list', () => {
    expect(partialBalances([pay({ paid_amount: 0, status: 'pending' })])).toEqual([]);
    expect(partialBalances([pay({ paid_amount: 5000, status: 'completed' })])).toEqual([]);
    expect(partialBalances([pay()])).toHaveLength(1);
  });
});

describe('7 working days', () => {
  it('skips Saturday and Sunday', () => {
    // Monday 12 Oct 2026 + 7 working days = Wednesday 21 Oct.
    expect(calculateFirstPaymentDueDate('2026-10-12')).toBe('2026-10-21');
    // Friday 16 Oct 2026 + 7 working days = Tuesday 27 Oct.
    expect(calculateFirstPaymentDueDate('2026-10-16')).toBe('2026-10-27');
  });
});

describe('isInitialPaymentOverdue', () => {
  const base = {
    contractDate: '2026-10-12',
    paymentPlan: 'no_risk',
    paymentMode: 'one_time',
  };

  it('is not overdue before the 7 working days are up, even unpaid', () => {
    expect(isInitialPaymentOverdue({ ...base, payments: [], today: '2026-10-21' })).toBe(false);
  });

  it('a part-paid contract is overdue after the deadline', () => {
    expect(isInitialPaymentOverdue({ ...base, payments: [pay()], today: '2026-10-22' })).toBe(true);
  });

  it('paid in full in two transfers is not overdue', () => {
    expect(
      isInitialPaymentOverdue({
        ...base,
        payments: [pay({ paid_amount: 5000, status: 'completed' })],
        today: '2026-10-26',
      }),
    ).toBe(false);
  });

  it('NO RISK expects the whole $5,000 even if the row says installment', () => {
    expect(planAllowsInstallment('no_risk')).toBe(false);
    expect(
      isInitialPaymentOverdue({
        ...base,
        paymentMode: 'installment',
        payments: [pay({ paid_amount: 4999 })],
        today: '2026-10-26',
      }),
    ).toBe(true);
  });

  it('on the 2-payment tariff only the first payment is expected by the deadline', () => {
    expect(
      isInitialPaymentOverdue({
        contractDate: '2026-10-12',
        paymentPlan: 'standart',
        paymentMode: 'installment',
        payments: [pay({ amount: 2000000, paid_amount: 2000000, currency: 'UZS', status: 'completed' })],
        today: '2026-10-26',
      }),
    ).toBe(false);
  });

  it('nothing is owed on a free re-application or a FREE plan', () => {
    expect(isInitialPaymentOverdue({ ...base, payments: [], today: '2026-12-01', exempt: true })).toBe(false);
    expect(isInitialPaymentOverdue({ ...base, paymentPlan: 'free', payments: [], today: '2026-12-01' })).toBe(false);
  });
});

describe('paidInFullByDue', () => {
  it('two transfers inside the week count as paid at once', () => {
    expect(
      paidInFullByDue(
        [
          { amount: 1000, paid_on: '2026-10-19' },
          { amount: 4000, paid_on: '2026-10-21' },
        ],
        5000,
        '2026-10-21',
      ),
    ).toBe(true);
  });

  it('uses the paid date, not when it was typed in', () => {
    expect(
      paidInFullByDue(
        [
          { amount: 1000, paid_on: '2026-10-19' },
          { amount: 4000, paid_on: '2026-10-23' },
        ],
        5000,
        '2026-10-21',
      ),
    ).toBe(false);
  });
});

describe('receiptsOf', () => {
  it('keeps every receipt of a transfer, old single-URL rows included, once', () => {
    expect(receiptsOf({ receipt_url: 'a', receipt_urls: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(receiptsOf({ receipt_url: 'old', receipt_urls: [] })).toEqual(['old']);
    expect(receiptsOf({ receipt_url: null, receipt_urls: null })).toEqual([]);
  });
});

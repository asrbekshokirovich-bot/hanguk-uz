import { describe, expect, it } from 'vitest';
import { parseAmount, payoutError, type PayoutDraft } from '../investorPayout';

const ok: PayoutDraft = {
  investor_id: 'i1',
  period_label: 'Q4 2026',
  amount: '12 500 000',
  status: 'accruing',
  due_date: '2027-01-15',
  paid_at: '',
};

describe('investorPayout', () => {
  it('parses spaced and comma amounts', () => {
    expect(parseAmount('12 500 000')).toBe(12500000);
    expect(parseAmount('100,5')).toBe(100.5);
    expect(Number.isNaN(parseAmount(''))).toBe(true);
  });

  it('accepts a valid accruing payout', () => {
    expect(payoutError(ok)).toBeNull();
  });

  it('requires investor, period and a positive amount', () => {
    expect(payoutError({ ...ok, investor_id: '' })).toBe('crm.investorDesk.errInvestor');
    expect(payoutError({ ...ok, period_label: '  ' })).toBe('crm.investorDesk.errPeriod');
    expect(payoutError({ ...ok, amount: '0' })).toBe('crm.investorDesk.errAmount');
    expect(payoutError({ ...ok, amount: 'abc' })).toBe('crm.investorDesk.errAmount');
  });

  it('requires the paid date on a paid payout', () => {
    expect(payoutError({ ...ok, status: 'paid' })).toBe('crm.investorDesk.errPaidAt');
    expect(payoutError({ ...ok, status: 'paid', paid_at: '2027-01-10' })).toBeNull();
  });
});

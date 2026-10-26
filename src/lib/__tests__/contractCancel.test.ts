import { describe, expect, it } from 'vitest';
import { paidByCurrency, parseRefundInput, validateRefunds } from '../contractCancel';

describe('paidByCurrency', () => {
  it('sums per currency and skips refunded or unpaid accounts', () => {
    expect(
      paidByCurrency([
        { currency: 'UZS', paid_amount: 2000000, status: 'completed' },
        { currency: 'UZS', paid_amount: '1000000', status: 'partial' },
        { currency: 'USD', paid_amount: 2000, status: 'partial' },
        { currency: 'USD', paid_amount: 5000, status: 'refunded' },
        { currency: 'UZS', paid_amount: 0, status: 'pending' },
      ]),
    ).toEqual([
      { currency: 'USD', amount: 2000 },
      { currency: 'UZS', amount: 3000000 },
    ]);
  });
});

describe('parseRefundInput', () => {
  it('reads spaced and comma numbers and drops empty or zero', () => {
    expect(parseRefundInput({ UZS: '1 500 000', USD: '', EUR: '0' })).toEqual([
      { currency: 'UZS', amount: 1500000 },
    ]);
    expect(parseRefundInput({ USD: '100,5' })).toEqual([{ currency: 'USD', amount: 100.5 }]);
  });

  it('keeps garbage as NaN so validation can say so', () => {
    expect(Number.isNaN(parseRefundInput({ USD: 'abc' })[0].amount)).toBe(true);
  });
});

describe('validateRefunds', () => {
  const paid = [{ currency: 'USD', amount: 2000 }];

  it('accepts up to what was paid', () => {
    expect(validateRefunds([{ currency: 'USD', amount: 2000 }], paid)).toBeNull();
    expect(validateRefunds([], paid)).toBeNull();
  });

  it('rejects more than was paid, or a currency never paid', () => {
    expect(validateRefunds([{ currency: 'USD', amount: 2001 }], paid)?.key).toBe('crm.contractCancel.tooMuch');
    expect(validateRefunds([{ currency: 'UZS', amount: 1 }], paid)?.key).toBe('crm.contractCancel.tooMuch');
  });

  it('rejects a non-number', () => {
    expect(validateRefunds([{ currency: 'USD', amount: NaN }], paid)?.key).toBe('crm.contractCancel.badAmount');
  });
});

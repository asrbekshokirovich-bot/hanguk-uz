import { describe, expect, it } from 'vitest';
import {
  conversionNote,
  overpaidByFar,
  rateError,
  suspiciousPrice,
  toAccountCurrency,
  withConversionNote,
} from '@/lib/paymentCurrency';

describe('toAccountCurrency', () => {
  it('leaves the sum alone when currencies match', () => {
    expect(toAccountCurrency(3_000_000, 'UZS', 'UZS', 0)).toBe(3_000_000);
    expect(toAccountCurrency(3000, 'USD', 'USD', 0)).toBe(3000);
  });

  it("converts so'm paid onto a dollar account (the reported case)", () => {
    // $3,000 owed, 3,000,000 so'm paid at 12,500 → $240 counted, not $3,000
    expect(toAccountCurrency(3_000_000, 'UZS', 'USD', 12_500)).toBe(240);
    expect(toAccountCurrency(1_000_000, 'UZS', 'USD', 12_750)).toBe(78.43);
  });

  it("converts dollars paid onto a so'm account", () => {
    expect(toAccountCurrency(100, 'USD', 'UZS', 12_500)).toBe(1_250_000);
  });

  it('needs a rate to convert', () => {
    expect(toAccountCurrency(3_000_000, 'UZS', 'USD', 0)).toBeNull();
  });
});

describe('guards', () => {
  it('rejects a missing or implausible rate', () => {
    expect(rateError(0)).toBe('rateMissing');
    expect(rateError(12.5)).toBe('rateOdd');
    expect(rateError(12_500_000)).toBe('rateOdd');
    expect(rateError(12_500)).toBeNull();
  });

  it('flags a price that has the wrong currency on it', () => {
    expect(suspiciousPrice(5000, 'UZS')).toBe('tooSmallForUzs');
    expect(suspiciousPrice(5_000_000, 'USD')).toBe('tooBigForUsd');
    expect(suspiciousPrice(5_000_000, 'UZS')).toBeNull();
    expect(suspiciousPrice(5000, 'USD')).toBeNull();
  });

  it("flags so'm typed into a dollar account as a huge overpayment", () => {
    expect(overpaidByFar(3_000_000, 3000)).toBe(true);
    expect(overpaidByFar(3100, 3000)).toBe(false);
    expect(overpaidByFar(240, 3000)).toBe(false);
  });
});

describe('conversion note', () => {
  it('records the original sum and the rate', () => {
    const line = conversionNote(3_000_000, 'UZS', 240, 'USD', 12_500);
    expect(line).toContain('$240');
    expect(line).toContain('kurs');
    expect(withConversionNote('naqd', line)).toBe(`${line} naqd`);
    expect(withConversionNote('', null)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeVisitorPhone, sanitizeVisitorPhone } from '../visitorPhone';

describe('normalizeVisitorPhone', () => {
  // The same table as supabase/functions/guest-auth/logic_test.ts: the server
  // checks the number again and must agree with the form.
  it.each([
    ['90 123 45 67', '+998901234567'],
    ['901234567', '+998901234567'],
    ['+998 (90) 123-45-67', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['8 90 123 45 67', '+998901234567'],
    ['50 590 15 30', '+998505901530'],
    ['+996 700 123 456', '+996700123456'],
    ['996700123456', '+996700123456'],
    ['+82 10 1234 5678', '+821012345678'],
    ['+7 701 123 45 67', '+77011234567'],
  ])('%s → %s', (typed, kept) => {
    expect(normalizeVisitorPhone(typed)).toBe(kept);
  });

  it.each(['', '   ', '12345', '+12345', 'abc', '77011234567', '+1234567890123456'])('%j is not a number we can call', (typed) => {
    expect(normalizeVisitorPhone(typed)).toBeNull();
  });

  it('nothing typed', () => {
    expect(normalizeVisitorPhone(null)).toBeNull();
    expect(normalizeVisitorPhone(undefined)).toBeNull();
  });
});

describe('sanitizeVisitorPhone', () => {
  it('keeps digits, the usual separators and a leading plus', () => {
    expect(sanitizeVisitorPhone('+998 (90) 123-45-67')).toBe('+998 (90) 123-45-67');
    expect(sanitizeVisitorPhone('tel: 90 123 45 67')).toBe(' 90 123 45 67');
    expect(sanitizeVisitorPhone('90+123')).toBe('90123');
    expect(sanitizeVisitorPhone('++998')).toBe('+998');
  });

  it('does not grow without end', () => {
    expect(sanitizeVisitorPhone('9'.repeat(100)).length).toBe(24);
  });
});

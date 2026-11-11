import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

// Must match SQL normalize_phone() and the edge normalizePhone()
// (supabase/migrations/20261111120000_kg_leads.sql, _shared/identity.ts).
describe('normalizePhone', () => {
  it('Uzbek numbers get +998', () => {
    expect(normalizePhone('998901234567')).toBe('+998901234567');
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567');
  });

  it('a whole Kyrgyz number keeps 996 and gets its + (plan KG3)', () => {
    expect(normalizePhone('+996 700 123 456')).toBe('+996700123456');
    expect(normalizePhone('996700123456')).toBe('+996700123456');
  });

  it('a 9-digit 996… number is Uzbek (99 6…)', () => {
    expect(normalizePhone('996123456')).toBe('+998996123456');
  });

  it('anything else stays digits; nothing is null', () => {
    expect(normalizePhone('700123456')).toBe('700123456');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

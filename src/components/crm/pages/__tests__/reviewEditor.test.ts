import { describe, it, expect } from 'vitest';
import { isoToLocalInput, localInputToIso } from '../ReviewEditor';

/**
 * The edit form shows Korean wall-clock time in a date/time picker.
 *
 * The tempting implementation — `new Date(iso)` and read the parts back — is
 * wrong here, and wrong in a way that corrupts real data rather than
 * crashing. Every stored timestamp is KST-anchored, but the reviewers work in
 * Tashkent (UTC+5). Routing through a Date renders the value in the browser's
 * zone, so a 09:00 KST application deadline would open showing 05:00. A
 * reviewer who "corrects" that back to 09:00 moves the deadline four hours.
 *
 * So the conversion is string surgery, and these tests pin that.
 */
describe('KST timestamps in the edit form', () => {
  it('shows the Korean wall-clock digits, whatever the browser timezone', () => {
    expect(isoToLocalInput('2026-09-07T09:00:00+09:00')).toBe('2026-09-07T09:00');
    expect(isoToLocalInput('2026-12-24T18:00:00+09:00')).toBe('2026-12-24T18:00');
    expect(isoToLocalInput('2026-09-07T00:00:00+09:00')).toBe('2026-09-07T00:00');
  });

  it('round-trips an untouched value byte for byte', () => {
    const stored = '2026-09-07T09:00:00+09:00';
    expect(localInputToIso(isoToLocalInput(stored), stored)).toBe(stored);
  });

  it('keeps the offset the extractor stored', () => {
    // Not every guideline is KST-stamped; whatever came in must survive an
    // edit that did not touch the zone.
    expect(localInputToIso('2026-09-07T09:00', '2026-09-07T00:00:00Z'))
      .toBe('2026-09-07T09:00:00Z');
    expect(localInputToIso('2026-09-07T09:00', '2026-09-07T00:00:00+05:00'))
      .toBe('2026-09-07T09:00:00+05:00');
  });

  it('defaults to KST when there is nothing to inherit', () => {
    // A newly added event has no previous value. The prompt emits +09:00 and
    // every guideline states its dates in Korean time.
    expect(localInputToIso('2026-09-07T09:00', null)).toBe('2026-09-07T09:00:00+09:00');
    expect(localInputToIso('2026-09-07T09:00', undefined)).toBe('2026-09-07T09:00:00+09:00');
  });

  it('treats a cleared field as unset rather than as a broken date', () => {
    expect(localInputToIso('', '2026-09-07T09:00:00+09:00')).toBeNull();
  });

  it('survives whatever the extractor put there', () => {
    expect(isoToLocalInput(null)).toBe('');
    expect(isoToLocalInput(undefined)).toBe('');
    expect(isoToLocalInput(12345)).toBe('');
    expect(isoToLocalInput('2026. 09. 07.')).toBe('');
    // A date with no time still opens in the picker.
    expect(isoToLocalInput('2026-09-07')).toBe('');
  });

  it('rejects a half-typed value instead of storing it', () => {
    expect(localInputToIso('2026-09', '')).toBeNull();
  });
});

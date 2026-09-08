import { describe, it, expect } from 'vitest';
import { displayToIso, isoToDisplay } from '../date-field';

/**
 * `<input type="date">` renders in the browser's locale, so a machine set to
 * US English showed a birthday as 02/27/2004 — month first. Staff here read
 * 27.02.2004. The dangerous half of that is not the awkward reading: 02/03/2004
 * is a different date depending on who is looking at it, and those are exactly
 * the ones nobody notices are wrong.
 */
describe('day-month-year field', () => {
  it('shows a stored date the way staff read it', () => {
    expect(isoToDisplay('2004-02-27')).toBe('27.02.2004');
    expect(isoToDisplay('2004-03-02')).toBe('02.03.2004');
  });

  it('stores what the user typed as the ISO the column expects', () => {
    expect(displayToIso('27.02.2004')).toBe('2004-02-27');
    expect(displayToIso('02.03.2004')).toBe('2004-03-02');
    // Single digits are normal typing.
    expect(displayToIso('2.3.2004')).toBe('2004-03-02');
  });

  it('round-trips without drifting', () => {
    for (const iso of ['2004-02-27', '2000-01-01', '1999-12-31', '2024-02-29']) {
      expect(displayToIso(isoToDisplay(iso))).toBe(iso);
    }
  });

  it('accepts the separators people actually use', () => {
    expect(displayToIso('27/02/2004')).toBe('2004-02-27');
    expect(displayToIso('27-02-2004')).toBe('2004-02-27');
    expect(displayToIso(' 27.02.2004 ')).toBe('2004-02-27');
  });

  it('rejects a date that does not exist instead of rolling it forward', () => {
    // `new Date(2004, 1, 31)` silently becomes 2 March. A birthday that moved
    // on its own is worse than an empty field.
    expect(displayToIso('31.02.2004')).toBeNull();
    expect(displayToIso('29.02.2003')).toBeNull(); // 2003 is not a leap year
    expect(displayToIso('31.04.2004')).toBeNull();
    expect(displayToIso('00.01.2004')).toBeNull();
    expect(displayToIso('01.13.2004')).toBeNull();
  });

  it('keeps 29 February in a leap year', () => {
    expect(displayToIso('29.02.2004')).toBe('2004-02-29');
    expect(displayToIso('29.02.2000')).toBe('2000-02-29'); // divisible by 400
    expect(displayToIso('29.02.1900')).toBeNull(); // divisible by 100, not 400
  });

  it('treats a half-typed date as not yet a date', () => {
    expect(displayToIso('')).toBeNull();
    expect(displayToIso('27')).toBeNull();
    expect(displayToIso('27.02')).toBeNull();
    expect(displayToIso('27.02.20')).toBeNull();
  });

  it('survives whatever is already in the column', () => {
    expect(isoToDisplay(null)).toBe('');
    expect(isoToDisplay(undefined)).toBe('');
    expect(isoToDisplay('')).toBe('');
    expect(isoToDisplay('27.02.2004')).toBe(''); // already display-shaped, not ISO
    expect(isoToDisplay('2004-02-27T00:00:00Z')).toBe('');
  });
});

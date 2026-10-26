import { describe, expect, it } from 'vitest';
import { fillSeasonMonths } from '../seasonMonths';

describe('fillSeasonMonths', () => {
  const today = new Date(Date.UTC(2026, 9, 26)); // 26 Oct 2026

  it('fills quiet months with zero from the season start to this month', () => {
    const out = fillSeasonMonths(
      [{ month: '2026-09-01', revenue: 57, net: 50 }, { month: '2026-10-01', revenue: 13, net: 12 }],
      '2026-08-01',
      '2027-01-31',
      today,
    );
    expect(out.map((m) => m.month)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(out[0]).toEqual({ month: '2026-08-01', revenue: 0, net: 0 });
    expect(out[1].revenue).toBe(57);
  });

  it('stops at the season end for a finished season', () => {
    const out = fillSeasonMonths([], '2025-08-01', '2026-01-31', today);
    expect(out).toHaveLength(6);
    expect(out[5].month).toBe('2026-01-01');
  });

  it('just sorts when the season has no start date', () => {
    const out = fillSeasonMonths([{ month: '2026-10-01', revenue: 1, net: 1 }, { month: '2026-09-01', revenue: 2, net: 2 }], null, null, today);
    expect(out.map((m) => m.month)).toEqual(['2026-09-01', '2026-10-01']);
  });
});

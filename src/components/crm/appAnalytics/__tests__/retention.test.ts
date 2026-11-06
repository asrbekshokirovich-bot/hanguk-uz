import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import { pct, rate, totalOf, weeksOf, type Retention, type RetentionRow } from '../retention';
import { tabOf } from '../helpers';

const row = (o: Partial<RetentionRow>): RetentionRow => ({
  week: null, audience: 'mehmon', devices: 229,
  d1: 27, d1_base: 229, d3: 12, d3_base: 148, d7: 1, d7_base: 63, w7: 14,
  d14: 0, d14_base: 44, d30: 0, d30_base: 0, ...o,
});

describe('retention', () => {
  it('rates as the plan counted them (16-okt – 6-noy)', () => {
    const r = row({});
    expect(rate(r, 'd1')).toBe(11.8);
    expect(rate(r, 'd3')).toBe(8.1);
    expect(rate(r, 'd7')).toBe(1.6);
    expect(rate(r, 'd14')).toBe(0);
    expect(rate(r, 'd30')).toBeNull();
    expect(pct(11.8)).toBe('11,8%');
    expect(pct(null)).toBe('—');
  });

  it('splits totals from weeks by audience', () => {
    const data: Retention = {
      from: '2026-10-16', to: '2026-11-06',
      rows: [row({}), row({ week: '2026-10-19' }), row({ audience: 'talaba' })],
      benchmark: { source: 'Adjust', d1: 18, d3: 11, d7: 8, d30: 4 },
    };
    expect(totalOf(data, 'mehmon')?.week).toBeNull();
    expect(weeksOf(data, 'mehmon').map((w) => w.week)).toEqual(['2026-10-19']);
    expect(weeksOf(data, 'talaba')).toEqual([]);
  });

  it('has its own tab', () => {
    expect(tabOf('/crm/app-analytics/retention')).toBe('retention');
  });
});

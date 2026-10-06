import { describe, expect, it } from 'vitest';
import type { LeadReport } from '../../types';
import {
  addDays,
  adRows,
  adTotals,
  controlLine,
  costPerContract,
  formatPct,
  funnelRows,
  funnelTotal,
  generationCompare,
  headlineTiles,
  lostShares,
  parseSpend,
  pct,
  periodRange,
  spendKey,
} from '../reportMath';

const report: LeadReport = {
  from: '2026-09-29',
  to: '2026-10-05',
  totals: { leads: 40, answered: 30, answered_in_10: 24, talked: 18, offers: 9, contracts_sent: 4, students: 3 },
  by_source: [
    { source: 'instagram', leads: 25, answered: 20, talked: 12, offers: 6, students: 2 },
    { source: 'telegram', leads: 10, answered: 6, talked: 4, offers: 2, students: 1 },
    { source: 'meta_form', leads: 5, answered: 4, talked: 2, offers: 1, students: 0 },
  ],
  by_ad: [
    { ad: 'Hanbox 10-sent', leads: 12, students: 2 },
    { ad: 'Toshkent 18–24', leads: 8, students: 0 },
    { ad: 'Reels TOPIK', leads: 5, students: 1 },
  ],
  by_operator: [
    { operator_id: 'op-1', students: 2 },
    { operator_id: 'op-2', students: 1 },
  ],
  lost: [
    { reason: 'price', n: 6 },
    { reason: 'no_certificate', n: 3 },
    { reason: null, n: 1 },
  ],
  generation: [
    { generation: 'old', leads: 200, answered: 50, students: 2 },
    { generation: 'new', leads: 40, answered: 30, students: 3 },
  ],
};

describe('pct / formatPct', () => {
  it('divides, and refuses to divide by nothing', () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(3, 0)).toBeNull();
    expect(formatPct(pct(1, 3))).toBe('33%');
    expect(formatPct(pct(2, 3), 1)).toBe('66.7%');
    expect(formatPct(null)).toBe('—');
  });
});

describe('periods', () => {
  const now = new Date('2026-10-05T10:00:00Z'); // 15:00 in Tashkent

  it('adds days across a month end', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
  });

  it('Bugun / Kecha / 7 kun / 30 kun are Tashkent days ending today', () => {
    expect(periodRange('today', now)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(periodRange('yesterday', now)).toEqual({ from: '2026-10-04', to: '2026-10-04' });
    expect(periodRange('7d', now)).toEqual({ from: '2026-09-29', to: '2026-10-05' });
    expect(periodRange('30d', now)).toEqual({ from: '2026-09-06', to: '2026-10-05' });
  });

  it('uses the Tashkent day, not the UTC one, near midnight', () => {
    const late = new Date('2026-10-05T20:30:00Z'); // 01:30 on the 6th in Tashkent
    expect(periodRange('today', late)).toEqual({ from: '2026-10-06', to: '2026-10-06' });
  });

  it('custom takes the typed range, fixes a reversed one, and defaults to today', () => {
    expect(periodRange('custom', now, { from: '2026-10-01', to: '2026-10-03' })).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(periodRange('custom', now, { from: '2026-10-03', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(periodRange('custom', now, { from: '', to: '' })).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(periodRange('custom', now, { from: '2026-10-02', to: '' })).toEqual({ from: '2026-10-02', to: '2026-10-02' });
  });
});

describe('headlineTiles', () => {
  it('shows the report totals when no source is picked', () => {
    expect(headlineTiles(report)).toEqual({ students: 3, offers: 9, talked: 18, leads: 40, conversion: 7.5, scoped: false });
  });

  it('narrows to one source from by_source', () => {
    expect(headlineTiles(report, 'instagram')).toEqual({ students: 2, offers: 6, talked: 12, leads: 25, conversion: 8, scoped: true });
  });

  it('an unknown source is all zeros, not a crash', () => {
    expect(headlineTiles(report, 'nope')).toEqual({ students: 0, offers: 0, talked: 0, leads: 0, conversion: null, scoped: true });
  });
});

describe('funnel by source', () => {
  it('has lid → javob → gaplashildi → taklif → shartnoma with counts and % of leads', () => {
    const [ig] = funnelRows(report);
    expect(ig.source).toBe('instagram');
    expect(ig.steps.map((s) => [s.key, s.count, s.pct])).toEqual([
      ['leads', 25, 100],
      ['answered', 20, 80],
      ['talked', 12, 48],
      ['offers', 6, 24],
      ['students', 2, 8],
    ]);
    expect(ig.conversion).toBe(8);
  });

  it('adds up to the Jami row', () => {
    const total = funnelTotal(funnelRows(report));
    expect(total.steps.map((s) => s.count)).toEqual([40, 30, 18, 9, 3]);
    expect(total.conversion).toBe(7.5);
  });

  it('can be limited to one source', () => {
    expect(funnelRows(report, 'telegram').map((r) => r.source)).toEqual(['telegram']);
  });

  it('an empty report gives an empty funnel and a zero total', () => {
    const rows = funnelRows({ ...report, by_source: [] });
    expect(rows).toEqual([]);
    expect(funnelTotal(rows).conversion).toBeNull();
  });
});

describe('ad performance and cost per contract', () => {
  it('parses what a person types into the spend cell', () => {
    expect(parseSpend('1 200 000')).toBe(1_200_000);
    expect(parseSpend('350,5')).toBe(350.5);
    expect(parseSpend('')).toBeNull();
    expect(parseSpend('abc')).toBeNull();
    expect(parseSpend('-5')).toBeNull();
    expect(parseSpend('12e3')).toBeNull();
  });

  it('cost per contract = spend ÷ contracts; none without a contract or a spend', () => {
    expect(costPerContract(600, 3)).toBe(200);
    expect(costPerContract(600, 0)).toBeNull();
    expect(costPerContract(null, 3)).toBeNull();
    expect(costPerContract(0, 2)).toBe(0);
  });

  it('keys the spend by period and ad', () => {
    expect(spendKey('2026-09-29', '2026-10-05', 'Hanbox 10-sent')).toBe('2026-09-29..2026-10-05|Hanbox 10-sent');
  });

  it('computes conversion and cost per contract per ad', () => {
    const spend = { [spendKey('2026-09-29', '2026-10-05', 'Hanbox 10-sent')]: 500, [spendKey('2026-09-29', '2026-10-05', 'Toshkent 18–24')]: 300 };
    const rows = adRows(report, spend, '2026-09-29', '2026-10-05');
    expect(rows[0]).toMatchObject({ ad: 'Hanbox 10-sent', leads: 12, students: 2, conversion: (2 / 12) * 100, spend: 500, costPerContract: 250 });
    // spend typed, but no contract: no cost per contract
    expect(rows[1]).toMatchObject({ students: 0, spend: 300, costPerContract: null });
    // nothing typed yet
    expect(rows[2]).toMatchObject({ spend: null, costPerContract: null });
  });

  it('a spend typed for another period is not used', () => {
    const rows = adRows(report, { [spendKey('2026-08-01', '2026-08-07', 'Hanbox 10-sent')]: 999 }, '2026-09-29', '2026-10-05');
    expect(rows[0].spend).toBeNull();
  });

  it('totals only the ads that have a spend', () => {
    const spend = { [spendKey('a', 'b', 'Hanbox 10-sent')]: 500, [spendKey('a', 'b', 'Reels TOPIK')]: 100 };
    const totals = adTotals(adRows(report, spend, 'a', 'b'));
    expect(totals).toEqual({ spend: 600, students: 3, costPerContract: 200 });
    expect(adTotals(adRows(report, {}, 'a', 'b'))).toEqual({ spend: 0, students: 0, costPerContract: null });
  });
});

describe('lost reasons', () => {
  it('gives each reason its share, largest first, with labels', () => {
    const shares = lostShares(report, (k) => ({ price: 'Narx', no_certificate: "Sertifikat yo'q" })[k] ?? k);
    expect(shares.map((s) => [s.label, s.n])).toEqual([
      ['Narx', 6],
      ["Sertifikat yo'q", 3],
      ["Sabab ko'rsatilmagan", 1],
    ]);
    expect(shares[0].share).toBeCloseTo(60);
    expect(shares.reduce((a, s) => a + s.share, 0)).toBeCloseTo(100);
  });

  it('nothing lost is an empty list', () => {
    expect(lostShares({ ...report, lost: [] }, (k) => k)).toEqual([]);
  });
});

describe('old vs new', () => {
  it('puts the two generations side by side with answered % and conversion %', () => {
    const { old, new: current } = generationCompare(report);
    expect(old).toMatchObject({ leads: 200, answered: 50, answeredPct: 25, students: 2, conversion: 1 });
    expect(current).toMatchObject({ leads: 40, answered: 30, answeredPct: 75, students: 3, conversion: 7.5 });
  });

  it('a missing generation is zeros', () => {
    const { old } = generationCompare({ ...report, generation: [{ generation: 'new', leads: 1, answered: 1, students: 0 }] });
    expect(old).toEqual({ generation: 'old', leads: 0, answered: 0, answeredPct: null, students: 0, conversion: null });
  });
});

describe('control line', () => {
  it('"10 daqiqa ichida javob %" = answered_in_10 / leads', () => {
    expect(controlLine(report)).toEqual({ answeredIn10: 24, leads: 40, pct: 60 });
  });

  it('no leads, no percentage', () => {
    expect(controlLine({ ...report, totals: { ...report.totals, leads: 0, answered_in_10: 0 } }).pct).toBeNull();
  });
});

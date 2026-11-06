import { describe, expect, it } from 'vitest';
import { errorPct, fmtAt, fmtTokens, fmtUsd, healthLevel, normalizeHealth, purposeKey } from '../botAiHealth';

const RAW = {
  hours: 24, calls: 27, errors: 3, avg_ms: 912, input_tokens: 54000, output_tokens: 8100, cost_usd: 0.0042,
  rows: [
    { purpose: 'group_analysis', provider: 'claude', calls: 20, errors: 1, avg_ms: 850, input_tokens: 40000, output_tokens: 6000, cost_usd: 0.0035 },
    { purpose: 'report_split', provider: 'gemini', calls: 7, errors: 2, avg_ms: null, input_tokens: 14000, output_tokens: 2100, cost_usd: null },
  ],
  jobs: { pending: 1, failed: 0, done: 4 },
  last_error: { at: '2026-11-05T07:18:07Z', purpose: 'group_analysis', provider: 'claude', status: 529, error: 'overloaded_error: Overloaded' },
};

describe('botAiHealth', () => {
  it('normalizeHealth: RPC javobi, yo\'q maydonlar 0/null', () => {
    const h = normalizeHealth(RAW)!;
    expect([h.calls, h.errors, h.cost_usd, h.jobs.pending]).toEqual([27, 3, 0.0042, 1]);
    expect(h.rows[1]).toEqual({ purpose: 'report_split', provider: 'gemini', calls: 7, errors: 2, avg_ms: null, input_tokens: 14000, output_tokens: 2100, cost_usd: null });
    expect(h.last_error?.status).toBe(529);
    const empty = normalizeHealth({ hours: 24, calls: 0, errors: 0, avg_ms: null, rows: [], jobs: {}, last_error: null })!;
    expect([empty.calls, empty.avg_ms, empty.rows.length, empty.jobs.failed, empty.last_error]).toEqual([0, null, 0, 0, null]);
    expect(normalizeHealth(null)).toBeNull();
  });

  it('errorPct', () => {
    expect(errorPct(27, 3)).toBe(11);
    expect(errorPct(0, 0)).toBeNull();
  });

  it('healthLevel: chegaralar bot ogohlantirishi bilan bir xil', () => {
    const j = { pending: 0, failed: 0, done: 0 };
    expect(healthLevel(null)).toBe('idle');
    expect(healthLevel({ calls: 0, errors: 0, jobs: j })).toBe('idle');
    expect(healthLevel({ calls: 10, errors: 0, jobs: j })).toBe('ok');
    expect(healthLevel({ calls: 10, errors: 1, jobs: j })).toBe('warn');
    expect(healthLevel({ calls: 10, errors: 0, jobs: { ...j, pending: 1 } })).toBe('warn');
    expect(healthLevel({ calls: 5, errors: 1, jobs: j })).toBe('bad'); // 20%
    expect(healthLevel({ calls: 4, errors: 4, jobs: j })).toBe('warn'); // 5 tadan kam chaqiruv
    expect(healthLevel({ calls: 10, errors: 0, jobs: { ...j, failed: 1 } })).toBe('bad');
  });

  it('fmtUsd, fmtTokens, fmtAt, purposeKey', () => {
    expect([fmtUsd(0), fmtUsd(null), fmtUsd(0.00035), fmtUsd(0.0042), fmtUsd(0.15312), fmtUsd(1.274)])
      .toEqual(['$0', '$0', '$0.00035', '$0.0042', '$0.153', '$1.27']);
    expect(fmtUsd(0.0042, 'ru')).toBe('$0,0042');
    expect([fmtTokens(950), fmtTokens(12300), fmtTokens(2_100_000), fmtTokens(null)]).toEqual(['950', '12.3K', '2.1M', '0']);
    expect(fmtAt('2026-11-05T19:30:00Z')).toBe('06.11 00:30');
    expect(fmtAt(null)).toBe('');
    expect(purposeKey('report_split')).toBe('crm.botAiHealth.purpose_report_split');
    expect(purposeKey('voice')).toBeNull();
  });
});

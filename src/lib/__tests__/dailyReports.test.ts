import { describe, expect, it } from 'vitest';
import { fmtTime, isLate, isWorkday, reportStats, shiftDate, sortReports, tashkentDate, type DailyReportRow } from '../dailyReports';

const row = (p: Partial<DailyReportRow>): DailyReportRow => ({
  user_id: 'u', full_name: 'X', is_linked: true, report_id: null, raw_text: null, done: null, blockers: null,
  plan: null, ai_parsed: false, submitted_at: null, updated_at: null, completed_count: 0, ...p,
});

describe('dailyReports', () => {
  it('Toshkent sanasi va siljitish', () => {
    expect(tashkentDate(Date.parse('2026-11-01T19:30:00Z'))).toBe('2026-11-02');
    expect(shiftDate('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(isWorkday('2026-11-01')).toBe(false); // yakshanba
    expect(isWorkday('2026-11-02')).toBe(true);
  });

  it('saralash va hisob', () => {
    const rows = [
      row({ full_name: 'Omina' }),
      row({ full_name: 'Madina', report_id: '1', blockers: 'x' }),
      row({ full_name: 'Diyora', report_id: '2' }),
    ];
    expect(sortReports(rows).map((r) => r.full_name)).toEqual(['Diyora', 'Madina', 'Omina']);
    expect(reportStats(rows)).toEqual({ total: 3, submitted: 2, missing: 1, blockers: 1 });
  });

  it('vaqt va kechikish', () => {
    expect(fmtTime('2026-11-02T12:05:00Z')).toBe('17:05');
    expect(isLate('2026-11-02T12:05:00Z')).toBe(false);
    expect(isLate('2026-11-02T13:00:00Z')).toBe(true);
    expect(fmtTime(null)).toBe('');
  });
});

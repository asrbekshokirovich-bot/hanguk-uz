import { describe, expect, it } from 'vitest';
import {
  CALL_TODAY_WINDOW_MINUTES,
  bandFor,
  buildBands,
  filterLeads,
  isCallToday,
  isOverdue,
  matchesQuery,
  minutesUntil,
  worklistStats,
} from '../worklistLogic';
import type { LeadVM } from '../types';

const NOW = new Date('2026-08-04T09:00:00Z');

function row(overrides: Partial<LeadVM> = {}): LeadVM {
  return {
    id: 'l1',
    name: 'Dilnoza Karimova',
    initials: 'DK',
    phone: '+998 91 445 12 03',
    city: 'Namangan',
    source: 'instagram',
    referred: false,
    owner: null,
    createdAt: NOW.toISOString(),
    stage: 'contacted',
    attempts: 1,
    score: 60,
    tier: 'warm',
    factors: { intent: 60, budget: 60, education: 60, language: 60, timing: 60 },
    nextCall: null,
    dueInMinutes: 120,
    history: [],
    duplicateOfId: null,
    duplicateNote: null,
    lead: { preferred_program: 'Nursing' } as LeadVM['lead'],
    ...overrides,
  } as LeadVM;
}

describe('due-time predicates', () => {
  it('treats a past due time as overdue and an unscheduled lead as not overdue', () => {
    expect(isOverdue(row({ dueInMinutes: -30 }))).toBe(true);
    expect(isOverdue(row({ dueInMinutes: 30 }))).toBe(false);
    expect(isOverdue(row({ dueInMinutes: null }))).toBe(false);
  });

  it('counts anything inside the window, overdue, or unscheduled as call-today', () => {
    expect(isCallToday(row({ dueInMinutes: CALL_TODAY_WINDOW_MINUTES }))).toBe(true);
    expect(isCallToday(row({ dueInMinutes: CALL_TODAY_WINDOW_MINUTES + 1 }))).toBe(false);
    expect(isCallToday(row({ dueInMinutes: -500 }))).toBe(true);
    expect(isCallToday(row({ dueInMinutes: null }))).toBe(true);
  });

  it('converts an ISO timestamp to signed minutes', () => {
    expect(minutesUntil('2026-08-04T10:00:00Z', NOW)).toBe(60);
    expect(minutesUntil('2026-08-04T08:00:00Z', NOW)).toBe(-60);
    expect(minutesUntil(null, NOW)).toBeNull();
  });
});

describe('search', () => {
  it('matches name, phone, city and programme, case-insensitively', () => {
    expect(matchesQuery(row(), 'dilnoza')).toBe(true);
    expect(matchesQuery(row(), '445')).toBe(true);
    expect(matchesQuery(row(), 'NAMANGAN')).toBe(true);
    expect(matchesQuery(row(), 'nursing')).toBe(true);
    expect(matchesQuery(row(), 'tashkent')).toBe(false);
    expect(matchesQuery(row(), '  ')).toBe(true);
  });
});

describe('filters compose', () => {
  const leads = [
    row({ id: 'a', source: 'instagram', dueInMinutes: -10 }),
    row({ id: 'b', source: 'telegram', dueInMinutes: 5000, name: 'Rustam Aliyev', city: 'Tashkent' }),
    row({ id: 'c', source: 'instagram', dueInMinutes: 60, name: 'Zarina Umarova', city: 'Tashkent' }),
  ];

  it('applies source, call-today and query together', () => {
    expect(filterLeads(leads, 'all', false, '').map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(filterLeads(leads, 'instagram', false, '').map((l) => l.id)).toEqual(['a', 'c']);
    expect(filterLeads(leads, 'all', true, '').map((l) => l.id)).toEqual(['a', 'c']);
    expect(filterLeads(leads, 'instagram', true, 'zarina').map((l) => l.id)).toEqual(['c']);
    expect(filterLeads(leads, 'telegram', true, '')).toEqual([]);
  });
});

describe('banding', () => {
  it('sends a never-called lead to the new band even when its clock has passed', () => {
    expect(bandFor(row({ stage: 'new', dueInMinutes: -400 }))).toBe('new');
  });

  it('bands overdue, booked and working correctly', () => {
    expect(bandFor(row({ stage: 'contacted', dueInMinutes: -1 }))).toBe('overdue');
    expect(bandFor(row({ stage: 'booked', dueInMinutes: 300 }))).toBe('booked');
    expect(bandFor(row({ stage: 'booked', dueInMinutes: -300 }))).toBe('overdue');
    expect(bandFor(row({ stage: 'attempting', dueInMinutes: 300 }))).toBe('working');
  });

  it('renders bands in fixed order and drops the empty ones', () => {
    const bands = buildBands([
      row({ id: 'w', stage: 'contacted', dueInMinutes: 200 }),
      row({ id: 'n', stage: 'new', dueInMinutes: null }),
      row({ id: 'o', stage: 'contacted', dueInMinutes: -60 }),
    ]);
    expect(bands.map((b) => b.key)).toEqual(['overdue', 'new', 'working']);
  });

  it('sorts overdue by how long it has waited, and other bands by score', () => {
    const bands = buildBands([
      row({ id: 'late', stage: 'contacted', dueInMinutes: -10 }),
      row({ id: 'later', stage: 'contacted', dueInMinutes: -600 }),
      row({ id: 'low', stage: 'attempting', dueInMinutes: 100, score: 40 }),
      row({ id: 'high', stage: 'attempting', dueInMinutes: 100, score: 90 }),
    ]);
    expect(bands[0].rows.map((r) => r.id)).toEqual(['later', 'late']);
    expect(bands[1].rows.map((r) => r.id)).toEqual(['high', 'low']);
  });
});

describe('stats', () => {
  it('counts uncalled, overdue, booked and the average score', () => {
    const stats = worklistStats([
      row({ stage: 'new', dueInMinutes: null, score: 80 }),
      row({ stage: 'contacted', dueInMinutes: -30, score: 60 }),
      row({ stage: 'booked', dueInMinutes: 400, score: 40 }),
    ]);
    expect(stats).toEqual({ uncalled: 1, overdue: 1, booked: 1, avgScore: 60, callToday: 3 });
  });

  it('never divides by zero', () => {
    expect(worklistStats([]).avgScore).toBe(0);
  });
});

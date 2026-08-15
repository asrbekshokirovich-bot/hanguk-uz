import { describe, expect, it } from 'vitest';
import type { Lead } from '@/contexts/LeadsContext';
import {
  EMPTY_FILTERS,
  type LeadFilters,
  activeFilterCount,
  filterLeads,
  hasActiveSearch,
  normalize,
  parseQuery,
} from '../leadSearch';

const NOW = new Date(2026, 7, 14); // 14 August 2026

const lead = (overrides: Partial<Lead> = {}): Lead =>
  ({
    id: 'lead-1',
    full_name: 'Muhammad Eshmurodov',
    phone: '+998 94 196 69 89',
    age: 18,
    city: 'Toshkent',
    cert_level: 'TOPIK 4',
    education_level: 'Bakalavr',
    target_intake: 'Bahorgi 2027',
    contact_channel: 'Instagram',
    how_heard: 'Instagram sahifasi',
    source_note: null,
    notes: null,
    status: 'new',
    next_follow_up: null,
    created_at: new Date(2026, 7, 11).toISOString(),
    ...overrides,
  }) as Lead;

const find = (leads: Lead[], filters: Partial<LeadFilters>) =>
  filterLeads(leads, { ...EMPTY_FILTERS, ...filters }, NOW).map((l) => l.id);

describe('normalize', () => {
  it('folds the three apostrophes a Uzbek keyboard can produce', () => {
    expect(normalize('Farg‘ona')).toBe(normalize("Farg'ona"));
    expect(normalize('Fargʻona')).toBe(normalize("farg'ona"));
  });

  it('folds case, accents and runs of whitespace', () => {
    expect(normalize('  Múhammad   ESHMURODOV ')).toBe('muhammad eshmurodov');
  });
});

describe('parseQuery', () => {
  it('splits words into terms that each narrow the search', () => {
    expect(parseQuery('muhammad toshkent')).toEqual([
      { value: 'muhammad' },
      { value: 'toshkent' },
    ]);
  });

  it('reads a known field prefix', () => {
    expect(parseQuery('city:Samarqand')).toEqual([
      { field: 'city', value: 'Samarqand' },
    ]);
  });

  it('keeps a quoted phrase in one piece', () => {
    expect(parseQuery('note:"qayta qo\'ng\'iroq"')).toEqual([
      { field: 'note', value: "qayta qo'ng'iroq" },
    ]);
  });

  it('treats an unknown prefix as ordinary text rather than dropping it', () => {
    expect(parseQuery('http://example.com')).toEqual([
      { value: 'http://example.com' },
    ]);
  });

  it('ignores empty input', () => {
    expect(parseQuery('   ')).toEqual([]);
  });
});

describe('filterLeads — free text', () => {
  const leads = [
    lead({ id: 'a', full_name: 'Muhammad Eshmurodov', city: 'Toshkent' }),
    lead({ id: 'b', full_name: 'Aziza Rahimova', city: 'Farg‘ona', phone: '+998 90 111 22 33' }),
  ];

  it('finds by name regardless of case', () => {
    expect(find(leads, { query: 'aziza' })).toEqual(['b']);
  });

  it('finds a city typed with a different apostrophe than the stored one', () => {
    expect(find(leads, { query: "farg'ona" })).toEqual(['b']);
  });

  it('narrows with each further word rather than widening', () => {
    expect(find(leads, { query: 'muhammad toshkent' })).toEqual(['a']);
    expect(find(leads, { query: 'muhammad fargona' })).toEqual([]);
  });

  it('matches a phone however it was punctuated', () => {
    expect(find(leads, { query: '941966989' })).toEqual(['a']);
    expect(find(leads, { query: '90 111' })).toEqual(['b']);
  });

  it('searches the note and the source clarification too', () => {
    const withNote = lead({ id: 'c', notes: 'Dugonasi Dilnoza tavsiya qilgan' });
    const withSource = lead({ id: 'd', source_note: 'Toshkent ta’lim ko‘rgazmasi' });
    expect(find([withNote, withSource], { query: 'dilnoza' })).toEqual(['c']);
    expect(find([withNote, withSource], { query: "ko'rgazmasi" })).toEqual(['d']);
  });

  it('restricts a field-qualified term to that field', () => {
    const named = lead({ id: 'e', full_name: 'Instagram Ali', contact_channel: 'Telefon' });
    const found = lead({ id: 'f', full_name: 'Bekzod Aliyev', contact_channel: 'Instagram' });
    expect(find([named, found], { query: 'channel:Instagram' })).toEqual(['f']);
    expect(find([named, found], { query: 'name:Instagram' })).toEqual(['e']);
  });

  it('matches an age exactly, so 18 does not pull in 18-year-olds by phone', () => {
    const young = lead({ id: 'g', age: 18, phone: '+998 90 000 18 00' });
    const older = lead({ id: 'h', age: 22, phone: '+998 90 000 22 00' });
    expect(find([young, older], { query: 'age:22' })).toEqual(['h']);
  });

  it('returns everything when nothing was typed', () => {
    expect(find(leads, { query: '  ' })).toEqual(['a', 'b']);
  });
});

describe('filterLeads — pickers', () => {
  const leads = [
    lead({ id: 'a', city: 'Toshkent', education_level: 'Bakalavr', cert_level: 'TOPIK 4' }),
    lead({ id: 'b', city: 'Samarqand', education_level: 'Magistr', cert_level: "Yo'q" }),
  ];

  it('matches a picked value exactly, not as a substring', () => {
    expect(find(leads, { city: 'Samarqand' })).toEqual(['b']);
    expect(find(leads, { level: 'Bakalavr' })).toEqual(['a']);
  });

  it('combines a picker with the text box', () => {
    expect(find(leads, { city: 'Toshkent', query: 'muhammad' })).toEqual(['a']);
    expect(find(leads, { city: 'Samarqand', query: 'nobody' })).toEqual([]);
  });

  it('separates complete records from half-filled ones', () => {
    const half = lead({ id: 'c', city: null });
    expect(find([leads[0], half], { completeness: 'incomplete' })).toEqual(['c']);
    expect(find([leads[0], half], { completeness: 'complete' })).toEqual(['a']);
  });
});

describe('filterLeads — follow-up window', () => {
  const overdue = lead({ id: 'past', next_follow_up: '2026-08-10' });
  const today = lead({ id: 'today', next_follow_up: '2026-08-14' });
  const soon = lead({ id: 'soon', next_follow_up: '2026-08-19' });
  const later = lead({ id: 'later', next_follow_up: '2026-09-30' });
  const none = lead({ id: 'none', next_follow_up: null });
  const all = [overdue, today, soon, later, none];

  it('picks out the dates that have already passed', () => {
    expect(find(all, { followUp: 'overdue' })).toEqual(['past']);
  });

  it("picks out today's calls", () => {
    expect(find(all, { followUp: 'today' })).toEqual(['today']);
  });

  it('counts today through a week out as the week', () => {
    expect(find(all, { followUp: 'week' })).toEqual(['today', 'soon']);
  });

  it('finds the leads nobody has scheduled', () => {
    expect(find(all, { followUp: 'none' })).toEqual(['none']);
  });

  it('leaves out leads that have already left the list', () => {
    const converted = lead({ id: 'gone', next_follow_up: '2026-08-10', status: 'converted' });
    expect(find([overdue, converted], { followUp: 'overdue' })).toEqual(['past']);
  });
});

describe('activeFilterCount', () => {
  it('counts only the pickers, so the badge does not double the text box', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, query: 'aziza' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, city: 'Toshkent', followUp: 'overdue' })).toBe(2);
  });

  it('reports a search as active for either kind of narrowing', () => {
    expect(hasActiveSearch(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveSearch({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveSearch({ ...EMPTY_FILTERS, query: 'a' })).toBe(true);
    expect(hasActiveSearch({ ...EMPTY_FILTERS, cert: 'TOPIK 4' })).toBe(true);
  });
});

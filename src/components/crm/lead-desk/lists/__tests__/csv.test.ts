import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectAllPages, csvCell, LEAD_CSV_HEADER, leadsToCsv, toCsv } from '../csv';
import { listRow } from './testUtils';

describe('csvCell', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('Dilnoza')).toBe('Dilnoza');
    expect(csvCell(82)).toBe('82');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes commas, semicolons and line breaks, and doubles quotes', () => {
    expect(csvCell('Aziz, Karimov')).toBe('"Aziz, Karimov"');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('keeps Uzbek apostrophes and letters as they are', () => {
    expect(csvCell("Farg'ona o'quvchisi")).toBe("Farg'ona o'quvchisi");
  });

  it('defuses spreadsheet formulas but not phone numbers', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('@sardor')).toBe("'@sardor");
    expect(csvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(csvCell('+998 90 123-45-67')).toBe('+998 90 123-45-67');
    expect(csvCell('2026-10-05 14:12')).toBe('2026-10-05 14:12');
  });
});

describe('toCsv', () => {
  it('joins with CRLF and no trailing newline', () => {
    expect(toCsv(['A', 'B'], [[1, 'x,y'], [2, '']])).toBe('A,B\r\n1,"x,y"\r\n2,');
  });
});

describe('leadsToCsv', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T07:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the header and one escaped line per lead', () => {
    const rows = [
      listRow({
        full_name: 'Dilnoza "Dila" A.',
        phone: '+998901234567',
        instagram_handle: 'dilnoza_a',
        telegram_handle: 'dilnoza',
        source: 'instagram',
        stage: 'interested',
        owner_id: 'u1',
        cert_level: 'TOPIK 3',
        education_level: 'Bakalavr',
        city: "Farg'ona",
        last_contacted_at: '2026-10-05T09:12:00Z',
        next_action_at: '2026-10-07T05:00:00Z',
        next_action_kind: 'callback',
        priority_score: 82,
        campaign_name: 'Hanbox 10-sent',
        created_at: '2026-10-03T15:14:00Z',
      }),
      listRow({ full_name: 'Pool Lead', owner_id: null, stage: 'new' }),
    ];
    const csv = leadsToCsv(rows, { ownerName: (id) => (id === 'u1' ? 'Omina' : null) });
    const [header, first, second] = csv.split('\r\n');
    expect(header).toBe(LEAD_CSV_HEADER.join(','));
    expect(first).toContain('"Dilnoza ""Dila"" A."');
    expect(first).toContain('+998901234567');
    expect(first).toContain('@dilnoza_a');
    expect(first).toContain('IG + TG + Tel');
    expect(first).toContain('Qiziqdi');
    expect(first).toContain('Omina');
    expect(first).toContain('TOPIK 3');
    expect(first).toContain("Farg'ona");
    expect(first).toContain('2026-10-05 14:12'); // 09:12 UTC = 14:12 Tashkent
    expect(first).toContain("07.10 10:00 · Qo'ng'iroq");
    expect(first).toContain(',82,');
    expect(second).toContain('Pool Lead');
    expect(second).toContain('Hovuz');
    expect(second).toContain('Yangi');
  });

  it('an empty list is just the header', () => {
    expect(leadsToCsv([], { ownerName: () => null })).toBe(LEAD_CSV_HEADER.join(','));
  });
});

describe('collectAllPages', () => {
  const makeFetch = (total: number) =>
    vi.fn(async (offset: number, limit: number) => ({
      rows: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => offset + i),
      total,
    }));

  it('walks every page of the filter', async () => {
    const fetchPage = makeFetch(2300);
    const res = await collectAllPages(fetchPage, { pageSize: 1000 });
    expect(res.rows).toHaveLength(2300);
    expect(res.truncated).toBe(false);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 1000, 2000]);
  });

  it('stops after one short page', async () => {
    const fetchPage = makeFetch(10);
    const res = await collectAllPages(fetchPage, { pageSize: 1000 });
    expect(res.rows).toHaveLength(10);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('an empty list is fine', async () => {
    const res = await collectAllPages(makeFetch(0));
    expect(res).toEqual({ rows: [], total: 0, truncated: false });
  });

  it('stops at the cap and says the export is cut', async () => {
    const res = await collectAllPages(makeFetch(5000), { pageSize: 1000, cap: 2000 });
    expect(res.rows).toHaveLength(2000);
    expect(res.total).toBe(5000);
    expect(res.truncated).toBe(true);
  });
});

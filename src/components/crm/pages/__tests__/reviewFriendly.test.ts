import { describe, it, expect } from 'vitest';
import {
  reviewLang,
  formatReviewDate,
  formatMoney,
  formatTopik,
  confidenceBand,
  getSummary,
  getRowLabel,
  collectOriginalTexts,
  parseReliabilityChecks,
  canonicalSection,
  presentSections,
} from '../reviewFriendly';

describe('reviewLang', () => {
  it('maps uz variants to uz and everything else to en', () => {
    expect(reviewLang('uz')).toBe('uz');
    expect(reviewLang('uz-UZ')).toBe('uz');
    expect(reviewLang('en')).toBe('en');
    expect(reviewLang('ru')).toBe('en');
    expect(reviewLang('ko')).toBe('en');
    expect(reviewLang(undefined)).toBe('en');
  });
});

describe('formatReviewDate', () => {
  it('formats a bare date without timezone shifting', () => {
    expect(formatReviewDate('2026-03-20', 'uz')).toBe('20-mart 2026');
    expect(formatReviewDate('2026-03-20', 'en')).toBe('20 March 2026');
    // Jan 1 must stay Jan 1 even though UTC-midnight parsing crosses KST.
    expect(formatReviewDate('2026-01-01', 'en')).toBe('1 January 2026');
  });

  it('formats a timestamp in KST with the time appended', () => {
    expect(formatReviewDate('2026-03-20T17:00:00+09:00', 'uz')).toBe('20-mart 2026, 17:00');
    expect(formatReviewDate('2026-03-20T17:00:00+09:00', 'en')).toBe('20 March 2026, 17:00');
    // UTC timestamp converts into KST (+9).
    expect(formatReviewDate('2026-03-20T00:00:00Z', 'en')).toBe('20 March 2026, 09:00');
  });

  it('returns null for absent or unparseable values', () => {
    expect(formatReviewDate(null, 'uz')).toBeNull();
    expect(formatReviewDate('', 'uz')).toBeNull();
    expect(formatReviewDate('가을학기', 'uz')).toBeNull();
    expect(formatReviewDate(20260320, 'uz')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('groups thousands with spaces and appends the currency', () => {
    expect(formatMoney(4200000)).toBe('4 200 000 KRW');
    expect(formatMoney(998000)).toBe('998 000 KRW');
    expect(formatMoney(0)).toBe('0 KRW');
    expect(formatMoney('5533000')).toBe('5 533 000 KRW');
    expect(formatMoney(150, 'USD')).toBe('150 USD');
  });

  it('returns null for non-numeric values', () => {
    expect(formatMoney(null)).toBeNull();
    expect(formatMoney(undefined)).toBeNull();
    expect(formatMoney('무료')).toBeNull();
    expect(formatMoney('')).toBeNull();
  });
});

describe('formatTopik', () => {
  it('renders a minimum level as TOPIK n+', () => {
    expect(formatTopik(3)).toBe('TOPIK 3+');
    expect(formatTopik(6)).toBe('TOPIK 6+');
  });

  it('returns null for out-of-range or non-integer values', () => {
    expect(formatTopik(null)).toBeNull();
    expect(formatTopik(undefined)).toBeNull();
    expect(formatTopik(0)).toBeNull();
    expect(formatTopik(7)).toBeNull();
    expect(formatTopik(3.5)).toBeNull();
    expect(formatTopik('3')).toBeNull();
  });
});

describe('confidenceBand', () => {
  it('bands scores into green / yellow / red', () => {
    expect(confidenceBand(0.95)).toBe('green');
    expect(confidenceBand(0.8)).toBe('green'); // ≥80 inclusive
    expect(confidenceBand(0.79)).toBe('yellow');
    expect(confidenceBand(0.55)).toBe('yellow');
    expect(confidenceBand(0.5)).toBe('yellow'); // ≥50 inclusive
    expect(confidenceBand(0.49)).toBe('red');
    expect(confidenceBand(0)).toBe('red');
  });

  it('returns null when there is no score', () => {
    expect(confidenceBand(null)).toBeNull();
    expect(confidenceBand(undefined)).toBeNull();
    expect(confidenceBand(NaN)).toBeNull();
  });
});

describe('getSummary — payload fallback', () => {
  const newPayload = {
    summary_uz: 'Hujjat topshirish 20-martgacha.',
    summary_en: 'Applications close on 20 March.',
    rows: [],
  };

  it('returns the summary in the requested language', () => {
    expect(getSummary(newPayload, 'uz')).toBe('Hujjat topshirish 20-martgacha.');
    expect(getSummary(newPayload, 'en')).toBe('Applications close on 20 March.');
  });

  it('falls back to the other language when one is missing', () => {
    expect(getSummary({ summary_en: 'Only English.' }, 'uz')).toBe('Only English.');
    expect(getSummary({ summary_uz: 'Faqat o‘zbekcha.' }, 'en')).toBe('Faqat o‘zbekcha.');
  });

  it('returns null for OLD payloads without summaries (must not throw)', () => {
    expect(getSummary({ rows: [{ topik_min_level: 3 }] }, 'uz')).toBeNull();
    expect(getSummary({ events: [] }, 'en')).toBeNull();
    expect(getSummary(null, 'uz')).toBeNull();
    expect(getSummary(undefined, 'uz')).toBeNull();
    expect(getSummary([], 'uz')).toBeNull();
    expect(getSummary({ summary_uz: '   ' }, 'uz')).toBeNull(); // whitespace-only
  });
});

describe('getRowLabel', () => {
  it('prefers the requested language and falls back to the other', () => {
    const row = { label_uz: 'Pasport nusxasi', label_en: 'Passport copy' };
    expect(getRowLabel(row, 'uz')).toBe('Pasport nusxasi');
    expect(getRowLabel(row, 'en')).toBe('Passport copy');
    expect(getRowLabel({ label_en: 'Passport copy' }, 'uz')).toBe('Passport copy');
  });

  it('returns null for old rows without labels', () => {
    expect(getRowLabel({ document_type: 'passport_copy' }, 'uz')).toBeNull();
    expect(getRowLabel(null, 'uz')).toBeNull();
  });
});

describe('collectOriginalTexts', () => {
  it('collects and dedupes Korean text fields from rows and events', () => {
    const parsed = {
      rows: [
        { source_text_ko: '여권 사본', notes_ko: '본인 및 부모' },
        { source_text_ko: '여권 사본' }, // duplicate
      ],
      events: [{ source_text_ko: '원서접수 마감' }],
    };
    expect(collectOriginalTexts(parsed)).toEqual(['여권 사본', '본인 및 부모', '원서접수 마감']);
  });

  it('works on a single row object', () => {
    expect(collectOriginalTexts({ prose_ko: 'TOPIK 3급 이상' })).toEqual(['TOPIK 3급 이상']);
  });

  it('returns [] when there is nothing to show', () => {
    expect(collectOriginalTexts({ rows: [{ amount_krw: 1 }] })).toEqual([]);
    expect(collectOriginalTexts(null)).toEqual([]);
  });
});

describe('parseReliabilityChecks', () => {
  it('reports all-passed for a clean green note', () => {
    const r = parseReliabilityChecks('[GREEN] reliability · calendar\n  all checks passed');
    expect(r).toEqual({ allPassed: true, failures: [] });
  });

  it('classifies failure lines by check kind', () => {
    const note = [
      '[RED] reliability · tuition',
      '  consensus DISAGREEMENT on tuition:인문 amount_krw: [4212000, 4812000]',
      '  grounding[not_found] row 1 admission_fee_krw',
      '  sanity[warn] gpa_floor_pct: below usual floor',
      '  identity: REJECTED — different institution',
    ].join('\n');
    const r = parseReliabilityChecks(note)!;
    expect(r.allPassed).toBe(false);
    expect(r.failures.map((f) => f.kind)).toEqual([
      'consensus',
      'grounding',
      'sanity',
      'identity',
    ]);
  });

  it('returns null when there is no note (old rows)', () => {
    expect(parseReliabilityChecks(null)).toBeNull();
    expect(parseReliabilityChecks('')).toBeNull();
  });
});

describe('section canonicalization / completeness', () => {
  it('maps pipeline aliases onto the five reviewer sections', () => {
    expect(canonicalSection('basic_requirements')).toBe('requirements');
    expect(canonicalSection('document_checklist')).toBe('documents_required');
    expect(canonicalSection('admission_periods')).toBe('calendar');
    expect(canonicalSection('recruitment_units')).toBeNull();
    expect(canonicalSection(null)).toBeNull();
  });

  it('computes which of the 5 groups are present', () => {
    const present = presentSections(['calendar', 'basic_requirements', null, 'bogus']);
    expect(present.has('calendar')).toBe(true);
    expect(present.has('requirements')).toBe(true);
    expect(present.has('tuition')).toBe(false);
    expect(present.size).toBe(2);
  });
});

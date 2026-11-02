import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import { ONE_PERCENT_UNIVERSITIES, isOnePercent } from '@/lib/onePercentUniversities';
import UniversityCatalogContent from '../UniversityCatalogContent';

/** "1% universitetlar" filtri (Asrbek, 2026-10-29) — Universitetlar bo'limida, hamma rolda. */

function guideline(institution_id: string): GuidelineSummary {
  return {
    id: `g-${institution_id}`, guideline_id: 'x', institution_id, univ_kod: 'x', univ_nomi_en: null,
    univ_nomi_kr: null, kampus: null, shahar: null, qabul_yili: 2027, semestr: 'bahor', daraja: 'bakalavr',
    english_track: null, korean_track: null, topik_min: null, ielts_min: null, toefl_ibt_min: null,
    narx_valyuta: 'KRW', kirish_tolovi: null, kontrakt_min: null, kontrakt_max: null, kontrakt_davri: null,
    fakultet_soni: 0, fayl_nomi: null, updated_at: '2026-10-01T00:00:00Z',
  };
}

function uni(id: string, name_en: string, name_ko: string): CatalogEntry {
  const g = guideline(id);
  return {
    institution: {
      id, name_ko, name_en, name_ko_short: null, city_ko: null, region_code: null, primary_domain: `${id}.ac.kr`,
      institution_type: 'private', tier: null, is_partner: false, logo_url: null, primary_admissions_url_ko: null,
    },
    guidelines: [g],
    latest: g,
  };
}

const mocks = vi.hoisted(() => ({
  entries: [] as unknown[],
  role: { isDocumentHandler: true, isCallOperator: false },
}));

vi.mock('@/hooks/useUniversityCatalog', () => ({
  useUniversityCatalog: () => ({ entries: mocks.entries, loading: false, error: null, refetch: async () => {} }),
  useGuidelineImport: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddInstitution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGuidelineDetail: () => ({ data: null, isLoading: false, error: null, refetch: () => {} }),
  useCatalogExtras: () => ({ extras: { faculties: new Map() }, loading: false, error: null }),
}));
vi.mock('@/lib/universityGuidelineExcel', () => ({ parseGuidelineWorkbook: async () => null }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => mocks.role }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function shownUniversities(): string[] {
  return screen
    .getAllByRole('button')
    .filter((el) => el.className.includes('cursor-pointer'))
    .map((el) => el.querySelector('p')?.textContent ?? '');
}

beforeEach(() => {
  mocks.entries = [
    uni('hongik', 'Hongik University', '홍익대학교'),
    uni('gachon', 'Gachon University', '가천대학교'),
    uni('korea', 'Korea University', ' 고려대학교 '),
  ];
  mocks.role = { isDocumentHandler: true, isCallOperator: false };
});

describe('1% universitetlar', () => {
  it('ro‘yxat — rasmlardagi 33 ta universitet', () => {
    expect(ONE_PERCENT_UNIVERSITIES.size).toBe(33);
    expect(isOnePercent({ name_ko: '울산과학기술원' })).toBe(true);
    expect(isOnePercent({ name_ko: '가천대학교' })).toBe(false);
    expect(isOnePercent({ name_ko: null })).toBe(false);
  });

  it('tugma bosilsa faqat 1% universitetlar qoladi, yana bosilsa hammasi', () => {
    render(<UniversityCatalogContent />);
    expect(shownUniversities()).toHaveLength(3);
    const toggle = screen.getByRole('button', { name: '1% universitetlar' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(shownUniversities()).toEqual(['Hongik University', 'Korea University']);
    fireEvent.click(toggle);
    expect(shownUniversities()).toHaveLength(3);
  });

  it('operatorda ham bor (boshqa filtr tugmalari yo‘q bo‘lsa ham)', () => {
    mocks.role = { isDocumentHandler: false, isCallOperator: true };
    render(<UniversityCatalogContent />);
    expect(screen.queryByRole('button', { name: "Ma'lumotli" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1% universitetlar' }));
    expect(shownUniversities()).toEqual(['Hongik University', 'Korea University']);
  });
});

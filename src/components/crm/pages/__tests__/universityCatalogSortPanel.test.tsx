import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import UniversityCatalogContent from '../UniversityCatalogContent';

/**
 * Saralash paneli (egasi, 2026-10-19): call operator va admin ko'radi,
 * hujjatchi ko'rmaydi. Yo'nalish qidirilsa — mos fakultetlar kartada chiqadi.
 */

function guideline(over: Partial<GuidelineSummary>): GuidelineSummary {
  return {
    id: 'g',
    guideline_id: 'x',
    institution_id: 'i',
    univ_kod: 'x',
    univ_nomi_en: null,
    univ_nomi_kr: null,
    kampus: null,
    shahar: 'Seoul',
    qabul_yili: 2027,
    semestr: 'bahor',
    daraja: 'bakalavr',
    english_track: null,
    korean_track: true,
    topik_min: 3,
    ielts_min: null,
    toefl_ibt_min: null,
    narx_valyuta: 'KRW',
    kirish_tolovi: null,
    kontrakt_min: 3000000,
    kontrakt_max: 3000000,
    kontrakt_davri: 'semestr',
    fakultet_soni: 1,
    fayl_nomi: null,
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  };
}

function uni(id: string, name: string, tier: number, over: Partial<GuidelineSummary> = {}): CatalogEntry {
  const g = guideline({ id: `g-${id}`, institution_id: id, univ_nomi_en: name, ...over });
  return {
    institution: {
      id,
      name_ko: name,
      name_en: name,
      name_ko_short: null,
      city_ko: null,
      region_code: null,
      primary_domain: `${id}.ac.kr`,
      institution_type: 'private',
      tier,
      is_partner: false,
      logo_url: null,
      primary_admissions_url_ko: null,
    },
    guidelines: [g],
    latest: g,
  };
}

const mocks = vi.hoisted(() => ({
  role: { isDocumentHandler: false, isCallOperator: true },
  entries: [] as unknown[],
  faculties: new Map<string, unknown[]>(),
}));

vi.mock('@/hooks/useUniversityCatalog', () => ({
  useUniversityCatalog: () => ({ entries: mocks.entries, loading: false, error: null, refetch: async () => {} }),
  useGuidelineImport: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddInstitution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGuidelineDetail: () => ({ data: null, isLoading: false, error: null, refetch: () => {} }),
  useCatalogExtras: () => ({
    extras: { faculties: mocks.faculties },
    loading: false,
    error: null,
  }),
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
  mocks.role = { isDocumentHandler: false, isCallOperator: true };
  mocks.entries = [
    uni('a', 'Alpha University', 3, { grant_holat: 'malumot_yoq' }),
    uni('b', 'Beta University', 1, { grant_holat: 'kirishda', grant_min: 50, grant_max: 50 }),
  ];
  mocks.faculties = new Map([
    ['g-a', [{ guideline_uuid: 'g-a', track: 'korean', kollej_en: null, kollej_kr: null, fakultet_en: 'Department of Nursing', fakultet_kr: null, kontrakt_summa: null }]],
    ['g-b', [{ guideline_uuid: 'g-b', track: 'korean', kollej_en: null, kollej_kr: null, fakultet_en: 'Business Administration', fakultet_kr: null, kontrakt_summa: null }]],
  ]);
});

describe('Universitetlar — saralash paneli', () => {
  it('call operatorga panel, nufuz va grant ko‘rinadi', () => {
    render(<UniversityCatalogContent />);
    expect(screen.getByLabelText("Yo'nalish qidirish")).toBeInTheDocument();
    expect(screen.getByText('Talabaning TOPIK darajasi')).toBeInTheDocument();
    expect(screen.getByText('Nufuz: 1-daraja')).toBeInTheDocument();
    expect(screen.getByText('Grant: 50% gacha')).toBeInTheDocument();
  });

  it('yo‘nalish so‘rovi universitetlarni ajratadi va mos fakultetni ko‘rsatadi', () => {
    render(<UniversityCatalogContent />);
    fireEvent.change(screen.getByLabelText("Yo'nalish qidirish"), { target: { value: 'hamshiralik' } });
    expect(shownUniversities()).toEqual(['Alpha University']);
    expect(screen.getByText(/Department of Nursing/)).toBeInTheDocument();
  });

  it('"Granti borlar" — faqat granti bor universitet qoladi', () => {
    render(<UniversityCatalogContent />);
    fireEvent.click(screen.getByRole('button', { name: /Granti borlar/ }));
    expect(shownUniversities()).toEqual(['Beta University']);
  });

  it('hujjatchi (call operator emas) panelni ko‘rmaydi, grant esa kartada qoladi', () => {
    mocks.role = { isDocumentHandler: true, isCallOperator: false };
    render(<UniversityCatalogContent />);
    expect(screen.queryByLabelText("Yo'nalish qidirish")).not.toBeInTheDocument();
    expect(screen.queryByText('Nufuz: 1-daraja')).not.toBeInTheDocument();
    expect(screen.getByText('Grant: 50% gacha')).toBeInTheDocument();
  });
});

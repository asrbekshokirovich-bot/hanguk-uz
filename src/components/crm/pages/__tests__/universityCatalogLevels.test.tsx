import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import UniversityCatalogContent from '../UniversityCatalogContent';

/**
 * Daraja filtri (egasi, 2026-10-05): "Magistr" bosilsa — faqat magistratura
 * o'qitadigan universitetlar, "Kasbiy ta'lim" — kollejlar. Kasbiy ta'lim
 * Excel'i ham alohida tugma bilan yuklanadi.
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
    shahar: null,
    qabul_yili: 2027,
    semestr: 'bahor',
    daraja: 'bakalavr',
    english_track: null,
    korean_track: null,
    topik_min: null,
    ielts_min: null,
    toefl_ibt_min: null,
    narx_valyuta: 'KRW',
    kirish_tolovi: null,
    kontrakt_min: null,
    kontrakt_max: null,
    kontrakt_davri: null,
    fakultet_soni: 0,
    fayl_nomi: null,
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  };
}

function uni(
  id: string,
  name_en: string,
  institution_type: string,
  guidelines: GuidelineSummary[] = [],
  name_ko = `${name_en} 대학교`,
  primary_domain = `${id}.ac.kr`,
): CatalogEntry {
  return {
    institution: {
      id,
      name_ko,
      name_en,
      name_ko_short: null,
      city_ko: null,
      region_code: null,
      primary_domain,
      institution_type,
      tier: null,
      is_partner: false,
      logo_url: null,
      primary_admissions_url_ko: null,
    },
    guidelines,
    latest: guidelines[0] ?? null,
  };
}

const entries: CatalogEntry[] = [
  // Ikkala darajaning ham Excel'i yuklangan
  uni('yonsei', 'Yonsei University', 'private', [
    guideline({ id: 'y1', institution_id: 'yonsei', daraja: 'bakalavr' }),
    guideline({ id: 'y2', institution_id: 'yonsei', daraja: 'magistratura' }),
  ]),
  // Faqat bakalavr Excel'i
  uni('gachon', 'Gachon University', 'private', [
    guideline({ id: 'ga1', institution_id: 'gachon', daraja: 'bakalavr' }),
  ]),
  // Faqat magistratura o'qitadi
  uni('kcgu', 'Korea Counseling Graduate University', 'specialized', [], '한국상담대학원대학교'),
  // Kollejlar
  uni('dhc', 'Daegu Health College', 'junior_college', [
    guideline({ id: 'd1', institution_id: 'dhc', daraja: 'kasbiy' }),
  ]),
  uni('yjc', 'Yeungjin University', 'junior_college'),
];

// vi.mock fabrikalari fayl tepasiga ko'chiriladi — o'zgaruvchilar vi.hoisted ichida.
const mocks = vi.hoisted(() => ({
  entries: [] as unknown[],
  parsed: null as unknown,
  mutateAsync: vi.fn(),
}));

vi.mock('@/hooks/useUniversityCatalog', () => ({
  useUniversityCatalog: () => ({
    entries: mocks.entries,
    loading: false,
    error: null,
    refetch: async () => {},
  }),
  useGuidelineImport: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  useAddInstitution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGuidelineDetail: () => ({ data: null, isLoading: false, error: null, refetch: () => {} }),
}));

vi.mock('@/lib/universityGuidelineExcel', () => ({
  parseGuidelineWorkbook: async () => mocks.parsed,
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isDocumentHandler: true, isCallOperator: false }),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function levelButton(name: RegExp) {
  return within(screen.getByRole('group', { name: 'Daraja' })).getByRole('button', { name });
}

function shownUniversities(): string[] {
  return screen
    .getAllByRole('button')
    .filter((el) => el.className.includes('cursor-pointer'))
    .map((el) => el.querySelector('p')?.textContent ?? '');
}

beforeEach(() => {
  mocks.entries = entries;
  mocks.parsed = null;
  mocks.mutateAsync.mockReset();
});

describe('Universitetlar — daraja filtri', () => {
  it('har bir daraja yonida nechta universitet borligi ko‘rinadi', () => {
    render(<UniversityCatalogContent />);
    expect(levelButton(/^Barcha darajalar/)).toHaveTextContent('Barcha darajalar5');
    expect(levelButton(/^Bakalavr/)).toHaveTextContent('Bakalavr2');
    expect(levelButton(/^Magistr/)).toHaveTextContent('Magistr3');
    expect(levelButton(/^Kasbiy/)).toHaveTextContent("Kasbiy ta'lim2");
  });

  it('"Magistr" bosilsa faqat magistratura o‘qitadigan universitetlar qoladi', () => {
    render(<UniversityCatalogContent />);
    fireEvent.click(levelButton(/^Magistr/));

    expect(levelButton(/^Magistr/)).toHaveAttribute('aria-pressed', 'true');
    expect(shownUniversities()).toEqual([
      'Yonsei University',
      'Gachon University',
      'Korea Counseling Graduate University',
    ]);
  });

  it('"Magistr" + "Ma‘lumotli" — faqat magistratura Excel‘i yuklanganlar', () => {
    render(<UniversityCatalogContent />);
    fireEvent.click(levelButton(/^Magistr/));
    fireEvent.click(screen.getByRole('button', { name: "Ma'lumotli" }));

    expect(shownUniversities()).toEqual(['Yonsei University']);
  });

  it('"Kasbiy ta‘lim" bosilsa faqat kollejlar qoladi', () => {
    render(<UniversityCatalogContent />);
    fireEvent.click(levelButton(/^Kasbiy/));

    expect(shownUniversities()).toEqual(['Daegu Health College', 'Yeungjin University']);
  });

  it('kasbiy ta‘lim Excel‘i uchun alohida yuklash tugmasi bor', () => {
    render(<UniversityCatalogContent />);
    expect(screen.getByRole('button', { name: 'Excel bakalavr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excel magistr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excel kasbiy' })).toBeInTheDocument();
  });
});

describe('Universitetlar — umumiy tugmadan Excel yuklash', () => {
  /** Faylni "Excel kasbiy" tugmasi orqali tanlagandek qiladi. */
  async function uploadVia(button: string, payload: { guideline_id: string; univ_kod: string; daraja: string }) {
    mocks.parsed = {
      ok: true,
      payload: { fayl_nomi: 'f.xlsx', universitet: payload, muddatlar: [], fakultetlar: [], hujjatlar: [] },
      errors: [],
      warnings: [],
    };
    const { container } = render(<UniversityCatalogContent />);
    fireEvent.click(screen.getByRole('button', { name: button }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'f.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
  }

  it('univ_kod ikki kollejga mos kelsa — yuklamaydi, kartadan yuklashni so‘raydi', async () => {
    mocks.entries = [
      ...entries,
      uni('dhc2', 'Donga College of Health', 'junior_college', [], '동아보건대학교', 'dhc.ac.kr'),
    ];
    await uploadVia('Excel kasbiy', { guideline_id: 'dhc_2027_bahor_kasbiy_v2', univ_kod: 'dhc', daraja: 'kasbiy' });

    expect(await screen.findByText(/bir nechta universitetga mos keladi/)).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('univ_kod bitta kollejga mos kelsa — o‘sha kollejga yuklaydi', async () => {
    mocks.mutateAsync.mockResolvedValue({ muddatlar: 1, fakultetlar: 2, hujjatlar: 3 });
    await uploadVia('Excel kasbiy', { guideline_id: 'yjc_2027_bahor_kasbiy', univ_kod: 'yjc', daraja: 'kasbiy' });

    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ institutionId: 'yjc' }));
  });

  it('"Excel kasbiy" tugmasidan bakalavr fayli yuklanmaydi', async () => {
    await uploadVia('Excel kasbiy', { guideline_id: 'yjc_2027_bahor_bakalavr', univ_kod: 'yjc', daraja: 'bakalavr' });

    expect(await screen.findByText(/"Excel kasbiy" tugmasi bosildi/)).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
});

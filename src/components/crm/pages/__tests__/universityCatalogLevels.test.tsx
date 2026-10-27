import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import UniversityCatalogContent from '../UniversityCatalogContent';

/**
 * Daraja filtri (egasi, 2026-10-05): "Magistr" bosilsa — faqat magistratura
 * o'qitadigan universitetlar, "Kasbiy ta'lim" — kollejlar. Kasbiy ta'lim
 * Excel'i ham alohida tugma bilan yuklanadi. Til kursi (egasi, 2026-10-20) —
 * xuddi shunday, filtrda esa ko'ruvchiga til kursi Excel'i yuklanganlar,
 * Excel yuklay oladigan xodimga — hammasi (egasi, 2026-10-27: aks holda
 * birinchi til kursi faylini yuklash joyi topilmasdi).
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
): CatalogEntry {
  return {
    institution: {
      id,
      name_ko,
      name_en,
      name_ko_short: null,
      city_ko: null,
      region_code: null,
      primary_domain: `${id}.ac.kr`,
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
  // Bakalavr va til kursi Excel'i (til kursining yozgi termi — eng yangisi)
  uni('gachon', 'Gachon University', 'private', [
    guideline({ id: 'ga2', institution_id: 'gachon', daraja: 'til_kursi', semestr: 'yoz' }),
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
  role: { isDocumentHandler: true, isCallOperator: false },
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
  useCatalogExtras: () => ({ extras: { faculties: new Map() }, loading: false, error: null }),
}));

vi.mock('@/lib/universityGuidelineExcel', () => ({
  parseGuidelineWorkbook: async () => mocks.parsed,
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => mocks.role,
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
  mocks.role = { isDocumentHandler: true, isCallOperator: false };
});

describe('Universitetlar — daraja filtri', () => {
  it('har bir daraja yonida nechta universitet borligi ko‘rinadi', () => {
    render(<UniversityCatalogContent />);
    expect(levelButton(/^Barcha darajalar/)).toHaveTextContent('Barcha darajalar5');
    expect(levelButton(/^Bakalavr/)).toHaveTextContent('Bakalavr2');
    expect(levelButton(/^Magistr/)).toHaveTextContent('Magistr3');
    expect(levelButton(/^Kasbiy/)).toHaveTextContent("Kasbiy ta'lim2");
    // Excel yuklay oladigan xodimga til kursida hammasi — birinchi faylni shu yerdan topadi
    expect(levelButton(/^Til kursi/)).toHaveTextContent('Til kursi5');
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

  it('"Til kursi" bosilsa ko‘ruvchiga faqat til kursi Excel‘i yuklanganlar qoladi', () => {
    mocks.role = { isDocumentHandler: false, isCallOperator: false };
    render(<UniversityCatalogContent />);
    expect(levelButton(/^Til kursi/)).toHaveTextContent('Til kursi1');
    fireEvent.click(levelButton(/^Til kursi/));

    expect(shownUniversities()).toEqual(['Gachon University']);
    expect(screen.queryByText(/Til kursi Excel'ini yuklash uchun/)).not.toBeInTheDocument();
  });

  it('Excel yuklay oladigan xodim "Til kursi"da barcha universitetni ko‘radi va panelda o‘sha yorliqda yuklaydi', () => {
    render(<UniversityCatalogContent />);
    fireEvent.click(levelButton(/^Til kursi/));

    expect(shownUniversities()).toHaveLength(5);
    expect(screen.getByText(/Til kursi Excel'ini yuklash uchun universitetni oching/)).toBeInTheDocument();

    // Til kursi Excel'i hali yo'q universitet — panel til kursi yorlig'ida, yuklash tugmasi bilan
    fireEvent.click(screen.getByText('Yonsei University'));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('button', { name: 'Til kursi' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sheet).getAllByRole('button', { name: 'Excel til kursi yuklash' }).length).toBeGreaterThan(0);
  });

  it('sarlavhada Shablon va umumiy Excel tugmalari yo‘q — Excel universitet panelidan yuklanadi', () => {
    render(<UniversityCatalogContent />);
    expect(screen.queryByRole('link', { name: /Shablon/ })).not.toBeInTheDocument();
    for (const name of ['Excel bakalavr', 'Excel magistr', 'Excel kasbiy']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('Universitetlar — universitet panelidan Excel yuklash', () => {
  const KASBIY = { tab: "Kasbiy ta'lim", button: "Excel kasbiy ta'lim yuklash" };
  const TIL_KURSI = { tab: 'Til kursi', button: 'Excel til kursi yuklash' };

  /** Universitet kartasini ochib, panelda daraja yorlig'ini tanlaydi va "Excel ... yuklash" orqali fayl tanlaydi. */
  async function uploadFromPanel(
    university: string,
    payload: { guideline_id: string; univ_kod: string; daraja: string },
    level = KASBIY,
  ) {
    mocks.parsed = {
      ok: true,
      payload: { fayl_nomi: 'f.xlsx', universitet: payload, muddatlar: [], fakultetlar: [], hujjatlar: [] },
      errors: [],
      warnings: [],
    };
    const { container } = render(<UniversityCatalogContent />);
    fireEvent.click(screen.getByText(university));
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('button', { name: level.tab }));
    fireEvent.click(within(sheet).getAllByRole('button', { name: level.button })[0]);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'f.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
  }

  it('kasbiy ta‘lim fayli ochilgan kollejga yuklanadi', async () => {
    mocks.mutateAsync.mockResolvedValue({ muddatlar: 1, fakultetlar: 2, hujjatlar: 3 });
    await uploadFromPanel('Yeungjin University', {
      guideline_id: 'yjc_2027_bahor_kasbiy',
      univ_kod: 'yjc',
      daraja: 'kasbiy',
    });

    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ institutionId: 'yjc' }));
  });

  it('kasbiy ta‘lim yorlig‘idan bakalavr fayli yuklanmaydi', async () => {
    await uploadFromPanel('Yeungjin University', {
      guideline_id: 'yjc_2027_bahor_bakalavr',
      univ_kod: 'yjc',
      daraja: 'bakalavr',
    });

    expect(await screen.findByText(/"Excel kasbiy ta'lim yuklash" tugmasi bosildi/)).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('til kursi Excel‘i hali yo‘q universitetga til kursi yorlig‘idan yuklanadi', async () => {
    mocks.mutateAsync.mockResolvedValue({ muddatlar: 11, fakultetlar: 2, hujjatlar: 5 });
    await uploadFromPanel(
      'Yonsei University',
      { guideline_id: 'yonsei_2027_yoz_til_kursi', univ_kod: 'yonsei', daraja: 'til_kursi' },
      TIL_KURSI,
    );

    expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ institutionId: 'yonsei' }));
    // Til kursida fakultetlar varag'idagi qatorlar — kurslar.
    expect(await screen.findByText('2 kurs')).toBeInTheDocument();
  });
});

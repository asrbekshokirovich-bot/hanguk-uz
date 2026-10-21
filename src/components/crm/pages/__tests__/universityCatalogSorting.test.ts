import { describe, expect, it } from 'vitest';
import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import {
  contractForSort,
  directionNames,
  directionTerms,
  EMPTY_EXTRAS,
  EMPTY_PANEL,
  groupFaculties,
  matchesPanel,
  matchingFaculties,
  perSemesterKrw,
  sortEntries,
  type CatalogExtras,
  type FacultyName,
} from '../university-catalog/sorting';

function guideline(over: Partial<GuidelineSummary> = {}): GuidelineSummary {
  return {
    id: 'g1',
    guideline_id: 'x_2027_bahor_bakalavr',
    institution_id: 'i1',
    univ_kod: 'x',
    univ_nomi_en: 'X University',
    univ_nomi_kr: null,
    kampus: null,
    shahar: 'Seoul',
    qabul_yili: 2027,
    semestr: 'bahor',
    daraja: 'bakalavr',
    english_track: false,
    korean_track: true,
    topik_min: 3,
    ielts_min: null,
    toefl_ibt_min: null,
    narx_valyuta: 'KRW',
    kirish_tolovi: null,
    kontrakt_min: 3000000,
    kontrakt_max: 4000000,
    kontrakt_davri: 'semestr',
    fakultet_soni: 2,
    fayl_nomi: null,
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  };
}

function entry(id: string, name: string, g: Partial<GuidelineSummary> | null, tier: number | null = null): CatalogEntry {
  const guidelines = g ? [guideline({ id: `g-${id}`, institution_id: id, univ_nomi_en: name, ...g })] : [];
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
    guidelines,
    latest: guidelines[0] ?? null,
  };
}

function faculty(guideline_uuid: string, name: string, kontrakt_summa: number | null = null): FacultyName {
  return { guideline_uuid, track: 'korean', kollej_en: null, kollej_kr: null, fakultet_en: name, fakultet_kr: null, kontrakt_summa };
}

describe('directionTerms', () => {
  it('o‘zbekcha yo‘nalishni inglizcha va koreyscha so‘zlarga yoyadi', () => {
    expect(directionTerms('hamshiralik')).toEqual(expect.arrayContaining(['nursing', '간호']));
    expect(directionTerms('IT')).toEqual(expect.arrayContaining(['computer', 'software']));
  });
  it('qisqa kalit faqat aynan o‘zi yozilganda ishlaydi', () => {
    expect(directionTerms('italyan')).toEqual(['italyan']);
  });
  it('bo‘sh so‘rov — hech narsa', () => {
    expect(directionTerms('  ')).toEqual([]);
  });
});

describe('matchingFaculties', () => {
  const e = entry('a', 'A Univ', {});
  const extras: CatalogExtras = {
    faculties: groupFaculties([
      faculty('g-a', 'Department of Nursing'),
      faculty('g-a', 'Computer Science'),
      faculty('g-a', 'Chair Design'),
    ]),
  };
  it('o‘zbekcha so‘rov bilan inglizcha fakultetni topadi', () => {
    expect(matchingFaculties(e, 'hamshira', 'hammasi', extras).map((f) => f.fakultet_en)).toEqual(['Department of Nursing']);
  });
  it('"IT" — "Chair" so‘zidagi "ai"ga tushmaydi', () => {
    expect(matchingFaculties(e, 'IT', 'hammasi', extras).map((f) => f.fakultet_en)).toEqual(['Computer Science']);
  });
  it('kartadagi nomlar takrorlanmaydi va qolgani sanaladi', () => {
    const list = [faculty('g', 'A'), faculty('g', 'A'), faculty('g', 'B'), faculty('g', 'C'), faculty('g', 'D')];
    expect(directionNames(list)).toEqual({ names: ['A', 'B', 'C'], more: 1 });
  });
});

describe('matchesPanel', () => {
  const topik3 = entry('a', 'A', { topik_min: 3, korean_track: true });
  const ielts6 = entry('b', 'B', { topik_min: null, korean_track: false, english_track: true, ielts_min: 6 });
  const noTopikMin = entry('c', 'C', { topik_min: null, korean_track: true });

  it('TOPIK darajasi — shu darajagacha talab qiladiganlar', () => {
    const f = { ...EMPTY_PANEL, topik: 2 };
    expect(matchesPanel(topik3, f, 'hammasi', EMPTY_EXTRAS)).toBe(false);
    expect(matchesPanel(topik3, { ...f, topik: 3 }, 'hammasi', EMPTY_EXTRAS)).toBe(true);
    // Talab ko'rsatilmagan koreyscha track ham mos.
    expect(matchesPanel(noTopikMin, f, 'hammasi', EMPTY_EXTRAS)).toBe(true);
    expect(matchesPanel(ielts6, f, 'hammasi', EMPTY_EXTRAS)).toBe(false);
  });

  it('TOPIK va IELTS ikkalasi tanlansa — bittasi mos kelsa yetadi', () => {
    const f = { ...EMPTY_PANEL, topik: 3, ielts: 5.5 };
    expect(matchesPanel(topik3, f, 'hammasi', EMPTY_EXTRAS)).toBe(true);
    expect(matchesPanel(ielts6, f, 'hammasi', EMPTY_EXTRAS)).toBe(false);
    expect(matchesPanel(ielts6, { ...f, ielts: 6 }, 'hammasi', EMPTY_EXTRAS)).toBe(true);
  });

  it('granti borlar va yo‘nalish', () => {
    const extras: CatalogExtras = {
      faculties: groupFaculties([faculty('g-a', 'Business Administration')]),
    };
    const withGrant = entry('a', 'A', { topik_min: 3, korean_track: true, grant_holat: 'kirishda', grant_min: 30, grant_max: 50 });
    const noInfo = entry('d', 'D', { grant_holat: 'malumot_yoq' });
    expect(matchesPanel(withGrant, { ...EMPTY_PANEL, grantOnly: true }, 'hammasi', extras)).toBe(true);
    // Grant o'rganilmagan yoki guideline'da ma'lumot yo'q — chiqmaydi
    expect(matchesPanel(ielts6, { ...EMPTY_PANEL, grantOnly: true }, 'hammasi', extras)).toBe(false);
    expect(matchesPanel(noInfo, { ...EMPTY_PANEL, grantOnly: true }, 'hammasi', extras)).toBe(false);
    // Grant bakalavr guideline'ida — magistraturada "granti borlar"ga tushmaydi
    expect(matchesPanel(withGrant, { ...EMPTY_PANEL, grantOnly: true }, 'magistratura', extras)).toBe(false);
    expect(matchesPanel(topik3, { ...EMPTY_PANEL, direction: 'biznes' }, 'hammasi', extras)).toBe(true);
    expect(matchesPanel(topik3, { ...EMPTY_PANEL, direction: 'hamshira' }, 'hammasi', extras)).toBe(false);
  });

  it('bo‘sh panel hech kimni chiqarib tashlamaydi', () => {
    expect(matchesPanel(entry('z', 'Z', null), EMPTY_PANEL, 'hammasi', EMPTY_EXTRAS)).toBe(true);
  });
});

describe('perSemesterKrw / contractForSort', () => {
  it('USD va yillik narxni semestr KRW ga keltiradi', () => {
    expect(perSemesterKrw(2000, guideline({ narx_valyuta: 'USD' }))).toBe(2800000);
    expect(perSemesterKrw(8000000, guideline({ kontrakt_davri: 'yil' }))).toBe(4000000);
    expect(perSemesterKrw(0, guideline())).toBeNull();
  });
  it('yo‘nalish qidirilgan bo‘lsa — mos fakultet narxi', () => {
    const e = entry('a', 'A', { kontrakt_min: 3000000, kontrakt_max: 5000000 });
    expect(contractForSort(e, 'min', 'hammasi', [faculty('g-a', 'IT', 4500000)])).toBe(4500000);
    expect(contractForSort(e, 'min', 'hammasi', [])).toBe(3000000);
    expect(contractForSort(e, 'max', 'hammasi', [])).toBe(5000000);
  });
});

describe('sortEntries', () => {
  const cheap = entry('a', 'Alpha', { kontrakt_min: 2000000, kontrakt_max: 2500000, topik_min: 4 }, 3);
  const pricey = entry('b', 'Beta', { kontrakt_min: 5000000, kontrakt_max: 7000000, topik_min: 2 }, 1);
  const nodata = entry('c', 'Gamma', null, null);
  const all = [nodata, pricey, cheap];

  const names = (list: CatalogEntry[]) => list.map((e) => e.institution.name_en);

  it('kontrakt: arzonidan va qimmatidan; narxsizlar oxirida', () => {
    expect(names(sortEntries(all, 'arzon', 'hammasi', EMPTY_EXTRAS))).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(names(sortEntries(all, 'qimmat', 'hammasi', EMPTY_EXTRAS))).toEqual(['Beta', 'Alpha', 'Gamma']);
  });
  it('nufuz: 1-daraja birinchi', () => {
    expect(names(sortEntries(all, 'nufuz', 'hammasi', EMPTY_EXTRAS))).toEqual(['Beta', 'Alpha', 'Gamma']);
  });
  it('TOPIK talabi pastidan', () => {
    expect(names(sortEntries(all, 'topik', 'hammasi', EMPTY_EXTRAS))).toEqual(['Beta', 'Alpha', 'Gamma']);
  });
  it('grant: kirishdagi foiz kattasi birinchi, keyin boshqa grantlar, grantsizlar oxirida', () => {
    const full = entry('a', 'Alpha', { grant_holat: 'kirishda', grant_min: 30, grant_max: 100 });
    const half = entry('b', 'Beta', { grant_holat: 'kirishda', grant_min: 20, grant_max: 50 });
    const later = entry('c', 'Gamma', { grant_holat: 'oqish_davomida' });
    const other = entry('d', 'Delta', { grant_holat: 'tilga_bogliq_emas' });
    const none = entry('e', 'Epsilon', { grant_holat: 'malumot_yoq' });
    expect(names(sortEntries([none, other, later, half, full], 'grant', 'hammasi', EMPTY_EXTRAS))).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Epsilon',
    ]);
  });
  it('nomi bo‘yicha', () => {
    expect(names(sortEntries(all, 'nom', 'hammasi', EMPTY_EXTRAS))).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

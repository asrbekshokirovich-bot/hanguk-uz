import { describe, expect, it } from 'vitest';
import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import {
  admissionLabel,
  cityLabel,
  contractRange,
  displayName,
  formatMoney,
  institutionCode,
  languageBadges,
  matchesFilter,
  matchesSearch,
} from '../university-catalog/format';

function guideline(over: Partial<GuidelineSummary> = {}): GuidelineSummary {
  return {
    id: 'g1',
    guideline_id: 'jbnu_2027_bahor_bakalavr',
    institution_id: 'i1',
    univ_kod: 'jbnu',
    univ_nomi_en: 'Jeonbuk National University',
    univ_nomi_kr: '전북대학교',
    kampus: null,
    shahar: 'Jeonju',
    qabul_yili: 2027,
    semestr: 'bahor',
    daraja: 'bakalavr',
    english_track: true,
    korean_track: true,
    topik_min: 2,
    ielts_min: 5.5,
    toefl_ibt_min: 71,
    narx_valyuta: 'KRW',
    kirish_tolovi: null,
    kontrakt_min: 2016000,
    kontrakt_max: 2779000,
    kontrakt_davri: 'semestr',
    fakultet_soni: 64,
    fayl_nomi: 'jbnu.xlsx',
    updated_at: '2026-09-21T00:00:00Z',
    ...over,
  };
}

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  const guidelines = over.guidelines ?? [guideline()];
  return {
    institution: {
      id: 'i1',
      name_ko: '전북대학교',
      name_en: 'Jeonbuk National University',
      name_ko_short: '전북대',
      city_ko: '전주',
      region_code: '전북',
      primary_domain: 'jbnu.ac.kr',
      institution_type: 'national',
      tier: 2,
      is_partner: false,
      logo_url: null,
      primary_admissions_url_ko: null,
      ...over.institution,
    },
    guidelines,
    latest: over.latest !== undefined ? over.latest : (guidelines[0] ?? null),
  };
}

describe('formatMoney', () => {
  it('KRW ni ₩ bilan va minglik ajratgich bilan yozadi', () => {
    expect(formatMoney(2016000, 'KRW')).toBe('₩2,016,000');
  });

  it('USD ni $ bilan yozadi', () => {
    expect(formatMoney(20000, 'USD')).toBe('$20,000');
  });

  it("noma'lum valyutada belgi o'rniga kodni qo'yadi", () => {
    expect(formatMoney(1000, 'EUR')).toBe('1,000 EUR');
  });

  it("qiymat yo'q bo'lsa chiziqcha", () => {
    expect(formatMoney(null, 'KRW')).toBe('—');
    expect(formatMoney(undefined, null)).toBe('—');
  });
});

describe('contractRange', () => {
  it('eng arzon va eng qimmat fakultet oralig‘ini beradi', () => {
    expect(contractRange(guideline())).toBe('₩2,016,000–2,779,000');
  });

  it('narx bitta bo‘lsa oraliq ko‘rsatmaydi', () => {
    expect(contractRange(guideline({ kontrakt_max: 2016000 }))).toBe('₩2,016,000');
  });

  it('narx yo‘q bo‘lsa null', () => {
    expect(contractRange(guideline({ kontrakt_min: null, kontrakt_max: null }))).toBeNull();
    expect(contractRange(null)).toBeNull();
  });
});

describe('languageBadges', () => {
  it('TOPIK va IELTS ballarini ko‘rsatadi', () => {
    expect(languageBadges(guideline()).map((b) => b.label)).toEqual([
      'TOPIK 2',
      'IELTS 5.5',
      'TOEFL 71',
    ]);
  });

  it('track bor-u, ball yo‘q bo‘lsa faqat nomini ko‘rsatadi', () => {
    const badges = languageBadges(
      guideline({ topik_min: null, ielts_min: null, toefl_ibt_min: null }),
    );
    expect(badges.map((b) => b.label)).toEqual(['TOPIK', 'IELTS']);
  });

  it('track ham, ball ham yo‘q bo‘lsa bo‘sh', () => {
    expect(
      languageBadges(
        guideline({
          korean_track: false,
          english_track: false,
          topik_min: null,
          ielts_min: null,
          toefl_ibt_min: null,
        }),
      ),
    ).toEqual([]);
  });
});

describe('cityLabel va displayName', () => {
  it('guideline‘dagi inglizcha shahar ustun turadi', () => {
    expect(cityLabel(entry())).toBe('Jeonju');
  });

  it('Excel yo‘q bo‘lsa institutions‘dagi koreyscha shahar', () => {
    expect(cityLabel(entry({ guidelines: [], latest: null }))).toBe('전주');
  });

  it('nomni ikki tilda beradi', () => {
    expect(displayName(entry())).toEqual({
      primary: 'Jeonbuk National University',
      secondary: '전북대학교',
    });
  });

  it('inglizcha nom yo‘q bo‘lsa koreyschasini asosiy qiladi', () => {
    const e = entry({ guidelines: [], latest: null });
    e.institution.name_en = null;
    expect(displayName(e)).toEqual({ primary: '전북대학교', secondary: null });
  });
});

describe('admissionLabel', () => {
  it('yil, semestr va darajani birlashtiradi', () => {
    expect(admissionLabel(guideline())).toBe('2027 · bahor · bakalavr');
  });
});

describe('institutionCode', () => {
  it('domenning birinchi qismini oladi', () => {
    expect(institutionCode('jbnu.ac.kr')).toBe('jbnu');
    expect(institutionCode('KHU.ac.kr')).toBe('khu');
  });
});

describe('matchesSearch', () => {
  const e = entry();

  it('bo‘sh so‘rov hammasini o‘tkazadi', () => {
    expect(matchesSearch(e, '   ')).toBe(true);
  });

  it('inglizcha nom, koreyscha nom va shahar bo‘yicha topadi', () => {
    expect(matchesSearch(e, 'jeonbuk')).toBe(true);
    expect(matchesSearch(e, '전북')).toBe(true);
    expect(matchesSearch(e, 'Jeonju')).toBe(true);
    expect(matchesSearch(e, '전주')).toBe(true);
  });

  it('domen va univ_kod bo‘yicha ham topadi', () => {
    expect(matchesSearch(e, 'jbnu.ac.kr')).toBe(true);
    expect(matchesSearch(e, 'jbnu')).toBe(true);
  });

  it('mos kelmasa false', () => {
    expect(matchesSearch(e, 'seoul')).toBe(false);
  });
});

describe('matchesFilter', () => {
  const withData = entry();
  const withoutData = entry({ guidelines: [], latest: null });

  it('"hammasi" hech nimani kesmaydi', () => {
    expect(matchesFilter(withoutData, 'hammasi')).toBe(true);
  });

  it('"malumotli" faqat Excel yuklanganlarni qoldiradi', () => {
    expect(matchesFilter(withData, 'malumotli')).toBe(true);
    expect(matchesFilter(withoutData, 'malumotli')).toBe(false);
  });

  it('TOPIK va IELTS track bo‘yicha ajratadi', () => {
    const faqatKorean = entry({
      guidelines: [guideline({ english_track: false, ielts_min: null })],
    });
    expect(matchesFilter(faqatKorean, 'topik')).toBe(true);
    expect(matchesFilter(faqatKorean, 'ielts')).toBe(false);
  });

  it('"hamkor" institutions bayrog‘iga qaraydi', () => {
    const hamkor = entry();
    hamkor.institution.is_partner = true;
    expect(matchesFilter(hamkor, 'hamkor')).toBe(true);
    expect(matchesFilter(withData, 'hamkor')).toBe(false);
  });
});

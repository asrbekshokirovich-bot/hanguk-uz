import { describe, expect, it } from 'vitest';
import type {
  CatalogEntry,
  CatalogInstitution,
  GuidelineSummary,
} from '@/hooks/useUniversityCatalog';
import {
  admissionLabel,
  cityLabel,
  contractRange,
  displayName,
  focusGuideline,
  formatMoney,
  institutionCode,
  languageBadges,
  matchesFilter,
  matchesLevel,
  matchesOperatorFilter,
  matchesSearch,
  offeredLevels,
  operatorCities,
  resolveUploadInstitution,
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

describe('matchesOperatorFilter', () => {
  const none = { topik: false, ielts: false, city: null };
  const withData = entry();
  const withoutData = entry({ guidelines: [], latest: null });

  it('ma’lumotsiz universitet operatorga hech qachon chiqmaydi', () => {
    expect(matchesOperatorFilter(withData, none)).toBe(true);
    expect(matchesOperatorFilter(withoutData, none)).toBe(false);
  });

  it('TOPIK va IELTS birga yoqilsa ikkalasi ham bo‘lishi shart', () => {
    const g = guideline({ english_track: false, ielts_min: null });
    const faqatKorean = entry({ guidelines: [g], latest: g });
    expect(matchesOperatorFilter(faqatKorean, { ...none, topik: true })).toBe(true);
    expect(matchesOperatorFilter(faqatKorean, { ...none, ielts: true })).toBe(false);
    expect(matchesOperatorFilter(faqatKorean, { ...none, topik: true, ielts: true })).toBe(false);
  });

  it('shahar asosiy shahar bo‘yicha solishtiriladi', () => {
    expect(matchesOperatorFilter(withData, { ...none, city: 'Jeonju' })).toBe(true);
    expect(matchesOperatorFilter(withData, { ...none, city: 'Seoul' })).toBe(false);
  });
});

describe('operatorCities', () => {
  it('faqat ma’lumotli universitetlarning shaharlari, takrorsiz va tartibda', () => {
    const seoul = guideline({ id: 'g2', institution_id: 'i2', shahar: 'Seoul' });
    const list = [
      entry(),
      entry({ guidelines: [seoul], latest: seoul }),
      entry(),
      entry({ guidelines: [], latest: null }),
    ];
    expect(operatorCities(list)).toEqual(['Jeonju', 'Seoul']);
  });
});

/** Boshqa universitet: entry() ustiga institutions maydonlarini almashtiradi. */
function uni(institution: Partial<CatalogInstitution>, guidelines: GuidelineSummary[] = []): CatalogEntry {
  const e = entry({ guidelines, latest: guidelines[0] ?? null });
  Object.assign(e.institution, institution);
  return e;
}

describe('offeredLevels va matchesLevel', () => {
  it('4 yillik universitetda bakalavr ham, magistr ham bor', () => {
    expect(offeredLevels(uni({ institution_type: 'private' }))).toEqual(['bakalavr', 'magistratura']);
    expect(offeredLevels(uni({ institution_type: 'national' }))).toEqual(['bakalavr', 'magistratura']);
  });

  it('kollej (전문대학) — faqat kasbiy ta‘lim', () => {
    const kollej = uni({ institution_type: 'junior_college', name_ko: '대구보건대학교' });
    expect(offeredLevels(kollej)).toEqual(['kasbiy']);
  });

  it('대학원대학교 va boshqa faqat magistratura oliygohlari — faqat magistr', () => {
    const counseling = uni({
      institution_type: 'specialized',
      name_ko: '한국상담대학원대학교',
      name_en: 'Korea Counseling Graduate University',
    });
    const aks = uni({
      institution_type: 'national_special',
      name_ko: '한국학중앙연구원',
      name_en: 'Graduate School of Korean Studies (Academy of Korean Studies)',
    });
    expect(offeredLevels(counseling)).toEqual(['magistratura']);
    expect(offeredLevels(aks)).toEqual(['magistratura']);
  });

  it('Excel yuklangan daraja oliygoh turidan qat‘i nazar qo‘shiladi', () => {
    const kasbiy = guideline({ id: 'g9', daraja: 'kasbiy' });
    expect(offeredLevels(uni({ institution_type: 'private' }, [kasbiy]))).toEqual([
      'bakalavr',
      'magistratura',
      'kasbiy',
    ]);
  });

  it('"hammasi" hammani o‘tkazadi, aks holda daraja bo‘lishi shart', () => {
    const kollej = uni({ institution_type: 'junior_college' });
    expect(matchesLevel(kollej, 'hammasi')).toBe(true);
    expect(matchesLevel(kollej, 'kasbiy')).toBe(true);
    expect(matchesLevel(kollej, 'magistratura')).toBe(false);
    expect(matchesLevel(uni({ institution_type: 'private' }), 'kasbiy')).toBe(false);
  });
});

describe('daraja tanlanganda ma‘lumot filtrlari', () => {
  const bak = guideline({
    id: 'b',
    daraja: 'bakalavr',
    english_track: true,
    ielts_min: 5.5,
    korean_track: false,
    topik_min: null,
  });
  const mag = guideline({
    id: 'm',
    daraja: 'magistratura',
    english_track: false,
    ielts_min: null,
    korean_track: true,
    topik_min: 4,
  });
  const ikkalasi = entry({ guidelines: [bak, mag] });
  const faqatBakalavr = entry({ guidelines: [bak] });

  it('"Ma‘lumotli" faqat tanlangan darajaning Excel‘iga qaraydi', () => {
    expect(matchesFilter(faqatBakalavr, 'malumotli', 'bakalavr')).toBe(true);
    expect(matchesFilter(faqatBakalavr, 'malumotli', 'magistratura')).toBe(false);
    expect(matchesFilter(faqatBakalavr, 'malumotli')).toBe(true);
  });

  it('TOPIK va IELTS shu darajaning guideline‘ida tekshiriladi', () => {
    expect(matchesFilter(ikkalasi, 'ielts', 'bakalavr')).toBe(true);
    expect(matchesFilter(ikkalasi, 'ielts', 'magistratura')).toBe(false);
    expect(matchesFilter(ikkalasi, 'topik', 'magistratura')).toBe(true);
    expect(matchesFilter(ikkalasi, 'topik', 'bakalavr')).toBe(false);
  });

  it('operatorga faqat shu darajaning Excel‘i yuklanganlar chiqadi', () => {
    const none = { topik: false, ielts: false, city: null };
    expect(matchesOperatorFilter(faqatBakalavr, none, 'bakalavr')).toBe(true);
    expect(matchesOperatorFilter(faqatBakalavr, none, 'magistratura')).toBe(false);
    expect(matchesOperatorFilter(ikkalasi, { ...none, ielts: true }, 'magistratura')).toBe(false);
  });

  it('karta tanlangan darajaning eng yangi guideline‘ini ko‘rsatadi', () => {
    expect(focusGuideline(ikkalasi, 'magistratura')?.id).toBe('m');
    expect(focusGuideline(ikkalasi, 'hammasi')?.id).toBe('b');
    expect(focusGuideline(faqatBakalavr, 'kasbiy')).toBeNull();
  });
});

describe('resolveUploadInstitution', () => {
  function college(id: string, name_ko: string, guidelines: GuidelineSummary[] = []): CatalogEntry {
    const e = uni({ name_ko, primary_domain: 'dhc.ac.kr', institution_type: 'junior_college' }, guidelines);
    e.institution.id = id;
    return e;
  }

  const jbnu = entry();
  const list = [college('a', '대구보건대학교'), college('b', '동아보건대학교'), jbnu];

  it('univ_kod bitta universitetga mos kelsa — o‘sha (katta-kichik harf farqsiz)', () => {
    expect(
      resolveUploadInstitution(list, { guideline_id: 'jbnu_2027_kuz_bakalavr', univ_kod: 'JBNU' }),
    ).toEqual({ institutionId: 'i1', error: null });
  });

  it('bir nechta universitetga mos kelsa — nomlari bilan xato, jimgina tanlamaydi', () => {
    const result = resolveUploadInstitution(list, {
      guideline_id: 'dhc_2027_bahor_kasbiy',
      univ_kod: 'dhc',
    });
    expect(result.institutionId).toBeNull();
    expect(result.error).toContain('대구보건대학교, 동아보건대학교');
    expect(result.error).toContain('kartasini oching');
  });

  it('avval yuklangan guideline qayta yuklansa — o‘z universitetida qoladi', () => {
    const loaded = guideline({ id: 'k1', guideline_id: 'dhc_2027_bahor_kasbiy', daraja: 'kasbiy' });
    const withLoaded = [college('a', '대구보건대학교'), college('b', '동아보건대학교', [loaded])];
    expect(
      resolveUploadInstitution(withLoaded, { guideline_id: 'dhc_2027_bahor_kasbiy', univ_kod: 'dhc' }),
    ).toEqual({ institutionId: 'b', error: null });
  });

  it('katalogda bo‘lmasa (masalan, yashirilgan bo‘lsa) — xato', () => {
    const result = resolveUploadInstitution(list, { guideline_id: 'gtc_2027', univ_kod: 'gtc' });
    expect(result.institutionId).toBeNull();
    expect(result.error).toContain('topilmadi');
  });
});

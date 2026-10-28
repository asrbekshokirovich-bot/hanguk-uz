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
  facultyNoun,
  focusGuideline,
  formatMoney,
  guidelinesForLevel,
  hiddenLevels,
  institutionCode,
  languageBadges,
  matchesFilter,
  matchesLevel,
  matchesOperatorFilter,
  matchesSearch,
  offeredLevels,
  operatorCities,
  panelLevels,
  romanKey,
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

  it('Excel‘dagi magistratura qo‘shimchasi emas, universitet nomi ko‘rinadi', () => {
    const e = entry();
    e.latest = { ...e.latest!, univ_nomi_en: 'Jeonbuk National University — Graduate School', univ_nomi_kr: '전북대학교 일반대학원' };
    expect(displayName(e)).toEqual({
      primary: 'Jeonbuk National University',
      secondary: '전북대학교',
    });
  });

  it('institutions‘da nom bo‘lmasa Excel nomi zaxira bo‘ladi', () => {
    const e = entry();
    e.institution.name_en = null;
    e.institution.name_ko = null;
    e.latest = { ...e.latest!, univ_nomi_en: 'Jeonbuk National Univ.', univ_nomi_kr: null };
    expect(displayName(e)).toEqual({ primary: 'Jeonbuk National Univ.', secondary: null });
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

  it('til kursi termini o‘qiladigan qilib yozadi', () => {
    expect(admissionLabel(guideline({ semestr: 'yoz', daraja: 'til_kursi' }))).toBe('2027 · yoz · til kursi');
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

describe('romanKey — koreyscha nomlarning turlicha lotincha yozilishi', () => {
  it('bir xil o‘qiladigan yozuvlar bir xil kalitga tushadi', () => {
    expect(romanKey('Kimpo')).toBe(romanKey('Gimpo'));
    expect(romanKey('kimbo')).toBe(romanKey('Gimpo'));
    expect(romanKey('Кимпо')).toBe(romanKey('Gimpo'));
    expect(romanKey('Daekyung')).toBe(romanKey('Daekyeung'));
    expect(romanKey('Pusan')).toBe(romanKey('Busan'));
    expect(romanKey('Kyungpook')).toBe(romanKey('Gyeongbuk'));
    expect(romanKey('Seul')).toBe(romanKey('Seoul'));
    expect(romanKey('Keimyung')).toBe(romanKey('Gyemyeong'));
    expect(romanKey('Chung-Ang')).toBe(romanKey('Jungang'));
    expect(romanKey('Xanyang')).toBe(romanKey('Hanyang'));
    expect(romanKey('Katolik')).toBe(romanKey('Catholic'));
    expect(romanKey('Kyung Hee')).toBe(romanKey('Kyunghee'));
  });

  it('boshqacha nomlarni bir-biriga aralashtirmaydi', () => {
    expect(romanKey('Kimpo')).not.toBe(romanKey('Kimhae'));
    expect(romanKey('Daegu')).not.toBe(romanKey('Daejeon'));
    expect(romanKey('Seoul')).not.toBe(romanKey('Suwon'));
  });
});

describe('matchesSearch — lotincha yozuvdagi farq xalaqit bermaydi', () => {
  const kimpo = uni({
    name_ko: '김포대학교',
    name_en: 'Gimpo University',
    name_ko_short: null,
    city_ko: '김포',
    region_code: null,
    primary_domain: 'gimpo.ac.kr',
    institution_type: 'junior_college',
  });
  const daekyeung = uni({
    name_ko: '대경대학교',
    name_en: 'Daekyeung University',
    name_ko_short: null,
    city_ko: '경산',
    region_code: null,
    primary_domain: 'tk.ac.kr',
    institution_type: 'junior_college',
  });
  const pusan = uni({
    name_ko: '부산대학교',
    name_en: 'Pusan National University',
    name_ko_short: null,
    city_ko: '부산',
    region_code: null,
    primary_domain: 'pusan.ac.kr',
  });

  it('"kimpo", "kimbo" va "Кимпо" Gimpo University‘ni topadi', () => {
    expect(matchesSearch(kimpo, 'kimpo')).toBe(true);
    expect(matchesSearch(kimpo, 'kimbo')).toBe(true);
    expect(matchesSearch(kimpo, 'Кимпо')).toBe(true);
    expect(matchesSearch(kimpo, 'Kimpo University')).toBe(true);
  });

  it('"daekyung" Daekyeung University‘ni, "busan" Pusan National University‘ni topadi', () => {
    expect(matchesSearch(daekyeung, 'daekyung')).toBe(true);
    expect(matchesSearch(pusan, 'busan')).toBe(true);
  });

  it('boshqa universitetni topib yubormaydi', () => {
    expect(matchesSearch(kimpo, 'daekyung')).toBe(false);
    expect(matchesSearch(daekyeung, 'kimpo')).toBe(false);
    expect(matchesSearch(pusan, 'seoul')).toBe(false);
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

  it('hidden_levels‘dagi daraja ko‘rinmaydi (교육대학교da bakalavr yo‘q)', () => {
    const kyodae = uni({ institution_type: 'education_university', hidden_levels: ['bakalavr'] });
    expect(offeredLevels(kyodae)).toEqual(['magistratura']);
    expect(matchesLevel(kyodae, 'bakalavr')).toBe(false);
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

describe('til kursi', () => {
  const bak = guideline({ id: 'b', daraja: 'bakalavr', kontrakt_min: 4200000, kontrakt_davri: 'semestr' });
  // Til kursining eng yangi termi — bakalavr qabulidan keyin yuklangan.
  const til = guideline({
    id: 't',
    guideline_id: 'jbnu_2027_qish_til_kursi',
    semestr: 'qish',
    daraja: 'til_kursi',
    kontrakt_min: 1700000,
    kontrakt_max: 1700000,
    kontrakt_davri: 'term',
    english_track: null,
    korean_track: null,
    topik_min: null,
    ielts_min: null,
    fakultet_soni: 1,
  });
  const ikkalasi = uni({ institution_type: 'national' }, [til, bak]);
  const faqatTilKursi = uni({ institution_type: 'private' }, [til]);
  const excelsiz = uni({ institution_type: 'private' });

  it('daraja ro‘yxatida til kursi bor-yo‘qligi Excel‘dan bilinadi', () => {
    expect(offeredLevels(ikkalasi)).toEqual(['bakalavr', 'magistratura', 'til_kursi']);
    expect(offeredLevels(excelsiz)).toEqual(['bakalavr', 'magistratura']);
    expect(matchesLevel(ikkalasi, 'til_kursi')).toBe(true);
    expect(matchesLevel(excelsiz, 'til_kursi')).toBe(false);
  });

  it('kollejda ham til kursi Excel‘i yuklansa ko‘rinadi', () => {
    const kollej = uni({ institution_type: 'junior_college' }, [til]);
    expect(offeredLevels(kollej)).toEqual(['kasbiy', 'til_kursi']);
  });

  it('panelda til kursi yorlig‘i Excel yuklay oladigan xodimga doim ochiq', () => {
    expect(panelLevels(excelsiz, true)).toEqual(['bakalavr', 'magistratura', 'til_kursi']);
    expect(panelLevels(excelsiz, false)).toEqual(['bakalavr', 'magistratura']);
    expect(panelLevels(ikkalasi, false)).toEqual(['bakalavr', 'magistratura', 'til_kursi']);
    expect(panelLevels(ikkalasi, true)).toEqual(['bakalavr', 'magistratura', 'til_kursi']);
  });

  it('"Til kursi" filtri — faqat til kursi Excel‘i yuklanganlar (egasi, 2026-10-28)', () => {
    expect(matchesLevel(ikkalasi, 'til_kursi')).toBe(true);
    expect(matchesLevel(faqatTilKursi, 'til_kursi')).toBe(true);
    expect(matchesLevel(uni({ institution_type: 'junior_college' }, [til]), 'til_kursi')).toBe(true);
    // Excel'i yo'q universitet va kollej filtrga tushmaydi — yuklash panelning "Til kursi" yorlig'idan
    expect(matchesLevel(excelsiz, 'til_kursi')).toBe(false);
    expect(matchesLevel(uni({ institution_type: 'junior_college' }), 'til_kursi')).toBe(false);
    expect(panelLevels(excelsiz, true)).toContain('til_kursi');
    // Til kursi yashirilgan, lekin Excel'i yuklangan — Excel ustun
    const yashirinExcel = uni({ institution_type: 'private', hidden_levels: ['til_kursi'] }, [til]);
    expect(matchesLevel(yashirinExcel, 'til_kursi')).toBe(true);
  });

  it('til kursi yashirilgan universitetda yorliq faqat Excel yuklay oladiganga chiqadi', () => {
    const yashirin = uni({ institution_type: 'private', hidden_levels: ['til_kursi'] });
    expect(offeredLevels(yashirin)).toEqual(['bakalavr', 'magistratura']);
    expect(panelLevels(yashirin, false)).toEqual(['bakalavr', 'magistratura']);
    expect(panelLevels(yashirin, true)).toEqual(['bakalavr', 'magistratura', 'til_kursi']);
    expect(hiddenLevels(yashirin)).toEqual(['til_kursi']);
  });

  it('yashirilgan darajaga Excel yuklansa — daraja bor (서울장신대 magistraturasi)', () => {
    const sjs = uni({ institution_type: 'private', hidden_levels: ['magistratura'] });
    // Ro'yxat bo'yicha yashirilgan: katalogda va operatorga ko'rinmaydi ...
    expect(offeredLevels(sjs)).toEqual(['bakalavr']);
    expect(matchesLevel(sjs, 'magistratura')).toBe(false);
    expect(panelLevels(sjs, false)).toEqual(['bakalavr']);
    // ... lekin Excel yuklay oladigan xodim yorliqni ko'radi va Excel'ni yuklay oladi.
    expect(panelLevels(sjs, true)).toEqual(['bakalavr', 'magistratura', 'til_kursi']);
    expect(hiddenLevels(sjs)).toEqual(['magistratura']);

    const mag = guideline({ id: 'm', daraja: 'magistratura' });
    const sjsExcel = uni({ institution_type: 'private', hidden_levels: ['magistratura'] }, [mag]);
    expect(offeredLevels(sjsExcel)).toEqual(['bakalavr', 'magistratura']);
    expect(matchesLevel(sjsExcel, 'magistratura')).toBe(true);
    expect(panelLevels(sjsExcel, false)).toEqual(['bakalavr', 'magistratura']);
    expect(hiddenLevels(sjsExcel)).toEqual([]);
  });

  it('"Barcha darajalar"da karta o‘qish darajasini ko‘rsatadi, til kursi yangi bo‘lsa ham', () => {
    expect(guidelinesForLevel(ikkalasi, 'hammasi').map((g) => g.id)).toEqual(['b']);
    expect(focusGuideline(ikkalasi, 'hammasi')?.id).toBe('b');
    expect(focusGuideline(ikkalasi, 'til_kursi')?.id).toBe('t');
  });

  it('faqat til kursi Excel‘i bo‘lsa "Barcha darajalar"da o‘sha ko‘rinadi', () => {
    expect(focusGuideline(faqatTilKursi, 'hammasi')?.id).toBe('t');
    expect(matchesFilter(faqatTilKursi, 'malumotli')).toBe(true);
    expect(matchesFilter(faqatTilKursi, 'malumotli', 'bakalavr')).toBe(false);
  });

  it('til kursida fakultetlar varag‘idagi qatorlar — kurslar', () => {
    expect(facultyNoun('til_kursi')).toEqual({ one: 'kurs', many: 'kurslar' });
    expect(facultyNoun('bakalavr')).toEqual({ one: 'fakultet', many: 'fakultetlar' });
    expect(facultyNoun(null)).toEqual({ one: 'fakultet', many: 'fakultetlar' });
  });
});

import { describe, expect, it } from 'vitest';
import type { CatalogEntry, GuidelineGrant, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import {
  awardLabel,
  cardGrant,
  grantRank,
  grantStatus,
  groupGrants,
  requirementLabel,
} from '../university-catalog/grants';

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

function rule(over: Partial<GuidelineGrant> = {}): GuidelineGrant {
  return {
    id: 'r1',
    tartib: 1,
    qachon: 'kirishda',
    nomi: null,
    kimlar_uchun: 'yangi qabul',
    mezon: 'TOPIK',
    talab: 'TOPIK 5급 이상',
    topik_min: 5,
    topik_max: null,
    ielts_min: null,
    toefl_ibt_min: null,
    boshqa_test: null,
    grant_foiz: 100,
    grant_asosi: 'kontrakt (수업료)',
    grant_summa: null,
    grant_qoshimcha: null,
    muddat: null,
    davom_shart: null,
    kampus: null,
    sahifa: '12',
    iqtibos: null,
    manba: null,
    ...over,
  };
}

describe('cardGrant', () => {
  it('kirishda — foizlar oralig‘i', () => {
    expect(cardGrant(guideline({ grant_holat: 'kirishda', grant_min: 30, grant_max: 100 }))?.label).toBe(
      'Grant: 30–100%',
    );
  });
  it('bitta foiz — "gacha": qolgan darajalar kontraktning bir qismi yoki summa bo‘lishi mumkin', () => {
    expect(cardGrant(guideline({ grant_holat: 'kirishda', grant_min: 100, grant_max: 100 }))?.label).toBe(
      'Grant: 100% gacha',
    );
  });
  it('kirishda, lekin foizsiz (qat‘iy summa) — "Grant bor"', () => {
    expect(cardGrant(guideline({ grant_holat: 'kirishda', grant_min: null, grant_max: null }))?.label).toBe(
      'Grant bor',
    );
  });
  it('o‘qish davomida va tilga bog‘liq bo‘lmagan grantlar', () => {
    expect(cardGrant(guideline({ grant_holat: 'oqish_davomida' }))?.label).toBe("Grant: o'qish davomida");
    expect(cardGrant(guideline({ grant_holat: 'tilga_bogliq_emas' }))?.label).toBe('Grant bor');
    expect(cardGrant(guideline({ grant_holat: 'aniq_emas' }))?.label).toBe('Grant bor');
  });
  it('ma‘lumot yo‘q yoki o‘rganilmagan — belgi yo‘q', () => {
    expect(cardGrant(guideline({ grant_holat: 'malumot_yoq' }))).toBeNull();
    expect(cardGrant(guideline())).toBeNull();
    expect(cardGrant(null)).toBeNull();
  });
});

describe('grantStatus', () => {
  it('kirishda — oraliq bilan', () => {
    expect(grantStatus(guideline({ grant_holat: 'kirishda', grant_min: 20, grant_max: 80 }))?.label).toBe(
      'Kirishda TOPIK / IELTS granti: 20–80%',
    );
  });
  it('o‘rganilmagan guideline — null', () => {
    expect(grantStatus(guideline())).toBeNull();
  });
});

describe('requirementLabel', () => {
  it('TOPIK: "dan", oraliq, aniq daraja va "va past"', () => {
    expect(requirementLabel(rule({ topik_min: 5 })).main).toBe('TOPIK 5+');
    expect(requirementLabel(rule({ topik_min: 3, topik_max: 4 })).main).toBe('TOPIK 3–4');
    expect(requirementLabel(rule({ topik_min: 4, topik_max: 4 })).main).toBe('TOPIK 4');
    expect(requirementLabel(rule({ topik_min: null, topik_max: 2 })).main).toBe('TOPIK 2 va past');
  });
  it('sertifikatsiz daraja', () => {
    expect(requirementLabel(rule({ topik_min: null, talab: 'TOPIK 미소지자' })).main).toBe("TOPIK yo'q");
  });
  it('TOPIK yoki IELTS / TOEFL — bitta qatorda', () => {
    const r = rule({ mezon: 'TOPIK yoki IELTS', topik_min: 5, ielts_min: 6.5, toefl_ibt_min: 80 });
    expect(requirementLabel(r).main).toBe('TOPIK 5+ yoki IELTS 6.5+ yoki TOEFL iBT 80+');
    expect(requirementLabel({ ...r, mezon: 'TOPIK va IELTS' }).main).toBe('TOPIK 5+ va IELTS 6.5+ va TOEFL iBT 80+');
  });
  it('boshqa test — izoh sifatida; sonlar yo‘q bo‘lsa — o‘zi asosiy', () => {
    expect(requirementLabel(rule({ boshqa_test: 'Duolingo 110+' }))).toEqual({
      main: 'TOPIK 5+',
      note: 'Duolingo 110+',
    });
    const course = rule({ mezon: 'boshqa', topik_min: null, talab: '본교 어학연수 2학기 이수', boshqa_test: null });
    expect(requirementLabel(course).main).toBe('본교 어학연수 2학기 이수');
    expect(requirementLabel({ ...course, boshqa_test: 'Universitet til kursi, 2 semestr' }).main).toBe(
      'Universitet til kursi, 2 semestr',
    );
  });
});

describe('awardLabel', () => {
  it('foiz va nimadan', () => {
    expect(awardLabel(rule())).toEqual({ value: '100%', caveat: null, details: ['kontrakt (수업료)'] });
  });
  it('kontraktning faqat bir qismi yoki kirish to‘lovi — raqam ostida ogohlantirish', () => {
    expect(awardLabel(rule({ grant_asosi: 'faqat 수업료1 (kontraktning kichik qismi)' })).caveat).toBe(
      'kontraktning bir qismi',
    );
    expect(awardLabel(rule({ grant_asosi: "kontraktning 'Tuition fee 2' qismi" })).caveat).toBe('kontraktning bir qismi');
    expect(awardLabel(rule({ grant_asosi: "kirish to'lovi (입학금)" })).caveat).toBe("kirish to'lovidan");
    // To'liq kontrakt (수업료1 + 수업료2) va taxminiy umumiy foiz — ogohlantirishsiz
    expect(awardLabel(rule({ grant_asosi: "to'liq kontrakt (수업료1 + 수업료2)" })).caveat).toBeNull();
    expect(
      awardLabel(rule({ grant_foiz: 20, grant_asosi: "[수업료1] qismi to'liq ozod (taxminan 20%)" })),
    ).toMatchObject({ value: '~20%', caveat: null });
  });
  it('taxminiy foiz "~" bilan', () => {
    expect(awardLabel(rule({ grant_foiz: 50, grant_asosi: "등록금ning taxminan 50% (약 50%)" })).value).toBe('~50%');
    // Boshqa son taxminan deb yozilgan bo'lsa — foiz aniq
    expect(awardLabel(rule({ grant_foiz: 50, grant_asosi: 'kontrakt (taxminan 4,000,000 won)' })).value).toBe('50%');
  });
  it('qat‘iy summa', () => {
    expect(awardLabel(rule({ grant_foiz: null, grant_summa: 1000000, grant_asosi: 'belgilangan summa' }))).toEqual({
      value: '₩1,000,000',
      caveat: null,
      details: ['belgilangan summa'],
    });
  });
  it('foiz ham, summa ham yo‘q — faqat tafsilot', () => {
    expect(
      awardLabel(rule({ grant_foiz: null, grant_asosi: 'yotoqxona', grant_qoshimcha: "yotoqxona to'lovidan 30% chegirma" })),
    ).toEqual({ value: null, caveat: null, details: ["yotoqxona to'lovidan 30% chegirma", 'yotoqxona'] });
  });
});

describe('groupGrants', () => {
  it('kirishda / o‘qish davomida, ichida kimlar uchun — hujjatdagi tartibda', () => {
    const rules = [
      rule({ id: 'c', tartib: 3, kimlar_uchun: 'transfer', nomi: 'A' }),
      rule({ id: 'a', tartib: 1, kimlar_uchun: 'yangi qabul', nomi: 'A' }),
      rule({ id: 'b', tartib: 2, kimlar_uchun: 'yangi qabul', nomi: 'A' }),
      rule({ id: 'd', tartib: 4, kimlar_uchun: 'yangi qabul', nomi: 'B' }),
      rule({ id: 'e', tartib: 5, qachon: 'oqish_davomida', kimlar_uchun: "o'qiyotganlar" }),
    ];
    const { kirishda, oqishDavomida } = groupGrants(rules);
    expect(kirishda.map((g) => g.audience)).toEqual(['yangi qabul', 'transfer']);
    expect(kirishda[0].rules.map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(kirishda[0].names).toEqual(['A', 'B']);
    expect(oqishDavomida.map((g) => g.audience)).toEqual(["o'qiyotganlar"]);
  });
});

describe('grantRank', () => {
  function entry(guidelines: GuidelineSummary[]): CatalogEntry {
    return {
      institution: {
        id: 'i1',
        name_ko: 'X',
        name_en: 'X',
        name_ko_short: null,
        city_ko: null,
        region_code: null,
        primary_domain: 'x.ac.kr',
        institution_type: 'private',
        tier: null,
        is_partner: false,
        logo_url: null,
        primary_admissions_url_ko: null,
      },
      guidelines,
      latest: guidelines[0] ?? null,
    };
  }

  it('tanlangan darajadagi eng yaxshi grant', () => {
    const e = entry([
      guideline({ id: 'b', daraja: 'bakalavr', grant_holat: 'oqish_davomida' }),
      guideline({ id: 'm', daraja: 'magistratura', grant_holat: 'kirishda', grant_max: 60 }),
    ]);
    expect(grantRank(e, 'bakalavr')).toBe(500);
    expect(grantRank(e, 'magistratura')).toBe(1060);
    expect(grantRank(e, 'hammasi')).toBe(1060);
    expect(grantRank(e, 'kasbiy')).toBeNull();
  });
  it('ma‘lumot yo‘q — null', () => {
    expect(grantRank(entry([guideline({ grant_holat: 'malumot_yoq' })]), 'hammasi')).toBeNull();
    expect(grantRank(entry([guideline()]), 'hammasi')).toBeNull();
  });
});

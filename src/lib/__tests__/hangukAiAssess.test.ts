import { describe, expect, it } from 'vitest';
import {
  type AssessUniversity,
  DEFAULT_RULES,
  admissionPercent,
  assess,
  band,
  dartRound,
  documentsBonus,
  groupCatalogRows,
  guidelineFromRow,
  kdbDeposit,
  meetsEnglish,
  requiredBank,
  rulesFromRows,
  segmentsOf,
  toAssessmentInput,
  toResult,
  topikCounted,
  visaHints,
  visaScore,
  visaWithConsultant,
} from '../../../supabase/functions/hanguk-ai-chat/assess';

// Mirrors hanguk_app/test/features/assessment/assessment_test.dart and
// visa_model_test.dart: same cases, same expected numbers.

function uni(
  id: string,
  { topik, city = 'Daegu', partner }: { topik?: number; city?: string; partner?: boolean } = {},
): AssessUniversity {
  return {
    institutionId: id,
    guidelines: [
      {
        id: `g-${id}`,
        univNameEn: `${id} University`,
        city,
        degree: 'bakalavr',
        topikMin: topik ?? null,
        isPartner: partner ?? null,
        isActive: true,
      },
    ],
  };
}
const primary = (u: AssessUniversity) => u.guidelines[0];
const rules = DEFAULT_RULES;

describe('assessment_test.dart — admissionPercent', () => {
  const g = primary(uni('a', { topik: 3 }));
  const at = (topik: number, gpa = 3.5) => admissionPercent({ topik, gpa }, g);

  it('by the TOPIK difference', () => {
    expect([1, 2, 3, 4, 5, 6].map((t) => at(t))).toEqual([15, 30, 55, 68, 78, 78]);
  });

  it('the certificate moves it by 10 a point, at most 15', () => {
    expect(at(3, 4.5)).toBe(65);
    expect(at(3, 5.0)).toBe(70);
    expect(at(3, 3.0)).toBe(50);
  });

  it('a partner adds 5, and it stays within 5–95', () => {
    expect(admissionPercent({ topik: 3, gpa: 3.5 }, primary(uni('p', { topik: 3, partner: true })))).toBe(60);
    expect(admissionPercent({ topik: 0, gpa: 1.0 }, primary(uni('h', { topik: 6 })))).toBe(5);
  });

  it("no requirement in the Excel: the route's own", () => {
    expect(admissionPercent({ topik: 3, gpa: 3.5 }, primary(uni('n')))).toBe(
      admissionPercent({ topik: 3, gpa: 3.5 }, primary(uni('r', { topik: rules.bachelorTopikMin }))),
    );
  });
});

describe('assessment_test.dart — admissionPercent: the English way in', () => {
  const english = (
    o: { ielts?: number | null; track?: boolean | null; korean?: boolean | null; topik?: number | null } = {},
  ) => ({
    id: 'g-e',
    univNameEn: 'E University',
    degree: 'bakalavr',
    koreanTrack: o.korean === undefined ? true : o.korean,
    englishTrack: o.track === undefined ? true : o.track,
    topikMin: o.topik === undefined ? 3 : o.topik,
    ieltsMin: o.ielts === undefined ? 5.5 : o.ielts,
    isActive: true,
  });
  type G = ReturnType<typeof english>;
  const at = (g: G, x: { topik?: number; ielts?: number; route?: 'bachelor' | 'master' | 'college' | 'languageCourse' } = {}) =>
    admissionPercent({ topik: x.topik ?? 0, ielts: x.ielts ?? 0, gpa: 3.5, route: x.route ?? 'bachelor' }, g);

  it("IELTS at the guideline's minimum is the requirement met", () => {
    const g = english();
    expect(at(g)).toBe(15);
    expect(at(g, { ielts: 5.0 })).toBe(16);
    expect(at(g, { ielts: 5.5 })).toBe(57);
    expect(at(g, { ielts: 7.0 })).toBe(60);
    expect(meetsEnglish({ ielts: 5.5 }, g)).toBe(true);
    expect(meetsEnglish({ ielts: 5.0 }, g)).toBe(false);
  });

  it('TOPIK above the requirement still counts for more', () => {
    const g = english();
    expect(at(g, { topik: 2, ielts: 5.5 })).toBe(57);
    expect(at(g, { topik: 3, ielts: 5.5 })).toBe(57);
    expect(at(g, { topik: 4, ielts: 5.5 })).toBe(70);
    expect(at(g, { topik: 5 })).toBe(78);
  });

  it("the guideline's own minimum; the rules' when it names none", () => {
    const hard = english({ ielts: 6.5 });
    expect(at(hard, { ielts: 6.0 })).toBe(18);
    expect(at(hard, { ielts: 6.5 })).toBe(59);
    const open = english({ ielts: null });
    expect(at(open, { ielts: 5.0 })).toBe(16);
    expect(at(open, { ielts: rules.englishIeltsMin })).toBe(57);
  });

  it('an IELTS minimum counts without the track flag', () => {
    expect(at(english({ track: null, ielts: 6 }), { ielts: 6.0 })).toBe(58);
    expect(at(english({ track: null, ielts: null }), { ielts: 7.0 })).toBe(20);
  });

  it('taught in English only: TOPIK does not count', () => {
    const g = english({ korean: false, topik: null, ielts: 6.5 });
    expect(at(g, { topik: 5 })).toBe(15);
    expect(at(g, { topik: 5, ielts: 6.5 })).toBe(59);
    expect(at(g, { ielts: 7.0, route: 'master' })).toBe(60);
  });

  it('other routes read TOPIK alone, as before', () => {
    expect(at(english(), { ielts: 7.0, route: 'college' })).toBe(20);
    expect(at(english({ korean: false, topik: null }), { topik: 1, route: 'languageCourse' })).toBe(55);
  });

  it('the catalogue row carries both tracks', () => {
    const g = guidelineFromRow({
      guideline_id: 'g1', institution_id: 'u1', daraja: 'bakalavr',
      english_track: true, korean_track: false, topik_min: null, ielts_min: '6.5',
    });
    expect(g.koreanTrack).toBe(false);
    expect(g.englishTrack).toBe(true);
    expect(admissionPercent({ topik: 6, gpa: 3.5 }, g)).toBe(15);
    expect(admissionPercent({ ielts: 6.5, gpa: 3.5 }, g)).toBe(59);
  });
});

describe('assessment_test.dart — requiredBank', () => {
  it("the capital area's deposit when any university is there", () => {
    const daegu = requiredBank('bachelor', [uni('d')]);
    const seoul = requiredBank('bachelor', [uni('d'), uni('s', { city: 'Seoul' })]);
    expect(daegu).toBe(Math.round(rules.degreeKdbUsd[0] * rules.krwPerUsd));
    expect(seoul).toBe(Math.round(rules.degreeKdbUsd[1] * rules.krwPerUsd));
    expect(daegu).toBe(17_500_000);
    expect(seoul).toBe(21_700_000);
  });
});

describe('assessment_test.dart — assess', () => {
  const catalog = [uni('a', { topik: 3 }), uni('b', { topik: 4 }), uni('c', { topik: 2 })];
  const need = requiredBank('bachelor', catalog);

  it('enough bank and TOPIK alone: a fair chance, not yet a high one', () => {
    const o = assess({ topik: 4, gpa: 4.2, bankKrw: need, universityIds: ['a', 'b', 'c'] }, catalog);
    // 30 + TOPIK 4 (12) + the bank (15) + a 4.2 certificate (3).
    expect(o.band).toBe('mid');
    expect(o.visaPercent).toBe(60);
    expect(o.visaWithConsultantPercent).toBeGreaterThan(o.visaPercent);
    expect(o.chances.map((c) => c.institutionId)).toEqual(['a', 'b', 'c']);
    expect(o.openCount).toBe(3);
    expect(o.fixes.filter((f) => f.kind === 'bank')).toEqual([]);
  });

  it('short of the bank: a fix that names the amount and what it adds', () => {
    const o = assess({ topik: 4, gpa: 4.2, bankKrw: 0, universityIds: ['a'] }, catalog);
    const bank = o.fixes.find((f) => f.kind === 'bank')!;
    expect(bank.value).toBe(need);
    expect(bank.gain).toBeGreaterThan(0);
    expect(o.visaPercent + bank.gain).toBeLessThanOrEqual(95);
  });

  it('a prior refusal never raises the visa chance', () => {
    const run = (refused: boolean) =>
      assess({ topik: 3, bankKrw: need, visaRefused: refused, universityIds: ['a'] }, catalog);
    expect(run(true).visaPercent).toBeLessThanOrEqual(run(false).visaPercent);
  });

  it('the TOPIK fix is one level up, gaining admission on average', () => {
    const o = assess({ topik: 2, gpa: 4.0, universityIds: ['a', 'b'] }, catalog);
    const t = o.fixes.find((f) => f.kind === 'topik')!;
    expect(t.value).toBe(3);
    expect(t.gain).toBeGreaterThan(0);
  });

  it('the answers and the result the CRM reads', () => {
    // toAnswers is not ported; its computed fields are: korean (topik3) and kdb.
    const input = { topik: 3, gpa: 4.2, bankKrw: 1_000_000, visaRefused: true, universityIds: ['a'] };
    expect(topikCounted(input)).toBe(3);
    expect(kdbDeposit(input, need)).toBe('by_intake');
    const r = toResult(assess(input, catalog));
    expect(r.source).toBe('assessment_v1');
    expect(['high', 'mid', 'low']).toContain(r.band);
    const unis = r.universities as { id: string }[];
    expect(unis).toHaveLength(1);
    expect(unis[0].id).toBe('a');
  });
});

describe("assessment_test.dart — visaHints: the old quiz's tariff and weak point", () => {
  const catalog = [uni('a', { topik: 3 })];
  const need = requiredBank('bachelor', catalog);
  const hints = (i: Parameters<typeof visaHints>[0]) => visaHints(i, catalog, need);

  it("TOPIK 2 for a bachelor's, income documented, money in the bank: language, Premium", () => {
    const h = hints({ topik: 2, incomeDocumented: true, bankKrw: need });
    expect(h.low).toBe('language');
    expect(h.tariff).toBe('premium');
    expect(h.formalIncome).toBe(true);
  });

  it('TOPIK 1 and nothing in the bank: Hanbox', () => {
    const h = hints({ topik: 1, incomeDocumented: true });
    expect(h.low).toBe('language');
    expect(h.tariff).toBe('hanbox');
  });

  it('the language met, money short and no income papers: NO RISK, the income first', () => {
    const h = hints({ topik: 3, bankKrw: 1_000_000 });
    expect(h.low).toBe('income');
    expect(h.tariff).toBe('no_risk');
  });

  it('nothing against: no weak point', () => {
    const h = hints({ topik: 4, incomeDocumented: true, bankKrw: need });
    expect(h.low).toBeNull();
    expect(h.tariff).toBe('premium');
  });

  it('the result the CRM reads carries the tariff (leads.tariff_interest)', () => {
    const r = toResult(assess({ topik: 2, incomeDocumented: true, bankKrw: need, universityIds: ['a'] }, catalog));
    expect(r.tariff).toBe('premium');
    expect(r.low).toBe('language');
  });
});

describe('assessment_test.dart — segmentsOf', () => {
  it("follows the design's thresholds", () => {
    expect([10, 25, 44, 45, 64, 65, 81, 82].map(segmentsOf)).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  });
});

describe('visa_model_test.dart', () => {
  const v = (i: Parameters<typeof visaScore>[0]) => visaScore(i, 20_000_000);

  it('the first answers everywhere: the base 30', () => {
    expect(v({ gpa: 3.5 })).toBe(30);
  });

  it('money weighs most: income, papers, steady years, assets, parents', () => {
    const strong = {
      gpa: 3.5, income: 3, incomeDocumented: true, incomeStability: 3, property: 2, sponsor: 1, relationDoc: true,
    };
    // 12 + 5 + 5 + 5 + 4 + 3 = 34
    expect(v(strong)).toBe(64);
    // The bank on top is held to the money's ceiling (35).
    expect(v({ ...strong, bankKrw: 20_000_000 })).toBe(65);
  });

  it('a relative as sponsor counts against', () => {
    expect(v({ gpa: 3.5, sponsor: 2 })).toBe(24);
  });

  it('an overstay holds it at 5, a master without a bachelor at 10', () => {
    expect(v({ gpa: 3.5, topik: 6, koreaBefore: 2 })).toBe(5);
    expect(v({ gpa: 3.5, topik: 6, route: 'master' })).toBe(10);
    expect(v({ gpa: 3.5, topik: 6, route: 'master', education: 2 })).toBe(42);
  });

  it('D-4: age and a long gap weigh more than for a degree', () => {
    const older = { gpa: 3.5, age: 31, gapYears: 3 };
    expect(v({ ...older, route: 'languageCourse' })).toBe(10);
    expect(v(older)).toBe(16);
  });

  it('history: refusal −10, illegal relatives −15, legal +5', () => {
    expect(v({ gpa: 3.5, visaRefused: true })).toBe(20);
    expect(v({ gpa: 3.5, illegalRelatives: true })).toBe(15);
    expect(v({ gpa: 3.5, legalRelatives: true })).toBe(35);
  });

  it('with a consultant: the papers in order', () => {
    const i = { gpa: 3.5, sponsor: 1 };
    // 30 + parents 4; then + plan 5, interview 5, letter 3, recommendation 2,
    // documented 5, relation 3.
    expect(v(i)).toBe(34);
    expect(visaWithConsultant(i, 20_000_000)).toBe(57);
  });
});

describe('edge cases (TypeScript port)', () => {
  const everything = {
    income: 3, incomeDocumented: true, incomeStability: 3, property: 2, car: 2, business: 2, sponsor: 1,
    relationDoc: true, bankKrw: 20_000_000, topik: 6, gpa: 5, legalRelatives: true, koreaBefore: 1,
    studyPlan: 2, interviewPrep: 2, motivation: 2, recommendation: true,
  };

  it('visa is clamped to 95 at the top and 5 at the bottom', () => {
    expect(visaScore(everything, 20_000_000)).toBe(95);
    expect(visaScore({ gpa: 2, sponsor: 2, visaRefused: true, illegalRelatives: true, age: 35, gapYears: 3 }, 20_000_000)).toBe(5);
  });

  it('age/gap risk is held within −20…0', () => {
    // D-4: age 31 (−15) + gap 2 (−8) = −23 → −20; 30 − 20 = 10.
    expect(visaScore({ gpa: 3.5, route: 'languageCourse', age: 31, gapYears: 2 }, 20_000_000)).toBe(10);
  });

  it('an overstay is 5 however strong the rest is', () => {
    expect(visaScore({ ...everything, koreaBefore: 2 }, 20_000_000)).toBe(5);
    expect(visaWithConsultant({ ...everything, koreaBefore: 2 }, 20_000_000)).toBe(5);
  });

  it("a master's with school/college education is capped at 10, not raised to it", () => {
    expect(visaScore({ ...everything, route: 'master', education: 1 }, 20_000_000)).toBe(10);
    expect(visaScore({ ...everything, route: 'master', education: 2 }, 20_000_000)).toBe(95);
    // Already below 10 stays below it.
    expect(visaScore({ gpa: 2, route: 'master', sponsor: 2, visaRefused: true, illegalRelatives: true }, 20_000_000)).toBe(5);
  });

  it('a requirement of 0 never counts as the bank met', () => {
    expect(visaScore({ gpa: 3.5, bankKrw: 1 }, 0)).toBe(35);
  });

  it('admission is clamped to 95 and the certificate to ±15', () => {
    const g = primary(uni('x', { topik: 1, partner: true }));
    expect(admissionPercent({ ...everything, ielts: 7.5, olympiad: 3, experience: 3, portfolio: true, activity: 3 }, g)).toBe(95);
    const g3 = primary(uni('y', { topik: 3 }));
    expect(admissionPercent({ topik: 3, gpa: 6 }, g3)).toBe(70);
    expect(admissionPercent({ topik: 3, gpa: 1 }, g3)).toBe(40);
  });

  it("Dart's round: half away from zero (JS Math.round differs on −x.5)", () => {
    expect(dartRound(-2.5)).toBe(-3);
    expect(dartRound(2.5)).toBe(3);
    const g3 = primary(uni('y', { topik: 3 }));
    // (3.25 − 3.5) × 10 = −2.5 → −3 in Dart.
    expect(admissionPercent({ topik: 3, gpa: 3.25 }, g3)).toBe(52);
    // (4.25 − 3.5) × 10 = 7.5 → 8.
    expect(admissionPercent({ topik: 3, gpa: 4.25 }, g3)).toBe(63);
    // A guideline TOPIK of 2.5 rounds to 3.
    expect(admissionPercent({ topik: 3, gpa: 3.5 }, { topikMin: 2.5 })).toBe(55);
  });

  it('documentsBonus: gap, experience, contests, IELTS, letter, recommendation, portfolio, activity', () => {
    expect(documentsBonus({})).toBe(0);
    expect(documentsBonus({ gapYears: 2 })).toBe(-3);
    expect(documentsBonus({ gapYears: 5 })).toBe(-6);
    expect(documentsBonus({ experience: 9, olympiad: 9, motivation: 9, activity: 9 })).toBe(4 + 6 + 4 + 3);
    expect([4.5, 5, 5.5, 6, 6.5, 7].map((ielts) => documentsBonus({ ielts }))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(documentsBonus({ recommendation: true, portfolio: true })).toBe(4);
  });

  it('an old TOPIK certificate counts as none, so the TOPIK fix gains nothing', () => {
    const catalog = [uni('a', { topik: 3 })];
    const o = assess({ topik: 4, topikFresh: false, universityIds: ['a'] }, catalog);
    expect(o.chances[0].percent).toBe(15 + 5);
    expect(o.fixes.find((f) => f.kind === 'topik')).toBeUndefined();
  });

  it('the TOPIK fix gain is the rounded average (11.5 → 12)', () => {
    const catalog = [uni('a', { topik: 3 }), uni('c', { topik: 2 })];
    const o = assess({ topik: 3, universityIds: ['a', 'c'] }, catalog);
    expect(o.chances.map((c) => c.percent)).toEqual([60, 73]);
    expect(o.fixes.find((f) => f.kind === 'topik')).toEqual({ kind: 'topik', value: 4, gain: 12 });
  });

  it('language course: the D-4 deposit, unknown ids dropped, the primary guideline used', () => {
    const catalog = [uni('a', { topik: 3 }), uni('s', { topik: 3, city: 'Seoul' })];
    const o = assess({ route: 'd4' as never, topik: 1, universityIds: ['a', 'zzz'] }, catalog);
    expect(o.requiredBankKrw).toBe(6300 * 1400);
    expect(o.chances.map((c) => c.institutionId)).toEqual(['a']);
    expect(requiredBank('languageCourse', catalog)).toBe(7800 * 1400);
  });

  it('input is normalised as Dart ints: truncated, defaults for missing or bad values', () => {
    const i = toAssessmentInput({ experience: 1.7, age: Number.NaN, gpa: undefined, route: 'd4' });
    expect(i.experience).toBe(1);
    expect(i.age).toBe(19);
    expect(i.gpa).toBe(4.0);
    expect(i.route).toBe('languageCourse');
    expect(i.topikFresh).toBe(true);
  });

  it('band: high from 65, mid from 40', () => {
    expect([39, 40, 64, 65].map(band)).toEqual(['low', 'mid', 'mid', 'high']);
  });

  it('rulesFromRows reads eligibility_rules like EligibilityRules.fromRows', () => {
    const r = rulesFromRows([
      { key: 'krw_per_usd', value: '1500' },
      { key: 'd2_kdb_usd', value: [13000.9, 16000] },
      { key: 'd2_bachelor_topik_min', value: 2.9 },
      { key: 'money_partial_cap', value: 'bogus' },
    ]);
    expect(r.krwPerUsd).toBe(1500);
    expect(r.degreeKdbUsd).toEqual([13000, 16000]);
    expect(r.bachelorTopikMin).toBe(2);
    expect(r.moneyPartialCap).toBe('mid');
    expect(requiredBank('bachelor', [uni('d')], r)).toBe(13000 * 1500);
  });

  it('groupCatalogRows + capital area by region code', () => {
    const cat = groupCatalogRows([
      { guideline_id: 'g1', institution_id: 'i1', daraja: 'magistratura', topik_min: '4', region_code: '경기' },
      { guideline_id: 'g2', institution_id: 'i1', daraja: 'bakalavr', topik_min: 3, region_code: '경기' },
      { guideline_id: 'g3', institution_id: 'i2', daraja: 'bakalavr', shahar: 'Busan' },
    ]);
    expect(cat.map((u) => u.institutionId)).toEqual(['i1', 'i2']);
    expect(requiredBank('bachelor', cat)).toBe(21_700_000);
    const o = assess({ route: 'master', topik: 4, gpa: 3.5, universityIds: ['i1'] }, cat);
    expect(o.chances[0].guidelineId).toBe('g1');
    expect(o.chances[0].percent).toBe(55);
  });
});

describe('assess_chances tool', async () => {
  const { ASSESS_TOOL, inputFromArgs } = await import('../../../supabase/functions/hanguk-ai-chat/tools/assess.ts');
  const { assess, groupCatalogRows } = await import('../../../supabase/functions/hanguk-ai-chat/assess.ts');
  const rows = [{
    guideline_id: 'g1', institution_id: 'u1', name_en: 'Ajou University', name_ko: '아주대학교', daraja: 'bakalavr',
    topik_min: 3, is_partner: true, region_code: '경기', is_active: true, visa_restricted: false, english_track: false,
  }];
  const service = (catalog: unknown[]) => ({
    from: (t: string) => ({
      select: () => (t === 'eligibility_rules'
        ? Promise.resolve({ data: [], error: null })
        : { or: () => ({ limit: () => Promise.resolve({ data: catalog, error: null }) }) }),
    }),
  });
  const ctx = (catalog: unknown[]) => ({ user: null, service: service(catalog), caller: { audience: 'guest', userId: null, name: '', roles: [], guestKey: 'g' }, language: 'uz' }) as never;

  it('maps snake_case answers and route words to the app input', () => {
    expect(inputFromArgs({ route: 'Bakalavr', topik: 4, topik_fresh: false, bank_krw: 20000000, gap_years: 2, study_plan: 2 }, ['u1']))
      .toEqual({ universityIds: ['u1'], route: 'bachelor', topik: 4, topikFresh: false, bankKrw: 20000000, gapYears: 2, studyPlan: 2 });
    expect(inputFromArgs({ route: 'til kursi' }, []).route).toBe('languageCourse');
  });

  it('gives exactly what the app formula gives', async () => {
    const args = { universities: ['Ajou'], route: 'bachelor', topik: 4, gpa: 4.5, bank_krw: 25000000, age: 19 };
    const out = await ASSESS_TOOL.run(ctx(rows), args);
    const expected = assess(inputFromArgs(args, ['u1']), groupCatalogRows(rows));
    const d = out.data as { universities: { percent: number }[]; visa_percent: number; required_bank_krw: number };
    expect(d.universities[0].percent).toBe(expected.chances[0].percent);
    expect(d.visa_percent).toBe(expected.visaPercent);
    expect(d.required_bank_krw).toBe(expected.requiredBankKrw);
  });

  it('says so when the university is not in the catalogue', async () => {
    const out = await ASSESS_TOOL.run(ctx([]), { universities: ['Nowhere'] });
    expect(out.data).toMatchObject({ error: 'no such university in the catalogue' });
  });
});

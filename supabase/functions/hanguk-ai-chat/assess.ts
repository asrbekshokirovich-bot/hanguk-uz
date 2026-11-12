// "Koreaga keta olamanmi o'zi?" — the student app's admission and visa
// chances, for Hanguk AI.
//
// THIS IS A PORT of the Flutter app's Dart code (as of 3b675cd, 2026-10-29):
//   hanguk_app/lib/features/assessment/domain/assessment.dart
//   hanguk_app/lib/features/assessment/domain/visa_model.dart
// plus the parts of eligibility_engine.dart (EligibilityRules defaults and
// fromRows, the tariff / weak point visaHints reads) and catalog_models.dart
// (inCapitalArea, forDegree, displayName) they depend on. The AI must give a
// student the same percentages the app shows, so ANY change to those Dart
// files must be made here too, in the same PR — and the cases in
// src/lib/__tests__/hangukAiAssess.test.ts mirror the Dart tests
// (hanguk_app/test/features/assessment/{assessment,visa_model}_test.dart).
//
// Pure TypeScript: no Deno globals, no network, no clock. Dart semantics kept:
// int fields are truncated (Dart ints), `round()` rounds half away from zero
// (JS Math.round does not), and every clamp is where Dart has it.

// ---------------------------------------------------------------- types

/// quiz_answers.dart StudyRoute (enum names; the code 'd4' is accepted too).
export type StudyRoute = "languageCourse" | "bachelor" | "master" | "college";

/// eligibility_engine.dart EligibilityBand codes.
export type EligibilityBand = "high" | "mid" | "low";

/// eligibility_engine.dart Tariff codes.
export type Tariff = "standart" | "premium" | "no_risk" | "hanbox";

/// quiz_answers.dart KdbDeposit codes (the ones the board can give).
export type KdbDeposit = "ready" | "by_intake" | "no";

/// assessment.dart AssessmentInput — same fields, same defaults.
export interface AssessmentInput {
  /** TOPIK level, 0 for none. */
  topik: number;
  /** School certificate average, five-point scale. */
  gpa: number;
  /** Money in the bank for the visa, in won. */
  bankKrw: number;
  route: StudyRoute;
  visaRefused: boolean;
  /** Chosen universities (institution ids), in the order shown. */
  universityIds: string[];
  /** Years since graduating: 0, 1, 2, or 3 for three and more. */
  gapYears: number;
  /** 0 none, 1 course/club, 2 project, 3 work. */
  experience: number;
  /** 0 none, 1 school, 2 national, 3 international. */
  olympiad: number;
  /** TOPIK certificate under two years old (else it counts as none). */
  topikFresh: boolean;
  /** IELTS band, 0 for none. */
  ielts: number;
  /** Motivation letter: 0 none, 1 draft, 2 ready. */
  motivation: number;
  recommendation: boolean;
  portfolio: boolean;
  /** 0 none, 1 volunteering, 2 sport/art, 3 leading an organisation. */
  activity: number;
  /** Last education: 0 school, 1 college/lyceum, 2 bachelor, 3 master. */
  education: number;
  age: number;
  /** Parents' yearly income: 0 <$5k, 1 $5–10k, 2 $10–20k, 3 $20k+. */
  income: number;
  incomeDocumented: boolean;
  /** Who pays: 0 the student, 1 the parents, 2 another relative. */
  sponsor: number;
  /** Kinship certificate, apostilled. */
  relationDoc: boolean;
  /** Steady income: 0 <6 months, 1 6–12 months, 2 1–3 years, 3 3+ years. */
  incomeStability: number;
  /** 0 none, 1 one, 2 two and more. */
  property: number;
  car: number;
  /** 0 none, 1 sole trader (IP), 2 company (MChJ). */
  business: number;
  /** Been to Korea: 0 no, 1 yes and left on time, 2 overstayed. */
  koreaBefore: number;
  illegalRelatives: boolean;
  legalRelatives: boolean;
  /** Study plan: 0 none, 1 draft, 2 ready. */
  studyPlan: number;
  /** Interview practice: 0 none, 1 on one's own, 2 three+ times with Hanguk AI. */
  interviewPrep: number;
}

/** Any subset of the answers; the rest take the Dart defaults. */
export type AssessmentInputLike = Omit<Partial<AssessmentInput>, "route"> & { route?: StudyRoute | "d4" };

/// catalog_models.dart CatalogGuideline — only the fields the formulas read.
export interface AssessGuideline {
  id?: string;
  /** 'bakalavr' | 'magistratura'. */
  degree?: string | null;
  topikMin?: number | null;
  ieltsMin?: number | null;
  isPartner?: boolean | null;
  englishTrack?: boolean | null;
  koreanTrack?: boolean | null;
  isActive?: boolean | null;
  visaRestricted?: boolean | null;
  regionCode?: string | null;
  city?: string | null;
  cityKo?: string | null;
  nameEn?: string | null;
  univNameEn?: string | null;
  nameKo?: string | null;
  univNameKr?: string | null;
}

/// catalog_models.dart CatalogUniversity. Guidelines newest intake first.
export interface AssessUniversity {
  institutionId: string;
  guidelines: AssessGuideline[];
}

/// The EligibilityRules fields these formulas read.
export interface AssessRules {
  baseScore: number;
  bandHighMin: number;
  bandMidMin: number;
  languageOkBonus: number;
  languageUnknownBonus: number;
  languageMissingCap: EligibilityBand;
  moneyOkBonus: number;
  moneyUnknownBonus: number;
  moneyPartialCap: EligibilityBand;
  moneyMissingCap: EligibilityBand;
  courseTopikMin: number;
  collegeTopikMin: number;
  bachelorTopikMin: number;
  masterTopikMin: number;
  englishIeltsMin: number;
  /** USD, [other areas, Seoul/Gyeonggi/Incheon]. */
  courseKdbUsd: [number, number];
  degreeKdbUsd: [number, number];
  courseGapYearsMax: number;
  courseAgeSoftMax: number;
  bachelorAgeSoftMax: number;
  softPenalty: number;
  krwPerUsd: number;
}

export interface AdmissionChance {
  institutionId: string;
  name: string;
  guidelineId: string | null;
  percent: number;
  /** percent >= K_OPEN_PERCENT. */
  open: boolean;
}

export interface AssessmentFix {
  kind: "bank" | "topik";
  /** The bank in won, or the TOPIK level to reach. */
  value: number;
  /** Points: on the visa for 'bank', on average admission for 'topik'. */
  gain: number;
}

export interface VisaHints {
  tariff: Tariff;
  /** 'language' | 'income' | 'deposit' | 'gap' | 'age', or null for none. */
  low: string | null;
  formalIncome: boolean;
}

/// assessment.dart AssessmentOutcome (+ openCount).
export interface AssessmentOutcome {
  band: EligibilityBand;
  visaPercent: number;
  visaWithConsultantPercent: number;
  requiredBankKrw: number;
  chances: AdmissionChance[];
  fixes: AssessmentFix[];
  hints: VisaHints;
  openCount: number;
}

// ---------------------------------------------------------------- constants

/// An admission chance at or above this counts as open.
export const K_OPEN_PERCENT = 60;

/// EligibilityRules() defaults (eligibility_engine.dart).
export const DEFAULT_RULES: Readonly<AssessRules> = Object.freeze({
  baseScore: 2,
  bandHighMin: 6,
  bandMidMin: 3,
  languageOkBonus: 2,
  languageUnknownBonus: 1,
  languageMissingCap: "low",
  moneyOkBonus: 2,
  moneyUnknownBonus: 1,
  moneyPartialCap: "mid",
  moneyMissingCap: "low",
  courseTopikMin: 1,
  collegeTopikMin: 2,
  bachelorTopikMin: 3,
  masterTopikMin: 4,
  englishIeltsMin: 5.5,
  courseKdbUsd: [6300, 7800],
  degreeKdbUsd: [12500, 15500],
  courseGapYearsMax: 3,
  courseAgeSoftMax: 30,
  bachelorAgeSoftMax: 30,
  softPenalty: 1,
  krwPerUsd: 1400,
}) as Readonly<AssessRules>;

const DEFAULT_INPUT: Readonly<AssessmentInput> = Object.freeze({
  topik: 0,
  gpa: 4.0,
  bankKrw: 0,
  route: "bachelor",
  visaRefused: false,
  universityIds: [],
  gapYears: 0,
  experience: 0,
  olympiad: 0,
  topikFresh: true,
  ielts: 0,
  motivation: 0,
  recommendation: false,
  portfolio: false,
  activity: 0,
  education: 0,
  age: 19,
  income: 0,
  incomeDocumented: false,
  sponsor: 0,
  relationDoc: false,
  incomeStability: 0,
  property: 0,
  car: 0,
  business: 0,
  koreaBefore: 0,
  illegalRelatives: false,
  legalRelatives: false,
  studyPlan: 0,
  interviewPrep: 0,
}) as Readonly<AssessmentInput>;

const INT_FIELDS = [
  "topik", "bankKrw", "gapYears", "experience", "olympiad", "motivation", "activity",
  "education", "age", "income", "sponsor", "incomeStability", "property", "car",
  "business", "koreaBefore", "studyPlan", "interviewPrep",
] as const;
const DOUBLE_FIELDS = ["gpa", "ielts"] as const;
const BOOL_FIELDS = [
  "visaRefused", "topikFresh", "recommendation", "portfolio", "incomeDocumented",
  "relationDoc", "illegalRelatives", "legalRelatives",
] as const;
const ROUTES: readonly StudyRoute[] = ["languageCourse", "bachelor", "master", "college"];

// ---------------------------------------------------------------- Dart helpers

/** Dart `num.round()`: half away from zero. */
export function dartRound(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/** Dart `num.clamp(lo, hi)`. */
function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** `const [..][i.clamp(0, n-1)]`. */
function pick(table: readonly number[], i: number): number {
  return table[clamp(i, 0, table.length - 1)];
}

/// The answers with the Dart defaults filled in and int fields truncated (as
/// Dart's `toInt()`); unknown or non-finite values fall back to the default.
export function toAssessmentInput(x: AssessmentInputLike = {}): AssessmentInput {
  const out: AssessmentInput = { ...DEFAULT_INPUT, universityIds: [] };
  const src = x as Record<string, unknown>;
  for (const k of INT_FIELDS) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.trunc(v);
  }
  for (const k of DOUBLE_FIELDS) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  for (const k of BOOL_FIELDS) {
    const v = src[k];
    if (typeof v === "boolean") out[k] = v;
  }
  const r = src.route;
  if (r === "d4") out.route = "languageCourse";
  else if (typeof r === "string" && (ROUTES as readonly string[]).includes(r)) out.route = r as StudyRoute;
  if (Array.isArray(src.universityIds)) {
    out.universityIds = src.universityIds.filter((s): s is string => typeof s === "string");
  }
  return out;
}

// ---------------------------------------------------------------- rules

/// EligibilityRules.topikMin(route).
export function topikMinFor(route: StudyRoute, rules: AssessRules = DEFAULT_RULES): number {
  switch (route) {
    case "languageCourse": return rules.courseTopikMin;
    case "college": return rules.collegeTopikMin;
    case "bachelor": return rules.bachelorTopikMin;
    case "master": return rules.masterTopikMin;
  }
}

/// EligibilityRules.kdbUsd(route): [other areas, capital area].
export function kdbUsdFor(route: StudyRoute, rules: AssessRules = DEFAULT_RULES): [number, number] {
  return route === "languageCourse" ? rules.courseKdbUsd : rules.degreeKdbUsd;
}

/** Dart `num.tryParse('$x')` for a JSON value. */
function dartNum(x: unknown): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const s = x.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/// EligibilityRules.fromRows: `eligibility_rules` rows ({key, value}); missing
/// or malformed keys keep their default. Only the keys these formulas read.
export function rulesFromRows(rows: { key: string; value: unknown }[]): AssessRules {
  const d = DEFAULT_RULES;
  const v = new Map<string, unknown>();
  for (const r of rows) v.set(r.key, r.value);
  const n = (k: string, def: number) => dartNum(v.get(k)) ?? def;
  const i = (k: string, def: number) => Math.trunc(n(k, def));
  const band = (k: string, def: EligibilityBand): EligibilityBand => {
    const x = v.get(k);
    return x === "high" || x === "mid" || x === "low" ? x : def;
  };
  const range = (k: string, def: [number, number]): [number, number] => {
    const x = v.get(k);
    if (Array.isArray(x) && x.length === 2 && typeof x[0] === "number" && typeof x[1] === "number") {
      return [Math.trunc(x[0]), Math.trunc(x[1])];
    }
    return def;
  };
  return {
    baseScore: n("base_score", d.baseScore),
    bandHighMin: n("band_high_min", d.bandHighMin),
    bandMidMin: n("band_mid_min", d.bandMidMin),
    languageOkBonus: n("lang_ok_bonus", d.languageOkBonus),
    languageUnknownBonus: n("lang_unknown_bonus", d.languageUnknownBonus),
    languageMissingCap: band("lang_missing_cap", d.languageMissingCap),
    moneyOkBonus: n("money_ok_bonus", d.moneyOkBonus),
    moneyUnknownBonus: n("money_unknown_bonus", d.moneyUnknownBonus),
    moneyPartialCap: band("money_partial_cap", d.moneyPartialCap),
    moneyMissingCap: band("money_missing_cap", d.moneyMissingCap),
    courseTopikMin: i("d4_topik_min", d.courseTopikMin),
    collegeTopikMin: i("voc_topik_min", d.collegeTopikMin),
    bachelorTopikMin: i("d2_bachelor_topik_min", d.bachelorTopikMin),
    masterTopikMin: i("d2_master_topik_min", d.masterTopikMin),
    englishIeltsMin: n("d2_master_ielts_min", d.englishIeltsMin),
    courseKdbUsd: range("d4_kdb_usd", d.courseKdbUsd),
    degreeKdbUsd: range("d2_kdb_usd", d.degreeKdbUsd),
    courseGapYearsMax: i("d4_gap_years_max", d.courseGapYearsMax),
    courseAgeSoftMax: i("d4_age_soft_max", d.courseAgeSoftMax),
    bachelorAgeSoftMax: i("d2_bachelor_age_soft_max", d.bachelorAgeSoftMax),
    softPenalty: n("soft_penalty", d.softPenalty),
    krwPerUsd: n("krw_per_usd", d.krwPerUsd),
  };
}

// ---------------------------------------------------------------- catalogue

/// CatalogGuideline.fromRow for a `v_app_university_catalog` row (the fields
/// above only).
export function guidelineFromRow(r: Record<string, unknown>): AssessGuideline & { institutionId: string } {
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
  const b = (k: string) => (typeof r[k] === "boolean" ? (r[k] as boolean) : null);
  return {
    id: String(r.guideline_id ?? ""),
    institutionId: String(r.institution_id ?? ""),
    degree: s("daraja"),
    topikMin: r.topik_min == null ? null : dartNum(r.topik_min),
    ieltsMin: r.ielts_min == null ? null : dartNum(r.ielts_min),
    isPartner: b("is_partner"),
    englishTrack: b("english_track"),
    koreanTrack: b("korean_track"),
    isActive: b("is_active"),
    visaRestricted: b("visa_restricted"),
    regionCode: s("region_code"),
    city: s("shahar"),
    cityKo: s("city_ko"),
    nameEn: s("name_en"),
    univNameEn: s("univ_nomi_en"),
    nameKo: s("name_ko"),
    univNameKr: s("univ_nomi_kr"),
  };
}

/// catalog_repository.dart groupCatalogRows: one entry per institution, rows
/// kept in their order (query them `order('qabul_yili', desc)` as the app
/// does). The app also sorts universities (partners, then name); nothing here
/// depends on that order, so it is left out.
export function groupCatalogRows(rows: Record<string, unknown>[]): AssessUniversity[] {
  const by = new Map<string, AssessGuideline[]>();
  for (const row of rows) {
    const g = guidelineFromRow(row);
    const list = by.get(g.institutionId) ?? [];
    list.push(g);
    by.set(g.institutionId, list);
  }
  return [...by.entries()].map(([institutionId, guidelines]) => ({ institutionId, guidelines }));
}

/// CatalogGuideline.inCapitalArea: Seoul, Gyeonggi or Incheon.
export function inCapitalArea(g: AssessGuideline): boolean {
  const r = g.regionCode;
  if (r != null && r.length > 0) return r === "서울" || r === "경기" || r === "인천";
  const c = `${g.cityKo ?? ""} ${g.city ?? ""}`.toLowerCase();
  return c.includes("서울") || c.includes("seoul") || c.includes("인천") || c.includes("incheon");
}

/// CatalogUniversity.forDegree: for null the bachelor's guideline, else the
/// first one.
export function forDegree(u: AssessUniversity, degree: string | null): AssessGuideline | null {
  if (degree == null) {
    return u.guidelines.find((g) => g.degree === "bakalavr") ?? u.guidelines[0] ?? null;
  }
  return u.guidelines.find((g) => g.degree === degree) ?? null;
}

/// CatalogUniversity.primary. Dart throws for a university without
/// guidelines; here it is null and such universities are skipped.
export function primaryGuideline(u: AssessUniversity): AssessGuideline | null {
  return forDegree(u, null);
}

/// CatalogUniversity.displayName.
export function displayName(u: AssessUniversity): string {
  const p = primaryGuideline(u);
  if (!p) return "";
  for (const x of [p.nameEn, p.univNameEn, p.nameKo, p.univNameKr]) {
    if (x != null && x.trim() !== "") return x.trim();
  }
  return "";
}

/// StudyRoute.catalogDegree.
export function catalogDegree(route: StudyRoute): string | null {
  return route === "bachelor" ? "bakalavr" : route === "master" ? "magistratura" : null;
}

// ---------------------------------------------------------------- admission

/// assessment.dart documentsBonus: what the documents' answers add (or take)
/// on top of TOPIK and the certificate.
export function documentsBonus(input: AssessmentInputLike): number {
  const i = toAssessmentInput(input);
  let p = 0;
  p += i.gapYears <= 1 ? 0 : i.gapYears === 2 ? -3 : -6;
  p += pick([0, 2, 3, 4], i.experience);
  p += pick([0, 2, 4, 6], i.olympiad);
  p += i.ielts >= 7 ? 5 : i.ielts >= 6.5 ? 4 : i.ielts >= 6 ? 3 : i.ielts >= 5.5 ? 2 : i.ielts >= 5 ? 1 : 0;
  p += pick([0, 2, 4], i.motivation);
  if (i.recommendation) p += 2;
  if (i.portfolio) p += 2;
  p += pick([0, 2, 2, 3], i.activity);
  return p;
}

/// assessment.dart meetsEnglish: whether the IELTS score meets the guideline's
/// language requirement — a bachelor's or master's whose guideline has an
/// English-taught track or names an IELTS minimum, and a score at or above
/// that minimum (the rules' when the guideline names none).
export function meetsEnglish(
  input: AssessmentInputLike,
  g: AssessGuideline,
  rules: AssessRules = DEFAULT_RULES,
): boolean {
  const i = toAssessmentInput(input);
  if (i.route !== "bachelor" && i.route !== "master") return false;
  if (g.englishTrack !== true && g.ieltsMin == null) return false;
  return i.ielts >= (g.ieltsMin ?? rules.englishIeltsMin);
}

/// assessment.dart languageBase: the better of the two ways in. Korean — the
/// TOPIK level against the requirement (the route's when the Excel has none):
/// short by 2+ 15, by one 30, met 55, one above 68, two above 78; a bachelor's
/// or master's taught in English only (korean_track false) has no Korean way
/// in. English (meetsEnglish) — 55, the same as a TOPIK requirement met.
export function languageBase(
  input: AssessmentInputLike,
  g: AssessGuideline,
  rules: AssessRules = DEFAULT_RULES,
): number {
  const i = toAssessmentInput(input);
  const isDegree = i.route === "bachelor" || i.route === "master";
  let base = 15;
  if (!isDegree || g.koreanTrack !== false) {
    const need = g.topikMin != null ? dartRound(g.topikMin) : topikMinFor(i.route, rules);
    const diff = topikCounted(i) - need;
    base = diff <= -2 ? 15 : diff === -1 ? 30 : diff === 0 ? 55 : diff === 1 ? 68 : 78;
  }
  if (base < 55 && meetsEnglish(i, g, rules)) base = 55;
  return base;
}

/// assessment.dart admissionPercent: one university's admission chance from
/// its language requirement (languageBase) — ±10 a certificate point from 3.5
/// (at most ±15), +5 for a partner, plus documentsBonus, kept within 5–95.
export function admissionPercent(
  input: AssessmentInputLike,
  g: AssessGuideline,
  rules: AssessRules = DEFAULT_RULES,
): number {
  const i = toAssessmentInput(input);
  let p = languageBase(i, g, rules);
  p += dartRound(clamp((i.gpa - 3.5) * 10, -15, 15));
  if (g.isPartner === true) p += 5;
  p += documentsBonus(i);
  return clamp(p, 5, 95);
}

/// AssessmentInput.topikCounted: the level the documents can show.
export function topikCounted(input: AssessmentInputLike): number {
  const i = toAssessmentInput(input);
  return i.topikFresh ? i.topik : 0;
}

/// AssessmentInput.kdbDeposit: the bank against the deposit the route needs.
export function kdbDeposit(input: AssessmentInputLike, requiredKrw: number): KdbDeposit {
  const i = toAssessmentInput(input);
  return i.bankKrw >= requiredKrw ? "ready" : i.bankKrw > 0 ? "by_intake" : "no";
}

/// assessment.dart requiredBank: the KDB deposit for the route in won — the
/// capital area's figure when any of the universities (their primary
/// guideline) is there.
export function requiredBank(
  route: StudyRoute,
  universities: AssessUniversity[],
  rules: AssessRules = DEFAULT_RULES,
): number {
  const kdb = kdbUsdFor(route, rules);
  const capital = universities.some((u) => {
    const p = primaryGuideline(u);
    return p != null && inCapitalArea(p);
  });
  return dartRound((capital ? kdb[1] : kdb[0]) * rules.krwPerUsd);
}

// ---------------------------------------------------------------- visa

/// visa_model.dart visaScore ("Vizam chiqadimi?"): starts at 30, moved by the
/// answers, kept within 5–95; an overstay holds it at 5, a master's without a
/// bachelor's (education < 2) at most 10.
export function visaScore(input: AssessmentInputLike, requiredBankKrw: number): number {
  const i = toAssessmentInput(input);
  const d4 = i.route === "languageCourse";
  let p = 30;

  // Language.
  const t = topikCounted(i);
  const topikPts = d4
    ? (t >= 3 ? 6 : t >= 1 ? 3 : 0)
    : (t >= 4 ? 12 : t === 3 ? 8 : t === 2 ? 3 : 0);
  const ieltsPts = !d4 && i.ielts >= 5.5 ? 8 : 0;
  p += topikPts > ieltsPts ? topikPts : ieltsPts;

  // Money.
  let money = 0;
  money += pick([0, 4, 8, 12], i.income);
  if (i.incomeDocumented) money += 5;
  money += pick([0, 2, 4, 5], i.incomeStability);
  money += pick([0, 3, 5], i.property);
  money += pick([0, 1, 2], i.car);
  money += pick([0, 2, 3], i.business);
  money += pick([0, 4, -6], i.sponsor);
  if (i.sponsor !== 0 && i.relationDoc) money += 3;
  if (i.bankKrw >= requiredBankKrw && requiredBankKrw > 0) {
    money += 15;
  } else if (i.bankKrw > 0) {
    money += 5;
  }
  p += clamp(money, -10, 35);

  // Age and gap.
  let risk = 0;
  if (d4) {
    risk += i.age > 30 ? -15 : i.age >= 26 ? -8 : 0;
    risk += i.gapYears >= 2 ? -8 : 0;
  } else {
    risk += i.age > 30 ? -8 : i.age >= 26 ? -3 : 0;
    risk += i.gapYears >= 3 ? -6 : i.gapYears === 2 ? -3 : 0;
  }
  p += clamp(risk, -20, 0);

  // The certificate.
  p += i.gpa >= 4 ? 3 : i.gpa < 3 ? -5 : 0;

  // History.
  if (i.visaRefused) p -= 10;
  if (i.koreaBefore === 1) p += 3;
  if (i.illegalRelatives) p -= 15;
  if (i.legalRelatives) p += 5;

  // Preparation.
  p += pick([0, 2, 5], i.studyPlan);
  p += pick([0, 2, 5], i.interviewPrep);
  p += pick([0, 1, 3], i.motivation);
  if (i.recommendation) p += 2;

  p = clamp(p, 5, 95);
  if (i.koreaBefore === 2) p = 5;
  if (i.route === "master" && i.education < 2) p = clamp(p, 5, 10);
  return p;
}

/// visa_model.dart visaWithConsultant: the papers a consultant puts in order —
/// plan, interview, letter, recommendation, income documented, relation
/// certified.
export function visaWithConsultant(input: AssessmentInputLike, requiredBankKrw: number): number {
  return visaScore(
    {
      ...toAssessmentInput(input),
      studyPlan: 2,
      interviewPrep: 2,
      motivation: 2,
      recommendation: true,
      incomeDocumented: true,
      relationDoc: true,
    },
    requiredBankKrw,
  );
}

/// assessment.dart visaBandOf: high from 65, mid from 40.
export function visaBandOf(percent: number): EligibilityBand {
  return percent >= 65 ? "high" : percent >= 40 ? "mid" : "low";
}

/** Alias of visaBandOf. */
export const band = visaBandOf;

/// assessment.dart segmentsOf: the meter's five segments.
export function segmentsOf(percent: number): number {
  return percent < 25 ? 1 : percent < 45 ? 2 : percent < 65 ? 3 : percent < 82 ? 4 : 5;
}

// ---------------------------------------------------------------- hints

const BAND_INDEX: Record<EligibilityBand, number> = { high: 0, mid: 1, low: 2 };

/** EligibilityBand.atMost: the lower of two bands. */
function atMost(b: EligibilityBand, cap: EligibilityBand): EligibilityBand {
  return BAND_INDEX[b] >= BAND_INDEX[cap] ? b : cap;
}

/// assessment.dart visaHints: the old quiz's tariff and first weak point for
/// these answers — the subset of evaluateEligibility (eligibility_engine.dart)
/// that decides `tariff` and the first negative factor. The answers as the old
/// quiz's: Korean from topikCounted (TOPIK 4+ as 4), IELTS bucketed to
/// 6.5/6.0/5.5/0, income documented, the deposit from the bank, the gap since
/// school = gapYears (the date cancels out), never "unknown".
export function visaHints(
  input: AssessmentInputLike,
  catalog: AssessUniversity[],
  requiredBankKrw: number,
  rules: AssessRules = DEFAULT_RULES,
): VisaHints {
  const i = toAssessmentInput(input);
  const route = i.route;
  const isDegree = route === "bachelor" || route === "master";
  const korean = Math.min(Math.max(topikCounted(i), 0), 4); // KoreanLevel.topik
  const ielts = i.ielts >= 6.5 ? 6.5 : i.ielts >= 6.0 ? 6.0 : i.ielts >= 5.5 ? 5.5 : 0;
  const formalIncome = i.incomeDocumented;
  const deposit = kdbDeposit(i, requiredBankKrw);
  const topikNeed = topikMinFor(route, rules);

  // Only whether an English-taught programme in the catalogue accepts the
  // IELTS matters here (MatchedUniversity.viaEnglish / englishTrack).
  const degree = catalogDegree(route);
  const englishScoreOk = isDegree && ielts >= rules.englishIeltsMin;
  const englishProgramme = degree != null && catalog.some((u) => {
    const g = forDegree(u, degree);
    if (g == null || g.isActive === false || g.visaRestricted === true) return false;
    return g.englishTrack === true && (g.ieltsMin == null || g.ieltsMin <= ielts);
  });

  const negatives: string[] = [];
  let score = rules.baseScore;
  let cap: EligibilityBand = "high";

  // 1. Language.
  const koreanOk = korean >= topikNeed;
  const englishOk = englishScoreOk && (route === "master" || englishProgramme);
  if (koreanOk || englishOk) {
    score += rules.languageOkBonus;
  } else {
    negatives.push("language");
    cap = atMost(cap, rules.languageMissingCap);
  }

  // 2. Money.
  if (!formalIncome) negatives.push("income");
  if (deposit !== "ready") negatives.push("deposit");
  const money = deposit === "no" ? "missing" : deposit === "by_intake" ? "partial" : !formalIncome ? "partial" : "met";
  if (money === "met") score += rules.moneyOkBonus;
  else if (money === "partial") cap = atMost(cap, rules.moneyPartialCap);
  else cap = atMost(cap, rules.moneyMissingCap);

  // 3. Soft points.
  if (route === "languageCourse") {
    if (i.gapYears > rules.courseGapYearsMax) {
      score -= rules.softPenalty;
      negatives.push("gap");
    }
    if (i.age > rules.courseAgeSoftMax) {
      score -= rules.softPenalty;
      negatives.push("age");
    }
  } else if (route === "bachelor" && i.age > rules.bachelorAgeSoftMax) {
    score -= rules.softPenalty;
    negatives.push("age");
  }

  const b = atMost(
    score >= rules.bandHighMin ? "high" : score >= rules.bandMidMin ? "mid" : "low",
    cap,
  );

  const financeWeak = !formalIncome;
  const hasMoney = deposit === "ready" || deposit === "by_intake";
  let tariff: Tariff;
  if (b === "low" && korean <= 1 && !englishOk) tariff = "hanbox";
  else if (financeWeak && hasMoney) tariff = "no_risk";
  else if (isDegree && (korean >= 2 || englishOk) && !financeWeak) tariff = "premium";
  else if (deposit === "no") tariff = "standart";
  else tariff = "premium";

  return { tariff, low: negatives[0] ?? null, formalIncome };
}

// ---------------------------------------------------------------- the board

/// assessment.dart assess: the whole board — visa band and chance, the chance
/// with a consultant, the deposit, each chosen university's admission chance
/// (unknown ids dropped), the fixes (bank to the required amount → visa gain;
/// TOPIK one level up → average admission gain) and the old quiz's hints.
export function assess(
  input: AssessmentInputLike,
  catalog: AssessUniversity[],
  rules: AssessRules = DEFAULT_RULES,
): AssessmentOutcome {
  const i = toAssessmentInput(input);
  const byId = new Map(catalog.map((u) => [u.institutionId, u] as const));
  const chosen = i.universityIds
    .map((id) => byId.get(id))
    .filter((u): u is AssessUniversity => u != null && primaryGuideline(u) != null);
  const degree = catalogDegree(i.route);

  const requiredKrw = requiredBank(i.route, chosen, rules);
  const visa = visaScore(i, requiredKrw);

  const chancesFor = (x: AssessmentInput): AdmissionChance[] =>
    chosen.map((u) => {
      const g = (degree == null ? null : forDegree(u, degree)) ?? primaryGuideline(u)!;
      const percent = admissionPercent(x, g, rules);
      return {
        institutionId: u.institutionId,
        name: displayName(u),
        guidelineId: g.id ?? null,
        percent,
        open: percent >= K_OPEN_PERCENT,
      };
    });

  const chances = chancesFor(i);
  const fixes: AssessmentFix[] = [];
  if (i.bankKrw < requiredKrw) {
    const gain = visaScore({ ...i, bankKrw: requiredKrw }, requiredKrw) - visa;
    if (gain > 0) fixes.push({ kind: "bank", value: requiredKrw, gain });
  }
  if (i.topik < 6 && chances.length > 0) {
    const next = i.topik + 1;
    const up = chancesFor({ ...i, topik: next });
    const now0 = chances.reduce((s, c) => s + c.percent, 0) / chances.length;
    const now1 = up.reduce((s, c) => s + c.percent, 0) / up.length;
    const gain = dartRound(now1 - now0);
    if (gain > 0) fixes.push({ kind: "topik", value: next, gain });
  }

  return {
    band: visaBandOf(visa),
    visaPercent: visa,
    visaWithConsultantPercent: visaWithConsultant(i, requiredKrw),
    requiredBankKrw: requiredKrw,
    chances,
    fixes,
    hints: visaHints(i, catalog, requiredKrw, rules),
    openCount: chances.filter((c) => c.open).length,
  };
}

/// AssessmentOutcome.toResult: `leads.eligibility_result` as the app writes it.
export function toResult(o: AssessmentOutcome): Record<string, unknown> {
  return {
    source: "assessment_v1",
    band: o.band,
    visa_pct: o.visaPercent,
    required_bank_krw: o.requiredBankKrw,
    universities: o.chances.map((c) => ({ id: c.institutionId, name: c.name, pct: c.percent })),
    fixes: o.fixes.map((f) => ({ kind: f.kind, value: f.value, gain: f.gain })),
    tariff: o.hints.tariff,
    low: o.hints.low,
  };
}

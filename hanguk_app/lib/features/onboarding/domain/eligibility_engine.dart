import 'package:flutter/foundation.dart';

import '../../catalog/domain/catalog_models.dart';
import 'quiz_answers.dart';

/// "Viza imkoniyatim": from the answers to a band (high / mid / low), the
/// reasons, matching universities, a yearly cost, three next steps and one
/// recommended tariff (app spec, section 5).
///
/// The band follows the Korean embassy in Tashkent (student visa notice of
/// 2026-06-12) through three checks:
///   * language — the certificate the route needs (TOPIK 1 for the language
///     course, 2 for a college, 3 for a bachelor's, 4 for a master's, or
///     IELTS for an English-taught programme). Without it the application is
///     refused without an interview, so the band is low;
///   * money — the KDB deposit in the student's name and the parents' income
///     papers, both required (the embassy asks for these, not for a budget);
///   * soft points — age and the gap since school — each one a point down.
/// High needs the first two met and no soft point.
///
/// A starting heuristic, not an embassy decision — the result screen says so.
/// Every number comes from [EligibilityRules], which the app reads from the
/// `eligibility_rules` table so operators can change a rule without a release;
/// the defaults below are the same values the migration seeds.

enum EligibilityBand {
  high('high'),
  mid('mid'),
  low('low');

  const EligibilityBand(this.code);
  final String code;

  static EligibilityBand fromScore(num score, EligibilityRules rules) {
    if (score >= rules.bandHighMin) return high;
    if (score >= rules.bandMidMin) return mid;
    return low;
  }

  /// The lower of two bands.
  EligibilityBand atMost(EligibilityBand cap) => index >= cap.index ? this : cap;
}

/// One reason shown under "Nimaga ta'sir qildi". The screen turns [kind] into
/// text in the app language.
enum FactorKind {
  koreanStrong,
  koreanMasterStrong,
  englishStrong,
  koreanTopik2Degree,
  koreanMissingDegree,
  koreanTopik3Master,
  koreanMissingMaster,
  koreanCollegeStrong,
  koreanCollegeTopik2,
  koreanCollegeMissing,
  koreanCourseCertificate,
  koreanCourseMissing,
  incomeYes,
  incomeNo,
  kdbReady,
  kdbByIntake,
  kdbNo,
  gradRecent,
  gradGapLong,
  ageHigh,
}

@immutable
class EligibilityFactor {
  const EligibilityFactor(this.kind, {required this.positive});

  final FactorKind kind;
  final bool positive;
}

/// One of the three "Keyingi 3 qadam", in priority order: the certificate the
/// route needs, the deposit, the parents' papers, then the documents and the
/// deadline.
enum NextStep { languagePrep, deposit, parentsDocs, schoolDocs, diplomaDocs, applyOnTime }

/// The "Sizga mos yo'llar" shown instead of universities for a low band —
/// only the ways that fit the route and the reason:
///   * [languageCourse] — not to someone already applying for it;
///   * [college] — to a bachelor's applicant whose TOPIK meets the college's;
///   * [englishTrack] — to a degree applicant without IELTS 5.5;
///   * [nextSeason] — with the TOPIK level the route needs;
///   * [deposit] / [parentsDocs] — when the money is what is missing.
enum AlternativePath { languageCourse, college, englishTrack, nextSeason, deposit, parentsDocs }

/// Why a band is low: the note under the band names it.
enum LowReason { language, money, both }

enum Tariff {
  standart('standart'),
  premium('premium'),
  noRisk('no_risk'),
  hanbox('hanbox');

  const Tariff(this.code);
  final String code;
}

/// A university suggested on the result screen, with its figures in dollars.
@immutable
class MatchedUniversity {
  const MatchedUniversity({
    required this.university,
    required this.guideline,
    required this.accredited,
    this.partner = false,
    this.viaEnglish = false,
    this.tuitionPerSemesterUsd,
    this.topikMin,
    this.bankStatementUsd,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final bool accredited;

  /// An official HANGUK partner: listed first, with a "Rasmiy hamkor" badge.
  final bool partner;

  /// Offered on the IELTS score (an English-taught programme), not on Korean.
  final bool viaEnglish;
  final int? tuitionPerSemesterUsd;
  final int? topikMin;

  /// The money to show in the bank: the university's own figure or the
  /// embassy's KDB deposit for its area, whichever is higher.
  final int? bankStatementUsd;
}

@immutable
class EligibilityResult {
  const EligibilityResult({
    required this.band,
    required this.score,
    required this.factors,
    required this.universities,
    required this.steps,
    required this.paths,
    required this.tariff,
    required this.needsOperator,
    this.lowReason,
    this.yearlyCostUsd,
    this.bankStatementUsd,
    this.topikNeed = 3,
    this.depositUsd = (12500, 15500),
    this.depositHoldMonths = 1,
  });

  final EligibilityBand band;
  final num score;
  final List<EligibilityFactor> factors;
  final List<MatchedUniversity> universities;

  /// Set when [band] is low.
  final LowReason? lowReason;

  /// Low and high end of the yearly cost estimate, in dollars.
  final (int, int)? yearlyCostUsd;
  final int? bankStatementUsd;
  final List<NextStep> steps;
  final List<AlternativePath> paths;
  final Tariff tariff;

  /// Two or more "Hali bilmayman" answers: the operator has to clarify.
  final bool needsOperator;

  /// The TOPIK level the route needs, for the steps and the paths.
  final int topikNeed;

  /// The KDB deposit for the route (other areas, Seoul area) and how many
  /// months it has to be held.
  final (int, int) depositUsd;
  final int depositHoldMonths;
}

/// The numbers behind the result. See `eligibility_rules`.
@immutable
class EligibilityRules {
  const EligibilityRules({
    this.baseScore = 2,
    this.bandHighMin = 6,
    this.bandMidMin = 3,
    this.languageOkBonus = 2,
    this.languageUnknownBonus = 1,
    this.languageMissingCap = EligibilityBand.low,
    this.moneyOkBonus = 2,
    this.moneyUnknownBonus = 1,
    this.moneyPartialCap = EligibilityBand.mid,
    this.moneyMissingCap = EligibilityBand.low,
    this.courseTopikMin = 1,
    this.collegeTopikMin = 2,
    this.bachelorTopikMin = 3,
    this.masterTopikMin = 4,
    this.englishIeltsMin = 5.5,
    this.courseKdbUsd = (6300, 7800),
    this.degreeKdbUsd = (12500, 15500),
    this.courseKdbHoldMonths = 3,
    this.degreeKdbHoldMonths = 1,
    this.courseGapYearsMax = 3,
    this.courseAgeSoftMax = 30,
    this.bachelorAgeSoftMax = 30,
    this.softPenalty = 1,
    this.krwPerUsd = 1400,
    this.livingSeoulMonthUsd = (900, 1100),
    this.livingRegionMonthUsd = (450, 750),
    this.applicationFeeUsd = 70,
    this.maxUniversities = 3,
  });

  final num baseScore;
  final num bandHighMin;
  final num bandMidMin;

  /// The language check: met, not known yet, or missing (refused without an
  /// interview, so the band goes no higher than [languageMissingCap]).
  final num languageOkBonus;
  final num languageUnknownBonus;
  final EligibilityBand languageMissingCap;

  /// The money check: met (deposit and income), not known yet, partly met
  /// (no higher than [moneyPartialCap]) or missing ([moneyMissingCap]).
  final num moneyOkBonus;
  final num moneyUnknownBonus;
  final EligibilityBand moneyPartialCap;
  final EligibilityBand moneyMissingCap;

  /// The TOPIK level the embassy asks for on each route.
  final int courseTopikMin;
  final int collegeTopikMin;
  final int bachelorTopikMin;
  final int masterTopikMin;

  /// An English-taught bachelor's or master's: this IELTS (and the
  /// programme's own minimum) counts as the language requirement met.
  final num englishIeltsMin;

  /// The KDB deposit in dollars, (other areas, Seoul/Gyeonggi/Incheon), and
  /// how many months it has to be held: language course and the rest.
  final (int, int) courseKdbUsd;
  final (int, int) degreeKdbUsd;
  final int courseKdbHoldMonths;
  final int degreeKdbHoldMonths;

  final int courseGapYearsMax;
  final int courseAgeSoftMax;
  final int bachelorAgeSoftMax;

  /// Points down for each soft point (age, gap).
  final num softPenalty;
  final num krwPerUsd;
  final (int, int) livingSeoulMonthUsd;
  final (int, int) livingRegionMonthUsd;
  final int applicationFeeUsd;
  final int maxUniversities;

  /// The TOPIK level [route] needs.
  int topikMin(StudyRoute route) => switch (route) {
    StudyRoute.languageCourse => courseTopikMin,
    StudyRoute.college => collegeTopikMin,
    StudyRoute.bachelor => bachelorTopikMin,
    StudyRoute.master => masterTopikMin,
  };

  /// The KDB deposit for [route], (other areas, capital area).
  (int, int) kdbUsd(StudyRoute route) =>
      route == StudyRoute.languageCourse ? courseKdbUsd : degreeKdbUsd;

  int kdbHoldMonths(StudyRoute route) =>
      route == StudyRoute.languageCourse ? courseKdbHoldMonths : degreeKdbHoldMonths;

  /// From `eligibility_rules` rows (`key`, `value`). Missing or malformed keys
  /// keep their default.
  factory EligibilityRules.fromRows(List<Map<String, dynamic>> rows) {
    const d = EligibilityRules();
    final v = {for (final r in rows) r['key'] as String: r['value']};
    num n(String k, num def) {
      final x = v[k];
      if (x is num) return x;
      return num.tryParse('$x') ?? def;
    }

    int i(String k, int def) => n(k, def).toInt();

    EligibilityBand band(String k, EligibilityBand def) {
      final x = v[k];
      return EligibilityBand.values.where((b) => b.code == x).firstOrNull ?? def;
    }

    (int, int) range(String k, (int, int) def) {
      final x = v[k];
      if (x is List && x.length == 2 && x[0] is num && x[1] is num) {
        return ((x[0] as num).toInt(), (x[1] as num).toInt());
      }
      return def;
    }

    return EligibilityRules(
      baseScore: n('base_score', d.baseScore),
      bandHighMin: n('band_high_min', d.bandHighMin),
      bandMidMin: n('band_mid_min', d.bandMidMin),
      languageOkBonus: n('lang_ok_bonus', d.languageOkBonus),
      languageUnknownBonus: n('lang_unknown_bonus', d.languageUnknownBonus),
      languageMissingCap: band('lang_missing_cap', d.languageMissingCap),
      moneyOkBonus: n('money_ok_bonus', d.moneyOkBonus),
      moneyUnknownBonus: n('money_unknown_bonus', d.moneyUnknownBonus),
      moneyPartialCap: band('money_partial_cap', d.moneyPartialCap),
      moneyMissingCap: band('money_missing_cap', d.moneyMissingCap),
      courseTopikMin: i('d4_topik_min', d.courseTopikMin),
      collegeTopikMin: i('voc_topik_min', d.collegeTopikMin),
      bachelorTopikMin: i('d2_bachelor_topik_min', d.bachelorTopikMin),
      masterTopikMin: i('d2_master_topik_min', d.masterTopikMin),
      englishIeltsMin: n('d2_master_ielts_min', d.englishIeltsMin),
      courseKdbUsd: range('d4_kdb_usd', d.courseKdbUsd),
      degreeKdbUsd: range('d2_kdb_usd', d.degreeKdbUsd),
      courseKdbHoldMonths: i('d4_kdb_hold_months', d.courseKdbHoldMonths),
      degreeKdbHoldMonths: i('d2_kdb_hold_months', d.degreeKdbHoldMonths),
      courseGapYearsMax: i('d4_gap_years_max', d.courseGapYearsMax),
      courseAgeSoftMax: i('d4_age_soft_max', d.courseAgeSoftMax),
      bachelorAgeSoftMax: i('d2_bachelor_age_soft_max', d.bachelorAgeSoftMax),
      softPenalty: n('soft_penalty', d.softPenalty),
      krwPerUsd: n('krw_per_usd', d.krwPerUsd),
      livingSeoulMonthUsd: range('living_seoul_month_usd', d.livingSeoulMonthUsd),
      livingRegionMonthUsd: range('living_region_month_usd', d.livingRegionMonthUsd),
      applicationFeeUsd: i('app_fee_usd', d.applicationFeeUsd),
      maxUniversities: i('max_universities', d.maxUniversities),
    );
  }

  /// [amount] in [currency] as whole dollars; null when it cannot be read.
  int? toUsd(num? amount, String? currency) {
    if (amount == null || amount <= 0) return null;
    final c = (currency ?? 'KRW').toUpperCase();
    if (c == 'USD' || c == r'$') return amount.round();
    if (c == 'KRW' || c == 'WON' || c == '₩') {
      return krwPerUsd > 0 ? (amount / krwPerUsd).round() : null;
    }
    return null;
  }
}

enum _Check { met, unknown, partial, missing }

/// Computes the result. [catalog] is the app's university catalogue; [now] is
/// injectable for tests.
EligibilityResult evaluateEligibility(
  QuizAnswers a, {
  required List<CatalogUniversity> catalog,
  EligibilityRules rules = const EligibilityRules(),
  DateTime? now,
}) {
  final today = now ?? DateTime.now();
  final route = a.route ?? StudyRoute.bachelor;
  final korean = a.korean ?? KoreanLevel.unknown;
  final ielts = (a.english ?? EnglishLevel.none).ielts;
  final topikNeed = rules.topikMin(route);
  final kdb = rules.kdbUsd(route);
  final factors = <EligibilityFactor>[];
  var score = rules.baseScore;
  var cap = EligibilityBand.high;
  var unknowns = 0;

  void plus(FactorKind k) => factors.add(EligibilityFactor(k, positive: true));
  void minus(FactorKind k) => factors.add(EligibilityFactor(k, positive: false));
  void capAt(EligibilityBand b) => cap = cap.atMost(b);

  // Universities that fit: the route's degree, the Korean level or the IELTS
  // score, active ones, none the embassy restricts.
  final degree = route.catalogDegree;
  final userTopik = korean == KoreanLevel.unknown ? 6 : korean.topik;
  final englishScoreOk = route.isDegree && ielts >= rules.englishIeltsMin;
  final matches = <MatchedUniversity>[];
  if (degree != null) {
    for (final u in catalog) {
      final g = u.forDegree(degree);
      if (g == null || g.isActive == false || g.visaRestricted == true) continue;
      final need = g.topikMin?.toInt();
      final viaKorean = g.koreanTrack != false && (need == null || need <= userTopik);
      final viaEnglish =
          g.englishTrack == true && englishScoreOk && (g.ieltsMin == null || g.ieltsMin! <= ielts);
      if (!viaKorean && !viaEnglish) continue;
      final perSemester = rules.toUsd(g.tuitionMin, g.currency);
      final own = rules.toUsd(g.bankAmount, g.bankCurrency);
      final deposit = g.inCapitalArea ? kdb.$2 : kdb.$1;
      matches.add(
        MatchedUniversity(
          university: u,
          guideline: g,
          accredited: g.ieqasStatus == 'accredited' || g.ieqasStatus == 'outstanding',
          partner: g.isPartner == true,
          viaEnglish: viaEnglish && !viaKorean,
          tuitionPerSemesterUsd: perSemester == null
              ? null
              : (g.tuitionPeriod == 'yil' ? (perSemester / 2).round() : perSemester),
          topikMin: viaKorean ? need : null,
          bankStatementUsd: own == null || own < deposit ? deposit : own,
        ),
      );
    }
    matches.sort((x, y) {
      if (x.partner != y.partner) return x.partner ? -1 : 1;
      if (x.accredited != y.accredited) return x.accredited ? -1 : 1;
      final cx = x.tuitionPerSemesterUsd ?? 1 << 30;
      final cy = y.tuitionPerSemesterUsd ?? 1 << 30;
      return cx.compareTo(cy);
    });
  }

  // 1. Language. Korean at the route's level, or — bachelor's and master's —
  // the IELTS score (a bachelor's also needs an English-taught programme in
  // the catalogue that accepts it).
  final koreanOk = korean != KoreanLevel.unknown && korean.topik >= topikNeed;
  final englishOk =
      englishScoreOk &&
      (route == StudyRoute.master ||
          matches.any(
            (m) =>
                m.viaEnglish ||
                m.guideline.englishTrack == true &&
                    (m.guideline.ieltsMin == null || m.guideline.ieltsMin! <= ielts),
          ));
  final _Check language;
  if (koreanOk) {
    language = _Check.met;
    plus(switch (route) {
      StudyRoute.languageCourse => FactorKind.koreanCourseCertificate,
      StudyRoute.college =>
        korean.topik > topikNeed ? FactorKind.koreanCollegeStrong : FactorKind.koreanCollegeTopik2,
      StudyRoute.bachelor => FactorKind.koreanStrong,
      StudyRoute.master => FactorKind.koreanMasterStrong,
    });
  } else if (englishOk) {
    language = _Check.met;
    if (korean == KoreanLevel.unknown) unknowns++;
    plus(FactorKind.englishStrong);
  } else if (korean == KoreanLevel.unknown) {
    language = _Check.unknown;
    unknowns++;
  } else {
    language = _Check.missing;
    minus(switch (route) {
      StudyRoute.languageCourse => FactorKind.koreanCourseMissing,
      StudyRoute.college => FactorKind.koreanCollegeMissing,
      StudyRoute.bachelor =>
        korean.topik == topikNeed - 1
            ? FactorKind.koreanTopik2Degree
            : FactorKind.koreanMissingDegree,
      StudyRoute.master =>
        korean.topik == topikNeed - 1
            ? FactorKind.koreanTopik3Master
            : FactorKind.koreanMissingMaster,
    });
  }
  switch (language) {
    case _Check.met:
      score += rules.languageOkBonus;
    case _Check.unknown:
      score += rules.languageUnknownBonus;
      capAt(EligibilityBand.mid);
    case _Check.partial:
    case _Check.missing:
      capAt(rules.languageMissingCap);
  }

  // 2. Money: the KDB deposit and the parents' formal income, both required.
  // The embassy asks for these, not for a budget.
  final income = a.formalIncome;
  final deposit = a.kdb ?? KdbDeposit.unknown;
  if (income == true) {
    plus(FactorKind.incomeYes);
  } else if (income == false) {
    minus(FactorKind.incomeNo);
  }
  switch (deposit) {
    case KdbDeposit.ready:
      plus(FactorKind.kdbReady);
    case KdbDeposit.byIntake:
      minus(FactorKind.kdbByIntake);
    case KdbDeposit.no:
      minus(FactorKind.kdbNo);
    case KdbDeposit.unknown:
      unknowns++;
  }
  final money = switch (deposit) {
    KdbDeposit.no => _Check.missing,
    KdbDeposit.byIntake => _Check.partial,
    KdbDeposit.ready => income == false ? _Check.partial : _Check.met,
    KdbDeposit.unknown => income == false ? _Check.partial : _Check.unknown,
  };
  switch (money) {
    case _Check.met:
      score += rules.moneyOkBonus;
    case _Check.unknown:
      score += rules.moneyUnknownBonus;
      capAt(EligibilityBand.mid);
    case _Check.partial:
      capAt(rules.moneyPartialCap);
    case _Check.missing:
      capAt(rules.moneyMissingCap);
  }

  // 3. Soft points: age and the gap since school.
  final age = a.age;
  final gap = a.stillStudying || a.gradYear == null ? 0 : today.year - a.gradYear!;
  if (route == StudyRoute.languageCourse) {
    if (gap > rules.courseGapYearsMax) {
      score -= rules.softPenalty;
      minus(FactorKind.gradGapLong);
    }
    if (age != null && age > rules.courseAgeSoftMax) {
      score -= rules.softPenalty;
      minus(FactorKind.ageHigh);
    }
  } else if (route == StudyRoute.bachelor && age != null && age > rules.bachelorAgeSoftMax) {
    score -= rules.softPenalty;
    minus(FactorKind.ageHigh);
  }
  if ((a.stillStudying || (a.gradYear != null && gap <= 1)) &&
      !factors.any((f) => f.kind == FactorKind.gradGapLong)) {
    plus(FactorKind.gradRecent);
  }

  // The universities shown: Korean-taught ones only when the Korean level
  // meets the route; English-taught ones on the IELTS score.
  final fitting = koreanOk || language == _Check.unknown
      ? matches
      : matches.where((m) => m.viaEnglish).toList();
  final shown = fitting.take(rules.maxUniversities).toList();

  // Yearly cost: two semesters of tuition, a year of living where the
  // university is (Seoul area or elsewhere) and the application fee.
  (int, int)? yearly;
  final priced = shown.where((m) => m.tuitionPerSemesterUsd != null).toList();
  if (priced.isNotEmpty) {
    int cost(MatchedUniversity m, bool high) {
      final living = m.guideline.inCapitalArea
          ? rules.livingSeoulMonthUsd
          : rules.livingRegionMonthUsd;
      return m.tuitionPerSemesterUsd! * 2 +
          (high ? living.$2 : living.$1) * 12 +
          rules.applicationFeeUsd;
    }

    final lo = priced.map((m) => cost(m, false)).reduce((p, q) => p < q ? p : q);
    final hi = priced.map((m) => cost(m, true)).reduce((p, q) => p > q ? p : q);
    yearly = (_round100(lo), _round100(hi));
  }
  final banks = shown.map((m) => m.bankStatementUsd).whereType<int>().toList();
  final bankUsd = banks.isEmpty ? null : banks.reduce((p, q) => p > q ? p : q);

  final band = EligibilityBand.fromScore(score, rules).atMost(cap);
  // What still stands in the way: a check not met, or not known yet (a low
  // band with "Hali bilmayman" answers still needs that one settled).
  final languageLow = language == _Check.missing || language == _Check.unknown;
  final moneyLow = money != _Check.met;
  final lowReason = band != EligibilityBand.low
      ? null
      : languageLow && moneyLow
      ? LowReason.both
      : languageLow
      ? LowReason.language
      : LowReason.money;

  // Next three steps.
  final steps = <NextStep>[
    if (language == _Check.missing || language == _Check.unknown) NextStep.languagePrep,
    if (deposit != KdbDeposit.ready) NextStep.deposit,
    if (income == false) NextStep.parentsDocs,
    route == StudyRoute.master ? NextStep.diplomaDocs : NextStep.schoolDocs,
    NextStep.applyOnTime,
  ].take(3).toList();

  // The ways forward for a low band: what fits the route and the reason.
  final paths = <AlternativePath>[
    if (languageLow) ...[
      if (route != StudyRoute.languageCourse) AlternativePath.languageCourse,
      if (route == StudyRoute.bachelor && korean.topik >= rules.collegeTopikMin)
        AlternativePath.college,
      if (route.isDegree && ielts < rules.englishIeltsMin) AlternativePath.englishTrack,
      AlternativePath.nextSeason,
    ],
    if (moneyLow) ...[
      if (deposit != KdbDeposit.ready) AlternativePath.deposit,
      if (income == false) AlternativePath.parentsDocs,
    ],
  ];

  // Tariff. The deposit answer stands for what the family can put in: the
  // money there but no income papers → NO RISK; no deposit → Standart.
  final financeWeak = income == false;
  final hasMoney = deposit == KdbDeposit.ready || deposit == KdbDeposit.byIntake;
  final Tariff tariff;
  if (band == EligibilityBand.low && korean.topik <= 1 && !englishOk) {
    tariff = Tariff.hanbox;
  } else if (financeWeak && hasMoney) {
    tariff = Tariff.noRisk;
  } else if (route.isDegree && (korean.topik >= 2 || englishOk) && !financeWeak) {
    tariff = Tariff.premium;
  } else if (deposit == KdbDeposit.no) {
    tariff = Tariff.standart;
  } else {
    tariff = Tariff.premium;
  }

  if (a.korean == null) unknowns++;
  if (a.formalIncome == null) unknowns++;

  return EligibilityResult(
    band: band,
    score: score,
    factors: factors,
    lowReason: lowReason,
    // A low band shows the ways forward instead of universities, except the
    // English-taught programmes the applicant's IELTS already meets.
    universities: band == EligibilityBand.low
        ? matches.where((m) => m.viaEnglish).take(rules.maxUniversities).toList()
        : shown,
    yearlyCostUsd: band == EligibilityBand.low ? null : yearly,
    bankStatementUsd: band == EligibilityBand.low ? null : bankUsd,
    steps: steps,
    paths: band == EligibilityBand.low ? paths : const [],
    tariff: tariff,
    needsOperator: unknowns >= 2,
    topikNeed: topikNeed,
    depositUsd: kdb,
    depositHoldMonths: rules.kdbHoldMonths(route),
  );
}

int _round100(int x) => ((x + 50) ~/ 100) * 100;

import 'package:flutter/foundation.dart';

import '../../catalog/domain/catalog_models.dart';
import 'quiz_answers.dart';

/// "Viza imkoniyatim": from the six answers to a band (high / mid / low), the
/// reasons, matching universities, a yearly cost, three next steps and one
/// recommended tariff (app spec, section 5).
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
  englishStrong,
  koreanTopik2Degree,
  koreanMissingDegree,
  koreanCollegeStrong,
  koreanCollegeTopik2,
  koreanCourseCertificate,
  koreanCourseMissing,
  incomeYes,
  incomeNo,
  gradRecent,
  gradGapLong,
  ageHigh,
  budgetLow,
}

@immutable
class EligibilityFactor {
  const EligibilityFactor(this.kind, {required this.positive});

  final FactorKind kind;
  final bool positive;
}

/// One of the three "Keyingi 3 qadam".
enum NextStep { topikPrep, schoolDocs, diplomaDocs, applyOnTime }

/// The "Sizga mos yo'llar" shown instead of universities for a low band.
enum AlternativePath { languageCourse, college, nextSeason }

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
    this.yearlyCostUsd,
    this.bankStatementUsd,
  });

  final EligibilityBand band;
  final num score;
  final List<EligibilityFactor> factors;
  final List<MatchedUniversity> universities;

  /// Low and high end of the yearly cost estimate, in dollars.
  final (int, int)? yearlyCostUsd;
  final int? bankStatementUsd;
  final List<NextStep> steps;
  final List<AlternativePath> paths;
  final Tariff tariff;

  /// Two or more "Hali bilmayman" answers: the operator has to clarify.
  final bool needsOperator;
}

/// The numbers behind the result. See `eligibility_rules`.
@immutable
class EligibilityRules {
  const EligibilityRules({
    this.baseScore = 2,
    this.bandHighMin = 4,
    this.bandMidMin = 2,
    this.degreeTopikOkBonus = 2,
    this.masterIeltsMin = 5.5,
    this.degreeTopik2Cap = EligibilityBand.mid,
    this.degreeNoCertCap = EligibilityBand.low,
    this.collegeTopik3Bonus = 2,
    this.collegeTopik2Bonus = 1,
    this.courseCertBonus = 1,
    this.financeBothOkBonus = 2,
    this.financeNoIncomeCap = EligibilityBand.mid,
    this.courseGapYearsMax = 3,
    this.courseAgeSoftMax = 30,
    this.bachelorAgeSoftMax = 30,
    this.budgetPenalty = 1,
    this.krwPerUsd = 1400,
    this.livingSeoulMonthUsd = (900, 1100),
    this.livingRegionMonthUsd = (450, 750),
    this.applicationFeeUsd = 70,
    this.maxUniversities = 3,
  });

  final num baseScore;
  final num bandHighMin;
  final num bandMidMin;
  final num degreeTopikOkBonus;

  /// Master's: this IELTS counts as the Korean requirement met (TOPIK 3+),
  /// and English-taught programmes asking no more than the score are offered.
  final num masterIeltsMin;
  final EligibilityBand degreeTopik2Cap;
  final EligibilityBand degreeNoCertCap;
  final num collegeTopik3Bonus;
  final num collegeTopik2Bonus;
  final num courseCertBonus;
  final num financeBothOkBonus;
  final EligibilityBand financeNoIncomeCap;
  final int courseGapYearsMax;
  final int courseAgeSoftMax;
  final int bachelorAgeSoftMax;
  final num budgetPenalty;
  final num krwPerUsd;
  final (int, int) livingSeoulMonthUsd;
  final (int, int) livingRegionMonthUsd;
  final int applicationFeeUsd;
  final int maxUniversities;

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
      degreeTopikOkBonus: n('d2_topik_ok_bonus', d.degreeTopikOkBonus),
      masterIeltsMin: n('d2_master_ielts_min', d.masterIeltsMin),
      degreeTopik2Cap: band('d2_topik2_cap', d.degreeTopik2Cap),
      degreeNoCertCap: band('d2_no_cert_cap', d.degreeNoCertCap),
      collegeTopik3Bonus: n('voc_topik3_bonus', d.collegeTopik3Bonus),
      collegeTopik2Bonus: n('voc_topik2_bonus', d.collegeTopik2Bonus),
      courseCertBonus: n('d4_cert_bonus', d.courseCertBonus),
      financeBothOkBonus: n('fin_both_ok_bonus', d.financeBothOkBonus),
      financeNoIncomeCap: band('fin_no_income_cap', d.financeNoIncomeCap),
      courseGapYearsMax: n('d4_gap_years_max', d.courseGapYearsMax).toInt(),
      courseAgeSoftMax: n('d4_age_soft_max', d.courseAgeSoftMax).toInt(),
      bachelorAgeSoftMax: n('d2_bachelor_age_soft_max', d.bachelorAgeSoftMax).toInt(),
      budgetPenalty: n('budget_penalty', d.budgetPenalty),
      krwPerUsd: n('krw_per_usd', d.krwPerUsd),
      livingSeoulMonthUsd: range('living_seoul_month_usd', d.livingSeoulMonthUsd),
      livingRegionMonthUsd: range('living_region_month_usd', d.livingRegionMonthUsd),
      applicationFeeUsd: n('app_fee_usd', d.applicationFeeUsd).toInt(),
      maxUniversities: n('max_universities', d.maxUniversities).toInt(),
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
  final factors = <EligibilityFactor>[];
  var score = rules.baseScore;
  var cap = EligibilityBand.high;
  var unknowns = 0;

  void plus(FactorKind k) => factors.add(EligibilityFactor(k, positive: true));
  void minus(FactorKind k) => factors.add(EligibilityFactor(k, positive: false));
  void capAt(EligibilityBand b) => cap = cap.atMost(b);

  // English: a master's applicant with IELTS meets the language requirement.
  final ielts = (a.english ?? EnglishLevel.none).ielts;
  final englishOk = route == StudyRoute.master && ielts >= rules.masterIeltsMin;

  // Korean.
  if (englishOk && korean.topik < 3) {
    if (korean == KoreanLevel.unknown) unknowns++;
    score += rules.degreeTopikOkBonus;
    plus(FactorKind.englishStrong);
  } else if (korean == KoreanLevel.unknown) {
    unknowns++;
  } else if (route.isDegree) {
    if (korean.topik >= 3) {
      score += rules.degreeTopikOkBonus;
      plus(FactorKind.koreanStrong);
    } else if (korean.topik == 2) {
      capAt(rules.degreeTopik2Cap);
      minus(FactorKind.koreanTopik2Degree);
    } else {
      capAt(rules.degreeNoCertCap);
      minus(FactorKind.koreanMissingDegree);
    }
  } else if (route == StudyRoute.college) {
    if (korean.topik >= 3) {
      score += rules.collegeTopik3Bonus;
      plus(FactorKind.koreanCollegeStrong);
    } else if (korean.topik == 2) {
      score += rules.collegeTopik2Bonus;
      plus(FactorKind.koreanCollegeTopik2);
    } else {
      minus(FactorKind.koreanCourseMissing);
    }
  } else {
    // Language course (D-4).
    if (korean.topik >= 1) {
      score += rules.courseCertBonus;
      plus(FactorKind.koreanCourseCertificate);
    } else {
      minus(FactorKind.koreanCourseMissing);
    }
  }

  // Money: the parents' formal income (the bank statement is no longer asked).
  final income = a.formalIncome;
  if (income == true) {
    score += rules.financeBothOkBonus;
    plus(FactorKind.incomeYes);
  } else if (income == false) {
    capAt(rules.financeNoIncomeCap);
    minus(FactorKind.incomeNo);
  }

  // Age and the gap since school.
  final age = a.age;
  final gap = a.stillStudying || a.gradYear == null ? 0 : today.year - a.gradYear!;
  if (route == StudyRoute.languageCourse) {
    if (gap > rules.courseGapYearsMax) {
      score -= 1;
      minus(FactorKind.gradGapLong);
    }
    if (age != null && age > rules.courseAgeSoftMax) {
      score -= 1;
      minus(FactorKind.ageHigh);
    }
  } else if (route == StudyRoute.bachelor && age != null && age > rules.bachelorAgeSoftMax) {
    score -= 1;
    minus(FactorKind.ageHigh);
  }
  if ((a.stillStudying || (a.gradYear != null && gap <= 1)) &&
      !factors.any((f) => f.kind == FactorKind.gradGapLong)) {
    plus(FactorKind.gradRecent);
  }

  // Universities that fit: the route's degree, the Korean level, active ones.
  final degree = route.catalogDegree;
  final userTopik = korean == KoreanLevel.unknown ? 6 : korean.topik;
  final city = (a.region ?? '').toLowerCase();
  final matches = <MatchedUniversity>[];
  if (degree != null) {
    for (final u in catalog) {
      final g = u.forDegree(degree);
      if (g == null || g.isActive == false) continue;
      final need = g.topikMin?.toInt();
      final viaKorean = g.koreanTrack != false && (need == null || need <= userTopik);
      // English-taught programmes: a master's applicant who meets the IELTS
      // rule, or a bachelor's applicant whose IELTS meets the programme's own
      // requirement (the bachelor's band does not change with IELTS).
      final viaEnglish = g.englishTrack == true &&
          ielts > 0 &&
          switch (route) {
            StudyRoute.master => englishOk && (g.ieltsMin == null || g.ieltsMin! <= ielts),
            StudyRoute.bachelor => ielts >= (g.ieltsMin ?? rules.masterIeltsMin),
            _ => false,
          };
      if (!viaKorean && !viaEnglish) continue;
      final perSemester = rules.toUsd(g.tuitionMin, g.currency);
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
          bankStatementUsd: rules.toUsd(g.bankAmount, g.bankCurrency),
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
  final shown = matches.take(rules.maxUniversities).toList();

  // Yearly cost: two semesters of the shown universities' tuition, a year of
  // living and the application fee.
  (int, int)? yearly;
  final tuitions = shown.map((m) => m.tuitionPerSemesterUsd).whereType<int>().toList();
  if (tuitions.isNotEmpty) {
    final living = city.contains('seoul') || city.contains('seul')
        ? rules.livingSeoulMonthUsd
        : rules.livingRegionMonthUsd;
    final lo = tuitions.reduce((p, q) => p < q ? p : q) * 2 + living.$1 * 12 + rules.applicationFeeUsd;
    final hi = tuitions.reduce((p, q) => p > q ? p : q) * 2 + living.$2 * 12 + rules.applicationFeeUsd;
    yearly = (_round100(lo), _round100(hi));

    final budgetMax = a.budget?.maxUsd;
    if (budgetMax != null && budgetMax < yearly.$1) {
      score -= rules.budgetPenalty;
      minus(FactorKind.budgetLow);
    }
  }
  final banks = shown.map((m) => m.bankStatementUsd).whereType<int>().toList();
  final bankUsd = banks.isEmpty ? null : banks.reduce((p, q) => p > q ? p : q);

  final band = EligibilityBand.fromScore(score, rules).atMost(cap);

  // Next three steps.
  final steps = <NextStep>[
    if ((route.isDegree && korean.topik < 3 && !englishOk) ||
        (route == StudyRoute.college && korean.topik < 2))
      NextStep.topikPrep,
    route == StudyRoute.master ? NextStep.diplomaDocs : NextStep.schoolDocs,
    NextStep.applyOnTime,
  ].take(3).toList();

  // Tariff.
  final financeWeak = income == false;
  final budgetMin = a.budget?.minUsd ?? 0;
  final Tariff tariff;
  if (band == EligibilityBand.low && korean.topik <= 1 && !englishOk) {
    tariff = Tariff.hanbox;
  } else if (financeWeak && budgetMin >= 6000) {
    tariff = Tariff.noRisk;
  } else if (route.isDegree && (korean.topik >= 2 || englishOk) && !financeWeak) {
    tariff = Tariff.premium;
  } else if (a.budget == Budget.under3k) {
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
    // A low band shows the ways forward instead of universities, except the
    // English-taught programmes the applicant's IELTS already meets.
    universities: band == EligibilityBand.low
        ? matches.where((m) => m.viaEnglish).take(rules.maxUniversities).toList()
        : shown,
    yearlyCostUsd: band == EligibilityBand.low ? null : yearly,
    bankStatementUsd: band == EligibilityBand.low ? null : bankUsd,
    steps: steps,
    paths: band == EligibilityBand.low
        ? const [AlternativePath.languageCourse, AlternativePath.college, AlternativePath.nextSeason]
        : const [],
    tariff: tariff,
    needsOperator: unknowns >= 2,
  );
}

int _round100(int x) => ((x + 50) ~/ 100) * 100;

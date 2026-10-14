import 'package:flutter/foundation.dart';

import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../../onboarding/domain/quiz_answers.dart';

/// "Koreaga keta olamanmi o'zi?" (design screens 11–12): the answers on the
/// assessment board.
@immutable
class AssessmentInput {
  const AssessmentInput({
    this.topik = 0,
    this.gpa = 4.0,
    this.bankKrw = 0,
    this.route = StudyRoute.bachelor,
    this.visaRefused = false,
    this.universityIds = const [],
  });

  /// The TOPIK level the student has; 0 for none ("—").
  final int topik;

  /// The school certificate's average, on the five-point scale.
  final double gpa;

  /// What is in the bank for the D-2 visa, in won.
  final int bankKrw;

  /// Bakalavr, Magistr or Til kursi.
  final StudyRoute route;
  final bool visaRefused;

  /// The universities the student is weighing, in the order shown.
  final List<String> universityIds;

  AssessmentInput copyWith({
    int? topik,
    double? gpa,
    int? bankKrw,
    StudyRoute? route,
    bool? visaRefused,
    List<String>? universityIds,
  }) => AssessmentInput(
    topik: topik ?? this.topik,
    gpa: gpa ?? this.gpa,
    bankKrw: bankKrw ?? this.bankKrw,
    route: route ?? this.route,
    visaRefused: visaRefused ?? this.visaRefused,
    universityIds: universityIds ?? this.universityIds,
  );

  /// The answers as the CRM's lead card reads them (`leads.quiz_answers`):
  /// the old quiz's codes where they mean the same, and the board's own.
  Map<String, dynamic> toAnswers({required int requiredBankKrw}) => {
    'source': 'assessment_v1',
    'route': route.code,
    'korean': koreanLevel.code,
    'kdb': kdbDeposit(requiredBankKrw).code,
    'gpa': gpa,
    'bank_krw': bankKrw,
    'visa_refused': visaRefused,
    'universities': universityIds,
  };

  KoreanLevel get koreanLevel => switch (topik) {
    <= 0 => KoreanLevel.none,
    1 => KoreanLevel.topik1,
    2 => KoreanLevel.topik2,
    3 => KoreanLevel.topik3,
    _ => KoreanLevel.topik4plus,
  };

  /// The bank against the KDB deposit the route needs: enough, some, none.
  KdbDeposit kdbDeposit(int requiredKrw) => bankKrw >= requiredKrw
      ? KdbDeposit.ready
      : bankKrw > 0
      ? KdbDeposit.byIntake
      : KdbDeposit.no;
}

/// One university on the board with its admission chance.
@immutable
class AdmissionChance {
  const AdmissionChance({required this.university, required this.guideline, required this.percent});

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final int percent;

  /// "Ochiq" in the report: a chance worth applying with.
  bool get open => percent >= kOpenPercent;
}

/// One row of "Nima qilish kerak" with what it would add.
@immutable
class AssessmentFix {
  const AssessmentFix.bank(this.value, this.gain) : kind = FixKind.bank;
  const AssessmentFix.topik(this.value, this.gain) : kind = FixKind.topik;

  final FixKind kind;

  /// The bank in won, or the TOPIK level to reach.
  final int value;

  /// Percentage points: on the visa for [FixKind.bank], on admission (the
  /// average over the universities) for [FixKind.topik].
  final int gain;
}

enum FixKind { bank, topik }

@immutable
class AssessmentOutcome {
  const AssessmentOutcome({
    required this.band,
    required this.visaPercent,
    required this.requiredBankKrw,
    required this.chances,
    required this.fixes,
  });

  /// "HA" / "BALKI" / "HOZIRCHA YO'Q", from the same rules as the old quiz.
  final EligibilityBand band;
  final int visaPercent;

  /// The KDB deposit the embassy asks for on this route, in won.
  final int requiredBankKrw;
  final List<AdmissionChance> chances;
  final List<AssessmentFix> fixes;

  int get openCount => chances.where((c) => c.open).length;

  /// `leads.eligibility_result`: the band the CRM sorts by, and the figures.
  Map<String, dynamic> toResult() => {
    'source': 'assessment_v1',
    'band': band.code,
    'visa_pct': visaPercent,
    'required_bank_krw': requiredBankKrw,
    'universities': [
      for (final c in chances)
        {'id': c.university.institutionId, 'name': c.university.displayName, 'pct': c.percent},
    ],
    'fixes': [for (final f in fixes) {'kind': f.kind.name, 'value': f.value, 'gain': f.gain}],
  };
}

/// An admission chance at or above this counts as open.
const int kOpenPercent = 60;

/// The meter's five segments and their word, as the design draws them
/// (`seg()`): below 25 Past, 45 O'rta, 65 Yaxshi, 82 Yuqori, then Juda yuqori.
int segmentsOf(int percent) => percent < 25
    ? 1
    : percent < 45
    ? 2
    : percent < 65
    ? 3
    : percent < 82
    ? 4
    : 5;

/// Computes the board.
///
/// The visa side is the old quiz's embassy check ([evaluateEligibility]):
/// the TOPIK level the route needs and the KDB deposit, with a prior refusal
/// counted as one more soft point. Its band is turned into a percentage on a
/// fixed scale — low 15–39, mid 40–64, high 65–85 — by where the score sits.
///
/// Admission is per university, from its own TOPIK requirement (the route's
/// when the Excel gives none) against the student's level — short by two or
/// more 15, by one 30, met 55, one above 68, two above 78 — moved by the
/// certificate (±10 per point from 3.5, at most ±15) and +5 for an official
/// partner, kept within 5–95.
AssessmentOutcome assess(
  AssessmentInput input, {
  required List<CatalogUniversity> catalog,
  EligibilityRules rules = const EligibilityRules(),
  DateTime? now,
}) {
  final byId = {for (final u in catalog) u.institutionId: u};
  final chosen = [for (final id in input.universityIds) ?byId[id]];
  final degree = input.route.catalogDegree;

  final requiredKrw = requiredBank(input.route, chosen, rules: rules);
  final visa = _visa(input, catalog: catalog, rules: rules, now: now, requiredKrw: requiredKrw);

  List<AdmissionChance> chancesFor(AssessmentInput i) => [
    for (final u in chosen)
      if ((degree == null ? u.primary : u.forDegree(degree) ?? u.primary) case final g)
        AdmissionChance(university: u, guideline: g, percent: admissionPercent(i, g, rules: rules)),
  ];

  final chances = chancesFor(input);
  final fixes = <AssessmentFix>[];
  if (input.bankKrw < requiredKrw) {
    final better = _visa(
      input.copyWith(bankKrw: requiredKrw),
      catalog: catalog,
      rules: rules,
      now: now,
      requiredKrw: requiredKrw,
    );
    final gain = better.$2 - visa.$2;
    if (gain > 0) fixes.add(AssessmentFix.bank(requiredKrw, gain));
  }
  if (input.topik < 6 && chances.isNotEmpty) {
    final next = input.topik + 1;
    final up = chancesFor(input.copyWith(topik: next));
    final now0 = chances.fold<int>(0, (s, c) => s + c.percent) / chances.length;
    final now1 = up.fold<int>(0, (s, c) => s + c.percent) / up.length;
    final gain = (now1 - now0).round();
    if (gain > 0) fixes.add(AssessmentFix.topik(next, gain));
  }

  return AssessmentOutcome(
    band: visa.$1,
    visaPercent: visa.$2,
    requiredBankKrw: requiredKrw,
    chances: chances,
    fixes: fixes,
  );
}

/// The KDB deposit for [route] in won: the capital area's figure when any of
/// the universities is there.
int requiredBank(StudyRoute route, List<CatalogUniversity> universities, {EligibilityRules rules = const EligibilityRules()}) {
  final kdb = rules.kdbUsd(route);
  final capital = universities.any((u) => u.primary.inCapitalArea);
  return ((capital ? kdb.$2 : kdb.$1) * rules.krwPerUsd).round();
}

(EligibilityBand, int) _visa(
  AssessmentInput input, {
  required List<CatalogUniversity> catalog,
  required EligibilityRules rules,
  required int requiredKrw,
  DateTime? now,
}) {
  final answers = QuizAnswers(
    route: input.route,
    korean: input.koreanLevel,
    english: EnglishLevel.none,
    kdb: input.kdbDeposit(requiredKrw),
  );
  final r = evaluateEligibility(answers, catalog: catalog, rules: rules, now: now);
  var score = r.score;
  var band = r.band;
  if (input.visaRefused) {
    score -= rules.softPenalty;
    band = band.atMost(EligibilityBand.fromScore(score, rules));
  }
  // Where the score sits between the band's floor and the next one.
  final lo = switch (band) {
    EligibilityBand.high => rules.bandHighMin,
    EligibilityBand.mid => rules.bandMidMin,
    EligibilityBand.low => 0,
  };
  final hi = switch (band) {
    EligibilityBand.high => rules.bandHighMin + 2,
    EligibilityBand.mid => rules.bandHighMin,
    EligibilityBand.low => rules.bandMidMin,
  };
  final (pLo, pHi) = switch (band) {
    EligibilityBand.high => (65, 85),
    EligibilityBand.mid => (40, 64),
    EligibilityBand.low => (15, 39),
  };
  final t = hi <= lo ? 1.0 : ((score - lo) / (hi - lo)).clamp(0.0, 1.0);
  return (band, (pLo + (pHi - pLo) * t).round());
}

/// One university's admission chance (see [assess]).
int admissionPercent(AssessmentInput input, CatalogGuideline g, {EligibilityRules rules = const EligibilityRules()}) {
  final need = g.topikMin?.round() ?? rules.topikMin(input.route);
  final diff = input.topik - need;
  var p = diff <= -2
      ? 15
      : diff == -1
      ? 30
      : diff == 0
      ? 55
      : diff == 1
      ? 68
      : 78;
  p += ((input.gpa - 3.5) * 10).clamp(-15, 15).round();
  if (g.isPartner == true) p += 5;
  return p.clamp(5, 95);
}

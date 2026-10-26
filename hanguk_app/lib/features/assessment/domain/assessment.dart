import 'package:flutter/foundation.dart';

import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../../onboarding/domain/quiz_answers.dart';
import 'visa_model.dart';

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
    this.gapYears = 0,
    this.experience = 0,
    this.olympiad = 0,
    this.topikFresh = true,
    this.ielts = 0,
    this.motivation = 0,
    this.recommendation = false,
    this.portfolio = false,
    this.activity = 0,
    this.education = 0,
    this.age = 19,
    this.income = 0,
    this.incomeDocumented = false,
    this.sponsor = 0,
    this.relationDoc = false,
    this.incomeStability = 0,
    this.property = 0,
    this.car = 0,
    this.business = 0,
    this.koreaBefore = 0,
    this.illegalRelatives = false,
    this.legalRelatives = false,
    this.studyPlan = 0,
    this.interviewPrep = 0,
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

  // The university assessment's questions (design: Akademik, Til,
  // Hujjatlar to'plami); each default is the "Yo'q" answer.

  /// Years since graduating: 0, 1, 2, or 3 for three and more.
  final int gapYears;

  /// Experience in the chosen field: none, course/club, project, work.
  final int experience;

  /// Olympiad or contest results: none, school, national, international.
  final int olympiad;

  /// Whether the TOPIK certificate is under two years old: older ones are
  /// not accepted, so the level counts as none.
  final bool topikFresh;

  /// IELTS band; 0 for none.
  final double ielts;

  /// Motivation letter: none, draft, ready.
  final int motivation;
  final bool recommendation;
  final bool portfolio;

  /// Extra activity: none, volunteering, sport/art, leading an organisation.
  final int activity;

  // "Vizam chiqadimi?" (visa_model.dart); each default is the first answer.

  /// Last education: school, college/lyceum, bachelor, master.
  final int education;
  final int age;

  /// Parents' yearly income: under \$5k, \$5–10k, \$10–20k, \$20k and more.
  final int income;
  final bool incomeDocumented;

  /// Who pays: the student, the parents, another relative.
  final int sponsor;

  /// The kinship certificate, apostilled.
  final bool relationDoc;

  /// How long the income has been steady: under 6 months, 6–12 months,
  /// 1–3 years, 3 years and more.
  final int incomeStability;

  /// Property, cars: none, one, two and more. Business: none, sole
  /// trader (IP), company (MChJ).
  final int property;
  final int car;
  final int business;

  /// Been to Korea: no, yes and left on time, stayed past the visa.
  final int koreaBefore;
  final bool illegalRelatives;
  final bool legalRelatives;

  /// Study plan: none, draft, ready. Interview practice: none, on one's
  /// own, three or more times with Hanguk AI.
  final int studyPlan;
  final int interviewPrep;

  /// The TOPIK level the documents can show.
  int get topikCounted => topikFresh ? topik : 0;

  /// Each answer as the analytics record it (`question_answer`): the option
  /// picked where the question has options; for the figures a range, never
  /// the figure itself — the school average to the half point below, the age
  /// as the start of its range, the money in the bank as the 5 million won
  /// below it (30 for 30 million and more).
  Map<String, Object> answerBands() => {
    'route': route.name,
    'education': education,
    'gpa': (gpa * 2).floor() / 2,
    'gap_years': gapYears,
    'age': switch (age) {
      < 18 => 17,
      < 20 => 18,
      < 22 => 20,
      < 24 => 22,
      < 26 => 24,
      < 30 => 26,
      _ => 30,
    },
    'topik': topik,
    'topik_fresh': topikFresh,
    'ielts': ielts,
    'bank': (bankKrw ~/ 5000000 * 5).clamp(0, 30),
    'income': income,
    'income_documented': incomeDocumented,
    'sponsor': sponsor,
    'relation_doc': relationDoc,
    'income_stability': incomeStability,
    'property': property,
    'car': car,
    'business': business,
    'visa_refused': visaRefused,
    'korea_before': koreaBefore,
    'illegal_relatives': illegalRelatives,
    'legal_relatives': legalRelatives,
    'experience': experience,
    'olympiad': olympiad,
    'motivation': motivation,
    'recommendation': recommendation,
    'portfolio': portfolio,
    'activity': activity,
    'study_plan': studyPlan,
    'interview_prep': interviewPrep,
  };

  AssessmentInput copyWith({
    int? topik,
    double? gpa,
    int? bankKrw,
    StudyRoute? route,
    bool? visaRefused,
    List<String>? universityIds,
    int? gapYears,
    int? experience,
    int? olympiad,
    bool? topikFresh,
    double? ielts,
    int? motivation,
    bool? recommendation,
    bool? portfolio,
    int? activity,
    int? education,
    int? age,
    int? income,
    bool? incomeDocumented,
    int? sponsor,
    bool? relationDoc,
    int? incomeStability,
    int? property,
    int? car,
    int? business,
    int? koreaBefore,
    bool? illegalRelatives,
    bool? legalRelatives,
    int? studyPlan,
    int? interviewPrep,
  }) => AssessmentInput(
    topik: topik ?? this.topik,
    gpa: gpa ?? this.gpa,
    bankKrw: bankKrw ?? this.bankKrw,
    route: route ?? this.route,
    visaRefused: visaRefused ?? this.visaRefused,
    universityIds: universityIds ?? this.universityIds,
    gapYears: gapYears ?? this.gapYears,
    experience: experience ?? this.experience,
    olympiad: olympiad ?? this.olympiad,
    topikFresh: topikFresh ?? this.topikFresh,
    ielts: ielts ?? this.ielts,
    motivation: motivation ?? this.motivation,
    recommendation: recommendation ?? this.recommendation,
    portfolio: portfolio ?? this.portfolio,
    activity: activity ?? this.activity,
    education: education ?? this.education,
    age: age ?? this.age,
    income: income ?? this.income,
    incomeDocumented: incomeDocumented ?? this.incomeDocumented,
    sponsor: sponsor ?? this.sponsor,
    relationDoc: relationDoc ?? this.relationDoc,
    incomeStability: incomeStability ?? this.incomeStability,
    property: property ?? this.property,
    car: car ?? this.car,
    business: business ?? this.business,
    koreaBefore: koreaBefore ?? this.koreaBefore,
    illegalRelatives: illegalRelatives ?? this.illegalRelatives,
    legalRelatives: legalRelatives ?? this.legalRelatives,
    studyPlan: studyPlan ?? this.studyPlan,
    interviewPrep: interviewPrep ?? this.interviewPrep,
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
    'gap_years': gapYears,
    'experience': experience,
    'olympiad': olympiad,
    'topik_fresh': topikFresh,
    'ielts': ielts,
    'motivation': motivation,
    'recommendation': recommendation,
    'portfolio': portfolio,
    'activity': activity,
    'education': education,
    'age': age,
    'income': income,
    'income_documented': incomeDocumented,
    'sponsor': sponsor,
    'relation_doc': relationDoc,
    'income_stability': incomeStability,
    'property': property,
    'car': car,
    'business': business,
    'korea_before': koreaBefore,
    'illegal_relatives': illegalRelatives,
    'legal_relatives': legalRelatives,
    'study_plan': studyPlan,
    'interview_prep': interviewPrep,
  };

  KoreanLevel get koreanLevel => switch (topikCounted) {
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
    this.visaWithConsultantPercent,
    required this.requiredBankKrw,
    required this.chances,
    required this.fixes,
    this.hints,
  });

  /// "HA" / "BALKI" / "HOZIRCHA YO'Q", from the same rules as the old quiz.
  final EligibilityBand band;
  final int visaPercent;

  /// The visa chance with the papers a consultant puts in order.
  final int? visaWithConsultantPercent;

  /// The KDB deposit the embassy asks for on this route, in won.
  final int requiredBankKrw;
  final List<AdmissionChance> chances;
  final List<AssessmentFix> fixes;

  /// The tariff and the weak point the consultant sees on the lead's card,
  /// by the old quiz's rules ([visaHints]).
  final VisaHints? hints;

  int get openCount => chances.where((c) => c.open).length;

  /// `leads.eligibility_result`: the band the CRM sorts by, and the figures.
  Map<String, dynamic> toResult() => {
    'source': 'assessment_v1',
    'band': band.code,
    'visa_pct': visaPercent,
    'required_bank_krw': requiredBankKrw,
    'universities': [
      for (final c in chances) {'id': c.university.institutionId, 'name': c.university.displayName, 'pct': c.percent},
    ],
    'fixes': [
      for (final f in fixes) {'kind': f.kind.name, 'value': f.value, 'gain': f.gain},
    ],
    // `leads.tariff_interest` (app_quiz_submit reads 'tariff').
    if (hints case final h?) ...{'tariff': h.tariff.code, 'low': h.low},
  };
}

/// What the lead's card shows about the visa answers (the CRM's «Ilovada»
/// block, marketing plan of 2026-10-22): «Mos tarif» and the «past omil» of
/// «Viza testi», by the old «Viza imkoniyatim» quiz's rules — the owner's
/// choice of 2026-10-26 — so the same answers give the same tariff there and
/// here.
@immutable
class VisaHints {
  const VisaHints({required this.tariff, required this.low, required this.formalIncome});

  final Tariff tariff;

  /// The first thing the old rules count against the person, in their
  /// order: 'language', 'income', 'deposit', 'gap', 'age'; null for none.
  final String? low;

  /// Whether the parents' income is documented («rasmiy daromad»).
  final bool formalIncome;
}

/// [input] as the old quiz's answers, through [evaluateEligibility].
VisaHints visaHints(
  AssessmentInput input, {
  required List<CatalogUniversity> catalog,
  required int requiredBankKrw,
  EligibilityRules rules = const EligibilityRules(),
  DateTime? now,
}) {
  final today = now ?? DateTime.now();
  final ielts = input.ielts;
  final answers = QuizAnswers(
    route: input.route,
    age: input.age,
    gradYear: today.year - input.gapYears,
    korean: input.koreanLevel,
    english: ielts >= 6.5
        ? EnglishLevel.ielts65plus
        : ielts >= 6.0
        ? EnglishLevel.ielts60
        : ielts >= 5.5
        ? EnglishLevel.ielts55
        : EnglishLevel.none,
    formalIncome: input.incomeDocumented,
    kdb: input.kdbDeposit(requiredBankKrw),
  );
  final r = evaluateEligibility(answers, catalog: catalog, rules: rules, now: today);
  final weak = r.factors.where((f) => !f.positive).map((f) => _lowOf(f.kind)).firstOrNull;
  return VisaHints(tariff: r.tariff, low: weak, formalIncome: input.incomeDocumented);
}

String _lowOf(FactorKind k) => switch (k) {
  FactorKind.incomeNo => 'income',
  FactorKind.kdbByIntake || FactorKind.kdbNo => 'deposit',
  FactorKind.gradGapLong => 'gap',
  FactorKind.ageHigh => 'age',
  _ => 'language',
};

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
/// The visa side is [visaScore] ("Vizam chiqadimi?"), its band high from
/// 65 and mid from 40.
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
        AdmissionChance(
          university: u,
          guideline: g,
          percent: admissionPercent(i, g, rules: rules),
        ),
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
    visaWithConsultantPercent: visaWithConsultant(input, requiredBankKrw: requiredKrw),
    requiredBankKrw: requiredKrw,
    chances: chances,
    fixes: fixes,
    hints: visaHints(input, catalog: catalog, requiredBankKrw: requiredKrw, rules: rules, now: now),
  );
}

/// The KDB deposit for [route] in won: the capital area's figure when any of
/// the universities is there.
int requiredBank(
  StudyRoute route,
  List<CatalogUniversity> universities, {
  EligibilityRules rules = const EligibilityRules(),
}) {
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
  final p = visaScore(input, requiredBankKrw: requiredKrw);
  return (visaBandOf(p), p);
}

/// The band the CRM sorts by, from the visa chance.
EligibilityBand visaBandOf(int percent) => percent >= 65
    ? EligibilityBand.high
    : percent >= 40
    ? EligibilityBand.mid
    : EligibilityBand.low;

/// One university's admission chance (see [assess]), with what the
/// university assessment's answers add to the documents: experience,
/// contests, IELTS, the letter, recommendation, portfolio and activities
/// raise it, a gap of two years and more lowers it, and a TOPIK certificate
/// over two years old counts as none.
int admissionPercent(AssessmentInput input, CatalogGuideline g, {EligibilityRules rules = const EligibilityRules()}) {
  final need = g.topikMin?.round() ?? rules.topikMin(input.route);
  final diff = input.topikCounted - need;
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
  p += documentsBonus(input);
  return p.clamp(5, 95);
}

/// The points the documents' answers add (or take) on top of TOPIK and the
/// certificate.
int documentsBonus(AssessmentInput i) {
  var p = 0;
  p += switch (i.gapYears) {
    <= 1 => 0,
    2 => -3,
    _ => -6,
  };
  p += const [0, 2, 3, 4][i.experience.clamp(0, 3)];
  p += const [0, 2, 4, 6][i.olympiad.clamp(0, 3)];
  p += i.ielts >= 7
      ? 5
      : i.ielts >= 6.5
      ? 4
      : i.ielts >= 6
      ? 3
      : i.ielts >= 5.5
      ? 2
      : i.ielts >= 5
      ? 1
      : 0;
  p += const [0, 2, 4][i.motivation.clamp(0, 2)];
  if (i.recommendation) p += 2;
  if (i.portfolio) p += 2;
  p += const [0, 2, 2, 3][i.activity.clamp(0, 3)];
  return p;
}

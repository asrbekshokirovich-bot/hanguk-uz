import 'package:flutter/foundation.dart';

/// The six questions of "Viza imkoniyatim" (S02) and the answers to them.
///
/// Every answer has a stable code: it is what is stored on the lead
/// (`leads.quiz_answers`) and what `app_quiz_submit` maps onto the CRM's own
/// fields, so codes never change with the app language.

/// 1 — Which way to study.
enum StudyRoute {
  languageCourse('d4'),
  bachelor('bachelor'),
  master('master'),
  college('college');

  const StudyRoute(this.code);
  final String code;

  /// The catalogue's `daraja` for this route; null where the catalogue has no
  /// guidelines yet (language course, vocational college).
  String? get catalogDegree => switch (this) {
    StudyRoute.bachelor => 'bakalavr',
    StudyRoute.master => 'magistratura',
    _ => null,
  };

  /// A D-2 degree route (bachelor's or master's).
  bool get isDegree => this == StudyRoute.bachelor || this == StudyRoute.master;
}

/// 3 — Korean level.
enum KoreanLevel {
  none('none', 0),
  learning('learning', 0),
  topik1('topik1', 1),
  topik2('topik2', 2),
  topik3plus('topik3plus', 3),
  unknown('unknown', 0);

  const KoreanLevel(this.code, this.topik);
  final String code;

  /// The TOPIK level this answer stands for (0 = no certificate).
  final int topik;
}

/// 4 — Yearly budget, in US dollars.
enum Budget {
  under3k('lt3', 0, 3000, "\$3 000 gacha"),
  from3to6k('3to6', 3000, 6000, "\$3–6 ming"),
  from6to10k('6to10', 6000, 10000, "\$6–10 ming"),
  over10k('gt10', 10000, null, "\$10 000+");

  const Budget(this.code, this.minUsd, this.maxUsd, this.crmLabel);
  final String code;
  final int minUsd;

  /// Null for the open-ended top bracket.
  final int? maxUsd;

  /// What the CRM stores in `leads.budget_range` (stored values stay Uzbek).
  final String crmLabel;
}

/// 4 — Who pays.
enum Payer {
  parents('parents'),
  self('self'),
  sponsor('sponsor');

  const Payer(this.code);
  final String code;
}

/// 6 — When.
enum Intake {
  spring2027('2027_spring'),
  fall2027('2027_fall'),
  later('later');

  const Intake(this.code);
  final String code;
}

/// Regions offered in question 6. Stored values, kept as the CRM's intake form
/// lists them (`src/components/crm/leads/intake/options.ts`, CITIES).
const List<String> kQuizRegions = [
  'Toshkent',
  'Samarqand',
  'Buxoro',
  'Andijon',
  "Farg'ona",
  'Namangan',
  'Qarshi',
  'Nukus',
  'Urganch',
  'Jizzax',
  'Navoiy',
  'Termiz',
  'Guliston',
];

/// Number of questions in S02.
const int kQuizSteps = 6;

@immutable
class QuizAnswers {
  const QuizAnswers({
    this.route,
    this.age,
    this.gradYear,
    this.stillStudying = false,
    this.korean,
    this.budget,
    this.payer,
    this.formalIncome,
    this.bankStatement,
    this.region,
    this.intake,
  });

  final StudyRoute? route;
  final int? age;

  /// The year school (or the last degree) was finished.
  final int? gradYear;

  /// "Hali o'qiyapman" — still at school or university.
  final bool stillStudying;
  final KoreanLevel? korean;
  final Budget? budget;
  final Payer? payer;

  /// Parents have an official income.
  final bool? formalIncome;

  /// A bank statement can be provided.
  final bool? bankStatement;
  final String? region;
  final Intake? intake;

  /// Whether question [step] (1–6) has every answer it needs.
  bool isComplete(int step) => switch (step) {
    1 => route != null,
    2 => age != null && (gradYear != null || stillStudying),
    3 => korean != null,
    4 => budget != null && payer != null,
    5 => formalIncome != null && bankStatement != null,
    6 => region != null && intake != null,
    _ => false,
  };

  bool get isAllComplete => [for (var s = 1; s <= kQuizSteps; s++) isComplete(s)].every((x) => x);

  QuizAnswers copyWith({
    StudyRoute? route,
    int? age,
    int? gradYear,
    bool? stillStudying,
    KoreanLevel? korean,
    Budget? budget,
    Payer? payer,
    bool? formalIncome,
    bool? bankStatement,
    String? region,
    Intake? intake,
    bool clearGradYear = false,
  }) {
    return QuizAnswers(
      route: route ?? this.route,
      age: age ?? this.age,
      gradYear: clearGradYear ? null : (gradYear ?? this.gradYear),
      stillStudying: stillStudying ?? this.stillStudying,
      korean: korean ?? this.korean,
      budget: budget ?? this.budget,
      payer: payer ?? this.payer,
      formalIncome: formalIncome ?? this.formalIncome,
      bankStatement: bankStatement ?? this.bankStatement,
      region: region ?? this.region,
      intake: intake ?? this.intake,
    );
  }

  /// What goes to `leads.quiz_answers`.
  Map<String, dynamic> toJson() => {
    if (route != null) 'route': route!.code,
    if (age != null) 'age': '$age',
    if (gradYear != null) 'grad_year': '$gradYear',
    if (stillStudying) 'grad_year': 'studying',
    if (korean != null) 'korean': korean!.code,
    if (budget != null) 'budget': budget!.code,
    if (payer != null) 'payer': payer!.code,
    if (formalIncome != null) 'formal_income': formalIncome! ? 'yes' : 'no',
    if (bankStatement != null) 'bank_statement': bankStatement! ? 'yes' : 'no',
    if (region != null) 'region': region,
    if (intake != null) 'intake': intake!.code,
  };
}

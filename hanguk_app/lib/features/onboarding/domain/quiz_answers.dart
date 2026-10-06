import 'package:flutter/foundation.dart';

/// The questions of "Viza imkoniyatim" (S02), one per screen, and the
/// answers to them.
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

/// 4 — Korean level.
enum KoreanLevel {
  none('none', 0),
  learning('learning', 0),
  topik1('topik1', 1),
  topik2('topik2', 2),
  topik3('topik3', 3),
  topik4plus('topik4plus', 4),
  unknown('unknown', 0);

  const KoreanLevel(this.code, this.topik);
  final String code;

  /// The TOPIK level this answer stands for (0 = no certificate).
  final int topik;
}

/// 5 — English: the IELTS score.
enum EnglishLevel {
  none('none', 0),
  ielts55('ielts55', 5.5),
  ielts60('ielts60', 6.0),
  ielts65plus('ielts65plus', 6.5),
  unknown('unknown', 0);

  const EnglishLevel(this.code, this.ielts);
  final String code;

  /// The IELTS score this answer stands for (0 = none).
  final double ielts;
}

/// 6 — Who pays.
enum Payer {
  parents('parents'),
  self('self'),
  sponsor('sponsor');

  const Payer(this.code);
  final String code;
}

/// 8 — The deposit the embassy asks for: a KDB Bank Uzbekistan account in the
/// student's name, held for a set time before applying.
enum KdbDeposit {
  ready('ready'),
  byIntake('by_intake'),
  no('no'),
  unknown('unknown');

  const KdbDeposit(this.code);
  final String code;
}

/// 10 — When.
enum Intake {
  spring2027('2027_spring'),
  fall2027('2027_fall'),
  later('later');

  const Intake(this.code);
  final String code;
}

/// Regions offered in question 9. Stored values, kept as the CRM's intake form
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

/// Ages offered in question 2; the last one stands for "31+".
const List<int> kQuizAges = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];

/// Number of questions in S02.
const int kQuizSteps = 10;

@immutable
class QuizAnswers {
  const QuizAnswers({
    this.route,
    this.age,
    this.gradYear,
    this.stillStudying = false,
    this.korean,
    this.english,
    this.payer,
    this.formalIncome,
    this.kdb,
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
  final EnglishLevel? english;
  final Payer? payer;

  /// Parents have an official income.
  final bool? formalIncome;
  final KdbDeposit? kdb;
  final String? region;
  final Intake? intake;

  /// Whether question [step] (1–[kQuizSteps]) is answered.
  bool isComplete(int step) => switch (step) {
    1 => route != null,
    2 => age != null,
    3 => gradYear != null || stillStudying,
    4 => korean != null,
    5 => english != null,
    6 => payer != null,
    7 => formalIncome != null,
    8 => kdb != null,
    9 => region != null,
    10 => intake != null,
    _ => false,
  };

  bool get isAllComplete => [for (var s = 1; s <= kQuizSteps; s++) isComplete(s)].every((x) => x);

  QuizAnswers copyWith({
    StudyRoute? route,
    int? age,
    int? gradYear,
    bool? stillStudying,
    KoreanLevel? korean,
    EnglishLevel? english,
    Payer? payer,
    bool? formalIncome,
    KdbDeposit? kdb,
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
      english: english ?? this.english,
      payer: payer ?? this.payer,
      formalIncome: formalIncome ?? this.formalIncome,
      kdb: kdb ?? this.kdb,
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
    if (english != null) 'english': english!.code,
    if (payer != null) 'payer': payer!.code,
    if (formalIncome != null) 'formal_income': formalIncome! ? 'yes' : 'no',
    if (kdb != null) 'kdb': kdb!.code,
    if (region != null) 'region': region,
    if (intake != null) 'intake': intake!.code,
  };
}

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';

CatalogUniversity uni(
  String id, {
  String degree = 'bakalavr',
  num? topik,
  num? tuitionKrw,
  num? bankKrw,
  String? ieqas = 'accredited',
  bool? active = true,
  String? region,
  bool? restricted,
}) {
  return CatalogUniversity(
    institutionId: id,
    guidelines: [
      CatalogGuideline(
        id: 'g-$id',
        institutionId: id,
        univNameEn: '$id University',
        city: 'Daegu',
        degree: degree,
        koreanTrack: true,
        topikMin: topik,
        currency: 'KRW',
        tuitionMin: tuitionKrw,
        tuitionMax: tuitionKrw,
        tuitionPeriod: 'semestr',
        bankAmount: bankKrw,
        bankCurrency: 'KRW',
        ieqasStatus: ieqas,
        isActive: active,
        regionCode: region,
        visaRestricted: restricted,
      ),
    ],
  );
}

void main() {
  final now = DateTime(2026, 10, 5);
  final catalog = [
    uni('A', topik: 3, tuitionKrw: 2800000, bankKrw: 17500000),
    uni('B', topik: 2, tuitionKrw: 2380000, bankKrw: 14000000),
    uni('C', topik: 2, tuitionKrw: 2000000, ieqas: 'none'),
    uni('D', topik: 2, tuitionKrw: 1000000, active: false),
    uni('M', degree: 'magistratura', topik: 3, tuitionKrw: 4200000),
  ];

  CatalogUniversity english(String id, {String degree = 'bakalavr', num ielts = 5.5, bool partner = false}) =>
      CatalogUniversity(
        institutionId: id,
        guidelines: [
          CatalogGuideline(
            id: 'g-$id',
            institutionId: id,
            univNameEn: '$id University',
            city: 'Gyeongsan',
            degree: degree,
            koreanTrack: false,
            englishTrack: true,
            ieltsMin: ielts,
            currency: 'KRW',
            tuitionMin: 3500000,
            tuitionMax: 3500000,
            tuitionPeriod: 'semestr',
            ieqasStatus: 'accredited',
            isActive: true,
            isPartner: partner,
          ),
        ],
      );

  // Everything in order: the language, the deposit, the income, the budget.
  QuizAnswers answers({
    StudyRoute route = StudyRoute.bachelor,
    int age = 19,
    KoreanLevel korean = KoreanLevel.topik3,
    EnglishLevel englishLevel = EnglishLevel.none,
    Budget budget = Budget.over10k,
    bool income = true,
    KdbDeposit kdb = KdbDeposit.ready,
  }) => QuizAnswers(
    route: route,
    age: age,
    gradYear: 2026,
    korean: korean,
    english: englishLevel,
    budget: budget,
    payer: Payer.parents,
    formalIncome: income,
    kdb: kdb,
    region: "Farg'ona",
    intake: Intake.spring2027,
  );

  EligibilityResult run(QuizAnswers a, [List<CatalogUniversity>? c]) =>
      evaluateEligibility(a, catalog: c ?? catalog, now: now);

  List<FactorKind> minuses(EligibilityResult r) =>
      r.factors.where((f) => !f.positive).map((f) => f.kind).toList();

  group('language: the embassy level for the route', () {
    test('a bachelor with TOPIK 3, deposit and income is high', () {
      final r = run(answers());
      expect(r.band, EligibilityBand.high);
      expect(r.lowReason, isNull);
      expect(r.factors.map((f) => f.kind), containsAll([FactorKind.koreanStrong, FactorKind.incomeYes, FactorKind.kdbReady]));
      // Inactive one never suggested, accredited first, cheapest first.
      expect(r.universities.map((m) => m.university.institutionId), ['B', 'A', 'C']);
      expect(r.universities.first.tuitionPerSemesterUsd, 1700);
      expect(r.steps, isNot(contains(NextStep.topikPrep)));
      expect(r.paths, isEmpty);
    });

    test('a bachelor with TOPIK 2 is low: the embassy asks for TOPIK 3', () {
      final r = run(answers(korean: KoreanLevel.topik2));
      expect(r.band, EligibilityBand.low);
      expect(r.lowReason, LowReason.language);
      expect(minuses(r), contains(FactorKind.koreanTopik2Degree));
      expect(r.universities, isEmpty);
      expect(r.paths, hasLength(3));
      expect(r.steps.first, NextStep.topikPrep);
    });

    test('a master needs TOPIK 4: TOPIK 3 is low, TOPIK 4+ is high', () {
      final t3 = run(answers(route: StudyRoute.master, age: 24, korean: KoreanLevel.topik3));
      expect(t3.band, EligibilityBand.low);
      expect(t3.lowReason, LowReason.language);
      expect(minuses(t3), contains(FactorKind.koreanTopik3Master));

      final t4 = run(answers(route: StudyRoute.master, age: 24, korean: KoreanLevel.topik4plus));
      expect(t4.band, EligibilityBand.high);
      expect(t4.factors.map((f) => f.kind), contains(FactorKind.koreanMasterStrong));
      expect(t4.universities.map((m) => m.university.institutionId), ['M']);
      expect(t4.steps, contains(NextStep.diplomaDocs));
    });

    test('a language course without a certificate is low, even with the money', () {
      final r = run(answers(route: StudyRoute.languageCourse, korean: KoreanLevel.learning));
      expect(r.band, EligibilityBand.low);
      expect(minuses(r), contains(FactorKind.koreanCourseMissing));

      final ok = run(answers(route: StudyRoute.languageCourse, korean: KoreanLevel.topik1, budget: Budget.from6to10k));
      expect(ok.band, EligibilityBand.high);
    });

    test('a college needs TOPIK 2', () {
      expect(run(answers(route: StudyRoute.college, korean: KoreanLevel.topik1)).band, EligibilityBand.low);
      final r = run(answers(route: StudyRoute.college, korean: KoreanLevel.topik2));
      expect(r.band, EligibilityBand.high);
      expect(r.factors.map((f) => f.kind), contains(FactorKind.koreanCollegeTopik2));
    });

    test('"Hali bilmayman" for Korean is mid at best', () {
      final r = run(answers(korean: KoreanLevel.unknown));
      expect(r.band, EligibilityBand.mid);
    });
  });

  group('language: IELTS for English-taught programmes', () {
    test('a bachelor with IELTS and an English-taught programme meets the language rule', () {
      final c = [...catalog, english('H', partner: true)];
      final r = run(answers(korean: KoreanLevel.none, englishLevel: EnglishLevel.ielts55), c);
      expect(r.band, EligibilityBand.high);
      expect(r.factors.map((f) => f.kind), contains(FactorKind.englishStrong));
      // Only the English-taught one: the Korean-taught ones need TOPIK 3.
      expect(r.universities.map((m) => m.university.institutionId), ['H']);
      expect(r.universities.single.partner, isTrue);
      expect(r.steps, isNot(contains(NextStep.topikPrep)));
    });

    test('a bachelor with IELTS but no programme that accepts it stays low', () {
      final c = [...catalog, english('H', ielts: 6.5)];
      final r = run(answers(korean: KoreanLevel.none, englishLevel: EnglishLevel.ielts60), c);
      expect(r.band, EligibilityBand.low);
      expect(r.universities, isEmpty);
    });

    test('TOPIK 2 with IELTS: the English-taught partner, not the Korean-taught ones', () {
      final c = [...catalog, english('H', partner: true)];
      final r = run(answers(korean: KoreanLevel.topik2, englishLevel: EnglishLevel.ielts55), c);
      expect(r.band, EligibilityBand.high);
      expect(r.universities.map((m) => m.university.institutionId), ['H']);
    });

    test('a master with IELTS 5.5+ meets the language rule; programmes ask their own score', () {
      final c = [...catalog, english('E', degree: 'magistratura', ielts: 6.0)];
      QuizAnswers master(EnglishLevel e) => answers(route: StudyRoute.master, age: 24, korean: KoreanLevel.none, englishLevel: e);

      expect(run(master(EnglishLevel.none), c).band, EligibilityBand.low);
      final ielts6 = run(master(EnglishLevel.ielts60), c);
      expect(ielts6.band, EligibilityBand.high);
      expect(ielts6.universities.map((m) => m.university.institutionId), ['E']);
      final ielts55 = run(master(EnglishLevel.ielts55), c);
      expect(ielts55.band, EligibilityBand.high);
      expect(ielts55.universities, isEmpty);
    });
  });

  group('money: the KDB deposit and the parents\' income', () {
    test('a deposit only by the intake is mid', () {
      final r = run(answers(kdb: KdbDeposit.byIntake));
      expect(r.band, EligibilityBand.mid);
      expect(minuses(r), contains(FactorKind.kdbByIntake));
    });

    test('no deposit is low, for money', () {
      final r = run(answers(kdb: KdbDeposit.no));
      expect(r.band, EligibilityBand.low);
      expect(r.lowReason, LowReason.money);
      expect(minuses(r), contains(FactorKind.kdbNo));
    });

    test('a deposit without the parents\' income is mid', () {
      final r = run(answers(income: false));
      expect(r.band, EligibilityBand.mid);
      expect(minuses(r), contains(FactorKind.incomeNo));
      expect(r.tariff, Tariff.noRisk);
    });

    test('a budget under the deposit is mid, far under it is low', () {
      final under = run(answers(budget: Budget.from6to10k));
      expect(under.band, EligibilityBand.mid);
      expect(minuses(under), contains(FactorKind.budgetBelowDeposit));

      final far = run(answers(budget: Budget.from3to6k));
      expect(far.band, EligibilityBand.low);
      expect(far.lowReason, LowReason.money);

      // The language course deposit is smaller.
      final course = run(answers(route: StudyRoute.languageCourse, korean: KoreanLevel.topik1, budget: Budget.from3to6k));
      expect(course.band, EligibilityBand.mid);
    });

    test('"Hali bilmayman" for the deposit is mid', () {
      final r = run(answers(kdb: KdbDeposit.unknown));
      expect(r.band, EligibilityBand.mid);
    });

    test('no certificate and no money: both reasons, paths, Hanbox', () {
      final r = run(answers(korean: KoreanLevel.none, budget: Budget.under3k, income: false, kdb: KdbDeposit.no));
      expect(r.band, EligibilityBand.low);
      expect(r.lowReason, LowReason.both);
      expect(r.universities, isEmpty);
      expect(r.paths, hasLength(3));
      expect(r.tariff, Tariff.hanbox);
    });
  });

  test('a soft point (age) takes a high result down to mid', () {
    final r = run(answers(age: 31));
    expect(r.band, EligibilityBand.mid);
    expect(minuses(r), contains(FactorKind.ageHigh));
  });

  test('the deposit and the cost of living follow the university\'s area', () {
    final c = [
      uni('S', topik: 3, tuitionKrw: 2800000, region: '서울'),
      uni('R', topik: 3, tuitionKrw: 2800000, region: '대구', bankKrw: 21000000),
    ];
    final r = run(answers(), c);
    final bank = {for (final m in r.universities) m.university.institutionId: m.bankStatementUsd};
    // Seoul: the embassy's $15 500; Daegu: the university's own, higher figure.
    expect(bank, {'S': 15500, 'R': 15000});
    expect(r.bankStatementUsd, 15500);
    // 2 × $2 000 + 12 × $450 + $70 … 2 × $2 000 + 12 × $1 100 + $70.
    expect(r.yearlyCostUsd, (9500, 17300));
  });

  test('a university the embassy restricts is never suggested', () {
    final c = [...catalog, uni('X', topik: 2, tuitionKrw: 500000, restricted: true)];
    final r = run(answers(), c);
    expect(r.universities.map((m) => m.university.institutionId), isNot(contains('X')));
  });

  test('two "Hali bilmayman" answers ask the operator', () {
    expect(run(answers(korean: KoreanLevel.unknown, kdb: KdbDeposit.unknown)).needsOperator, isTrue);
    expect(run(answers(kdb: KdbDeposit.unknown)).needsOperator, isFalse);
  });

  test('rules come from eligibility_rules rows, defaults otherwise', () {
    final rules = EligibilityRules.fromRows([
      {'key': 'krw_per_usd', 'value': 1300},
      {'key': 'd2_master_ielts_min', 'value': 6},
      {'key': 'd2_master_topik_min', 'value': 3},
      {'key': 'd2_kdb_usd', 'value': [13000, 16000]},
      {'key': 'money_partial_cap', 'value': 'low'},
      {'key': 'living_seoul_month_usd', 'value': [1000, 1200]},
      {'key': 'broken', 'value': 'x'},
    ]);
    expect(rules.krwPerUsd, 1300);
    expect(rules.englishIeltsMin, 6);
    expect(rules.masterTopikMin, 3);
    expect(rules.degreeKdbUsd, (13000, 16000));
    expect(rules.courseKdbUsd, (6300, 7800));
    expect(rules.moneyPartialCap, EligibilityBand.low);
    expect(rules.livingSeoulMonthUsd, (1000, 1200));
    expect(rules.baseScore, 2);
    expect(rules.bandHighMin, 6);
  });

  test('answers serialise to stable codes', () {
    const a = QuizAnswers(
      route: StudyRoute.languageCourse,
      age: 22,
      stillStudying: true,
      korean: KoreanLevel.topik4plus,
      english: EnglishLevel.ielts60,
      budget: Budget.from3to6k,
      payer: Payer.sponsor,
      formalIncome: true,
      kdb: KdbDeposit.byIntake,
      region: 'Nukus',
      intake: Intake.later,
    );
    expect(a.isAllComplete, isTrue);
    expect(a.toJson(), {
      'route': 'd4',
      'age': '22',
      'grad_year': 'studying',
      'korean': 'topik4plus',
      'english': 'ielts60',
      'budget': '3to6',
      'payer': 'sponsor',
      'formal_income': 'yes',
      'kdb': 'by_intake',
      'region': 'Nukus',
      'intake': 'later',
    });
    expect(const QuizAnswers().isComplete(9), isFalse);
  });
}

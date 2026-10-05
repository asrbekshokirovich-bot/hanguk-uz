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

  test('TOPIK 2 bachelor with income and bank statement is mid (design S03)', () {
    final r = evaluateEligibility(
      const QuizAnswers(
        route: StudyRoute.bachelor,
        age: 19,
        gradYear: 2026,
        korean: KoreanLevel.topik2,
        budget: Budget.from6to10k,
        payer: Payer.parents,
        formalIncome: true,
        bankStatement: true,
        region: "Farg'ona",
        intake: Intake.spring2027,
      ),
      catalog: catalog,
      now: now,
    );
    expect(r.band, EligibilityBand.mid);
    expect(r.factors.where((f) => !f.positive).map((f) => f.kind), contains(FactorKind.koreanTopik2Degree));
    expect(r.factors.map((f) => f.kind), contains(FactorKind.incomeYes));
    // TOPIK 3 university is out, inactive one is never suggested, accredited first.
    expect(r.universities.map((m) => m.university.institutionId), ['B', 'C']);
    expect(r.universities.first.tuitionPerSemesterUsd, 1700);
    expect(r.yearlyCostUsd, isNotNull);
    expect(r.steps.first, NextStep.topikPrep);
    expect(r.tariff, Tariff.premium);
    expect(r.paths, isEmpty);
  });

  test('TOPIK 3+ master with money in order is high', () {
    final r = evaluateEligibility(
      const QuizAnswers(
        route: StudyRoute.master,
        age: 24,
        gradYear: 2025,
        korean: KoreanLevel.topik3plus,
        budget: Budget.over10k,
        payer: Payer.parents,
        formalIncome: true,
        bankStatement: true,
        region: 'Toshkent',
        intake: Intake.fall2027,
      ),
      catalog: catalog,
      now: now,
    );
    expect(r.band, EligibilityBand.high);
    expect(r.universities.map((m) => m.university.institutionId), ['M']);
    expect(r.steps, contains(NextStep.diplomaDocs));
  });

  test('no certificate and no money is low, with paths instead of universities', () {
    final r = evaluateEligibility(
      const QuizAnswers(
        route: StudyRoute.bachelor,
        age: 18,
        stillStudying: true,
        korean: KoreanLevel.none,
        budget: Budget.under3k,
        payer: Payer.self,
        formalIncome: false,
        bankStatement: false,
        region: 'Samarqand',
        intake: Intake.spring2027,
      ),
      catalog: catalog,
      now: now,
    );
    expect(r.band, EligibilityBand.low);
    expect(r.universities, isEmpty);
    expect(r.paths, hasLength(3));
    expect(r.tariff, Tariff.hanbox);
  });

  test('vocational college with TOPIK 3+ keeps a mid cap without money (pilot)', () {
    final r = evaluateEligibility(
      const QuizAnswers(
        route: StudyRoute.college,
        age: 20,
        gradYear: 2024,
        korean: KoreanLevel.topik3plus,
        budget: Budget.from3to6k,
        payer: Payer.parents,
        formalIncome: false,
        bankStatement: false,
        region: 'Andijon',
        intake: Intake.later,
      ),
      catalog: catalog,
      now: now,
    );
    expect(r.band, EligibilityBand.mid);
  });

  test('rules come from eligibility_rules rows, defaults otherwise', () {
    final rules = EligibilityRules.fromRows([
      {'key': 'krw_per_usd', 'value': 1300},
      {'key': 'd2_topik2_cap', 'value': 'low'},
      {'key': 'living_seoul_month_usd', 'value': [1000, 1200]},
      {'key': 'broken', 'value': 'x'},
    ]);
    expect(rules.krwPerUsd, 1300);
    expect(rules.degreeTopik2Cap, EligibilityBand.low);
    expect(rules.livingSeoulMonthUsd, (1000, 1200));
    expect(rules.baseScore, 2);
  });

  test('answers serialise to stable codes', () {
    const a = QuizAnswers(
      route: StudyRoute.languageCourse,
      age: 22,
      stillStudying: true,
      korean: KoreanLevel.topik1,
      budget: Budget.from3to6k,
      payer: Payer.sponsor,
      formalIncome: true,
      bankStatement: false,
      region: 'Nukus',
      intake: Intake.later,
    );
    expect(a.isAllComplete, isTrue);
    expect(a.toJson(), {
      'route': 'd4',
      'age': '22',
      'grad_year': 'studying',
      'korean': 'topik1',
      'budget': '3to6',
      'payer': 'sponsor',
      'formal_income': 'yes',
      'bank_statement': 'no',
      'region': 'Nukus',
      'intake': 'later',
    });
  });
}

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

  test('TOPIK 2 bachelor with formal income is mid (design S03)', () {
    final r = evaluateEligibility(
      const QuizAnswers(
        route: StudyRoute.bachelor,
        age: 19,
        gradYear: 2026,
        korean: KoreanLevel.topik2,
        budget: Budget.from6to10k,
        payer: Payer.parents,
        formalIncome: true,
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
        region: 'Andijon',
        intake: Intake.later,
      ),
      catalog: catalog,
      now: now,
    );
    expect(r.band, EligibilityBand.mid);
  });

  test('a master with IELTS 5.5+ meets the language rule and sees English tracks', () {
    final withEnglish = [
      ...catalog,
      CatalogUniversity(
        institutionId: 'E',
        guidelines: [
          CatalogGuideline(
            id: 'g-E',
            institutionId: 'E',
            univNameEn: 'E University',
            city: 'Seoul',
            degree: 'magistratura',
            koreanTrack: false,
            englishTrack: true,
            ieltsMin: 6.0,
            currency: 'KRW',
            tuitionMin: 5600000,
            tuitionMax: 5600000,
            tuitionPeriod: 'semestr',
            ieqasStatus: 'accredited',
            isActive: true,
          ),
        ],
      ),
    ];
    QuizAnswers master(EnglishLevel e) => QuizAnswers(
      route: StudyRoute.master,
      age: 24,
      gradYear: 2025,
      korean: KoreanLevel.none,
      english: e,
      budget: Budget.over10k,
      payer: Payer.parents,
      formalIncome: true,
      region: 'Toshkent',
      intake: Intake.fall2027,
    );

    final none = evaluateEligibility(master(EnglishLevel.none), catalog: withEnglish, now: now);
    expect(none.band, EligibilityBand.low);

    final ielts6 = evaluateEligibility(master(EnglishLevel.ielts60), catalog: withEnglish, now: now);
    expect(ielts6.band, EligibilityBand.high);
    expect(ielts6.factors.map((f) => f.kind), contains(FactorKind.englishStrong));
    expect(ielts6.universities.map((m) => m.university.institutionId), ['E']);
    expect(ielts6.steps, isNot(contains(NextStep.topikPrep)));

    // 5.5 meets the rule but not this programme's 6.0.
    final ielts55 = evaluateEligibility(master(EnglishLevel.ielts55), catalog: withEnglish, now: now);
    expect(ielts55.band, EligibilityBand.high);
    expect(ielts55.universities, isEmpty);

    // IELTS does not change a bachelor's result.
    final bachelor = evaluateEligibility(
      master(EnglishLevel.ielts65plus).copyWith(route: StudyRoute.bachelor),
      catalog: withEnglish,
      now: now,
    );
    expect(bachelor.band, EligibilityBand.low);
  });

  test('without formal income the result stops at mid, never lower for money alone', () {
    QuizAnswers bachelor({required bool income}) => QuizAnswers(
      route: StudyRoute.bachelor,
      age: 19,
      gradYear: 2026,
      korean: KoreanLevel.topik3plus,
      english: EnglishLevel.none,
      budget: Budget.from6to10k,
      payer: Payer.parents,
      formalIncome: income,
      region: 'Toshkent',
      intake: Intake.spring2027,
    );
    final yes = evaluateEligibility(bachelor(income: true), catalog: catalog, now: now);
    expect(yes.band, EligibilityBand.high);
    expect(yes.factors.map((f) => f.kind), contains(FactorKind.incomeYes));

    final no = evaluateEligibility(bachelor(income: false), catalog: catalog, now: now);
    expect(no.band, EligibilityBand.mid);
    expect(no.factors.where((f) => !f.positive).map((f) => f.kind), contains(FactorKind.incomeNo));
    expect(no.tariff, Tariff.noRisk);
  });

  test('rules come from eligibility_rules rows, defaults otherwise', () {
    final rules = EligibilityRules.fromRows([
      {'key': 'krw_per_usd', 'value': 1300},
      {'key': 'd2_master_ielts_min', 'value': 6},
      {'key': 'd2_topik2_cap', 'value': 'low'},
      {'key': 'living_seoul_month_usd', 'value': [1000, 1200]},
      {'key': 'broken', 'value': 'x'},
    ]);
    expect(rules.krwPerUsd, 1300);
    expect(rules.masterIeltsMin, 6);
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
      english: EnglishLevel.ielts60,
      budget: Budget.from3to6k,
      payer: Payer.sponsor,
      formalIncome: true,
      region: 'Nukus',
      intake: Intake.later,
    );
    expect(a.isAllComplete, isTrue);
    expect(a.toJson(), {
      'route': 'd4',
      'age': '22',
      'grad_year': 'studying',
      'korean': 'topik1',
      'english': 'ielts60',
      'budget': '3to6',
      'payer': 'sponsor',
      'formal_income': 'yes',
      'region': 'Nukus',
      'intake': 'later',
    });
  });
}

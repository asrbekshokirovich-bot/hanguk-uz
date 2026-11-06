import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';

/// The eligibility engine behind the assessment's visa result: every
/// combination of answers keeps its rules. (The old quiz screens it was
/// tested through are gone — plan R7.2.)

void main() {
  group('every combination of answers', () {
    final catalog = [
      for (final (id, topik, region, english, ielts) in [
        ('K2', 2, '대구', false, null),
        ('K3', 3, '서울', false, null),
        ('K4', 4, '경기', false, null),
        ('E55', null, '경북', true, 5.5),
        ('E65', null, '서울', true, 6.5),
      ])
        for (final degree in ['bakalavr', 'magistratura'])
          CatalogUniversity(
            institutionId: '$id-$degree',
            guidelines: [
              CatalogGuideline(
                id: 'g-$id-$degree',
                institutionId: '$id-$degree',
                univNameEn: '$id University',
                degree: degree,
                koreanTrack: !english,
                englishTrack: english,
                topikMin: topik,
                ieltsMin: ielts,
                currency: 'KRW',
                tuitionMin: 3000000,
                tuitionMax: 3000000,
                tuitionPeriod: 'semestr',
                ieqasStatus: 'accredited',
                isActive: true,
                regionCode: region,
              ),
            ],
          ),
    ];

    test(
      'the result keeps its rules for all of them',
      () async {
        final rules = const EligibilityRules();
        var n = 0;
        final bands = <EligibilityBand, int>{};
        for (final route in StudyRoute.values) {
          for (final korean in KoreanLevel.values) {
            for (final english in EnglishLevel.values) {
              for (final payer in Payer.values) {
                for (final income in [true, false]) {
                  for (final kdb in KdbDeposit.values) {
                    for (final (age, grad, studying) in [
                      (19, 2026, false),
                      (31, 2020, false),
                      (17, null, true),
                    ]) {
                      final a = QuizAnswers(
                        route: route,
                        age: age,
                        gradYear: grad,
                        stillStudying: studying,
                        korean: korean,
                        english: english,
                        payer: payer,
                        formalIncome: income,
                        kdb: kdb,
                        region: 'Toshkent',
                        intake: Intake.fall2027,
                      );
                      expect(a.isAllComplete, isTrue);
                      final r = evaluateEligibility(
                        a,
                        catalog: catalog,
                        now: DateTime(2026, 10, 6),
                      );
                      n++;
                      bands[r.band] = (bands[r.band] ?? 0) + 1;
                      final why = '$route $korean $english $income $kdb age $age';
                      final minus = r.factors.where((f) => !f.positive).map((f) => f.kind).toSet();

                      // A low result always says why; others never do.
                      expect(r.lowReason != null, r.band == EligibilityBand.low, reason: why);
                      // A low result shows the ways forward; others never do.
                      expect(r.paths.isNotEmpty, r.band == EligibilityBand.low, reason: why);

                      // The language the embassy asks for.
                      final topikOk =
                          korean != KoreanLevel.unknown && korean.topik >= rules.topikMin(route);
                      if (!topikOk &&
                          korean != KoreanLevel.unknown &&
                          !(route.isDegree && english.ielts >= 5.5)) {
                        expect(r.band, EligibilityBand.low, reason: 'no certificate: $why');
                      }
                      // No deposit: never better than low.
                      if (kdb == KdbDeposit.no) expect(r.band, EligibilityBand.low, reason: why);
                      // High needs the deposit, the income, the language, and no soft point.
                      if (r.band == EligibilityBand.high) {
                        expect(kdb, KdbDeposit.ready, reason: why);
                        expect(income, isTrue, reason: why);
                        expect(minus, isEmpty, reason: why);
                      }
                      // A "not sure" deposit is never high; nor is a "not sure"
                      // Korean level, unless IELTS already meets the language rule.
                      final englishMet = r.factors.any((f) => f.kind == FactorKind.englishStrong);
                      if (kdb == KdbDeposit.unknown ||
                          (korean == KoreanLevel.unknown && !englishMet)) {
                        expect(r.band, isNot(EligibilityBand.high), reason: why);
                      }
                      // Two "not sure" answers ask the operator.
                      if (kdb == KdbDeposit.unknown && korean == KoreanLevel.unknown) {
                        expect(r.needsOperator, isTrue, reason: why);
                      }
                      // The language course and the college have no catalogue.
                      if (!route.isDegree) expect(r.universities, isEmpty, reason: why);
                      // A university is offered only on what the applicant has.
                      for (final m in r.universities) {
                        final g = m.guideline;
                        final viaKorean =
                            g.koreanTrack == true &&
                            (korean == KoreanLevel.unknown || (g.topikMin ?? 0) <= korean.topik);
                        final viaEnglish =
                            g.englishTrack == true && english.ielts >= (g.ieltsMin ?? 5.5);
                        expect(viaKorean || viaEnglish, isTrue, reason: '${g.institutionId}: $why');
                        expect(
                          m.bankStatementUsd,
                          greaterThanOrEqualTo(g.inCapitalArea ? 15500 : 12500),
                          reason: why,
                        );
                      }
                      expect(r.universities.length, lessThanOrEqualTo(rules.maxUniversities));
                      expect(r.steps.length, inInclusiveRange(2, 3), reason: why);
                      if (r.yearlyCostUsd != null) {
                        expect(
                          r.yearlyCostUsd!.$1,
                          lessThanOrEqualTo(r.yearlyCostUsd!.$2),
                          reason: why,
                        );
                      }

                    }
                  }
                }
              }
            }
          }
        }
        expect(n, 4 * 7 * 5 * 3 * 2 * 4 * 3);
        // All three bands occur.
        expect(bands.keys.toSet(), EligibilityBand.values.toSet());
      },
    );
  });
}


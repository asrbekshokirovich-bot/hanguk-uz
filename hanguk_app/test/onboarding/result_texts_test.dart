import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';
import 'package:hanguk_app/features/onboarding/presentation/result_texts.dart';
import 'package:hanguk_app/l10n/app_localizations_ru.dart';
import 'package:hanguk_app/l10n/app_localizations_uz.dart';

void main() {
  test('money is written as the design writes it', () {
    expect(usd(1700, space: ' '), r'$1 700');
    expect(usd(12500, space: ' '), r'$12 500');
    expect(usd(70, space: ' '), r'$70');
    expect(usdRange((6800, 9400), space: ' '), r'$6 800–9 400');
    expect(topikValue(3), '3+');
    expect(topikValue(null), '—');
  });

  const answers = QuizAnswers(
    route: StudyRoute.bachelor,
    age: 18,
    gradYear: 2026,
    korean: KoreanLevel.none,
    budget: Budget.from3to6k,
    payer: Payer.parents,
    formalIncome: false,
    bankStatement: false,
    region: 'Samarqand',
    intake: Intake.spring2027,
  );
  const low = EligibilityResult(
    band: EligibilityBand.low,
    score: 2,
    factors: [
      EligibilityFactor(FactorKind.koreanMissingDegree, positive: false),
      EligibilityFactor(FactorKind.incomeNo, positive: false),
    ],
    universities: [],
    steps: [NextStep.topikPrep, NextStep.bankStatement, NextStep.schoolDocs],
    paths: [AlternativePath.languageCourse, AlternativePath.college, AlternativePath.nextSeason],
    tariff: Tariff.hanbox,
    needsOperator: false,
  );

  test('plan text carries the S03 words in the app language', () {
    final uz = planText(AppLocalizationsUz(), answers, low);
    expect(uz, startsWith("Bakalavr · Samarqand · 2027 bahor\n\nHozircha xavf yuqori — lekin yo'l bor"));
    expect(uz, contains("Sizga mos yo'llar"));
    expect(uz, contains('− Ota-onada rasmiy daromad yo\'q'));
    expect(uz, contains('1. TOPIK 3 ga tayyorgarlik'));
    expect(uz, contains('Hanbox'));
    expect(uz, endsWith('Bu dastlabki baho. Viza qarorini elchixona beradi.'));
    expect(uz, isNot(contains('<')));
    expect(uz.length, lessThanOrEqualTo(3500));

    final ru = planText(AppLocalizationsRu(), answers, low);
    expect(ru, startsWith('Бакалавриат · Samarqand · Весна 2027'));
  });
}

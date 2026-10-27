import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/assessment/domain/assessment.dart';
import 'package:hanguk_app/features/assessment/domain/visa_model.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';

void main() {
  int v(AssessmentInput i) => visaScore(i, requiredBankKrw: 20000000);

  test('the first answers everywhere: the base 30', () {
    expect(v(const AssessmentInput(gpa: 3.5)), 30);
  });

  test('money weighs most: income, papers, steady years, assets, parents', () {
    const strong = AssessmentInput(
      gpa: 3.5,
      income: 3,
      incomeDocumented: true,
      incomeStability: 3,
      property: 2,
      sponsor: 1,
      relationDoc: true,
    );
    // 12 + 5 + 5 + 5 + 4 + 3 = 34
    expect(v(strong), 64);
    // The bank on top is held to the money's ceiling (35).
    expect(v(strong.copyWith(bankKrw: 20000000)), 65);
  });

  test('a relative as sponsor counts against', () {
    expect(v(const AssessmentInput(gpa: 3.5, sponsor: 2)), 24);
  });

  test('an overstay holds it at 5, a master without a bachelor at 10', () {
    expect(v(const AssessmentInput(gpa: 3.5, topik: 6, koreaBefore: 2)), 5);
    expect(v(const AssessmentInput(gpa: 3.5, topik: 6, route: StudyRoute.master)), 10);
    expect(v(const AssessmentInput(gpa: 3.5, topik: 6, route: StudyRoute.master, education: 2)), 42);
  });

  test('D-4: age and a long gap weigh more than for a degree', () {
    const older = AssessmentInput(gpa: 3.5, age: 31, gapYears: 3);
    expect(v(older.copyWith(route: StudyRoute.languageCourse)), 10);
    expect(v(older), 16);
  });

  test('history: refusal −10, illegal relatives −15, legal +5', () {
    expect(v(const AssessmentInput(gpa: 3.5, visaRefused: true)), 20);
    expect(v(const AssessmentInput(gpa: 3.5, illegalRelatives: true)), 15);
    expect(v(const AssessmentInput(gpa: 3.5, legalRelatives: true)), 35);
  });

  test('with a consultant: the papers in order', () {
    const i = AssessmentInput(gpa: 3.5, sponsor: 1);
    // 30 + parents 4; then + plan 5, interview 5, letter 3, recommendation
    // 2, documented 5, relation 3.
    expect(v(i), 34);
    expect(visaWithConsultant(i, requiredBankKrw: 20000000), 57);
  });
}

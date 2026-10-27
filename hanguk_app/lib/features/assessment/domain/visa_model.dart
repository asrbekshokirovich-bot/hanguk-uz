import '../../onboarding/domain/quiz_answers.dart';
import 'assessment.dart';

/// "Vizam chiqadimi?": the D-2/D-4 visa chance from the page's answers.
///
/// What it rests on (sourced 2026-10-21):
/// - MOJ "외국인유학생 사증발급 및 체류관리 지침": the money must be shown
///   (degree USD 20k capital / 18k regional, D-4 USD 9k; ₩20M/₩16M/₩10M since
///   the 2023 reform), in the applicant's or the parents' name — a parent's
///   balance with a family-relation certificate, other sponsors "strictly
///   restricted"; employment or asset certificates may stand in; sudden
///   balance changes are reviewed closely.
/// - Uzbekistan is one of the 21 designated countries: financial proof is
///   always required, and for D-4 the officer weighs whether a course is
///   really needed given the applicant's age and occupation.
/// - An earlier overstay brings an entry ban (refusal); prior refusals,
///   relatives staying illegally and long gaps are the "migration risk"
///   consultants name — their weights are our estimate, not published.
/// - Korean ability: TOPIK 4 is planned to waive financial proof, TOPIK 3
///   (or IELTS 5.5 for English tracks) is the entry level the guidance
///   recommends; D-4 has no language requirement.
///
/// The score starts at 30 and moves by the answers below, kept within 5–95;
/// an overstay holds it at 5, a master's without a bachelor's at 10.
int visaScore(AssessmentInput i, {required int requiredBankKrw}) {
  final d4 = i.route == StudyRoute.languageCourse;
  var p = 30;

  // Language.
  final t = i.topikCounted;
  final topikPts = d4
      ? (t >= 3
            ? 6
            : t >= 1
            ? 3
            : 0)
      : (t >= 4
            ? 12
            : t == 3
            ? 8
            : t == 2
            ? 3
            : 0);
  final ieltsPts = !d4 && i.ielts >= 5.5 ? 8 : 0;
  p += topikPts > ieltsPts ? topikPts : ieltsPts;

  // Money: what the family earns and owns, how long and how plainly, who
  // pays, and the bank the board holds.
  var money = 0;
  money += const [0, 4, 8, 12][i.income.clamp(0, 3)];
  if (i.incomeDocumented) money += 5;
  money += const [0, 2, 4, 5][i.incomeStability.clamp(0, 3)];
  money += const [0, 3, 5][i.property.clamp(0, 2)];
  money += const [0, 1, 2][i.car.clamp(0, 2)];
  money += const [0, 2, 3][i.business.clamp(0, 2)];
  money += const [0, 4, -6][i.sponsor.clamp(0, 2)];
  if (i.sponsor != 0 && i.relationDoc) money += 3;
  if (i.bankKrw >= requiredBankKrw && requiredBankKrw > 0) {
    money += 15;
  } else if (i.bankKrw > 0) {
    money += 5;
  }
  p += money.clamp(-10, 35);

  // Age and gap: for D-4 the officer asks whether a course is really needed.
  var risk = 0;
  if (d4) {
    risk += i.age > 30
        ? -15
        : i.age >= 26
        ? -8
        : 0;
    risk += i.gapYears >= 2 ? -8 : 0;
  } else {
    risk += i.age > 30
        ? -8
        : i.age >= 26
        ? -3
        : 0;
    risk += i.gapYears >= 3
        ? -6
        : i.gapYears == 2
        ? -3
        : 0;
  }
  p += risk.clamp(-20, 0);

  // The certificate, as the study's seriousness.
  p += i.gpa >= 4
      ? 3
      : i.gpa < 3
      ? -5
      : 0;

  // History.
  if (i.visaRefused) p -= 10;
  if (i.koreaBefore == 1) p += 3;
  if (i.illegalRelatives) p -= 15;
  if (i.legalRelatives) p += 5;

  // Preparation: the embassy reads the study plan and may interview.
  p += const [0, 2, 5][i.studyPlan.clamp(0, 2)];
  p += const [0, 2, 5][i.interviewPrep.clamp(0, 2)];
  p += const [0, 1, 3][i.motivation.clamp(0, 2)];
  if (i.recommendation) p += 2;

  p = p.clamp(5, 95);
  if (i.koreaBefore == 2) p = 5;
  if (i.route == StudyRoute.master && i.education < 2) p = p.clamp(5, 10);
  return p;
}

/// What the answers would give once a consultant has the papers in order:
/// the study plan and letter written, the interview practised, a
/// recommendation, the income documented and the relation certified.
int visaWithConsultant(AssessmentInput i, {required int requiredBankKrw}) => visaScore(
  i.copyWith(
    studyPlan: 2,
    interviewPrep: 2,
    motivation: 2,
    recommendation: true,
    incomeDocumented: true,
    relationDoc: true,
  ),
  requiredBankKrw: requiredBankKrw,
);

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/assessment/data/admission_tests_repository.dart';
import 'package:hanguk_app/features/assessment/domain/admission_tests.dart';

void main() {
  group('combinedAdmission', () {
    test('the profile alone until a test is taken', () {
      expect(combinedAdmission(55, AdmissionTests.none), 55);
    });

    test('the interview weighs most, the study plan least', () {
      // 40·60 + 15·80 + 45·90 = 7650 → 76.5
      expect(combinedAdmission(60, const AdmissionTests(studyPlan: 80, interview: 90)), 77);
      // Only the study plan: (40·60 + 15·80) / 55
      expect(combinedAdmission(60, const AdmissionTests(studyPlan: 80)), 65);
    });

    test('an interview under the pass mark keeps the chance low', () {
      expect(combinedAdmission(90, const AdmissionTests(studyPlan: 100, interview: 50)), kFailedInterviewCap);
      expect(combinedAdmission(90, const AdmissionTests(interview: 60)), greaterThan(kFailedInterviewCap));
    });

    test('kept within 5–95', () {
      expect(combinedAdmission(95, const AdmissionTests(studyPlan: 100, interview: 100)), 95);
      expect(combinedAdmission(5, const AdmissionTests(studyPlan: 0, interview: 0)), 5);
    });
  });

  test('rows: the latest scored attempt per university, out of 100', () {
    final m = admissionTestsFrom(
      studyPlans: [
        {
          'target_institution_id': 'a',
          'study_plan_analyses': [
            {'overall_score': 5, 'created_at': '2026-10-01T00:00:00Z'},
            {'overall_score': 8, 'created_at': '2026-10-05T00:00:00Z'},
            {'overall_score': null, 'created_at': '2026-10-06T00:00:00Z'},
          ],
        },
        {'target_institution_id': 'b', 'study_plan_analyses': []},
      ],
      interviews: [
        {
          'target_institution_id': 'a',
          'interview_feedback': {'overall_score': 7, 'created_at': '2026-10-02T00:00:00Z'},
        },
      ],
    );
    expect(m.keys, ['a']);
    expect(m['a'], const AdmissionTests(studyPlan: 80, interview: 70, studyPlanAttempts: 2, interviewAttempts: 1));
  });

  test('the Study Plan test mark is read exactly from ai_response', () {
    final m = admissionTestsFrom(
      studyPlans: [
        {
          'target_institution_id': 'a',
          'study_plan_analyses': [
            {'overall_score': 7, 'ai_response': '{"score":73,"seconds":120}', 'created_at': '2026-10-05T00:00:00Z'},
          ],
        },
        {
          'target_institution_id': 'b',
          'study_plan_analyses': [
            {'overall_score': 1, 'ai_response': '{"score":0}', 'created_at': '2026-10-05T00:00:00Z'},
          ],
        },
        {
          'target_institution_id': 'c',
          'study_plan_analyses': [
            {'overall_score': 6, 'ai_response': 'This is an initial analysis', 'created_at': '2026-10-05T00:00:00Z'},
          ],
        },
      ],
      interviews: const [],
    );
    expect(m['a']!.studyPlan, 73);
    expect(m['b']!.studyPlan, 0);
    expect(m['c']!.studyPlan, 60);
  });
}

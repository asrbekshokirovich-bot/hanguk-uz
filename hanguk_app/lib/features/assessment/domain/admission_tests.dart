import 'package:flutter/foundation.dart';

/// The two tests a student takes for one university — the Study Plan and the
/// interview, each scored by the AI — and how they enter that university's
/// admission chance.
///
/// The weights follow the foreign-student admission guides (모집요강) of the
/// universities our students apply to: documents are checked pass/fail and
/// the ranking is the interview's (100% at Kumoh, Woosong, Chungbuk,
/// Kyungsung, Jeju, Catholic Kwandong), with a pass mark of 60–70 out of 100;
/// the study plan has no weight of its own but sits inside the document
/// score (Keimyung's "학업소양", Kyung Hee's "학업계획"). So the interview
/// counts most, the profile (certificate, TOPIK, partner) next, and the
/// study plan least, and an interview under the pass mark keeps the chance
/// low whatever else is strong.
@immutable
class AdmissionTests {
  const AdmissionTests({this.studyPlan, this.interview, this.studyPlanAttempts = 0, this.interviewAttempts = 0});

  /// The latest scores out of 100; null until the test is taken.
  final int? studyPlan;
  final int? interview;

  final int studyPlanAttempts;
  final int interviewAttempts;

  static const none = AdmissionTests();

  bool get any => studyPlan != null || interview != null;

  @override
  bool operator ==(Object other) =>
      other is AdmissionTests &&
      other.studyPlan == studyPlan &&
      other.interview == interview &&
      other.studyPlanAttempts == studyPlanAttempts &&
      other.interviewAttempts == interviewAttempts;

  @override
  int get hashCode => Object.hash(studyPlan, interview, studyPlanAttempts, interviewAttempts);
}

const int kProfileWeight = 40;
const int kStudyPlanWeight = 15;
const int kInterviewWeight = 45;

/// The interview mark the guides pass at (Jeju 60; Kumoh and Woosong 70).
const int kInterviewPass = 60;

/// The chance an interview under [kInterviewPass] leaves at most: the
/// meter's lowest segment.
const int kFailedInterviewCap = 24;

/// [profile] (the board's estimate, 5–95) with the tests taken so far. A
/// test not yet taken leaves its weight to the others, so the figure is the
/// profile's alone until the first test.
int combinedAdmission(int profile, AdmissionTests tests) {
  var sum = profile * kProfileWeight;
  var weight = kProfileWeight;
  if (tests.studyPlan case final s?) {
    sum += s.clamp(0, 100) * kStudyPlanWeight;
    weight += kStudyPlanWeight;
  }
  if (tests.interview case final i?) {
    sum += i.clamp(0, 100) * kInterviewWeight;
    weight += kInterviewWeight;
  }
  var p = (sum / weight).round();
  if (tests.interview case final i? when i < kInterviewPass) p = p.clamp(0, kFailedInterviewCap);
  return p.clamp(5, 95);
}

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/interview_repository.dart';

InterviewMessage _m(String role, String content) => InterviewMessage(id: content, role: role, content: content, createdAt: '');

void main() {
  test('only the student\'s own words make an interview worth scoring', () {
    expect(InterviewNotifier.hasStudentAnswer([]), isFalse);
    expect(InterviewNotifier.hasStudentAnswer([_m('student', '[Interview started in en]')]), isFalse);
    expect(InterviewNotifier.hasStudentAnswer([_m('interviewer', 'Tell me about yourself.')]), isFalse);
    expect(InterviewNotifier.hasStudentAnswer([_m('student', '   ')]), isFalse);
    expect(
      InterviewNotifier.hasStudentAnswer([_m('interviewer', 'Why Korea?'), _m('student', 'Because of the culture.')]),
      isTrue,
    );
  });
}

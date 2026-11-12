import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/interview_repository.dart';

InterviewMessage _m(String role, String content) => InterviewMessage(id: content, role: role, content: content, createdAt: '');

void main() {
  test('the hints the function sends become the lines on screen', () {
    expect(InterviewNotifier.hintLines('Talk about your major\nMention a professor\nSay your goal'), [
      'Talk about your major',
      'Mention a professor',
      'Say your goal',
    ]);
    expect(InterviewNotifier.hintLines('- 전공 이야기\n\n• 교수님 언급\n* 목표\n넷째 줄'), ['전공 이야기', '교수님 언급', '목표']);
    // No hint (builds the function gives none to, a busy model): nothing shown.
    expect(InterviewNotifier.hintLines(null), isEmpty);
    expect(InterviewNotifier.hintLines(''), isEmpty);
    expect(InterviewNotifier.hintLines(42), isEmpty);
  });

  test('only the student\'s own words make an interview worth scoring', () {
    expect(InterviewNotifier.hasStudentAnswer([]), isFalse);
    expect(InterviewNotifier.hasStudentAnswer([_m('student', '[Interview started in en]')]), isFalse);
    expect(InterviewNotifier.hasStudentAnswer([_m('interviewer', 'Tell me about yourself.')]), isFalse);
    expect(InterviewNotifier.hasStudentAnswer([_m('student', '   ')]), isFalse);
    expect(
      InterviewNotifier.hasStudentAnswer([
        _m('interviewer', 'Please introduce yourself.'),
        _m('student', 'The student is stuck and said nothing.'),
      ]),
      isFalse,
    );
    expect(
      InterviewNotifier.hasStudentAnswer([_m('interviewer', 'Why Korea?'), _m('student', 'Because of the culture.')]),
      isTrue,
    );
  });
}

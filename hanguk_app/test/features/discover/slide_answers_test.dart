import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/features/assessment/domain/assessment.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/assess_parts.dart';

void main() {
  late List<TrackedEvent> seen;

  setUp(() {
    seen = [];
    AppEvents.debugOnTrack = seen.add;
  });
  tearDown(() => AppEvents.debugOnTrack = null);

  test('a slide is one answer, recorded when it ends', () {
    const start = AssessmentInput();
    final slide = SlideAnswers();
    slide.moved(start);
    slide.moved(start.copyWith(gpa: 4.2));
    slide.moved(start.copyWith(gpa: 4.6));
    expect(seen, isEmpty, reason: 'nothing while the finger moves');

    slide.ended('visa', start.copyWith(gpa: 4.6));
    expect(seen, hasLength(1));
    expect(seen.single.event, 'question_answer');
    expect(seen.single.props, {'form': 'visa', 'q': 'gpa', 'band': 4.5});

    // No slide under way: a stray end records nothing.
    slide.ended('visa', start.copyWith(gpa: 5.0));
    expect(seen, hasLength(1));
  });

  test('a slide that ends where it began records nothing', () {
    const start = AssessmentInput(age: 22);
    final slide = SlideAnswers();
    slide.moved(start);
    slide.moved(start.copyWith(age: 27));
    slide.ended('university', start);
    expect(seen, isEmpty);
  });

  test('each slide starts from where the last one ended', () {
    const start = AssessmentInput();
    final slide = SlideAnswers();
    slide.moved(start);
    slide.ended('visa', start.copyWith(age: 25));
    final after = start.copyWith(age: 25);
    slide.moved(after);
    slide.ended('visa', after.copyWith(age: 31));
    expect(seen.map((e) => e.props?['band']).toList(), [24, 30]);
  });
}

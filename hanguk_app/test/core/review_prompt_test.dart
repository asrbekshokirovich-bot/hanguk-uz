import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/review/review_prompt.dart';

void main() {
  final now = DateTime(2026, 11, 20, 10);

  test('not on the first day, not twice, not without a first day', () {
    expect(ReviewPrompt.shouldAsk(firstDay: DateTime(2026, 11, 20), asked: false, now: now), isFalse);
    expect(ReviewPrompt.shouldAsk(firstDay: DateTime(2026, 11, 19), asked: false, now: now), isTrue);
    expect(ReviewPrompt.shouldAsk(firstDay: DateTime(2026, 11, 10), asked: true, now: now), isFalse);
    expect(ReviewPrompt.shouldAsk(firstDay: null, asked: false, now: now), isFalse);
  });

  test('the first day is noted once', () async {
    final store = <String, String>{};
    ReviewPrompt.read = (k) async => store[k];
    ReviewPrompt.write = (k, v) async => store[k] = v;
    await ReviewPrompt.noteStart(DateTime(2026, 11, 19, 23, 59));
    await ReviewPrompt.noteStart(DateTime(2026, 11, 25));
    expect(store['review_first_day_v1'], DateTime(2026, 11, 19).toIso8601String());
  });
}

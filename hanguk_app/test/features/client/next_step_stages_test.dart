import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/applications/domain/application_journey.dart';
import 'package:hanguk_app/features/client/presentation/widgets/next_step_card.dart';

void main() {
  test('TARTIB (D8): done steps, then one current, then the rest ahead', () {
    final s = nextStepStages(docsDone: false, all: const []);
    expect(s.map((e) => e.$1).toList(), NextStepStage.values);
    expect(s.map((e) => e.$2).toList(), [
      StampState.done,
      StampState.current,
      StampState.ahead,
      StampState.ahead,
      StampState.ahead,
    ]);
  });

  test('TARTIB (D8): documents done and no university yet → choosing is current', () {
    final s = nextStepStages(docsDone: true, all: const []);
    expect(s[2], (NextStepStage.university, StampState.current));
    expect(s[1].$2, StampState.done);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/presentation/training_strings.dart';

void main() {
  group('TrainingStrings.forTrack', () {
    test('en + english both return the English surface', () {
      expect(TrainingStrings.forTrack('en').tabTitle, 'Training Center');
      expect(TrainingStrings.forTrack('english').tabTitle, 'Training Center');
    });

    test('ko + korean both return the Korean surface', () {
      expect(TrainingStrings.forTrack('ko').tabTitle, '트레이닝 센터');
      expect(TrainingStrings.forTrack('korean').tabTitle, '트레이닝 센터');
    });

    test('unknown / null falls back to Uzbek', () {
      expect(TrainingStrings.forTrack(null).tabTitle, 'Trening markazi');
      expect(TrainingStrings.forTrack('').tabTitle, 'Trening markazi');
      expect(TrainingStrings.forTrack('ru').tabTitle, 'Trening markazi');
    });

    test('all three locales define every field (no nulls)', () {
      for (final track in const ['en', 'ko', 'uz']) {
        final s = TrainingStrings.forTrack(track);
        expect(s.tabTitle.isNotEmpty, isTrue);
        expect(s.studyPlanCardTitle.isNotEmpty, isTrue);
        expect(s.interviewCardTitle.isNotEmpty, isTrue);
        expect(s.applyCta.isNotEmpty, isTrue);
        expect(s.endInterview.isNotEmpty, isTrue);
        expect(s.micRequired.isNotEmpty, isTrue);
      }
    });
  });
}

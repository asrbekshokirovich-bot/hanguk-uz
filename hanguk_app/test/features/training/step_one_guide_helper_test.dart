import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/step_one_guide_helper.dart';

void main() {
  group('normalizeTrack', () {
    test('maps short codes', () {
      expect(normalizeTrack('en'), 'english');
      expect(normalizeTrack('ko'), 'korean');
    });

    test('maps legacy long-form codes (audit F5)', () {
      expect(normalizeTrack('english'), 'english');
      expect(normalizeTrack('korean'), 'korean');
    });

    test('unknown or null falls back to uzbek (largest cohort)', () {
      expect(normalizeTrack(null), 'uzbek');
      expect(normalizeTrack(''), 'uzbek');
      expect(normalizeTrack('ru'), 'uzbek');
      expect(normalizeTrack('uz'), 'uzbek');
    });
  });
}

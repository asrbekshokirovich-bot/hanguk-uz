import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/plan_sections.dart';

void main() {
  test('the four parts survive a round trip', () {
    final parts = ['I want to study robotics.', 'Korea leads in chips.\nSecond line.', '', 'Return home and teach.'];
    final text = serializePlan(parts);
    expect(text, contains('## Goal'));
    expect(text, isNot(contains('## Why this university')));
    expect(parsePlan(text), parts);
  });

  test('nothing written is an empty draft', () {
    expect(serializePlan(['', ' ', '', '']), isEmpty);
    expect(parsePlan(''), ['', '', '', '']);
  });

  test('a draft without markers goes into the first part', () {
    expect(parsePlan('An old free-form plan.'), ['An old free-form plan.', '', '', '']);
  });

  test('a part counts as written from the minimum length on', () {
    expect(writtenParts(['x' * kPlanMinChars, 'short', '', 'y' * 100]), 2);
  });

  test('dictation is appended after a space and kept within the limit', () {
    expect(appendDictation('', 'men koreyani', 300), 'men koreyani');
    expect(appendDictation('Salom.', 'men', 300), 'Salom. men');
    expect(appendDictation('Salom. ', 'men', 300), 'Salom. men');
    expect(appendDictation('abc', '   ', 300), 'abc');
    expect(appendDictation('x' * 298, 'yyyy', 300).length, 300);
  });
}

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

  test('dictation never cuts a part already over the limit, and adds nothing to it (audit P-F3)', () {
    final long = 'x' * 1200;
    expect(appendDictation(long, 'men koreyani', 300), long);
    expect(appendDictation(long, '', 300), long);
    expect(appendDictation('x' * 300, 'yana', 300), 'x' * 300);
  });

  test('a plan without markers longer than a part may grow stays whole (audit P-F3)', () {
    final legacy = List.filled(40, 'Eski ekranda yozilgan uzun reja.').join(' ');
    expect(legacy.length, greaterThan(kPlanMaxChars));
    expect(parsePlan(legacy), [legacy, '', '', '']);
    expect(parsePlan(serializePlan(parsePlan(legacy))), [legacy, '', '', '']);
  });

  test('AI prose loses its markdown marks', () {
    const raw = '### 1. 📊 Overall Score\n**Good** start, *keep* going.\n\n---\n\n\n* **❌ "I like"**\n   * note\n```json\n{}\n```';
    final out = plainFeedbackText(raw);
    expect(out, isNot(contains('#')));
    expect(out, isNot(contains('*')));
    expect(out, isNot(contains('---')));
    expect(out, isNot(contains('```')));
    expect(out, startsWith('1. 📊 Overall Score\nGood start, keep going.'));
    expect(out, contains('• ❌ "I like"'));
    expect(out, contains('   • note'));
  });
}


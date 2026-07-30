import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/training/data/local_dictionary.dart';

/// Runs against the real bundled asset — the same ~370k-word file the app
/// ships — because the dictionary IS the feature. A unit test against a toy
/// wordlist would happily pass while the shipped file was missing, unsorted,
/// or CRLF-terminated, all of which break the byte-level binary search.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalDictionary dict;

  setUpAll(() async {
    final loaded = await LocalDictionary.load();
    expect(loaded, isNotNull, reason: 'the bundled asset must load');
    dict = loaded!;
  });

  test('the shipped wordlist is intact', () {
    expect(dict.wordCount, greaterThan(300000));
    // Ends of the sorted range — a truncated or unsorted file fails here.
    expect(dict.contains('a'), isTrue);
    expect(dict.contains('zebra'), isTrue);
  });

  group('lookup', () {
    test('everyday essay words are accepted', () {
      for (final w in [
        'the', 'university', 'study', 'plan', 'korea', 'korean',
        'scholarship', 'engineering', 'because', 'future', 'dream',
      ]) {
        expect(dict.contains(w), isTrue, reason: '"$w" must be accepted');
      }
    });

    test('typos are rejected', () {
      for (final w in ['tahden', 'tashkrnt', 'xojamurod', 'universety']) {
        expect(dict.contains(w), isFalse, reason: '"$w" must be rejected');
      }
    });
  });

  group('check', () {
    test("flags exactly the misspellings in the reporter's own draft", () {
      // The verbatim text from the phone screenshot that reported the
      // checker "does not work at all".
      const draft = 'i am xojamurod ai tahden';

      final flagged = dict.check(draft);
      final words = flagged.map((m) => m.word).toList();

      expect(words, ['xojamurod', 'tahden']);
      // "i" is a single letter, "am" is a word, "ai" is in the wordlist —
      // none of them may be flagged.

      // Every range must slice the draft back to the word it claims.
      for (final m in flagged) {
        expect(draft.substring(m.start, m.end), m.word);
      }
    });

    test('a clean sentence produces no marks', () {
      expect(
        dict.check('I want to study computer science in Korea.'),
        isEmpty,
      );
    });

    test('capitalized words are out of jurisdiction', () {
      // Proper nouns — names, cities, universities — can never be enumerated
      // by a fixed wordlist, so anything with an uppercase letter is skipped.
      expect(
        dict.check('Xojamurod is from Tashkent and applies to Yonsei'),
        isEmpty,
      );
    });

    test('acronyms are not flagged', () {
      expect(dict.check('My TOPIK level and IELTS score'), isEmpty);
    });

    test('non-ASCII words are left alone', () {
      // Korean, and Uzbek with its modifier-letter apostrophe (oʻ) — both
      // outside an English wordlist's jurisdiction.
      expect(dict.check('한국어 공부 wants oʻqish'), isEmpty);
    });

    test('contractions and possessives are understood', () {
      expect(
        dict.check("I don't know the university's ranking, it's fine"),
        isEmpty,
      );
    });

    test('ranges survive position in a longer text', () {
      const draft = 'I study hard. My frend helps me evry day.';
      final flagged = dict.check(draft);
      expect(flagged.map((m) => m.word), ['frend', 'evry']);
      for (final m in flagged) {
        expect(draft.substring(m.start, m.end), m.word);
      }
    });
  });

  group('suggest', () {
    test('a one-letter slip finds its word', () {
      expect(dict.suggest('universety'), contains('university'));
      expect(dict.suggest('frend'), contains('friend'));
    });

    test('suggestions are real dictionary words', () {
      for (final s in dict.suggest('tahden')) {
        expect(dict.contains(s), isTrue);
      }
    });

    test('an unrecognisable word gets no guess', () {
      // Underline without a chip is honest; a wrong "fix" one tap away from
      // an admission essay is not.
      expect(dict.suggest('xqzvwjkp'), isEmpty);
    });
  });
}

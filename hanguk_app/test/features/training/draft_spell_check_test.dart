import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/training/data/draft_spell_checker.dart';
import 'package:hanguk_app/features/training/presentation/widgets/ai_highlighting_text_controller.dart';

/// A spell check service that answers with whatever the test hands it.
class _FakeSpellCheckService implements SpellCheckService {
  _FakeSpellCheckService(this._reply);

  final Future<List<SuggestionSpan>?> Function(Locale, String) _reply;
  int calls = 0;

  @override
  Future<List<SuggestionSpan>?> fetchSpellCheckSuggestions(
    Locale locale,
    String text,
  ) {
    calls++;
    return _reply(locale, text);
  }
}

SuggestionSpan _span(int start, int end, List<String> suggestions) =>
    SuggestionSpan(TextRange(start: start, end: end), suggestions);

void main() {
  group('the underline never changes the text', () {
    // The renderer slices the draft into spans and advances a cursor. If two
    // flagged ranges overlap it can emit the same characters twice — and the
    // student watches letters duplicate themselves inside the field while
    // they type. Overlaps are not hypothetical here: the AI supervisor flags
    // phrases seconds after the fact while the dictionary flags single words
    // on the next keystroke, so the two routinely describe the same region of
    // a draft that has already moved on.
    //
    // Whatever is flagged, the rendered characters must equal the draft.
    const draft = 'Hi my name is Asrbek. I live in tashkrnt';

    late BuildContext context;

    Future<void> pumpContext(WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (c) {
              context = c;
              return const SizedBox();
            },
          ),
        ),
      );
    }

    String render(AiHighlightingTextController controller) => controller
        .buildTextSpan(context: context, style: null, withComposing: false)
        .toPlainText();

    testWidgets('with no issues at all', (tester) async {
      await pumpContext(tester);
      final c = AiHighlightingTextController(text: draft);
      expect(render(c), draft);
    });

    testWidgets('with a plain misspelling', (tester) async {
      await pumpContext(tester);
      final c = AiHighlightingTextController(text: draft);
      c.setSpellingIssues([
        GrammarIssue(
          start: 32,
          end: 40,
          originalText: 'tashkrnt',
          suggestion: 'Tashkent',
        ),
      ]);
      expect(render(c), draft);
    });

    testWidgets('when the AI and the dictionary flag the same word', (
      tester,
    ) async {
      await pumpContext(tester);
      final c = AiHighlightingTextController(text: draft);
      // The AI flags the whole clause; the dictionary flags one word inside
      // it. This is the overlap that used to duplicate text.
      c.setIssues([
        GrammarIssue(
          start: 22,
          end: 40,
          originalText: 'I live in tashkrnt',
          suggestion: 'I live in Tashkent',
        ),
      ]);
      c.setSpellingIssues([
        GrammarIssue(
          start: 32,
          end: 40,
          originalText: 'tashkrnt',
          suggestion: 'Tashkent',
        ),
      ]);
      expect(render(c), draft);
    });

    testWidgets('when a stale range reaches past the end of the draft', (
      tester,
    ) async {
      await pumpContext(tester);
      // The student deleted a chunk while a check was in flight.
      final c = AiHighlightingTextController(text: 'Hi my name is');
      c.setSpellingIssues([
        GrammarIssue(
          start: 32,
          end: 40,
          originalText: 'tashkrnt',
          suggestion: 'Tashkent',
        ),
      ]);
      expect(render(c), 'Hi my name is');
    });

    testWidgets('with ghost text present as well', (tester) async {
      await pumpContext(tester);
      final c = AiHighlightingTextController(text: draft);
      c.setSpellingIssues([
        GrammarIssue(
          start: 32,
          end: 40,
          originalText: 'tashkrnt',
          suggestion: 'Tashkent',
        ),
      ]);
      c.setGhostText(', Uzbekistan');
      // The ghost is a preview, so it is the one thing that may legitimately
      // add characters — the draft itself must still be intact underneath.
      expect(render(c), startsWith(draft));
      expect(render(c), contains(', Uzbekistan'));
    });
  });

  group('mergeIssues', () {
    GrammarIssue at(int start, int end, [String suggestion = 'x']) =>
        GrammarIssue(
          start: start,
          end: end,
          originalText: 'w',
          suggestion: suggestion,
        );

    test('keeps both when they do not touch', () {
      final merged = AiHighlightingTextController.mergeIssues(
        [at(0, 5)],
        [at(10, 15)],
      );
      expect(merged, hasLength(2));
    });

    test('the AI wins a contested range', () {
      // It carries a real rewrite; the dictionary only knows one word is
      // unrecognised.
      final merged = AiHighlightingTextController.mergeIssues(
        [at(0, 20, 'the AI rewrite')],
        [at(10, 15, 'word')],
      );
      expect(merged, hasLength(1));
      expect(merged.single.suggestion, 'the AI rewrite');
    });

    test('adjacent ranges are not treated as overlapping', () {
      // end is exclusive: 0-5 and 5-10 share no character.
      final merged = AiHighlightingTextController.mergeIssues(
        [at(0, 5)],
        [at(5, 10)],
      );
      expect(merged, hasLength(2));
    });

    test('output is sorted by start', () {
      final merged = AiHighlightingTextController.mergeIssues(
        [at(30, 35), at(0, 5)],
        [at(10, 15)],
      );
      expect(merged.map((i) => i.start), [0, 10, 30]);
    });

    test('malformed ranges are dropped', () {
      final merged = AiHighlightingTextController.mergeIssues(
        [at(-3, 2), at(9, 9)],
        [at(20, 10)],
      );
      expect(merged, isEmpty);
    });
  });

  group('DraftSpellChecker', () {
    test('reports the misspelled word and its suggestions', () async {
      final service = _FakeSpellCheckService(
        (_, _) async => [
          _span(32, 40, ['Tashkent', 'Tashkurghan']),
        ],
      );
      final checker = DraftSpellChecker(service: service);

      final result = await checker.check(
        const Locale('en', 'US'),
        'Hi my name is Asrbek. I live in tashkrnt',
      );

      expect(result, hasLength(1));
      expect(result!.single.word, 'tashkrnt');
      expect(result.single.suggestions.first, 'Tashkent');
    });

    test('empty text is clean, not unknown', () async {
      // An emptied draft has to clear the marks, so it must not come back as
      // null ("leave things as they are").
      final checker = DraftSpellChecker(
        service: _FakeSpellCheckService((_, _) async => null),
      );
      expect(await checker.check(const Locale('en', 'US'), '   '), isEmpty);
    });

    test('a null reply is "unknown", not "all correct"', () async {
      // The service returns null both for a cancelled request and for a
      // platform with no dictionary. Reporting that as an empty list would
      // wipe every underline off the screen.
      final checker = DraftSpellChecker(
        service: _FakeSpellCheckService((_, _) async => null),
      );
      expect(await checker.check(const Locale('en', 'US'), 'hello'), isNull);
    });

    test('ranges past the end of the text are clamped away', () async {
      final checker = DraftSpellChecker(
        service: _FakeSpellCheckService(
          (_, _) async => [
            _span(0, 99, ['hello']),
            _span(50, 60, ['gone']),
          ],
        ),
      );

      final result = await checker.check(const Locale('en', 'US'), 'helo');
      expect(result, hasLength(1));
      expect(result!.single.word, 'helo');
      expect(result.single.end, 4);
    });

    test('a platform with no spell checker is asked only once', () async {
      final service = _FakeSpellCheckService(
        (_, _) async => throw MissingPluginException('no spell check'),
      );
      final checker = DraftSpellChecker(service: service);

      expect(await checker.check(const Locale('en', 'US'), 'hello'), isNull);
      expect(checker.availability, SpellCheckAvailability.unavailable);

      expect(await checker.check(const Locale('en', 'US'), 'again'), isNull);
      expect(service.calls, 1, reason: 'must stop asking after the first no');
    });

    test('one platform error does not disable checking', () async {
      // A transient failure is not the same as "this device cannot do it".
      var thrown = false;
      final service = _FakeSpellCheckService((_, _) async {
        if (!thrown) {
          thrown = true;
          throw PlatformException(code: 'busy');
        }
        return <SuggestionSpan>[];
      });
      final checker = DraftSpellChecker(service: service);

      expect(await checker.check(const Locale('en', 'US'), 'hello'), isNull);
      expect(checker.availability, isNot(SpellCheckAvailability.unavailable));
      expect(await checker.check(const Locale('en', 'US'), 'hello'), isEmpty);
      expect(checker.availability, SpellCheckAvailability.available);
    });

    test('a device that fails every call is given up on', () async {
      // The Android shape of "this ROM has no spell checker": the native
      // session comes back null, the call throws, and because the engine only
      // frees its pending slot on success every later request is refused too.
      // That never recovers, so it must stop being asked on every keystroke.
      final service = _FakeSpellCheckService(
        (_, _) async => throw PlatformException(
          code: 'error',
          message: 'Previous spell check request still pending.',
        ),
      );
      final checker = DraftSpellChecker(service: service);

      for (var i = 0; i < 3; i++) {
        expect(await checker.check(const Locale('en', 'US'), 'word $i'), isNull);
      }
      expect(checker.availability, SpellCheckAvailability.unavailable);

      final callsSoFar = service.calls;
      await checker.check(const Locale('en', 'US'), 'more');
      expect(service.calls, callsSoFar, reason: 'stop hammering a dead service');
    });

    test('requests do not overlap', () async {
      // Overlapping our own requests is what provokes the Android "still
      // pending" rejection, which would otherwise look like a broken device.
      final gate = Completer<List<SuggestionSpan>?>();
      final service = _FakeSpellCheckService((_, _) async => gate.future);
      final checker = DraftSpellChecker(service: service);

      final first = checker.check(const Locale('en', 'US'), 'one');
      final second = await checker.check(const Locale('en', 'US'), 'two');

      expect(second, isNull, reason: 'declined while one is in flight');
      expect(service.calls, 1, reason: 'only one request may be out');

      gate.complete(<SuggestionSpan>[]);
      expect(await first, isEmpty);

      // ...and the checker is usable again once the first one lands.
      expect(await checker.check(const Locale('en', 'US'), 'three'), isEmpty);
      expect(service.calls, 2);
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/onboarding/data/quiz_controller.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';
import 'package:hanguk_app/features/onboarding/presentation/contact_sheet_s04.dart';
import 'package:hanguk_app/features/onboarding/presentation/quiz_s02_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

class _Quiz extends QuizNotifier {
  _Quiz(this.s);
  final QuizState s;
  @override
  QuizState build() => s;
}

Widget _app(Widget home, {QuizState quiz = const QuizState()}) => ProviderScope(
  overrides: [quizProvider.overrideWith(() => _Quiz(quiz))],
  child: MaterialApp(
    locale: const Locale('uz'),
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    home: home,
  ),
);

void main() {
  group('isTashkentWorkingHours (Mon–Sat 09:40–18:00, UTC+5)', () {
    // 2026-10-05 is a Monday. Tashkent = UTC + 5.
    DateTime tashkent(int day, int h, int m) =>
        DateTime.utc(2026, 10, day, h, m).subtract(const Duration(hours: 5));

    test('opens at 09:40 and closes at 18:00', () {
      expect(isTashkentWorkingHours(tashkent(5, 9, 39)), isFalse);
      expect(isTashkentWorkingHours(tashkent(5, 9, 40)), isTrue);
      expect(isTashkentWorkingHours(tashkent(5, 17, 59)), isTrue);
      expect(isTashkentWorkingHours(tashkent(5, 18, 0)), isFalse);
    });

    test('Saturday is a working day, Sunday is not', () {
      expect(isTashkentWorkingHours(tashkent(10, 12, 0)), isTrue);
      expect(isTashkentWorkingHours(tashkent(11, 12, 0)), isFalse);
    });

    test('the after-hours banner names the day of the call', () {
      expect(tashkentNextCallDay(tashkent(6, 12, 0)), isNull);
      expect(tashkentNextCallDay(tashkent(6, 8, 0)), NextCallDay.today);
      expect(tashkentNextCallDay(tashkent(6, 19, 0)), NextCallDay.tomorrow);
      // Friday evening → Saturday is a working day.
      expect(tashkentNextCallDay(tashkent(9, 19, 0)), NextCallDay.tomorrow);
      expect(tashkentNextCallDay(tashkent(10, 8, 0)), NextCallDay.today);
      expect(tashkentNextCallDay(tashkent(10, 18, 0)), NextCallDay.monday);
      expect(tashkentNextCallDay(tashkent(11, 8, 0)), NextCallDay.monday);
      expect(tashkentNextCallDay(tashkent(11, 23, 0)), NextCallDay.monday);
    });
  });

  testWidgets('S02: Davom etish waits for an answer, then moves on', (t) async {
    await t.pumpWidget(_app(const QuizScreen()));
    expect(find.text('1 / 11'), findsOneWidget);

    await t.tap(find.text('Davom etish'));
    await t.pump();
    expect(find.text('1 / 11'), findsOneWidget);

    await t.tap(find.text('Bakalavr'));
    await t.pump();
    await t.tap(find.text('Davom etish'));
    await t.pump();
    expect(find.text('2 / 11'), findsOneWidget);
  });

  testWidgets('S04 opens on the success state once submitted', (t) async {
    await t.pumpWidget(
      _app(
        Consumer(
          builder: (context, ref, _) => TextButton(
            onPressed: () => showContactSheet(context, ref),
            child: const Text('open'),
          ),
        ),
        quiz: const QuizState(
          answers: QuizAnswers(route: StudyRoute.bachelor),
          submittedPhone: '+998901234567',
          submittedName: 'Dilnoza',
        ),
      ),
    );
    await t.tap(find.text('open'));
    await t.pumpAndSettle();
    expect(
      find.text("Rahmat, Dilnoza! Operator 10 daqiqada qo'ng'iroq qiladi."),
      findsOneWidget,
    );
    expect(find.text('+998 90 123 45 67'), findsOneWidget);
    expect(find.text("Operator qo'ng'iroq qilsin"), findsNothing);
  });
}

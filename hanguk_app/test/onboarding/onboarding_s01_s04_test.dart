import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/features/entry/data/entry_store.dart';
import 'package:hanguk_app/features/onboarding/data/quiz_controller.dart';
import 'package:hanguk_app/features/onboarding/data/quiz_repository.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';
import 'package:hanguk_app/features/onboarding/presentation/contact_sheet_s04.dart';
import 'package:hanguk_app/features/onboarding/presentation/quiz_s02_screen.dart';
import 'package:hanguk_app/features/onboarding/presentation/welcome_s01_screen.dart';
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

class _Entry extends EntryNotifier {
  @override
  EntryState build() => const EntryState(languageCode: 'uz');
  @override
  Future<void> setRegistered(String phone) async => state = state.copyWith(phone: phone);
}

class _Repo implements QuizRepository {
  @override
  Future<EligibilityRules> fetchRules() async => const EligibilityRules();
  @override
  Future<QuizSubmitResult> submit({
    required String phoneE164,
    required String name,
    required Map<String, dynamic> answers,
    required Map<String, dynamic> result,
  }) async =>
      QuizSubmitResult(QuizSubmitStatus.ok, phone: phoneE164);
  @override
  Future<String?> botUsername() async => null;
}

const _result = EligibilityResult(
  band: EligibilityBand.mid,
  score: 2,
  factors: [],
  universities: [],
  steps: [],
  paths: [],
  tariff: Tariff.premium,
  needsOperator: false,
);

/// The result screen stand-in at `/` (a button opening S04) and the
/// universities at `/guest`.
Widget _routed() {
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, _) => Scaffold(
          body: Consumer(
            builder: (context, ref, _) => TextButton(
              onPressed: () => showContactSheet(context, ref, openTelegramAfter: false),
              child: const Text('open'),
            ),
          ),
        ),
      ),
      GoRoute(path: '/guest', builder: (_, _) => const Scaffold(body: Text('UNIVERSITETLAR'))),
    ],
  );
  return ProviderScope(
    overrides: [
      quizProvider.overrideWith(
        () => _Quiz(const QuizState(answers: QuizAnswers(route: StudyRoute.bachelor))),
      ),
      entryProvider.overrideWith(_Entry.new),
      quizRepositoryProvider.overrideWithValue(_Repo()),
      eligibilityResultProvider.overrideWithValue(const AsyncValue.data(_result)),
      // A Tuesday, 12:00 Tashkent: no after-hours banner.
      contactSheetClockProvider.overrideWithValue(() => DateTime.utc(2026, 10, 6, 7)),
    ],
    child: MaterialApp.router(
      locale: const Locale('uz'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      routerConfig: router,
    ),
  );
}

Future<void> _send(WidgetTester t) async {
  await t.tap(find.text('open'));
  await t.pumpAndSettle();
  await t.enterText(find.byType(TextField).at(0), 'Dilnoza');
  await t.enterText(find.byType(TextField).at(1), '901234567');
  await t.tap(find.text("Operator qo'ng'iroq qilsin"));
  await t.pump();
  await t.pump();
}

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

  test('S01 photos: each photo once', () {
    expect(kWelcomePhotoAssets, hasLength(10));
    expect(kWelcomePhotoAssets.toSet(), hasLength(kWelcomePhotoAssets.length));
  });

  testWidgets('S01: the photo changes every 4 seconds, then starts over', (t) async {
    await t.pumpWidget(
      ProviderScope(
        overrides: [entryProvider.overrideWith(_Entry.new)],
        child: MaterialApp(
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: const OnboardingWelcomeScreen(),
        ),
      ),
    );
    String shown() => ((t.widgetList<Image>(find.byType(Image)).last.image) as AssetImage).assetName;

    expect(shown(), kWelcomePhotoAssets[0]);
    await t.pump(kWelcomePhotoInterval);
    await t.pump(const Duration(seconds: 1));
    expect(shown(), kWelcomePhotoAssets[1]);
    for (var i = 1; i < kWelcomePhotoAssets.length; i++) {
      await t.pump(kWelcomePhotoInterval);
    }
    await t.pump(const Duration(seconds: 1));
    expect(shown(), kWelcomePhotoAssets[0]);
  });

  testWidgets('S02: Davom etish waits for an answer, then moves on', (t) async {
    await t.pumpWidget(_app(const QuizScreen()));
    expect(find.text('1 / 10'), findsOneWidget);

    await t.tap(find.text('Davom etish'));
    await t.pump();
    expect(find.text('1 / 10'), findsOneWidget);

    await t.tap(find.text('Bakalavr — universitet, 4 yil'));
    await t.pump();
    await t.tap(find.text('Davom etish'));
    await t.pump();
    expect(find.text('2 / 10'), findsOneWidget);
  });

  testWidgets('S02 question 8 asks for the KDB deposit, with the amounts for the route', (t) async {
    Future<void> show(StudyRoute route) => t.pumpWidget(
      ProviderScope(
        key: ValueKey(route),
        overrides: [
          quizProvider.overrideWith(() => _Quiz(QuizState(answers: QuizAnswers(route: route), step: 8))),
          eligibilityRulesProvider.overrideWith((_) async => const EligibilityRules()),
        ],
        child: MaterialApp(
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: const QuizScreen(),
        ),
      ),
    );

    await show(StudyRoute.bachelor);
    await t.pump();
    expect(find.text('8 / 10'), findsOneWidget);
    expect(find.text("Talaba nomiga bankda depozit qo'ya olasizmi?"), findsOneWidget);
    expect(find.textContaining('\$12\u00A0500'), findsOneWidget);
    expect(find.textContaining('kamida 1 oy'), findsOneWidget);

    await show(StudyRoute.languageCourse);
    await t.pump();
    expect(find.textContaining('\$6\u00A0300'), findsOneWidget);
    expect(find.textContaining('kamida 3 oy'), findsOneWidget);
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

  testWidgets('after sending, the thank-you moves on to the universities', (t) async {
    await t.pumpWidget(_routed());
    await _send(t);
    expect(find.text("Rahmat, Dilnoza! Operator 10 daqiqada qo'ng'iroq qiladi."), findsOneWidget);
    expect(find.text('UNIVERSITETLAR'), findsNothing);

    await t.pump(kContactSuccessLeaveAfter);
    await t.pumpAndSettle();
    expect(find.text('UNIVERSITETLAR'), findsOneWidget);
  });

  testWidgets('"Natijaga qaytish" before that stays on the result', (t) async {
    await t.pumpWidget(_routed());
    await _send(t);
    await t.tap(find.text('Natijaga qaytish'));
    await t.pumpAndSettle();

    await t.pump(kContactSuccessLeaveAfter * 2);
    await t.pumpAndSettle();
    expect(find.text('UNIVERSITETLAR'), findsNothing);
    expect(find.text('open'), findsOneWidget);
  });

  testWidgets('reopened on an already sent result, the sheet does not move on', (t) async {
    await t.pumpWidget(_routed());
    await _send(t);
    await t.tap(find.text('Natijaga qaytish'));
    await t.pumpAndSettle();

    await t.tap(find.text('open'));
    await t.pumpAndSettle();
    expect(find.text("Rahmat, Dilnoza! Operator 10 daqiqada qo'ng'iroq qiladi."), findsOneWidget);
    await t.pump(kContactSuccessLeaveAfter * 2);
    await t.pumpAndSettle();
    expect(find.text('UNIVERSITETLAR'), findsNothing);
  });
}

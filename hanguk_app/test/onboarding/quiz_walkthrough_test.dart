import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/onboarding/data/quiz_controller.dart';
import 'package:hanguk_app/features/onboarding/data/quiz_repository.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';
import 'package:hanguk_app/features/onboarding/onboarding_routes.dart';
import 'package:hanguk_app/features/onboarding/presentation/quiz_s02_screen.dart';
import 'package:hanguk_app/features/onboarding/presentation/result_texts.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

/// The whole quiz, the way a customer goes through it: every question in
/// every language, on a small phone with a large font, and every combination
/// of answers through the result.

Widget _quiz(Locale locale, {required Size size, double textScale = 1}) {
  final router = GoRouter(
    initialLocation: kQuizPath,
    routes: [
      GoRoute(path: kQuizPath, builder: (_, _) => const QuizScreen()),
      GoRoute(path: kQuizResultPath, builder: (_, _) => const Scaffold(body: Text('RESULT'))),
      GoRoute(path: '/welcome', builder: (_, _) => const Scaffold(body: Text('WELCOME'))),
    ],
  );
  return ProviderScope(
    overrides: [eligibilityRulesProvider.overrideWith((_) async => const EligibilityRules())],
    child: MediaQuery(
      data: MediaQueryData(size: size, textScaler: TextScaler.linear(textScale)),
      child: MaterialApp.router(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        routerConfig: router,
      ),
    ),
  );
}

/// The option rows on screen (each one is a tappable Semantics button).
Finder _options() => find.byWidgetPredicate(
  (w) => w is Semantics && w.properties.button == true && w.properties.selected != null,
);

void main() {
  const locales = [Locale('uz'), Locale('ru'), Locale('en'), Locale('ko')];

  for (final locale in locales) {
    for (final routeIndex in [0, 1, 2, 3]) {
      testWidgets('${locale.languageCode}, route option ${routeIndex + 1}: all 11 questions, '
          'small phone, large font', (t) async {
        t.view.physicalSize = const Size(320 * 2, 568 * 2);
        t.view.devicePixelRatio = 2;
        addTearDown(t.view.reset);
        await t.pumpWidget(_quiz(locale, size: const Size(320, 568), textScale: 1.3));
        await t.pumpAndSettle();
        final l = await AppLocalizations.delegate.load(locale);
        final container = ProviderScope.containerOf(t.element(find.byType(QuizScreen)));

        final titles = <String>{};
        for (var step = 1; step <= kQuizSteps; step++) {
          expect(find.text('$step / $kQuizSteps'), findsOneWidget, reason: 'step $step');
          expect(t.takeException(), isNull, reason: 'step $step overflows');

          // Nothing chosen yet: "Davom etish" does nothing.
          if (!container.read(quizProvider).answers.isComplete(step)) {
            await t.ensureVisible(find.text(l.onbQuizContinue));
            await t.tap(find.text(l.onbQuizContinue));
            await t.pump();
            expect(find.text('$step / $kQuizSteps'), findsOneWidget, reason: 'step $step moved on unanswered');
          }

          // Every question has its own title.
          final title = switch (step) {
            1 => l.onbQuizQ1,
            2 => l.onbQuizAgeQ,
            3 => routeIndex == 2 ? l.onbQuizGradQMaster : l.onbQuizGradQ,
            4 => l.onbQuizQ3,
            5 => l.onbQuizIeltsQ,
            6 => l.onbQuizBudgetQ,
            7 => l.onbQuizPayerQ,
            8 => l.onbQuizQ5,
            9 => l.onbQuizKdbQ,
            10 => l.onbQuizRegionQ,
            _ => l.onbQuizIntakeQ,
          };
          expect(find.text(title), findsOneWidget, reason: 'step $step title');
          expect(titles.add(title), isTrue, reason: 'step $step repeats a title');

          // Pick an answer (the route under test on the first question).
          final opts = _options();
          if (step == 2) {
            await t.tap(find.text('19'));
          } else {
            final count = t.widgetList(opts).length;
            expect(count, greaterThan(1), reason: 'step $step has options');
            final i = step == 1 ? routeIndex : count - 1;
            await t.ensureVisible(opts.at(i));
            await t.tap(opts.at(i));
          }
          await t.pump();
          expect(container.read(quizProvider).answers.isComplete(step), isTrue, reason: 'step $step answer');

          await t.ensureVisible(find.text(l.onbQuizContinue));
          await t.tap(find.text(l.onbQuizContinue));
          await t.pumpAndSettle();
        }
        expect(find.text('RESULT'), findsOneWidget);
        final a = container.read(quizProvider).answers;
        expect(a.isAllComplete, isTrue);
        expect(a.route, StudyRoute.values[[0, 1, 2, 3][routeIndex]]);
      });
    }
  }

  testWidgets('"Orqaga" goes back one question and keeps the answer', (t) async {
    await t.pumpWidget(_quiz(const Locale('uz'), size: const Size(390, 844)));
    await t.pumpAndSettle();
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    await t.tap(find.text(l.onbQuizRouteMaster));
    await t.pump();
    await t.tap(find.text(l.onbQuizContinue));
    await t.pumpAndSettle();
    expect(find.text('2 / $kQuizSteps'), findsOneWidget);
    await t.tap(find.bySemanticsLabel(l.onbQuizBack));
    await t.pumpAndSettle();
    expect(find.text('1 / $kQuizSteps'), findsOneWidget);
    final container = ProviderScope.containerOf(t.element(find.byType(QuizScreen)));
    expect(container.read(quizProvider).answers.route, StudyRoute.master);
    await t.tap(find.bySemanticsLabel(l.onbQuizBack));
    await t.pumpAndSettle();
    expect(find.text('WELCOME'), findsOneWidget);
  });

  testWidgets('a master is asked about the bachelor\'s; the deposit hint follows the route', (t) async {
    await t.pumpWidget(_quiz(const Locale('uz'), size: const Size(390, 844)));
    await t.pumpAndSettle();
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    final container = ProviderScope.containerOf(t.element(find.byType(QuizScreen)));
    final quiz = container.read(quizProvider.notifier);

    quiz.update((x) => x.copyWith(route: StudyRoute.master));
    quiz.next();
    quiz.next();
    await t.pumpAndSettle();
    expect(find.text(l.onbQuizGradQMaster), findsOneWidget);
    expect(find.text(l.onbQuizGradHint), findsNothing);

    // Back to question 1, the route changes to the language course.
    quiz.back();
    quiz.back();
    quiz.update((x) => x.copyWith(route: StudyRoute.languageCourse));
    for (var i = 0; i < 8; i++) {
      quiz.next();
    }
    await t.pumpAndSettle();
    expect(find.text('9 / $kQuizSteps'), findsOneWidget);
    expect(find.textContaining('\$6 300'), findsOneWidget);
    expect(find.textContaining('3 oy'), findsOneWidget);
  });

  group('every combination of answers', () {
    final catalog = [
      for (final (id, topik, region, english, ielts) in [
        ('K2', 2, '대구', false, null),
        ('K3', 3, '서울', false, null),
        ('K4', 4, '경기', false, null),
        ('E55', null, '경북', true, 5.5),
        ('E65', null, '서울', true, 6.5),
      ])
        for (final degree in ['bakalavr', 'magistratura'])
          CatalogUniversity(
            institutionId: '$id-$degree',
            guidelines: [
              CatalogGuideline(
                id: 'g-$id-$degree',
                institutionId: '$id-$degree',
                univNameEn: '$id University',
                degree: degree,
                koreanTrack: !english,
                englishTrack: english,
                topikMin: topik,
                ieltsMin: ielts,
                currency: 'KRW',
                tuitionMin: 3000000,
                tuitionMax: 3000000,
                tuitionPeriod: 'semestr',
                ieqasStatus: 'accredited',
                isActive: true,
                regionCode: region,
              ),
            ],
          ),
    ];

    test('the result keeps its rules for all of them, and its text builds in every language', () async {
      final ls = [for (final c in locales) await AppLocalizations.delegate.load(c)];
      final rules = const EligibilityRules();
      var n = 0;
      final bands = <EligibilityBand, int>{};
      for (final route in StudyRoute.values) {
        for (final korean in KoreanLevel.values) {
          for (final english in EnglishLevel.values) {
            for (final budget in Budget.values) {
              for (final payer in Payer.values) {
                for (final income in [true, false]) {
                  for (final kdb in KdbDeposit.values) {
                    for (final (age, grad, studying) in [(19, 2026, false), (31, 2020, false), (17, null, true)]) {
                      final a = QuizAnswers(
                        route: route,
                        age: age,
                        gradYear: grad,
                        stillStudying: studying,
                        korean: korean,
                        english: english,
                        budget: budget,
                        payer: payer,
                        formalIncome: income,
                        kdb: kdb,
                        region: 'Toshkent',
                        intake: Intake.fall2027,
                      );
                      expect(a.isAllComplete, isTrue);
                      final r = evaluateEligibility(a, catalog: catalog, now: DateTime(2026, 10, 6));
                      n++;
                      bands[r.band] = (bands[r.band] ?? 0) + 1;
                      final why = '$route $korean $english $budget $income $kdb age $age';
                      final minus = r.factors.where((f) => !f.positive).map((f) => f.kind).toSet();

                      // A low result always says why; others never do.
                      expect(r.lowReason != null, r.band == EligibilityBand.low, reason: why);
                      // A low result shows the ways forward; others never do.
                      expect(r.paths.isNotEmpty, r.band == EligibilityBand.low, reason: why);

                      // The language the embassy asks for.
                      final topikOk = korean != KoreanLevel.unknown && korean.topik >= rules.topikMin(route);
                      if (!topikOk && korean != KoreanLevel.unknown && !(route.isDegree && english.ielts >= 5.5)) {
                        expect(r.band, EligibilityBand.low, reason: 'no certificate: $why');
                      }
                      // No deposit: never better than low.
                      if (kdb == KdbDeposit.no) expect(r.band, EligibilityBand.low, reason: why);
                      // High needs the deposit, the income, the language, and no soft point.
                      if (r.band == EligibilityBand.high) {
                        expect(kdb, KdbDeposit.ready, reason: why);
                        expect(income, isTrue, reason: why);
                        expect(minus, isEmpty, reason: why);
                      }
                      // A "not sure" deposit is never high; nor is a "not sure"
                      // Korean level, unless IELTS already meets the language rule.
                      final englishMet = r.factors.any((f) => f.kind == FactorKind.englishStrong);
                      if (kdb == KdbDeposit.unknown || (korean == KoreanLevel.unknown && !englishMet)) {
                        expect(r.band, isNot(EligibilityBand.high), reason: why);
                      }
                      // Two "not sure" answers ask the operator.
                      if (kdb == KdbDeposit.unknown && korean == KoreanLevel.unknown) {
                        expect(r.needsOperator, isTrue, reason: why);
                      }
                      // The language course and the college have no catalogue.
                      if (!route.isDegree) expect(r.universities, isEmpty, reason: why);
                      // A university is offered only on what the applicant has.
                      for (final m in r.universities) {
                        final g = m.guideline;
                        final viaKorean = g.koreanTrack == true && (korean == KoreanLevel.unknown || (g.topikMin ?? 0) <= korean.topik);
                        final viaEnglish = g.englishTrack == true && english.ielts >= (g.ieltsMin ?? 5.5);
                        expect(viaKorean || viaEnglish, isTrue, reason: '${g.institutionId}: $why');
                        expect(m.bankStatementUsd, greaterThanOrEqualTo(g.inCapitalArea ? 15500 : 12500), reason: why);
                      }
                      expect(r.universities.length, lessThanOrEqualTo(rules.maxUniversities));
                      expect(r.steps.length, inInclusiveRange(2, 3), reason: why);
                      if (r.yearlyCostUsd != null) {
                        expect(r.yearlyCostUsd!.$1, lessThanOrEqualTo(r.yearlyCostUsd!.$2), reason: why);
                      }

                      // Every word of it exists in every language.
                      if (n % 7 == 0) {
                        for (final l in ls) {
                          final text = planText(l, a, r);
                          expect(text.trim(), isNotEmpty);
                          expect(bandNote(l, r.band, r.lowReason), isNotEmpty);
                          for (final f in r.factors) {
                            expect(factorLabel(l, f.kind), isNotEmpty);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      expect(n, 4 * 7 * 5 * 4 * 3 * 2 * 4 * 3);
      // All three bands occur.
      expect(bands.keys.toSet(), EligibilityBand.values.toSet());
    });
  });
}

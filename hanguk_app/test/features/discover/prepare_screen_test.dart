import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/widgets/fd_kit.dart' show FdColors;
import 'package:hanguk_app/design_system/seoul_night/widgets/lucide.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart' show catalogProvider;
import 'package:hanguk_app/features/discover/data/guest_ai_usage.dart';
import 'package:hanguk_app/features/discover/data/prepare_progress.dart';
import 'package:hanguk_app/features/discover/presentation/prepare_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

/// «Tayyorgarlik» as the owner approved it (Claude Design canvas
/// «Tayyorgarlik», 2026-11-10): the guest's page is D4 with its preparing and
/// failed interview row (boards 1–3); the student's page shows what the
/// student has done (board 4, variant A).
void main() {
  /// [statusBar]: the phone's status bar, in logical pixels (the boards draw 48).
  Future<void> pump(
    WidgetTester t, {
    bool signedIn = false,
    Locale locale = const Locale('uz'),
    PrepareProgress? done,
    double statusBar = 0,
  }) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    if (statusBar > 0) t.view.padding = FakeViewPadding(top: statusBar);
    addTearDown(t.view.reset);
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          guestAiUsageProvider.overrideWith((ref) async => null),
          prepareProgressProvider.overrideWith((ref) async => done),
          signedInProvider.overrideWithValue(signedIn),
          catalogProvider.overrideWith((ref) async => const []),
        ],
        child: MaterialApp(
          locale: locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(body: PrepareScreen(signedIn: signedIn)),
        ),
      ),
    );
    await t.pump();
    await t.pump();
  }

  Finder chevrons() => find.byWidgetPredicate((w) => w is Lucide && w.glyph == LucideIcons.chevronRight);

  /// The column of texts in the row or card whose title is [title].
  Finder texts(String title) => find.ancestor(of: find.text(title), matching: find.byType(Column)).first;

  /// The chevron's gap to the texts of the row whose title is [title].
  double chevronGap(WidgetTester t, String title) {
    final row = find.ancestor(of: texts(title), matching: find.byType(Row)).first;
    return t.getTopLeft(find.descendant(of: row, matching: chevrons())).dx - t.getTopRight(texts(title)).dx;
  }

  group('guest (D4)', () {
    testWidgets('the D4 texts, and the sign-in button at the bottom of the page', (t) async {
      await pump(t);
      expect(find.text('Tayyorgarlik'), findsOneWidget);
      expect(find.text('tayyorgarlik'), findsNothing, reason: 'the title was the second half of a two-part heading');
      expect(find.text('Hanguk AI'), findsOneWidget);
      expect(find.text('Suhbat mashqi'), findsOneWidget);
      expect(find.text('Study Plan'), findsOneWidget);
      expect(find.byWidgetPredicate((w) => w is Lucide && w.glyph == LucideIcons.messageCircle), findsOneWidget);
      final button = t.getCenter(find.text('Mijoz kodi bilan kirish')).dy;
      final lastRow = t.getBottomLeft(find.text('Study Plan')).dy;
      expect(button, greaterThan(740), reason: 'pinned to the bottom, as in D4');
      expect(button - lastRow, greaterThan(200));
    });

    testWidgets('in English the title is «Preparation», not «university»', (t) async {
      await pump(t, locale: const Locale('en'));
      expect(find.text('Preparation'), findsOneWidget);
      expect(find.text('university'), findsNothing);
    });

    testWidgets('the interview row: preparing at once, one request per wait, failure with retry, then the interview', (t) async {
      final session = prepareGuestSession;
      final screen = prepareInterviewScreen;
      addTearDown(() {
        prepareGuestSession = session;
        prepareInterviewScreen = screen;
      });
      var calls = 0;
      late Completer<bool> pending;
      prepareGuestSession = () {
        calls++;
        pending = Completer<bool>();
        return pending.future;
      };
      prepareInterviewScreen = () => const Text('interview open');
      final l = lookupAppLocalizations(const Locale('uz'));

      await pump(t);
      await t.tap(find.text('Suhbat mashqi'));
      await t.pump();
      expect(find.text(l.interviewSettingUp), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // A second tap while it is being prepared asks for nothing more.
      await t.tap(find.text('Suhbat mashqi'));
      await t.pump();
      expect(calls, 1);

      pending.complete(false);
      await t.pump();
      expect(find.text(l.entryErrorNetwork), findsOneWidget);
      expect(find.text(l.commonRetry), findsOneWidget);
      expect(find.text('interview open'), findsNothing);

      await t.tap(find.text(l.commonRetry));
      await t.pump();
      expect(calls, 2);
      expect(find.text(l.interviewSettingUp), findsOneWidget);

      pending.complete(true);
      await t.pumpAndSettle();
      expect(find.text('interview open'), findsOneWidget);
    });

    testWidgets('board 1: the title 8px under the status bar, the chevrons 12px from the texts', (t) async {
      await pump(t, statusBar: 48);
      expect(t.getTopLeft(find.text('Tayyorgarlik')).dy, moreOrLessEquals(56, epsilon: 0.01), reason: 'board 1: 48 + 8');
      expect(chevronGap(t, 'Hanguk AI'), moreOrLessEquals(12, epsilon: 0.01));
      expect(chevronGap(t, 'Suhbat mashqi'), moreOrLessEquals(12, epsilon: 0.01));
    });

    testWidgets('the interview row keeps the chevron\'s room while it is prepared and when it failed (ru: no reflow)', (t) async {
      final session = prepareGuestSession;
      addTearDown(() => prepareGuestSession = session);
      final pending = Completer<bool>();
      prepareGuestSession = () => pending.future;
      final l = lookupAppLocalizations(const Locale('ru'));
      final title = find.text(l.interviewPracticeTitle);
      final row = find.ancestor(of: texts(l.interviewPracticeTitle), matching: find.byType(Row)).first;

      await pump(t, locale: const Locale('ru'));
      final width = t.getSize(texts(l.interviewPracticeTitle)).width;
      final titleHeight = t.getSize(title).height;
      expect(find.descendant(of: row, matching: chevrons()), findsOneWidget);

      await t.tap(title);
      await t.pump();
      expect(find.text(l.interviewSettingUp), findsOneWidget);
      expect(find.descendant(of: row, matching: chevrons()), findsNothing, reason: 'preparing: nothing to tap');
      expect(t.getSize(texts(l.interviewPracticeTitle)).width, moreOrLessEquals(width, epsilon: 0.01), reason: 'preparing');
      expect(t.getSize(title).height, moreOrLessEquals(titleHeight, epsilon: 0.01), reason: 'preparing');

      pending.complete(false);
      await t.pump();
      expect(find.text(l.entryErrorNetwork), findsOneWidget);
      expect(find.descendant(of: row, matching: chevrons()), findsNothing, reason: 'failed: the retry button is the tap');
      expect(t.getSize(texts(l.interviewPracticeTitle)).width, moreOrLessEquals(width, epsilon: 0.01), reason: 'failed');
      expect(t.getSize(title).height, moreOrLessEquals(titleHeight, epsilon: 0.01), reason: 'failed');
    });

    testWidgets('the sign-in button is a button to a screen reader', (t) async {
      final semantics = t.ensureSemantics();
      try {
        await pump(t);
        expect(
          t.getSemantics(find.text('Mijoz kodi bilan kirish')),
          containsSemantics(label: 'Mijoz kodi bilan kirish', isButton: true, hasTapAction: true),
        );
      } finally {
        semantics.dispose();
      }
    });
  });

  group('student (variant A)', () {
    testWidgets('what the student has done: «1 / 4 bosqich», «2 ta mashq», a chevron, not «→»', (t) async {
      await pump(t, signedIn: true, done: const PrepareProgress(planParts: 1, interviews: 2));
      expect(find.text('1 / 4 bosqich'), findsOneWidget);
      expect(find.text('2 ta mashq'), findsOneWidget);
      expect(find.text('→'), findsNothing);
      expect(find.byWidgetPredicate((w) => w is Lucide && w.glyph == LucideIcons.chevronRight), findsOneWidget);
    });

    testWidgets('no practice yet says «Yangi»', (t) async {
      await pump(t, signedIn: true, done: const PrepareProgress(planParts: 0, interviews: 0));
      expect(find.text('0 / 4 bosqich'), findsOneWidget);
      expect(find.text('Yangi'), findsOneWidget);
    });

    testWidgets('while unknown, no number at all (it said «0 / 4» and «Yangi» to everyone)', (t) async {
      await pump(t, signedIn: true);
      expect(find.text('0 / 4 bosqich'), findsNothing);
      expect(find.text('Yangi'), findsNothing);
    });

    testWidgets('the Study Plan meter: none while unknown, its room kept; four steps for 0 and for 1', (t) async {
      final l = lookupAppLocalizations(const Locale('uz'));
      final card = find.ancestor(of: find.text(l.fdPrepareStudyPlanTitle), matching: find.byType(Container)).first;
      // The meter's steps, or only the lit ones.
      Finder steps({bool lit = false}) => find.descendant(
        of: card,
        matching: find.byWidgetPredicate((w) {
          if (w is! Container || w.constraints != const BoxConstraints.tightFor(height: 6)) return false;
          final d = w.decoration;
          return !lit || (d is BoxDecoration && d.color == FdColors.lime);
        }),
      );

      await pump(t, signedIn: true);
      expect(steps(), findsNothing, reason: 'an empty meter reads as «0 / 4» before the number is known');
      final unknown = t.getSize(card).height;

      await t.pumpWidget(const SizedBox());
      await pump(t, signedIn: true, done: const PrepareProgress(planParts: 0, interviews: 0));
      expect(steps(), findsNWidgets(4));
      expect(steps(lit: true), findsNothing);
      expect(t.getSize(card).height, moreOrLessEquals(unknown, epsilon: 0.01), reason: 'the card does not grow when the number comes');

      await t.pumpWidget(const SizedBox());
      await pump(t, signedIn: true, done: const PrepareProgress(planParts: 1, interviews: 0));
      expect(steps(), findsNWidgets(4));
      expect(steps(lit: true), findsOneWidget);
    });

    testWidgets('board 4: the title 8px under the status bar, 8px between a kicker and its tag, the chevron 12px from the texts', (t) async {
      final l = lookupAppLocalizations(const Locale('uz'));
      await pump(t, signedIn: true, done: const PrepareProgress(planParts: 1, interviews: 2), statusBar: 48);
      expect(
        t.getTopLeft(find.text('${l.fdPrepareEyebrow} ${l.fdPrepareTitle}')).dy,
        moreOrLessEquals(56, epsilon: 0.01),
        reason: 'board 4: 48 + 8',
      );
      for (final (kicker, tag) in [(l.fdPrepareStudyKicker, '1 / 4 bosqich'), (l.fdPrepareInterviewKicker, '2 ta mashq')]) {
        final gap = t.getTopLeft(find.text(tag)).dx - t.getTopRight(find.text(kicker)).dx;
        expect(gap, moreOrLessEquals(8, epsilon: 0.01), reason: kicker);
      }
      expect(chevronGap(t, l.fdPrepareAskTitle), moreOrLessEquals(12, epsilon: 0.01));
    });
  });
}

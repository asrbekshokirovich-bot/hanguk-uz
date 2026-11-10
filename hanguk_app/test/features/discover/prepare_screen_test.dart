import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
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
  Future<void> pump(WidgetTester t, {bool signedIn = false, Locale locale = const Locale('uz'), PrepareProgress? done}) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
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
  });
}

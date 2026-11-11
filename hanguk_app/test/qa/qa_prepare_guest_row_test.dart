// QA audit evidence (Tayyorgarlik D2/T2, commit 47ecd0b) — not to be merged.
//
// Checks that hold (all QA-OK):
// 1. Analytics names. `tracked(name, fn)` hands back a callback typed more
//    narrowly than VoidCallback (one returning a Future) unwrapped
//    (tracked.dart:26-28), and the row now passes the Future<void> tear-off
//    `_openInterview` (prepare_screen.dart:185, :218). In a VoidCallback
//    context the type argument is inferred as VoidCallback, so the tear-off
//    is still wrapped and both taps keep their names (first CI run of this
//    PR: the tear-off was named).
// 2. The row's "only while this page is in front" gate (Visibility.of +
//    ModalRoute.isCurrent) and the mounted check.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/tracked.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart' show catalogProvider;
import 'package:hanguk_app/features/discover/data/guest_ai_usage.dart';
import 'package:hanguk_app/features/discover/data/prepare_progress.dart';
import 'package:hanguk_app/features/discover/presentation/prepare_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

void main() {
  late List<TrackedEvent> seen;
  late Future<bool> Function() session;
  late Widget Function() interview;

  setUp(() {
    seen = [];
    AppEvents.debugReset();
    AppEvents.debugOnTrack = seen.add;
    session = prepareGuestSession;
    interview = prepareInterviewScreen;
    prepareInterviewScreen = () => const Text('QA interview open');
  });

  tearDown(() {
    AppEvents.debugOnTrack = null;
    prepareGuestSession = session;
    prepareInterviewScreen = interview;
  });

  /// The names of the `tap` events recorded so far.
  List<String?> taps() => [
    for (final e in seen)
      if (e.event == 'tap') e.element,
  ];

  Future<AppLocalizations> pump(WidgetTester t, Widget page) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          guestAiUsageProvider.overrideWith((ref) async => null),
          prepareProgressProvider.overrideWith((ref) async => null),
          signedInProvider.overrideWithValue(false),
          catalogProvider.overrideWith((ref) async => const []),
        ],
        child: MaterialApp(
          // As main.dart: every tap is recorded, named by the tracked callback.
          builder: (context, child) => AnalyticsRoot(child: child!),
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: Scaffold(body: page),
        ),
      ),
    );
    await t.pump();
    await t.pump();
    return AppLocalizations.delegate.load(const Locale('uz'));
  }

  Future<void> settle(WidgetTester t) async {
    for (var i = 0; i < 15; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  group('analytics names of the guest interview row', () {
    test('QA-OK: in a VoidCallback context tracked() names a Future-returning tear-off too', () async {
      var ran = 0;
      Future<void> open() async {
        ran++;
      }

      final VoidCallback closure = tracked('qa.closure', () => open());
      final VoidCallback tearOff = tracked('qa.tear_off', open);
      closure();
      await Future<void>.delayed(Duration.zero);
      tearOff();
      await Future<void>.delayed(Duration.zero);
      expect(ran, 2, reason: 'both ran');
      expect(taps(), ['qa.closure', 'qa.tear_off']);
    });

    testWidgets('QA-OK: a tap on «Suhbat mashqi» is recorded as prepare.guest_interview', (t) async {
      final pending = Completer<bool>();
      prepareGuestSession = () => pending.future;
      final l = await pump(t, const PrepareScreen());

      await t.tap(find.text(l.interviewPracticeTitle));
      await t.pump();
      final names = taps();
      pending.complete(false);
      await t.pump();
      expect(names, contains('prepare.guest_interview'), reason: 'tap events recorded: $names');
    });

    testWidgets('QA-OK: a tap on «Qayta urinish» is recorded as prepare.guest_interview_retry', (t) async {
      prepareGuestSession = () async => false;
      final l = await pump(t, const PrepareScreen());
      await t.tap(find.text(l.interviewPracticeTitle));
      await t.pump();
      await t.pump();
      expect(find.text(l.commonRetry), findsOneWidget);

      seen.clear();
      await t.tap(find.text(l.commonRetry));
      await t.pump();
      await t.pump();
      final names = taps();
      expect(names, contains('prepare.guest_interview_retry'), reason: 'tap events recorded: $names');
    });
  });

  group('the interview opens only over this page', () {
    testWidgets('QA-OK: ready while the guest is on another tab: nothing opens, then or on coming back', (t) async {
      final pending = Completer<bool>();
      prepareGuestSession = () => pending.future;
      var tab = 0;
      late StateSetter setTab;
      final l = await pump(
        t,
        StatefulBuilder(
          builder: (context, setState) {
            setTab = setState;
            return IndexedStack(index: tab, children: const [PrepareScreen(), Center(child: Text('QA other tab'))]);
          },
        ),
      );
      await t.tap(find.text(l.interviewPracticeTitle));
      await t.pump();
      expect(find.text(l.interviewSettingUp), findsOneWidget);

      setTab(() => tab = 1);
      await t.pump();
      pending.complete(true);
      await settle(t);
      expect(find.text('QA interview open'), findsNothing);

      setTab(() => tab = 0);
      await settle(t);
      expect(find.text('QA interview open'), findsNothing);
      expect(find.text(l.interviewSettingUp), findsNothing, reason: 'the row is back to ready');
    });

    testWidgets('QA-OK: ready while another screen is over the page: it does not open over that screen', (t) async {
      final pending = Completer<bool>();
      prepareGuestSession = () => pending.future;
      final l = await pump(t, const PrepareScreen());
      await t.tap(find.text(l.interviewPracticeTitle));
      await t.pump();
      unawaited(
        Navigator.of(t.element(find.byType(PrepareScreen))).push(
          MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Center(child: Text('QA other screen')))),
        ),
      );
      await settle(t);
      pending.complete(true);
      await settle(t);
      expect(find.text('QA interview open'), findsNothing);
      expect(find.text('QA other screen'), findsOneWidget);
    });

    testWidgets('QA-OK: the page is gone before the session comes: no setState after dispose', (t) async {
      final pending = Completer<bool>();
      prepareGuestSession = () => pending.future;
      final l = await pump(t, const PrepareScreen());
      await t.tap(find.text(l.interviewPracticeTitle));
      await t.pump();
      await t.pumpWidget(const SizedBox());
      pending.complete(true);
      await t.pump();
      expect(t.takeException(), isNull);
    });
  });
}

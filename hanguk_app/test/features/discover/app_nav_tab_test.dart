// The bottom nav of a screen pushed over the home (the Study Plan, the
// interview from Tayyorgarlik) closes it and opens the tab tapped, on the real
// shells and the app's own routes (audit C-F1, 2026-11-10).
//
// goOverPushed closes the pushed screens, then `go`es to '/?tab=N' (student)
// or discoverTabPath(N) (guest). The shells took their tab from the URL only
// when it CHANGED, while a tab picked in the home's own nav never touches the
// URL: when the tab tapped was the URL's tab, the screen closed and the shell
// stayed where it was. And for a guest, discoverTabPath(0) was '/guest', which
// the /guest route reads as AppTab.home (the round button), not Universitetlar.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/core/router/app_router.dart' show $homeRoute, guestHomeRoute;
import 'package:hanguk_app/features/applications/data/applications_repository.dart';
import 'package:hanguk_app/features/applications/data/journey_repository.dart';
import 'package:hanguk_app/features/applications/domain/application.dart';
import 'package:hanguk_app/features/applications/domain/application_journey.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/client/presentation/client_shell.dart';
import 'package:hanguk_app/features/discover/data/application_windows.dart';
import 'package:hanguk_app/features/discover/data/guest_ai_usage.dart';
import 'package:hanguk_app/features/discover/data/prepare_progress.dart';
import 'package:hanguk_app/features/discover/presentation/discover_routes.dart';
import 'package:hanguk_app/features/discover/presentation/discover_shell.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/fd_bottom_nav.dart';
import 'package:hanguk_app/features/documents/data/documents_repository.dart';
import 'package:hanguk_app/features/documents/domain/document.dart';
import 'package:hanguk_app/features/university_choices/data/university_choices_repository.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

const _pushedText = 'Pushed screen';

Future<void> _settle(WidgetTester t, [int frames = 20]) async {
  for (var i = 0; i < frames; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

Future<AppLocalizations> _pump(WidgetTester t, GoRouter router, {required bool signedIn}) async {
  t.view.physicalSize = const Size(390 * 3, 844 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  const List<StudentApplication> apps = [];
  const List<AppDocument> docs = [];
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        applicationsProvider.overrideWith((ref) async => apps),
        applicationJourneyProvider.overrideWith(
          (ref) async => const ApplicationJourney(facts: JourneyFacts(), universities: []),
        ),
        documentsProvider.overrideWith((ref) async => docs),
        studentFullNameProvider.overrideWith((ref) async => 'Dilnoza Karimova'),
        catalogProvider.overrideWith((ref) async => const []),
        applicationWindowsProvider.overrideWith((ref) async => const {}),
        myUniversityChoicesProvider.overrideWith((ref) async => const []),
        signedInProvider.overrideWithValue(signedIn),
        prepareProgressProvider.overrideWith((ref) async => null),
        guestAiUsageProvider.overrideWith((ref) async => null),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('uz'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
      ),
    ),
  );
  await _settle(t, 5);
  return AppLocalizations.delegate.load(const Locale('uz'));
}

/// The tab [shell] (ClientShell or DiscoverShell) shows.
int _shellTab(WidgetTester t, Type shell) =>
    t.widget<IndexedStack>(find.descendant(of: find.byType(shell), matching: find.byType(IndexedStack)).first).index ?? -1;

/// Taps [label] in the bottom nav under [of].
Future<void> _tapNav(WidgetTester t, Finder of, String label) async {
  final nav = find.descendant(of: of, matching: find.byType(FdBottomNav));
  await t.tap(find.descendant(of: nav, matching: find.text(label)).first);
  await _settle(t);
}

/// A screen pushed over the home the way PrepareScreen._push does it:
/// pageless, in the home's NavScaffold.
Future<void> _pushOverHome(WidgetTester t, Finder shell) async {
  final navigator = Navigator.of(t.element(shell));
  unawaited(
    navigator.push(
      MaterialPageRoute<void>(
        settings: const RouteSettings(name: 'interview'),
        builder: (_) => const NavScaffold(current: AppTab.prepare, child: Center(child: Text(_pushedText))),
      ),
    ),
  );
  await _settle(t);
  expect(find.text(_pushedText), findsOneWidget);
}

void main() {
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        final args = (call.arguments as Map?) ?? const {};
        final key = args['key'];
        // Every page tour already seen, so no tour timers run.
        if (call.method == 'read' && key is String && key.endsWith('_tour_seen_v1')) return '1';
        return null;
      },
    );
  });

  group('student (ClientShell, the app\'s own / route)', () {
    testWidgets('«Arizam» from a screen pushed over Tayyorgarlik closes it and opens Arizam', (t) async {
      final router = GoRouter(initialLocation: '/', routes: [$homeRoute]);
      addTearDown(router.dispose);
      final l = await _pump(t, router, signedIn: true);
      expect(_shellTab(t, ClientShell), AppTab.application, reason: 'the student opens on Arizam (URL "/")');

      await _tapNav(t, find.byType(ClientShell), l.fdNavPrepare);
      expect(_shellTab(t, ClientShell), AppTab.prepare);

      await _pushOverHome(t, find.byType(ClientShell));
      await _tapNav(t, find.byType(NavScaffold), l.fdNavApplication);

      expect(find.text(_pushedText), findsNothing, reason: 'the pushed screen closed');
      expect(
        _shellTab(t, ClientShell),
        AppTab.application,
        reason:
            'the student tapped Arizam; the URL went "/" -> "${router.routeInformationProvider.value.uri}", '
            'both tab ${AppTab.application}: the shell must open it though the URL\'s tab did not change',
      );
    });

    testWidgets('«Hujjatlar» (a tab not already in the URL) opens too', (t) async {
      final router = GoRouter(initialLocation: '/', routes: [$homeRoute]);
      addTearDown(router.dispose);
      final l = await _pump(t, router, signedIn: true);
      await _tapNav(t, find.byType(ClientShell), l.fdNavPrepare);
      await _pushOverHome(t, find.byType(ClientShell));
      await _tapNav(t, find.byType(NavScaffold), l.fdNavDocuments);
      expect(find.text(_pushedText), findsNothing);
      expect(_shellTab(t, ClientShell), AppTab.documents);
    });

    testWidgets('the round button from a pushed screen, the URL already on its tab, opens its page', (t) async {
      final router = GoRouter(initialLocation: '/?tab=${AppTab.home}', routes: [$homeRoute]);
      addTearDown(router.dispose);
      final l = await _pump(t, router, signedIn: true);
      expect(_shellTab(t, ClientShell), AppTab.home);

      await _tapNav(t, find.byType(ClientShell), l.fdNavPrepare);
      await _pushOverHome(t, find.byType(ClientShell));
      await t.tap(find.descendant(of: find.byType(NavScaffold), matching: find.byType(FdNavOrb)));
      await _settle(t);

      expect(find.text(_pushedText), findsNothing);
      expect(
        _shellTab(t, ClientShell),
        AppTab.home,
        reason: 'URL "/?tab=${AppTab.home}" -> "${router.routeInformationProvider.value.uri}"',
      );
    });
  });

  group('guest (DiscoverShell, the app\'s own /guest route)', () {
    testWidgets('the round button from a screen pushed over Tayyorgarlik opens the round button\'s page', (t) async {
      final router = GoRouter(initialLocation: kDiscoverPath, routes: [guestHomeRoute()]);
      addTearDown(router.dispose);
      final l = await _pump(t, router, signedIn: false);
      expect(_shellTab(t, DiscoverShell), AppTab.home, reason: 'a guest opens on the round button\'s page');

      await _tapNav(t, find.byType(DiscoverShell), l.fdNavPrepare);
      expect(_shellTab(t, DiscoverShell), AppTab.prepare);

      await _pushOverHome(t, find.byType(DiscoverShell));
      await t.tap(find.descendant(of: find.byType(NavScaffold), matching: find.byType(FdNavOrb)));
      await _settle(t);

      expect(find.text(_pushedText), findsNothing, reason: 'the pushed screen closed');
      expect(
        _shellTab(t, DiscoverShell),
        AppTab.home,
        reason: 'URL "/guest" -> "${router.routeInformationProvider.value.uri}": both are tab ${AppTab.home}',
      );
    });

    testWidgets('«Universitetlar» from a screen pushed over Tayyorgarlik opens Universitetlar', (t) async {
      final router = GoRouter(initialLocation: kDiscoverPath, routes: [guestHomeRoute()]);
      addTearDown(router.dispose);
      final l = await _pump(t, router, signedIn: false);
      await _tapNav(t, find.byType(DiscoverShell), l.fdNavPrepare);
      await _pushOverHome(t, find.byType(DiscoverShell));
      await _tapNav(t, find.byType(NavScaffold), l.fdNavUniversities);

      expect(find.text(_pushedText), findsNothing, reason: 'the pushed screen closed');
      expect(
        _shellTab(t, DiscoverShell),
        AppTab.universities,
        reason:
            'discoverTabPath(0) = "${discoverTabPath(AppTab.universities)}" must not read as AppTab.home; '
            'URL now "${router.routeInformationProvider.value.uri}"',
      );
    });

    testWidgets('after the URL holds ?tab=1, «Universitetlar» from a pushed screen opens Universitetlar', (t) async {
      // '/guest?tab=1' is where a pushed screen's «Tayyorgarlik» leaves the URL.
      final router = GoRouter(initialLocation: '$kDiscoverPath?tab=${AppTab.prepare}', routes: [guestHomeRoute()]);
      addTearDown(router.dispose);
      final l = await _pump(t, router, signedIn: false);
      expect(_shellTab(t, DiscoverShell), AppTab.prepare);

      await _pushOverHome(t, find.byType(DiscoverShell));
      await _tapNav(t, find.byType(NavScaffold), l.fdNavUniversities);

      expect(find.text(_pushedText), findsNothing, reason: 'the pushed screen closed');
      expect(
        _shellTab(t, DiscoverShell),
        AppTab.universities,
        reason: 'go("${discoverTabPath(AppTab.universities)}") must not be read as AppTab.home (${AppTab.home})',
      );
    });
  });
}

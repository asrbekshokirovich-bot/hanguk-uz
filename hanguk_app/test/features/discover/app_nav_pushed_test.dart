import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';

/// The bottom nav on a screen pushed over the home with `Navigator.push`
/// (the Study Plan, the interview from Tayyorgarlik). `go` to the home's own
/// path with another `?tab=` used to switch the tab underneath and leave the
/// pushed screen on top (2026-11-10: 51 of 75 nav taps on the interview).
///
/// The homes here keep the app's own rules (audit C-F12: they did not, so
/// C-F1 passed): a bare `/guest` is the round button's page and a bare `/` the
/// student's Arizam, as app_router.dart reads them; the URL's tab is read when
/// it changes; a tab picked in the home's own nav leaves the URL as it is; and
/// a tab asked for from a pushed screen ([kAppTabRequest]) opens.
void main() {
  int tabOf(GoRouterState s, int fallback) => int.tryParse(s.uri.queryParameters['tab'] ?? '') ?? fallback;

  GoRouter router({String initial = '/guest?tab=1'}) => GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(path: '/guest', builder: (_, s) => _Home(tab: tabOf(s, AppTab.home))),
      GoRoute(path: '/', builder: (_, s) => _Home(tab: tabOf(s, AppTab.application))),
    ],
  );

  Future<void> pumpApp(WidgetTester tester, GoRouter r, {bool signedIn = false}) async {
    addTearDown(r.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [signedInProvider.overrideWithValue(signedIn)],
        child: MaterialApp.router(routerConfig: r),
      ),
    );
    await tester.pumpAndSettle();
  }

  String url(GoRouter r) => r.routeInformationProvider.value.uri.toString();

  setUp(() {
    _Saving.saves = 0;
    _Stays.asked = 0;
  });

  testWidgets('a guest: the tab opens and the pushed screen closes', (tester) async {
    final r = router();
    await pumpApp(tester, r);
    expect(find.text('home tab 1'), findsOneWidget);

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsOneWidget);

    await tester.tap(find.text('nav ${AppTab.universities}'));
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab ${AppTab.universities}'), findsOneWidget);
    expect(url(r), '/guest?tab=${AppTab.universities}', reason: 'a bare /guest is the round button\'s page');
  });

  testWidgets('a guest on a bare /guest is on the round button\'s page', (tester) async {
    await pumpApp(tester, router(initial: '/guest'));
    expect(find.text('home tab ${AppTab.home}'), findsOneWidget);
  });

  testWidgets('a student: the same on the client home', (tester) async {
    await pumpApp(tester, router(initial: '/?tab=1'), signedIn: true);
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav ${AppTab.universities}'));
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab ${AppTab.universities}'), findsOneWidget);
  });

  group('the tab tapped is the URL\'s tab', () {
    testWidgets('a student on "/" (Arizam) picks Tayyorgarlik, then «Arizam» from a pushed screen', (tester) async {
      final r = router(initial: '/');
      await pumpApp(tester, r, signedIn: true);
      await tester.tap(find.text('local ${AppTab.prepare}'));
      await tester.pumpAndSettle();
      expect(find.text('home tab ${AppTab.prepare}'), findsOneWidget);
      expect(url(r), '/', reason: 'the home\'s own nav leaves the URL as it is');

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('nav ${AppTab.application}'));
      await tester.pumpAndSettle();
      expect(find.text('pushed'), findsNothing);
      expect(find.text('home tab ${AppTab.application}'), findsOneWidget);
    });

    testWidgets('a guest on a bare /guest picks Tayyorgarlik, then the round button from a pushed screen', (
      tester,
    ) async {
      await pumpApp(tester, router(initial: '/guest'));
      await tester.tap(find.text('local ${AppTab.prepare}'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('nav ${AppTab.home}'));
      await tester.pumpAndSettle();
      expect(find.text('pushed'), findsNothing);
      expect(find.text('home tab ${AppTab.home}'), findsOneWidget);
    });

    testWidgets('the very same URL: /guest?tab=1, Universitetlar picked, then «Tayyorgarlik» from a pushed screen', (
      tester,
    ) async {
      final r = router();
      await pumpApp(tester, r);
      await tester.tap(find.text('local ${AppTab.universities}'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('nav ${AppTab.prepare}'));
      await tester.pumpAndSettle();
      expect(url(r), '/guest?tab=${AppTab.prepare}');
      expect(find.text('pushed'), findsNothing);
      expect(find.text('home tab ${AppTab.prepare}'), findsOneWidget);
    });
  });

  testWidgets('a screen that saves on its way out saves first, then closes; a newer tap meanwhile wins', (
    tester,
  ) async {
    await pumpApp(tester, router());
    await tester.tap(find.text('open saving'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav ${AppTab.universities}'));
    await tester.pump(const Duration(milliseconds: 100));
    // Still saving: the screen is there, the tab has not moved.
    expect(find.text('pushed'), findsOneWidget);
    expect(_Saving.saves, 1);

    // A second tap while it saves is not dropped: it is the tab that opens.
    // The screen is asked again and goes on with the same save, as the Study
    // Plan does, so nothing more is saved or closed.
    await tester.tap(find.text('nav ${AppTab.documents}'));
    await tester.pumpAndSettle();
    expect(_Saving.saves, 1);
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab ${AppTab.documents}'), findsOneWidget, reason: 'the home is still there, on the newer tab');
  });

  testWidgets('a screen that stays when asked opens no tab, then or when it goes later', (tester) async {
    final r = router();
    await pumpApp(tester, r);
    await tester.tap(find.text('open staying'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav ${AppTab.universities}'));
    await tester.pumpAndSettle();
    expect(_Stays.asked, 1);
    expect(find.text('pushed'), findsOneWidget, reason: 'it stayed');
    expect(url(r), '/guest?tab=1');

    // Later the student leaves it by its own back button.
    await tester.tap(find.text('back'));
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab 1'), findsOneWidget, reason: 'back is back, not the tab it once said no to');
    expect(url(r), '/guest?tab=1');
  });

  testWidgets('a link opened while a screen saves wins over the tab asked for before it', (tester) async {
    final r = router();
    await pumpApp(tester, r);
    await tester.tap(find.text('open saving'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav ${AppTab.universities}'));
    await tester.pump(const Duration(milliseconds: 100));
    r.go('/guest?tab=${AppTab.application}');
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab ${AppTab.application}'), findsOneWidget);
    expect(url(r), '/guest?tab=${AppTab.application}');
  });
}

/// A home that takes its tab the way ClientShell and DiscoverShell do.
class _Home extends StatefulWidget {
  const _Home({required this.tab});

  final int tab;

  @override
  State<_Home> createState() => _HomeState();
}

class _HomeState extends State<_Home> {
  late int _tab = widget.tab;

  @override
  void initState() {
    super.initState();
    kAppTabRequest.addListener(_asked);
  }

  @override
  void dispose() {
    kAppTabRequest.removeListener(_asked);
    super.dispose();
  }

  void _asked() {
    final tab = kAppTabRequest.value?.tab;
    if (tab != null && mounted) setState(() => _tab = tab);
  }

  @override
  void didUpdateWidget(_Home old) {
    super.didUpdateWidget(old);
    if (old.tab != widget.tab) setState(() => _tab = widget.tab);
  }

  void _open(Widget screen) => unawaited(Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen)));

  @override
  Widget build(BuildContext context) => Scaffold(
    body: ListView(
      children: [
        Text('home tab $_tab'),
        for (var t = 0; t < AppTab.count; t++)
          TextButton(onPressed: () => setState(() => _tab = t), child: Text('local $t')),
        TextButton(onPressed: () => _open(const _Pushed()), child: const Text('open')),
        TextButton(onPressed: () => _open(const _Saving()), child: const Text('open saving')),
        TextButton(onPressed: () => _open(const _Stays()), child: const Text('open staying')),
      ],
    ),
  );
}

/// A pushed screen with the bottom nav: one button per [AppTab].
class _Pushed extends ConsumerWidget {
  const _Pushed();

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    body: ListView(
      children: [
        const Text('pushed'),
        for (var t = 0; t < AppTab.count; t++)
          TextButton(onPressed: () => openAppTab(context, ref, t), child: Text('nav $t')),
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('back')),
      ],
    ),
  );
}

/// Like the Study Plan: the back button saves, and the screen closes itself
/// when the save is done. Asked again while it saves, it goes on with the
/// same save.
class _Saving extends StatefulWidget {
  const _Saving();

  static int saves = 0;

  @override
  State<_Saving> createState() => _SavingState();
}

class _SavingState extends State<_Saving> {
  Future<void>? _leaving;

  Future<void> _leave() => _leaving ??= () async {
    _Saving.saves++;
    final navigator = Navigator.of(context);
    await Future<void>.delayed(const Duration(milliseconds: 400));
    if (navigator.mounted) navigator.pop();
  }();

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) unawaited(_leave());
    },
    child: const _Pushed(),
  );
}

/// Like a live interview answered "Bekor qilish": it stays, and says so.
class _Stays extends StatelessWidget {
  const _Stays();

  static int asked = 0;

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) {
      if (didPop) return;
      asked++;
      dropPendingTab();
    },
    child: const _Pushed(),
  );
}

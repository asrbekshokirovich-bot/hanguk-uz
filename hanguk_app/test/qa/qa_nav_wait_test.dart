// QA audit evidence (Tayyorgarlik T1, commit db20097) — not to be merged.
//
// goOverPushed asks the top pushed screen to close (maybePop) and then waits
// up to 20 s for it to be gone (_closeRoute, app_nav.dart:111-125), with the
// global _goingOverPushed flag set the whole time.
//  * A screen that does not close (a PopScope that keeps it, e.g. a "leave?"
//    dialog answered "stay") leaves the bottom nav dead for 20 s: every tap
//    in that time is dropped.
//  * A screen that closes after more than 20 s (a save on a slow network)
//    closes by itself later, and the tab that was asked for is dropped.
// Routes as in app_nav_pushed_test.dart (the T1 test).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';

void main() {
  GoRouter router() => GoRouter(
    initialLocation: '/?tab=1',
    routes: [GoRoute(path: '/', builder: (_, s) => _Home(tab: s.uri.queryParameters['tab'] ?? '3'))],
  );

  Future<void> pumpApp(WidgetTester tester, GoRouter r) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [signedInProvider.overrideWithValue(true)],
        child: MaterialApp.router(routerConfig: r),
      ),
    );
    await tester.pumpAndSettle();
  }

  setUp(() => _Keeps.asked = 0);

  testWidgets('QA-BUG: after a screen keeps itself open, the nav ignores taps for 20 s', (tester) async {
    final r = router();
    addTearDown(r.dispose);
    await pumpApp(tester, r);
    await tester.tap(find.text('open keeping'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav'));
    await tester.pump(const Duration(seconds: 1));
    final first = _Keeps.asked;

    // The student taps a tab again a second later.
    await tester.tap(find.text('nav'));
    await tester.pump(const Duration(seconds: 1));
    final second = _Keeps.asked;

    // goOverPushed's 20 s timer runs out; the nav answers again.
    await tester.pump(const Duration(seconds: 20));
    await tester.tap(find.text('nav'));
    await tester.pump(const Duration(seconds: 1));
    final third = _Keeps.asked;
    await tester.pump(const Duration(seconds: 21));

    expect(first, 1, reason: 'the first tap asked the screen to close');
    expect(second, 2, reason: 'the tap 1 s later was dropped (asked: $first, $second; after 20 s: $third)');
  });

  testWidgets('QA-BUG: a screen that takes more than 20 s to close drops the tab asked for', (tester) async {
    final r = router();
    addTearDown(r.dispose);
    await pumpApp(tester, r);
    expect(find.text('home tab 1'), findsOneWidget);
    await tester.tap(find.text('open slow'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav'));
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(seconds: 1));
    }
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsNothing, reason: 'the screen closed itself after its 25 s save');
    expect(find.text('home tab 0'), findsOneWidget, reason: 'the tab tapped (Universitetlar) was dropped at 20 s');
  });
}

class _Home extends StatelessWidget {
  const _Home({required this.tab});

  final String tab;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Column(
      children: [
        Text('home tab $tab'),
        TextButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const _Keeps())),
          child: const Text('open keeping'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const _Slow())),
          child: const Text('open slow'),
        ),
      ],
    ),
  );
}

class _Pushed extends ConsumerWidget {
  const _Pushed();

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    body: Column(
      children: [
        const Text('pushed'),
        TextButton(onPressed: () => openAppTab(context, ref, AppTab.universities), child: const Text('nav')),
      ],
    ),
  );
}

/// A screen that stays when asked to close (a "leave?" answered "stay").
class _Keeps extends StatelessWidget {
  const _Keeps();

  static int asked = 0;

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) asked++;
    },
    child: const _Pushed(),
  );
}

/// Like the Study Plan on a slow network: it saves for 25 s, then closes.
class _Slow extends StatelessWidget {
  const _Slow();

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) async {
      if (didPop) return;
      final navigator = Navigator.of(context);
      await Future<void>.delayed(const Duration(seconds: 25));
      if (navigator.mounted) navigator.pop();
    },
    child: const _Pushed(),
  );
}

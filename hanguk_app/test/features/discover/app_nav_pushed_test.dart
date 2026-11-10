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
void main() {
  GoRouter router({String initial = '/guest?tab=1'}) => GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(path: '/guest', builder: (_, s) => _Home(tab: s.uri.queryParameters['tab'] ?? '0')),
      GoRoute(path: '/', builder: (_, s) => _Home(tab: s.uri.queryParameters['tab'] ?? '3')),
    ],
  );

  Future<void> pumpApp(WidgetTester tester, GoRouter r, {bool signedIn = false}) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [signedInProvider.overrideWithValue(signedIn)],
        child: MaterialApp.router(routerConfig: r),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a guest: the tab opens and the pushed screen closes', (tester) async {
    await pumpApp(tester, router());
    expect(find.text('home tab 1'), findsOneWidget);

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsOneWidget);

    await tester.tap(find.text('nav'));
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab 0'), findsOneWidget);
  });

  testWidgets('a student: the same on the client home', (tester) async {
    await pumpApp(tester, router(initial: '/?tab=1'), signedIn: true);
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav'));
    await tester.pumpAndSettle();
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab 0'), findsOneWidget);
  });

  testWidgets('a screen that saves on its way out saves first, then closes', (tester) async {
    await pumpApp(tester, router());
    await tester.tap(find.text('open saving'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('nav'));
    await tester.pump(const Duration(milliseconds: 100));
    // Still saving: the screen is there, the tab has not moved.
    expect(find.text('pushed'), findsOneWidget);
    expect(_Saving.saves, 1);

    // A second tap while it saves closes nothing more.
    await tester.tap(find.text('nav'));
    await tester.pumpAndSettle();
    expect(_Saving.saves, 1);
    expect(find.text('pushed'), findsNothing);
    expect(find.text('home tab 0'), findsOneWidget);
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
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const _Pushed())),
          child: const Text('open'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const _Saving())),
          child: const Text('open saving'),
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

/// Like the Study Plan: the back button saves, and the screen closes itself
/// when the save is done.
class _Saving extends ConsumerWidget {
  const _Saving();

  static int saves = 0;

  @override
  Widget build(BuildContext context, WidgetRef ref) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) async {
      if (didPop) return;
      saves++;
      final navigator = Navigator.of(context);
      await Future<void>.delayed(const Duration(milliseconds: 400));
      if (navigator.mounted) navigator.pop();
    },
    child: const _Pushed(),
  );
}

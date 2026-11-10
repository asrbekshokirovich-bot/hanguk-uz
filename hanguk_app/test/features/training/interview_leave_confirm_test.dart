import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/features/training/data/interview_repository.dart';
import 'package:hanguk_app/features/training/presentation/interview_screen.dart';
import 'package:hanguk_app/features/training/presentation/widgets/interview_active_view.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// A nav tap, the round button or the system back during a live interview
/// ended it with no question: the screen popped, and its dispose stopped the
/// call and marked the session abandoned (audit C-F3, 2026-11-10). Now the
/// student is asked first: "Bekor qilish" keeps the call, "Suhbatni tugatish"
/// leaves as before.
class _FakeInterview extends InterviewNotifier {
  int abandoned = 0;

  @override
  InterviewSessionState build() => const InterviewSessionState(status: 'active', targetUniversityName: 'Kongju');

  @override
  Future<void> markAbandoned() async => abandoned++;
}

class _MemoryStorage extends GotrueAsyncStorage {
  final _items = <String, String>{};

  @override
  Future<String?> getItem({required String key}) async => _items[key];

  @override
  Future<void> removeItem({required String key}) async => _items.remove(key);

  @override
  Future<void> setItem({required String key, required String value}) async => _items[key] = value;
}

void main() {
  setUpAll(() async {
    await Supabase.initialize(
      url: 'https://example.supabase.co',
      anonKey: 'test-anon-key',
      authOptions: FlutterAuthClientOptions(
        localStorage: const EmptyLocalStorage(),
        pkceAsyncStorage: _MemoryStorage(),
        autoRefreshToken: false,
      ),
    );
  });

  // The call stays connecting for the whole test: the microphone permission
  // never answers, so the handshake is in flight (it gives up after 30 s).
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('flutter.baseflow.com/permissions/methods'),
      (call) => Completer<Object?>().future,
    );
  });

  late _FakeInterview fake;
  late GoRouter router;

  Future<AppLocalizations> pumpApp(WidgetTester t) async {
    fake = _FakeInterview();
    router = GoRouter(
      initialLocation: '/?tab=${AppTab.prepare}',
      routes: [GoRoute(path: '/', builder: (_, s) => _Home(tab: s.uri.queryParameters['tab'] ?? '?'))],
    );
    addTearDown(router.dispose);
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          interviewProvider.overrideWith(() => fake),
          signedInProvider.overrideWithValue(true),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
        ),
      ),
    );
    await t.pump();
    return AppLocalizations.delegate.load(const Locale('uz'));
  }

  Future<void> frames(WidgetTester t) async {
    for (var i = 0; i < 10; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> openInterview(WidgetTester t) async {
    await t.tap(find.text('open'));
    await frames(t);
    expect(find.byType(InterviewActiveView), findsOneWidget, reason: 'the call is on');
  }

  /// The system back, as the app's router hands it to the navigator.
  Future<void> systemBack(WidgetTester t) async {
    unawaited(Navigator.of(t.element(find.byType(InterviewActiveView))).maybePop());
    await frames(t);
  }

  Finder dialogButton(String label) =>
      find.descendant(of: find.byType(AlertDialog), matching: find.widgetWithText(TextButton, label));

  String url() => router.routeInformationProvider.value.uri.toString();

  testWidgets('system back during the call asks first: cancel keeps the screen, confirm pops it', (t) async {
    final l = await pumpApp(t);
    await openInterview(t);

    await systemBack(t);
    expect(find.byType(AlertDialog), findsOneWidget, reason: 'leaving a live call asks first');
    expect(find.descendant(of: find.byType(AlertDialog), matching: find.text(l.endInterview)), findsWidgets);

    await t.tap(dialogButton(l.cancel));
    await frames(t);
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.byType(InterviewActiveView), findsOneWidget, reason: '«Bekor qilish»: the call goes on');
    expect(fake.abandoned, 0);

    await systemBack(t);
    await t.tap(dialogButton(l.endInterview));
    await frames(t);
    expect(find.byType(InterviewActiveView), findsNothing, reason: '«Suhbatni tugatish»: the screen pops');
    expect(find.text('home tab ${AppTab.prepare}'), findsOneWidget);
    expect(fake.abandoned, 1, reason: 'as before: the call is stopped and the session marked abandoned');

    // The handshake still in flight gives up after 30 s.
    await t.pump(const Duration(seconds: 31));
    expect(t.takeException(), isNull);
  });

  testWidgets('a nav tap during the call asks first: cancel keeps the call and the tab, confirm opens the tab', (
    t,
  ) async {
    final l = await pumpApp(t);
    await openInterview(t);

    await t.tap(find.text('nav'));
    await frames(t);
    expect(find.byType(AlertDialog), findsOneWidget);
    await t.tap(dialogButton(l.cancel));
    await frames(t);
    expect(find.byType(InterviewActiveView), findsOneWidget, reason: 'the call goes on');
    expect(url(), '/?tab=${AppTab.prepare}', reason: 'the tab tapped does not open');

    // Leaving later by the system back is back to the home as it was, not to
    // the tab the student said «Bekor qilish» to.
    await systemBack(t);
    await t.tap(dialogButton(l.endInterview));
    await frames(t);
    expect(find.byType(InterviewActiveView), findsNothing);
    expect(find.text('home tab ${AppTab.prepare}'), findsOneWidget);
    expect(url(), '/?tab=${AppTab.prepare}');

    // A nav tap answered «Suhbatni tugatish»: the screen pops and the tab opens.
    await openInterview(t);
    await t.tap(find.text('nav'));
    await frames(t);
    await t.tap(dialogButton(l.endInterview));
    await frames(t);
    expect(find.byType(InterviewActiveView), findsNothing);
    expect(url(), '/?tab=${AppTab.universities}');
    expect(find.text('home tab ${AppTab.universities}'), findsOneWidget);
    expect(fake.abandoned, 2);

    await t.pump(const Duration(seconds: 31));
    expect(t.takeException(), isNull);
  });

  testWidgets('once the call is no longer live, leaving asks nothing', (t) async {
    await pumpApp(t);
    await openInterview(t);

    // The interviewer never greets: after 25 s the call is given up.
    await t.pump(const Duration(seconds: 26));
    await systemBack(t);
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.byType(InterviewActiveView), findsNothing);

    await t.pump(const Duration(seconds: 5));
    expect(t.takeException(), isNull);
  });
}

/// The home: the interview opens over it the way Tayyorgarlik opens it,
/// pushed, with a bottom nav under it.
class _Home extends StatelessWidget {
  const _Home({required this.tab});

  final String tab;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Column(
      children: [
        Text('home tab $tab'),
        TextButton(
          onPressed: () => unawaited(
            Navigator.of(context).push(
              MaterialPageRoute<void>(
                settings: const RouteSettings(name: 'interview'),
                builder: (_) => const _WithNav(child: InterviewScreen()),
              ),
            ),
          ),
          child: const Text('open'),
        ),
      ],
    ),
  );
}

/// NavScaffold's part that matters here: a nav button that opens a tab.
class _WithNav extends ConsumerWidget {
  const _WithNav({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    body: child,
    bottomNavigationBar: SafeArea(
      child: TextButton(onPressed: () => openAppTab(context, ref, AppTab.universities), child: const Text('nav')),
    ),
  );
}

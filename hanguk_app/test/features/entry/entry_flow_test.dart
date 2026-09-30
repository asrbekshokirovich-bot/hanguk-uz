import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/core/router/app_router.dart';
import 'package:hanguk_app/features/entry/data/app_account_repository.dart';
import 'package:hanguk_app/features/entry/data/entry_store.dart';
import 'package:hanguk_app/features/entry/presentation/language_screen.dart';
import 'package:hanguk_app/features/entry/presentation/phone_account_screens.dart';
import 'package:hanguk_app/features/entry/presentation/widgets/entry_fields.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

/// Answers every call with [result] and records what it was asked.
class _FakeAccounts implements AppAccountRepository {
  _FakeAccounts(this.result);

  AppAccountResult result;
  final calls = <String>[];

  @override
  Future<AppAccountResult> register(String national, String password) async {
    calls.add('register $national $password');
    return result;
  }

  @override
  Future<AppAccountResult> signIn(String national, String password) async {
    calls.add('signIn $national $password');
    return result;
  }
}

/// The entry screens under a router of their own: `/register`, `/sign-in`,
/// and a stand-in for the Magic Code screen that prints the notice it got.
Future<ProviderContainer> _pump(
  WidgetTester tester,
  _FakeAccounts accounts, {
  String initial = '/register',
}) async {
  // Flutter's own secure-storage channel is absent in tests: swallow writes.
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
        const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
        (call) async => null,
      );
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  final container = ProviderContainer(
    overrides: [appAccountRepositoryProvider.overrideWithValue(accounts)],
  );
  addTearDown(container.dispose);
  final router = GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/sign-in', builder: (_, _) => const PhoneSignInScreen()),
      GoRoute(
        path: '/login',
        builder: (_, state) => Scaffold(
          body: Text('MAGIC ${(state.extra as Map?)?['notice'] ?? ''}'),
        ),
      ),
    ],
  );
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('uz'),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

Finder _field(int index) => find.byType(TextField).at(index);

void main() {
  group('UzPhoneFormatter', () {
    test('keeps nine digits and spaces them', () {
      expect(UzPhoneFormatter.digitsOf('90 123-45-67'), '901234567');
      expect(UzPhoneFormatter.format('901234567'), '90 123 45 67');
      expect(UzPhoneFormatter.format('9012'), '90 12');
    });

    test('a pasted +998 number keeps its last nine digits', () {
      expect(UzPhoneFormatter.digitsOf('+998 90 123 45 67'), '901234567');
    });

    test('stops at nine digits', () {
      expect(UzPhoneFormatter.digitsOf('9012345678'), '901234567');
    });
  });

  group('parseAppAccountResponse', () {
    test('reads status and phone', () {
      final r = parseAppAccountResponse({
        'status': 'ok',
        'phone': '+998901234567',
      });
      expect(r.status, AppAccountStatus.ok);
      expect(r.phone, '+998901234567');
    });

    test('maps every status the server sends', () {
      const expected = {
        'exists': AppAccountStatus.exists,
        'student': AppAccountStatus.student,
        'invalid_phone': AppAccountStatus.invalidPhone,
        'weak_password': AppAccountStatus.weakPassword,
        'not_found': AppAccountStatus.notFound,
        'wrong_password': AppAccountStatus.wrongPassword,
        'locked': AppAccountStatus.locked,
      };
      expected.forEach((raw, status) {
        expect(parseAppAccountResponse({'status': raw}).status, status);
      });
    });

    test('anything unreadable is a network failure', () {
      expect(parseAppAccountResponse('nope').status, AppAccountStatus.network);
      expect(
        parseAppAccountResponse({'status': 'odd'}).status,
        AppAccountStatus.network,
      );
    });
  });

  group('resolveAppRedirect', () {
    String? go(
      String loc, {
      bool auth = false,
      bool language = true,
      bool registered = true,
      bool loading = false,
    }) => resolveAppRedirect(
      loc: loc,
      isLoading: loading,
      isAuthenticated: auth,
      hasLanguage: language,
      isRegistered: registered,
    );

    test('first launch: the language screen, and nothing else', () {
      expect(go('/', language: false, registered: false), '/language');
      expect(go('/welcome', language: false, registered: false), '/language');
      expect(go('/guest', language: false, registered: false), '/language');
      expect(go('/language', language: false, registered: false), isNull);
    });

    test('language chosen: sign-up, sign-in or the Magic Code only', () {
      expect(go('/', registered: false), '/register');
      expect(go('/welcome', registered: false), '/register');
      expect(go('/guest', registered: false), '/register');
      expect(go('/language', registered: false), '/register');
      expect(go('/register', registered: false), isNull);
      expect(go('/sign-in', registered: false), isNull);
      expect(go('/login', registered: false), isNull);
    });

    test('signed up: straight to Welcome, as before', () {
      expect(go('/'), '/welcome');
      expect(go('/language'), '/welcome');
      expect(go('/register'), '/welcome');
      expect(go('/sign-in'), '/welcome');
      expect(go('/welcome'), isNull);
      expect(go('/guest'), isNull);
      expect(go('/login'), isNull);
    });

    test('a signed-in student skips the way in', () {
      for (final loc in ['/language', '/register', '/sign-in', '/welcome']) {
        expect(go(loc, auth: true, language: false, registered: false), '/');
      }
      expect(go('/', auth: true, language: false, registered: false), isNull);
    });

    test('nothing moves while the session is loading', () {
      expect(go('/', loading: true, language: false), isNull);
    });
  });

  group('RegisterScreen', () {
    testWidgets('refuses a short number without calling the server', (
      tester,
    ) async {
      final accounts = _FakeAccounts(
        const AppAccountResult(AppAccountStatus.ok),
      );
      await _pump(tester, accounts);
      await tester.enterText(_field(0), '90 12');
      await tester.enterText(_field(1), 'secret1');
      await tester.enterText(_field(2), 'secret1');
      await tester.tap(find.text('Ro‘yxatdan o‘tish').last);
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Telefon raqamini to‘liq kiriting: +998 dan keyin 9 ta raqam.',
        ),
        findsOneWidget,
      );
      expect(accounts.calls, isEmpty);
    });

    testWidgets('refuses passwords that differ', (tester) async {
      final accounts = _FakeAccounts(
        const AppAccountResult(AppAccountStatus.ok),
      );
      await _pump(tester, accounts);
      await tester.enterText(_field(0), '901234567');
      await tester.enterText(_field(1), 'secret1');
      await tester.enterText(_field(2), 'secret2');
      await tester.tap(find.text('Ro‘yxatdan o‘tish').last);
      await tester.pumpAndSettle();
      expect(find.text('Parollar bir xil emas.'), findsOneWidget);
      expect(accounts.calls, isEmpty);
    });

    testWidgets('signs up and remembers the number', (tester) async {
      final accounts = _FakeAccounts(
        const AppAccountResult(AppAccountStatus.ok, phone: '+998901234567'),
      );
      final container = await _pump(tester, accounts);
      await tester.enterText(_field(0), '901234567');
      await tester.enterText(_field(1), 'secret1');
      await tester.enterText(_field(2), 'secret1');
      await tester.tap(find.text('Ro‘yxatdan o‘tish').last);
      await tester.pumpAndSettle();
      expect(accounts.calls, ['register 901234567 secret1']);
      expect(container.read(entryProvider).phone, '+998901234567');
    });

    testWidgets('a student is sent to the Magic Code with a note', (
      tester,
    ) async {
      final accounts = _FakeAccounts(
        const AppAccountResult(AppAccountStatus.student),
      );
      final container = await _pump(tester, accounts);
      await tester.enterText(_field(0), '901234567');
      await tester.enterText(_field(1), 'secret1');
      await tester.enterText(_field(2), 'secret1');
      await tester.tap(find.text('Ro‘yxatdan o‘tish').last);
      await tester.pumpAndSettle();
      expect(
        find.textContaining('MAGIC Siz Hanguk talabasisiz'),
        findsOneWidget,
      );
      expect(container.read(entryProvider).isRegistered, isFalse);
    });

    testWidgets('a number already signed up is told to sign in', (
      tester,
    ) async {
      final accounts = _FakeAccounts(
        const AppAccountResult(AppAccountStatus.exists),
      );
      await _pump(tester, accounts);
      await tester.enterText(_field(0), '901234567');
      await tester.enterText(_field(1), 'secret1');
      await tester.enterText(_field(2), 'secret1');
      await tester.tap(find.text('Ro‘yxatdan o‘tish').last);
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Bu raqam allaqachon ro‘yxatdan o‘tgan. Parolingiz bilan kiring.',
        ),
        findsOneWidget,
      );
    });
  });

  group('PhoneSignInScreen', () {
    testWidgets('says when the password is wrong', (tester) async {
      final accounts = _FakeAccounts(
        const AppAccountResult(AppAccountStatus.wrongPassword),
      );
      final container = await _pump(tester, accounts, initial: '/sign-in');
      await tester.enterText(_field(0), '901234567');
      await tester.enterText(_field(1), 'secret1');
      await tester.tap(find.text('Kirish').last);
      await tester.pumpAndSettle();
      expect(accounts.calls, ['signIn 901234567 secret1']);
      expect(find.text('Parol noto‘g‘ri.'), findsOneWidget);
      expect(container.read(entryProvider).isRegistered, isFalse);
    });

    testWidgets('signs in and remembers the number', (tester) async {
      final accounts = _FakeAccounts(
        const AppAccountResult(AppAccountStatus.ok, phone: '+998901234567'),
      );
      final container = await _pump(tester, accounts, initial: '/sign-in');
      await tester.enterText(_field(0), '901234567');
      await tester.enterText(_field(1), 'secret1');
      await tester.tap(find.text('Kirish').last);
      await tester.pumpAndSettle();
      expect(container.read(entryProvider).phone, '+998901234567');
    });
  });

  testWidgets('LanguageScreen stores the language picked', (tester) async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async => null,
        );
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: LanguageScreen()),
      ),
    );
    await tester.tap(find.text('Русский'));
    await tester.pump();
    expect(find.text('Продолжить'), findsOneWidget);
    await tester.tap(find.text('Продолжить'));
    // The spinner keeps turning until the router moves on; there is no
    // router here, so pump instead of settling.
    await tester.pump(const Duration(milliseconds: 100));
    expect(container.read(entryProvider).languageCode, 'ru');
  });
}

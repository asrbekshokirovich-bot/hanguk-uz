import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/auth/presentation/client_code_screen.dart';
import 'package:hanguk_app/design_system/seoul_night/widgets/fd_kit.dart' show HardIconButton;
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

class _FakeAuth extends Fake implements AuthRepository {
  final codes = <String>[];
  AuthError? answer = AuthError.codeNotFound;

  @override
  Future<({AuthError? error, String? studentName, bool transient})> signInWithMagicCode(
    String magicCode, {
    void Function(int attempt, int total)? onRetry,
  }) async {
    codes.add(magicCode);
    return (error: answer, studentName: null, transient: false);
  }
}

void main() {
  late _FakeAuth auth;
  final stored = <String, String>{};
  setUp(() {
    stored.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        final args = (call.arguments as Map?) ?? const {};
        final key = args['key'] as String?;
        switch (call.method) {
          case 'read':
            return stored[key];
          case 'write':
            stored[key!] = args['value'] as String;
        }
        return null;
      },
    );
  });

  Future<void> pump(WidgetTester t, {Widget home = const ClientCodeScreen()}) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    auth = _FakeAuth();
    await t.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(auth)],
        child: MaterialApp(
          // The app's own theme: its input borders must not reach the cells.
          theme: AppTheme.materialTheme,
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: home,
        ),
      ),
    );
    await t.pump();
  }

  testWidgets("the theme's input borders do not draw around the cells", (t) async {
    await pump(t);
    final deco = t.widget<TextField>(find.byType(TextField)).decoration!;
    for (final b in [deco.border, deco.enabledBorder, deco.focusedBorder, deco.disabledBorder]) {
      expect(b, InputBorder.none);
    }
  });

  testWidgets("the home's nav is under the page; a locked tab stays here", (t) async {
    await pump(t);
    expect(find.byType(AppNav), findsOneWidget);
    expect(find.byType(AppNavOrb), findsOneWidget);
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    await t.tap(find.text(l.fdNavApplication));
    await t.pump(const Duration(milliseconds: 500));
    // No second sign-in page over this one: the field takes the focus.
    expect(find.byType(ClientCodeScreen), findsOneWidget);
    expect(t.widget<TextField>(find.byType(TextField)).focusNode!.hasFocus, isTrue);
  });

  testWidgets("in the guest home's tab: no back button and no nav of its own", (t) async {
    await pump(t, home: const Scaffold(body: ClientCodeScreen(embedded: true, notice: 'note')));
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    expect(find.text(l.fdCodeTitle), findsOneWidget);
    expect(find.text('note'), findsOneWidget);
    expect(find.byType(HardIconButton), findsNothing);
    expect(find.byType(AppNav), findsNothing);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('typing fills the cells in capitals; the eighth signs in', (t) async {
    await pump(t);
    await t.enterText(find.byType(TextField), 'hg7k');
    await t.pump();
    for (final c in ['H', 'G', '7', 'K']) {
      expect(find.text(c), findsOneWidget);
    }
    expect(auth.codes, isEmpty);
    await t.enterText(find.byType(TextField), 'ab-cd efghij');
    await t.pump();
    await t.pump();
    expect(tester(t).controller!.text, 'ABCDEFGH');
    expect(auth.codes, ['ABCDEFGH']);
    expect(
      find.text(AppLocalizations.of(t.element(find.byType(ClientCodeScreen)))!.authErrorCodeNotFound),
      findsOneWidget,
    );
  });

  testWidgets('the first time: no SMS card and no keypad, the banner and Telegram', (t) async {
    await pump(t);
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    expect(find.text(l.fdCodeBannerTitle), findsOneWidget);
    expect(find.text(l.fdCodeTelegram), findsOneWidget);
    expect(find.text(l.fdCodeSmsFrom), findsNothing);
    expect(find.text(l.fdCodePaste), findsNothing);
    expect(find.text('Kirish'), findsNothing);
  });

  testWidgets('once a code has worked: its SMS and its own keypad', (t) async {
    stored['client_code_v1'] = 'HG7K2M9P';
    await pump(t);
    await t.pump();
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    expect(find.text(l.fdCodeSmsFrom), findsOneWidget);
    expect(find.textContaining('HG7K2M9P', findRichText: true), findsOneWidget);
    // The keypad: the code's characters and ⌫, nothing else.
    for (final c in ['H', 'G', '7', 'K', '2', 'M', '9', 'P']) {
      expect(find.bySemanticsLabel(c), findsOneWidget);
    }
    await t.tap(find.bySemanticsLabel('H'));
    await t.tap(find.bySemanticsLabel('G'));
    await t.pump();
    expect(tester(t).controller!.text, 'HG');
    await t.tap(
      find.bySemanticsLabel(MaterialLocalizations.of(t.element(find.byType(ClientCodeScreen))).deleteButtonTooltip),
    );
    await t.pump();
    expect(tester(t).controller!.text, 'H');
    // "qo'yish →" puts the whole code in, and that signs in.
    await t.tap(find.text(l.fdCodePaste));
    await t.pump();
    await t.pump();
    expect(auth.codes, ['HG7K2M9P']);
  });

  testWidgets('a code that works is remembered', (t) async {
    await pump(t);
    auth.answer = null;
    await t.enterText(find.byType(TextField), 'hg7k2m9p');
    await t.pump();
    await t.pump();
    expect(stored['client_code_v1'], 'HG7K2M9P');
  });
}

TextField tester(WidgetTester t) => t.widget<TextField>(find.byType(TextField));

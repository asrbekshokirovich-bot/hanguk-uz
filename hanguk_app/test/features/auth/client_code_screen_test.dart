import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/auth/presentation/client_code_screen.dart';
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

  Future<void> pump(WidgetTester t) async {
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
          home: const ClientCodeScreen(),
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

  testWidgets('typing fills the cells in capitals, eight at most', (t) async {
    await pump(t);
    expect(find.text('Kirish'), findsOneWidget);
    await t.enterText(find.byType(TextField), 'hg7k');
    await t.pump();
    for (final c in ['H', 'G', '7', 'K']) {
      expect(find.text(c), findsOneWidget);
    }
    // The bars under the cells: one lime bar per character typed.
    await t.pump(const Duration(milliseconds: 300));
    final lime = find.byWidgetPredicate(
      (w) => w is AnimatedContainer && (w.decoration as BoxDecoration?)?.color == const Color(0xFFCCFF00),
    );
    expect(lime, findsNWidgets(4));
    await t.enterText(find.byType(TextField), 'ab-cd efghij');
    await t.pump();
    expect(tester(t).controller!.text, 'ABCDEFGH');
  });

  testWidgets('too short a code is refused without calling the server', (t) async {
    await pump(t);
    await t.enterText(find.byType(TextField), 'AB12');
    await t.tap(find.text('Kirish'));
    await t.pump();
    expect(
      find.text(AppLocalizations.of(t.element(find.byType(ClientCodeScreen)))!.loginErrorInvalidAccessCode),
      findsOneWidget,
    );
    expect(auth.codes, isEmpty);
  });

  testWidgets('a full code is sent, and the server\'s answer is shown in words', (t) async {
    await pump(t);
    await t.enterText(find.byType(TextField), 'hg7k1234');
    await t.tap(find.text('Kirish'));
    await t.pump();
    await t.pump();
    expect(auth.codes, ['HG7K1234']);
    expect(
      find.text(AppLocalizations.of(t.element(find.byType(ClientCodeScreen)))!.authErrorCodeNotFound),
      findsOneWidget,
    );
  });
}

TextField tester(WidgetTester t) => t.widget<TextField>(find.byType(TextField));

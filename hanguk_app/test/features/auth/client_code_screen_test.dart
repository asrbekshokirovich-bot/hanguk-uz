import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/auth/presentation/client_code_screen.dart';
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
        child: const MaterialApp(
          locale: Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: ClientCodeScreen(),
        ),
      ),
    );
    await t.pump();
  }

  testWidgets('typing fills the cells in capitals, eight at most', (t) async {
    await pump(t);
    expect(find.text('Kirish'), findsOneWidget);
    await t.enterText(find.byType(TextField), 'hg7k');
    await t.pump();
    for (final c in ['H', 'G', '7', 'K']) {
      expect(find.text(c), findsOneWidget);
    }
    await t.enterText(find.byType(TextField), 'ab-cd efghij');
    await t.pump();
    expect(tester(t).controller!.text, 'ABCDEFGH');
  });

  testWidgets('too short a code is refused without calling the server', (t) async {
    await pump(t);
    await t.enterText(find.byType(TextField), 'AB12');
    await t.tap(find.text('Kirish'));
    await t.pump();
    expect(find.text(AppLocalizations.of(t.element(find.byType(ClientCodeScreen)))!.loginErrorInvalidAccessCode), findsOneWidget);
    expect(auth.codes, isEmpty);
  });

  testWidgets('a full code is sent, and the server\'s answer is shown in words', (t) async {
    await pump(t);
    await t.enterText(find.byType(TextField), 'hg7k1234');
    await t.tap(find.text('Kirish'));
    await t.pump();
    await t.pump();
    expect(auth.codes, ['HG7K1234']);
    expect(find.text(AppLocalizations.of(t.element(find.byType(ClientCodeScreen)))!.authErrorCodeNotFound), findsOneWidget);
  });
}

TextField tester(WidgetTester t) => t.widget<TextField>(find.byType(TextField));

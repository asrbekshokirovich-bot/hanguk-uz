import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/router/app_router.dart';
import 'package:hanguk_app/features/entry/data/entry_store.dart';
import 'package:hanguk_app/features/entry/presentation/language_screen.dart';
import 'package:hanguk_app/features/entry/presentation/widgets/entry_fields.dart';

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

  group('resolveAppRedirect', () {
    String? go(
      String loc, {
      bool auth = false,
      bool language = true,
      bool loading = false,
    }) => resolveAppRedirect(
      loc: loc,
      isLoading: loading,
      isAuthenticated: auth,
      hasLanguage: language,
    );

    test('first launch: the language screen, and nothing else', () {
      expect(go('/', language: false), '/language');
      expect(go('/welcome', language: false), '/language');
      expect(go('/quiz', language: false), '/language');
      expect(go('/guest', language: false), '/language');
      expect(go('/language', language: false), isNull);
    });

    test('language chosen: Welcome (S01), no sign-up', () {
      expect(go('/'), '/welcome');
      expect(go('/language'), '/welcome');
      expect(go('/register'), '/welcome');
      expect(go('/welcome'), isNull);
      expect(go('/guest'), isNull);
      expect(go('/login'), isNull);
    });

    test('the quiz, its result and the tariffs are public', () {
      expect(go('/quiz'), isNull);
      expect(go('/quiz/result'), isNull);
      expect(go('/tariffs'), isNull);
      expect(go('/tariffs/premium'), isNull);
    });

    test('a signed-in student skips the way in', () {
      for (final loc in ['/language', '/welcome', '/quiz', '/tariffs/premium', '/guest']) {
        expect(go(loc, auth: true, language: false), '/');
      }
      expect(go('/', auth: true, language: false), isNull);
    });

    test('nothing moves while the session is loading', () {
      expect(go('/', loading: true, language: false), isNull);
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

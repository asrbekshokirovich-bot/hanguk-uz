// The lead form in the app's country (plan KG3): Uzbekistan keeps its +998
// form; Kyrgyzstan gets +996, nine digits spaced 700 123 456, and a consent
// box that has to be ticked before «Yuborish».
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/core/country/app_country.dart';
import 'package:hanguk_app/features/assessment/presentation/lead_screen.dart';
import 'package:hanguk_app/features/assessment/presentation/sent_screen.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/entry/data/entry_store.dart';
import 'package:hanguk_app/features/entry/presentation/widgets/entry_fields.dart';
import 'package:hanguk_app/features/onboarding/data/quiz_repository.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

/// Records what the form sends; answers "network" so nothing navigates.
class _FakeQuiz implements QuizRepository {
  final sent = <({String phone, String country})>[];

  @override
  Future<QuizSubmitResult> submit({
    required String phoneE164,
    required String name,
    required Map<String, dynamic> answers,
    required Map<String, dynamic> result,
    String country = 'UZ',
  }) async {
    sent.add((phone: phoneE164, country: country));
    return const QuizSubmitResult(QuizSubmitStatus.network);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('KgPhoneFormatter', () {
    test('keeps nine digits and spaces them 3-3-3', () {
      expect(KgPhoneFormatter.digitsOf('700-123 456'), '700123456');
      expect(KgPhoneFormatter.format('700123456'), '700 123 456');
      expect(KgPhoneFormatter.format('7001'), '700 1');
    });

    test('a pasted +996 number keeps its last nine', () {
      expect(KgPhoneFormatter.digitsOf('+996 700 123 456'), '700123456');
      expect(KgPhoneFormatter.digitsOf('7001234567'), '700123456');
    });
  });

  test('NationalPhone', () {
    const kg = NationalPhone(AppCountry.kg);
    const uz = NationalPhone(AppCountry.uz);
    expect(kg.code, '+996');
    expect(kg.e164('700123456'), '+996700123456');
    expect(uz.e164('901234567'), '+998901234567');
    expect(kg.owns('+996700123456'), isTrue);
    expect(kg.owns('+998901234567'), isFalse);
    expect(uz.owns('+998901234567'), isTrue);
    expect(uz.format('901234567'), '90 123 45 67');
  });

  test('the sent screen spaces a Kyrgyz number', () {
    expect(prettyUzPhone('+996700123456'), '+996 700 123 456');
    expect(prettyUzPhone('+998901234567'), '+998 90 123 45 67');
  });

  group('LeadScreen', () {
    Future<(ProviderContainer, _FakeQuiz)> pump(WidgetTester tester, AppCountry country) async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
        (call) async => null,
      );
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final quiz = _FakeQuiz();
      final container = ProviderContainer(
        overrides: [
          catalogProvider.overrideWith((ref) async => const []),
          eligibilityRulesProvider.overrideWith((ref) async => const EligibilityRules()),
          quizRepositoryProvider.overrideWithValue(quiz),
        ],
      );
      addTearDown(container.dispose);
      await container.read(entryProvider.notifier).setCountry(country);
      await container.read(catalogProvider.future);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            locale: Locale('uz'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: LeadScreen(),
          ),
        ),
      );
      await tester.pump();
      return (container, quiz);
    }

    Future<void> fill(WidgetTester tester, String phone) async {
      await tester.enterText(find.byType(TextField).at(0), 'Aybek Toktogulov');
      await tester.enterText(find.byType(TextField).at(1), phone);
      await tester.pump();
    }

    testWidgets('Kyrgyzstan: +996 and nothing sent before the consent box', (tester) async {
      final (_, quiz) = await pump(tester, AppCountry.kg);
      expect(find.text('+996'), findsOneWidget);
      const consent =
          "Shaxsiy ma'lumotlarim (ism, telefon, javoblar) maslahat uchun Hanguk Consulting'ga yuborilishi va Koreya Respublikasidagi serverda saqlanishiga roziman.";
      expect(find.text(consent), findsOneWidget);
      await fill(tester, '700123456');
      expect(find.text('700 123 456'), findsOneWidget);

      await tester.tap(find.text('Yuborish'), warnIfMissed: false);
      await tester.pump();
      expect(quiz.sent, isEmpty);

      await tester.tap(find.text(consent));
      await tester.pump();
      await tester.tap(find.text('Yuborish'));
      await tester.pump();
      expect(quiz.sent.single, (phone: '+996700123456', country: 'KG'));
    });

    testWidgets('Uzbekistan: the form as it was, no consent box', (tester) async {
      final (_, quiz) = await pump(tester, AppCountry.uz);
      expect(find.text('+998'), findsOneWidget);
      expect(find.byType(Checkbox), findsNothing);
      await fill(tester, '901234567');
      expect(find.text('90 123 45 67'), findsOneWidget);
      await tester.tap(find.text('Yuborish'));
      await tester.pump();
      expect(quiz.sent.single, (phone: '+998901234567', country: 'UZ'));
    });
  });
}

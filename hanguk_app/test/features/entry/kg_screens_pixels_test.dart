// Qirg'iziston ekranlari telefonda qanday ko'rinishi (QA audit, 2026-11-11):
// mamlakat ekrani va +996 lid formasi qirg'izcha va o'zbekcha, 360×780
// telefonda, ilovaning haqiqiy shriftlari bilan. Har bir holat
// build/test_screens/ ga yoziladi (CI: test-screens/pr-<N>.zip) va asosiy
// yozuvlari bo'yalgan piksellarda o'qilishi tekshiriladi.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/core/country/app_country.dart';
import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/features/assessment/presentation/lead_screen.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/entry/data/entry_store.dart';
import 'package:hanguk_app/features/entry/presentation/country_screen.dart';
import 'package:hanguk_app/features/entry/presentation/language_screen.dart';
import 'package:hanguk_app/features/onboarding/data/quiz_repository.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

import '../../helpers/screen_pixels.dart';

class _NoQuiz implements QuizRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<AppLocalizations> _pump(WidgetTester t, Widget home, {required String lang, AppCountry? country}) async {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
    (call) async => null,
  );
  usePhone(t);
  final container = ProviderContainer(
    overrides: [
      catalogProvider.overrideWith((ref) async => const []),
      eligibilityRulesProvider.overrideWith((ref) async => const EligibilityRules()),
      quizRepositoryProvider.overrideWithValue(_NoQuiz()),
    ],
  );
  addTearDown(container.dispose);
  if (country != null) await container.read(entryProvider.notifier).setCountry(country);
  await container.read(catalogProvider.future);
  final locale = Locale(lang);
  await t.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: RepaintBoundary(
        key: shotKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.materialTheme,
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: home,
        ),
      ),
    ),
  );
  await t.pump();
  await t.pump(const Duration(milliseconds: 300));
  return AppLocalizations.delegate.load(locale);
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('kg_1 · til ekrani: Кыргызча qatori', (t) async {
    await _pump(t, const LanguageScreen(), lang: 'uz');
    final shot = await capture(t, 'kg_1_til_ekrani');
    expectLabelVisible(t, shot, find.text('Кыргызча'));
  });

  for (final lang in ['ky', 'uz']) {
    testWidgets('kg_2 · mamlakat ekrani ($lang)', (t) async {
      t.platformDispatcher.localeTestValue = const Locale('ru', 'KG');
      addTearDown(t.platformDispatcher.clearLocaleTestValue);
      final l = await _pump(t, const CountryScreen(), lang: lang);
      final shot = await capture(t, 'kg_2_mamlakat_$lang');
      expectLabelVisible(t, shot, find.text(l.countryKyrgyzstan));
      expectLabelVisible(t, shot, find.text(l.countryKgCaption));
    });

    testWidgets('kg_3 · +996 lid formasi ($lang)', (t) async {
      final l = await _pump(t, const LeadScreen(), lang: lang, country: AppCountry.kg);
      await capture(t, 'kg_3_lid_formasi_$lang');
      // The form scrolls on a 780px phone (the list builds lazily): bring the
      // phone field, then the consent box, into view before reading them.
      final scrollable = find.byType(Scrollable).first;
      await t.scrollUntilVisible(find.text('+996'), 120, scrollable: scrollable);
      await t.pump();
      final shot = await capture(t, 'kg_3_lid_formasi_${lang}_telefon');
      expectLabelVisible(t, shot, find.text('+996'));
      await t.scrollUntilVisible(find.text(l.leadKgConsent), 120, scrollable: scrollable);
      await t.pump();
      final shot2 = await capture(t, 'kg_3_lid_formasi_${lang}_rozilik');
      expectLabelVisible(t, shot2, find.text(l.leadKgConsent));
    });
  }
}

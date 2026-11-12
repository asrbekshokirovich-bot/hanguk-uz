import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/language_store.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// A device store that cannot write.
class FailingStore implements LanguageStore {
  @override
  AppLanguage? load() => null;

  @override
  Future<void> save(AppLanguage language) async => throw StateError('disk full');
}

void main() {
  test('it starts in the language chosen before, else Uzbek; a choice is kept for the next launch', () {
    final store = MemoryLanguageStore();
    final first = ProviderContainer(overrides: [languageStoreProvider.overrideWithValue(store)]);
    addTearDown(first.dispose);
    expect(first.read(appLanguageProvider), AppLanguage.uz);
    first.read(appLanguageProvider.notifier).select(AppLanguage.ru);
    expect(store.load(), AppLanguage.ru);

    final next = ProviderContainer(overrides: [languageStoreProvider.overrideWithValue(store)]);
    addTearDown(next.dispose);
    expect(next.read(appLanguageProvider), AppLanguage.ru);
  });

  test('with a backend the choice goes to the profile too', () {
    final told = <AppLanguage>[];
    final container = ProviderContainer(overrides: [
      languageSaverProvider.overrideWithValue((language) async => told.add(language)),
    ]);
    addTearDown(container.dispose);
    container.read(appLanguageProvider.notifier).select(AppLanguage.ko);
    expect(told, [AppLanguage.ko]);
  });

  test('a store or profile that fails keeps the choice for this launch', () async {
    final container = ProviderContainer(overrides: [
      languageStoreProvider.overrideWithValue(FailingStore()),
      languageSaverProvider.overrideWithValue((language) async => throw const OfflineException()),
    ]);
    addTearDown(container.dispose);
    container.read(appLanguageProvider.notifier).select(AppLanguage.en);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(appLanguageProvider), AppLanguage.en);
  });

  test('the device store keeps the code', () async {
    SharedPreferences.setMockInitialValues({});
    final store = PrefsLanguageStore(await SharedPreferences.getInstance());
    expect(store.load(), isNull);
    await store.save(AppLanguage.ru);
    expect(PrefsLanguageStore(await SharedPreferences.getInstance()).load(), AppLanguage.ru);
  });

  group('A11', () {
    setUpAll(loadHiFonts);

    testWidgets('choosing Русский in A11 is kept: the next launch opens in Russian', (tester) async {
      usePhone(tester);
      final store = MemoryLanguageStore();
      final container = appContainer(
        location: WorkerRoutes.me,
        overrides: [languageStoreProvider.overrideWithValue(store)],
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ilova tili'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Русский'));
      await tester.pumpAndSettle();
      expect(find.text('Профиль'), findsWidgets);
      expect(store.load(), AppLanguage.ru);

      // The next launch.
      await tester.pumpWidget(const SizedBox());
      final next = ProviderContainer(overrides: [languageStoreProvider.overrideWithValue(store)]);
      addTearDown(next.dispose);
      expect(next.read(appLanguageProvider), AppLanguage.ru);
    });
  });
}

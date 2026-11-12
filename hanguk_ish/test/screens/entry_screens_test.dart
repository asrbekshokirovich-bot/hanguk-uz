@Tags(['screens'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../helpers/fonts.dart';
import '../helpers/phone.dart';

/// Renders the entry screens with the real fonts. CI writes them with
/// `--update-goldens` and publishes them next to the prototype for review;
/// `<name>.png` is the screen exactly as the prototype frames it.
void main() {
  setUpAll(loadHiFonts);

  for (final language in AppLanguage.values) {
    testWidgets('A01 Kirish — ${language.code}', (tester) async {
      usePhone(tester);
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(appLanguageProvider.notifier).select(language);
      await tester.pumpWidget(capture(UncontrolledProviderScope(container: container, child: const WorkerApp())));
      await tester.pumpAndSettle();
      await expectScreen(tester, language == AppLanguage.uz ? 'A01-Kirish' : 'A01-Kirish.${language.code}');
    });
  }

  for (final phone in [TestPhone.android, TestPhone.small]) {
    testWidgets('A01 Kirish — ${phone.name}', (tester) async {
      usePhone(tester, phone);
      await tester.pumpWidget(capture(const ProviderScope(child: WorkerApp())));
      await tester.pumpAndSettle();
      await expectScreen(tester, 'A01-Kirish.${phone.name}');
    });
  }

  // T1 / T2 are not in the prototype: drawn from its parts, for approval.
  for (final language in AppLanguage.values) {
    final suffix = language == AppLanguage.uz ? '' : '.${language.code}';
    testWidgets('T1 Telefon — ${language.code}', (tester) async {
      usePhone(tester);
      final container = ProviderContainer(overrides: [workerInitialLocationProvider.overrideWithValue(WorkerRoutes.phone)]);
      addTearDown(container.dispose);
      container.read(appLanguageProvider.notifier).select(language);
      await tester.pumpWidget(capture(UncontrolledProviderScope(container: container, child: const WorkerApp())));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '01012345678');
      await tester.pumpAndSettle();
      await expectScreen(tester, 'T1-Telefon$suffix');
    });

    testWidgets('T2 Kod — ${language.code}', (tester) async {
      usePhone(tester);
      final container = ProviderContainer(overrides: [
        workerInitialLocationProvider.overrideWithValue(WorkerRoutes.phoneCode('010-1234-5678')),
      ]);
      addTearDown(container.dispose);
      container.read(appLanguageProvider.notifier).select(language);
      await tester.pumpWidget(capture(UncontrolledProviderScope(container: container, child: const WorkerApp())));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '1234');
      await tester.pump(const Duration(seconds: 12));
      await tester.pumpAndSettle();
      await expectScreen(tester, 'T2-Kod$suffix');
    });
  }

  testWidgets('T2 Kod — wrong code', (tester) async {
    usePhone(tester);
    final container = ProviderContainer(overrides: [
      workerInitialLocationProvider.overrideWithValue(WorkerRoutes.phoneCode('010-1234-5678')),
      authRepositoryProvider.overrideWithValue(_WrongCode()),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(capture(UncontrolledProviderScope(container: container, child: const WorkerApp())));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    await expectScreen(tester, 'T2-Kod.wrong');
  });

  testWidgets('BA0 Code', (tester) async {
    usePhone(tester);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        employerInitialLocationProvider.overrideWithValue(EmployerRoutes.code('010-1234-5678')),
      ],
      child: const EmployerApp(),
    )));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'BA0-Code');
  });

  testWidgets('BA0 App Login', (tester) async {
    usePhone(tester);
    await tester.pumpWidget(capture(const ProviderScope(child: EmployerApp())));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'BA0-App-Login');
  });

  testWidgets('BA0 App Login — android', (tester) async {
    usePhone(tester, TestPhone.android);
    await tester.pumpWidget(capture(const ProviderScope(child: EmployerApp())));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'BA0-App-Login.android');
  });
}

/// Refuses every code (the T2 error state).
class _WrongCode extends DemoAuthRepository {
  @override
  Future<void> verifyCode(String phone, String code) async => throw const ShiftActionException('CODE_INVALID');
}

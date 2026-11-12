@Tags(['screens'])
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
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

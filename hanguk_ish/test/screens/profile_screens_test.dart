@Tags(['screens'])
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/features/worker/profile/profile_screens.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

/// A02 · 1–3 with the prototype's sample profile, in the four languages.
void main() {
  setUpAll(loadHiFonts);

  final screens = {
    'A02-Profil-1': () => ProfileNameScreen(onBack: () {}, onNext: () {}),
    'A02-Profil-2': () => ProfileLanguagesScreen(onBack: () {}, onNext: () {}),
    'A02-Profil-3': () => ProfileScheduleScreen(onBack: () {}, onDone: () {}),
  };

  for (final entry in screens.entries) {
    for (final language in AppLanguage.values) {
      testWidgets('${entry.key} — ${language.code}', (tester) async {
        usePhone(tester);
        final container = workerContainer(language: language, draft: prototypeProfile());
        addTearDown(container.dispose);
        await tester.pumpWidget(workerHarness(container, entry.value()));
        await tester.pumpAndSettle();
        await expectScreen(tester, language == AppLanguage.uz ? entry.key : '${entry.key}.${language.code}');
      });
    }
  }

  testWidgets('A02-Profil-3 — small screen scrolls', (tester) async {
    usePhone(tester, TestPhone.small);
    final container = workerContainer(draft: prototypeProfile());
    addTearDown(container.dispose);
    await tester.pumpWidget(workerHarness(container, ProfileScheduleScreen(onBack: () {}, onDone: () {})));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'A02-Profil-3.small');
  });
}

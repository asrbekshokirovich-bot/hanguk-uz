import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hanguk_ish/app/text_scale.dart';
import 'package:hanguk_ish/design/theme.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';
import 'package:hanguk_ish/l10n/gen/worker_l10n.dart';

import 'phone.dart';

/// [screen] inside a worker-app MaterialApp (theme, the four languages) that
/// follows [container]'s language, wrapped for screen captures.
Widget workerHarness(ProviderContainer container, Widget screen) {
  return capture(
    UncontrolledProviderScope(
      container: container,
      child: Consumer(
        builder: (context, ref, _) => MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: hiTheme(),
          locale: ref.watch(appLanguageProvider).locale,
          supportedLocales: WorkerL10n.supportedLocales,
          localizationsDelegates: WorkerL10n.localizationsDelegates,
          builder: (context, child) => HiTextScaleCap(child: child ?? const SizedBox.shrink()),
          home: screen,
        ),
      ),
    ),
  );
}

/// The profile the prototype shows on A02 (Aziz Karimov).
WorkerProfileDraft prototypeProfile() {
  var mask = 0;
  const pattern = {
    0: [2],
    1: [1, 2],
    2: [2],
    3: [1, 2],
    4: [2],
    5: [0, 1, 2],
    6: [0, 1],
  };
  pattern.forEach((day, slots) {
    for (final slot in slots) {
      mask |= WorkerProfileDraft.bit(day, slot);
    }
  });
  return WorkerProfileDraft(
    firstName: 'Aziz',
    lastName: 'Karimov',
    languages: const {'uz', 'ru', 'en', 'ko'},
    topik: 4,
    university: 'sogang',
    district: 'mapo',
    availability: mask,
    visa: 'D-2',
  );
}

/// A container in [language] holding [draft].
ProviderContainer workerContainer({
  AppLanguage language = AppLanguage.uz,
  WorkerProfileDraft? draft,
  List<Override> overrides = const [],
}) {
  final container = ProviderContainer(overrides: overrides);
  container.read(appLanguageProvider.notifier).select(language);
  if (draft != null) container.read(workerProfileDraftProvider.notifier).replace(draft);
  return container;
}

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/icons.dart';
import '../../design/widgets/navigation.dart';
import '../../design/widgets/picker_sheet.dart';
import '../worker/settings/app_language.dart';
import 'biz.dart';

/// The employer app's language before any choice: Korean (the prototype's),
/// or the phone's when it is one of the app's four (set at start,
/// `bootstrap`).
final employerDefaultLanguageProvider = Provider<AppLanguage>((ref) => AppLanguage.ko);

/// The phone's language if the app speaks it, else Korean.
AppLanguage employerLanguageFor(Iterable<Locale> deviceLocales) {
  for (final locale in deviceLocales) {
    for (final language in AppLanguage.values) {
      if (language.code == locale.languageCode) return language;
    }
  }
  return AppLanguage.ko;
}

/// The employer app's language (P43): chosen on BA0 or BA1, kept on the
/// device and on the profile like the worker app's.
final employerLanguageProvider = NotifierProvider<EmployerLanguageController, AppLanguage>(
  EmployerLanguageController.new,
);

class EmployerLanguageController extends Notifier<AppLanguage> {
  @override
  AppLanguage build() => ref.read(languageStoreProvider).load() ?? ref.read(employerDefaultLanguageProvider);

  void select(AppLanguage language) {
    state = language;
    // Best effort: a failure keeps the choice for this launch.
    ref.read(languageStoreProvider).save(language).catchError((Object _) {});
    ref.read(languageSaverProvider)?.call(language).catchError((Object _) {});
  }
}

/// The language list (the worker app's A11 sheet); the choice applies at once.
Future<void> pickEmployerLanguage(BuildContext context, WidgetRef ref) async {
  final current = ref.read(employerLanguageProvider);
  final value = await showHiPicker(
    context,
    title: Biz.language,
    searchHint: '',
    searchable: false,
    selected: current.code,
    options: [for (final l in AppLanguage.values) HiPickerOption(l.code, l.label)],
  );
  if (value != null) ref.read(employerLanguageProvider.notifier).select(AppLanguage.fromCode(value));
}

/// The globe button that opens [pickEmployerLanguage] (BA0, BA1).
class EmployerLanguageButton extends ConsumerWidget {
  const EmployerLanguageButton({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(employerLanguageProvider);
    return HiGlassIconButton(
      icon: HiIcons.globe,
      size: size,
      radius: 16,
      iconSize: 21,
      semanticsLabel: '${Biz.language}: ${language.label}',
      onTap: () => pickEmployerLanguage(context, ref),
    );
  }
}

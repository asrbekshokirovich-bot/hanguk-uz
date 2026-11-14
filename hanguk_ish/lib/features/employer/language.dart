import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/employer_app.dart' show EmployerRoutes;
import '../../data/repositories/auth_repository.dart';
import '../../design/icons.dart';
import '../../design/insets.dart';
import '../../design/tokens.dart';
import '../../design/typography.dart';
import '../../design/widgets/buttons.dart';
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

const _deleteAccountValue = '__delete_account__';

/// The language list (the worker app's A11 sheet); the choice applies at once.
/// Signed in, «계정 삭제» sits under it (Google Play's account-deletion rule;
/// Asrbek, 2026-11-13: the app has no settings screen, so here).
Future<void> pickEmployerLanguage(BuildContext context, WidgetRef ref) async {
  final current = ref.read(employerLanguageProvider);
  final signedIn = ref.read(authRepositoryProvider).userId != null;
  final value = await showHiPicker(
    context,
    title: Biz.language,
    searchHint: '',
    searchable: false,
    selected: current.code,
    options: [for (final l in AppLanguage.values) HiPickerOption(l.code, l.label)],
    action: signedIn ? HiPickerAction(_deleteAccountValue, Biz.deleteAccount) : null,
  );
  if (value == null) return;
  if (value == _deleteAccountValue) {
    if (context.mounted) await _deleteAccount(context, ref);
    return;
  }
  ref.read(employerLanguageProvider.notifier).select(AppLanguage.fromCode(value));
}

Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
  final router = GoRouter.of(context);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final sure = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
    builder: (context) => const _DeleteAccountSheet(),
  );
  if (sure != true) return;
  try {
    await ref.read(authRepositoryProvider).deleteAccount();
    messenger?.showSnackBar(SnackBar(content: Text(Biz.deleteAccountDone)));
    router.go(EmployerRoutes.login);
  } on Object catch (error) {
    messenger?.showSnackBar(SnackBar(content: Text(Biz.error(error))));
  }
}

class _DeleteAccountSheet extends StatelessWidget {
  const _DeleteAccountSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 24, 20, HiInsets.bottom(context, 24)),
      decoration: const BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: HiBorders.ink),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: HiText(Biz.deleteAccountTitle, style: hiStyle(22, FontWeight.w800, color: HiColors.ink))),
          const SizedBox(height: 8),
          HiText(Biz.deleteAccountText, style: hiStyle(15, FontWeight.w500, color: HiColors.inkMuted)),
          const SizedBox(height: 20),
          HiButton(
            label: Biz.deleteAccountConfirm,
            style: HiButtonStyle.danger,
            height: 52,
            fontSize: 17,
            onPressed: () => Navigator.of(context).pop(true),
          ),
          const SizedBox(height: 8),
          HiButton(
            label: Biz.back,
            style: HiButtonStyle.text,
            textColor: HiColors.ink,
            height: 48,
            fontSize: 16,
            onPressed: () => Navigator.of(context).pop(false),
          ),
        ],
      ),
    );
  }
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

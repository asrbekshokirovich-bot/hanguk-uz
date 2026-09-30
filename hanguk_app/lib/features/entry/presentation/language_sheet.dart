import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/entry_store.dart';
import 'widgets/language_options.dart';

/// Changing the language after the first screen: a bottom sheet with the same
/// four rows. Picking one applies it at once and closes the sheet.
Future<void> showLanguageSheet(BuildContext context, WidgetRef ref) {
  final l10n = AppLocalizations.of(context)!;
  final current =
      ref.read(entryProvider).languageCode ??
      Localizations.localeOf(context).languageCode;

  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: const Color(0xFF132A4D),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color.fromRGBO(255, 255, 255, .24),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              l10n.entryLanguageSheetTitle,
              style: SeoulType.title,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            LanguageOptions(
              selected: current,
              onSelected: (code) {
                ref.read(entryProvider.notifier).setLanguage(code);
                Navigator.of(sheetContext).pop();
              },
            ),
          ],
        ),
      ),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/entry_store.dart';
import 'widgets/country_options.dart';

/// Changing the country after the first launch (plan KG2): a bottom sheet
/// like the language one. Picking a row applies it at once and closes it.
Future<void> showCountrySheet(BuildContext context, WidgetRef ref) {
  final l10n = AppLocalizations.of(context)!;
  final current = ref.read(entryProvider).country;

  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: const Color(0xFF132A4D),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
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
            Text(l10n.countrySheetTitle, style: SeoulType.title, textAlign: TextAlign.center),
            const SizedBox(height: 18),
            CountryOptions(
              selected: current,
              onSelected: (country) {
                ref.read(entryProvider.notifier).setCountry(country);
                Navigator.of(sheetContext).pop();
              },
            ),
          ],
        ),
      ),
    ),
  );
}

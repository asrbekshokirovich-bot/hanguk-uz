// `institutions.ieqas_status` is a database enum, and screens were printing it
// verbatim: a student browsing in Uzbek met the bare English word
// "outstanding" on a university card, naming neither the scheme it comes from
// nor what it certifies.
//
// `ieqasLabel` is the only way that column should reach a screen. What matters
// most here is the null branch: 'none' is a real value for 74 of 204 visible
// institutions, and an unrecognised value must behave like it rather than fall
// back to printing itself — a grade added server-side tomorrow must not
// surface as raw text again.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/map/presentation/ieqas_label.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

Future<AppLocalizations> _l10n(WidgetTester tester, Locale locale) async {
  late AppLocalizations l;
  await tester.pumpWidget(
    MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) {
          l = AppLocalizations.of(context)!;
          return const SizedBox.shrink();
        },
      ),
    ),
  );
  await tester.pumpAndSettle();
  return l;
}

void main() {
  testWidgets('the two real grades get a label, in every locale', (
    tester,
  ) async {
    for (final locale in AppLocalizations.supportedLocales) {
      final l = await _l10n(tester, locale);
      for (final status in ['outstanding', 'accredited']) {
        final label = ieqasLabel(l, status);
        expect(
          label,
          isNotNull,
          reason: '$status has no label in ${locale.languageCode}',
        );
        // The point of the fix: what reaches the card is not the enum.
        expect(
          label,
          isNot(status),
          reason:
              'ieqasLabel returned the raw database value for $status in '
              '${locale.languageCode}',
        );
      }
    }
  });

  testWidgets('none, null and an unknown grade produce no chip', (
    tester,
  ) async {
    final l = await _l10n(tester, const Locale('uz'));

    expect(ieqasLabel(l, 'none'), isNull);
    expect(ieqasLabel(l, null), isNull);
    // A value this build has never seen: no chip beats inventing a meaning,
    // and beats printing the enum.
    expect(ieqasLabel(l, 'provisional_2027'), isNull);
    expect(ieqasLabel(l, ''), isNull);
  });
}

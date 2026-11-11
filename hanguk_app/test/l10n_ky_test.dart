// Kyrgyz (plan KG7, Asrbek 2026-11-11): offered on the first screen and in
// the language sheet, and every text the app shows has its Kyrgyz version.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/entry/data/entry_store.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

void main() {
  test('Kyrgyz is one of the languages', () {
    expect(kEntryLanguages, contains('ky'));
    expect(kEntryLanguageNames['ky'], 'Кыргызча');
    expect(AppLocalizations.supportedLocales, contains(const Locale('ky')));
    final l = lookupAppLocalizations(const Locale('ky'));
    expect(l.countryLabel, 'Өлкө');
    expect(l.countryKyrgyzstan, 'Кыргызстан');
    expect(l.onbQuizContinue, 'Улантуу');
  });

  test('app_ky.arb has every key, with the template placeholders', () {
    Map<String, dynamic> read(String name) =>
        jsonDecode(File('lib/l10n/$name').readAsStringSync()) as Map<String, dynamic>;
    final en = read('app_en.arb');
    final ky = read('app_ky.arb');
    final braces = RegExp(r'\{(\w+)[},]');
    for (final key in en.keys.where((k) => !k.startsWith('@'))) {
      expect(ky.containsKey(key), isTrue, reason: key);
      Set<String> names(String s) => {for (final m in braces.allMatches(s)) m.group(1)!};
      expect(names(ky[key] as String), names(en[key] as String), reason: key);
    }
  });
}

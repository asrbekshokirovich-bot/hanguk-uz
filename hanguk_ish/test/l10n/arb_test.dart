import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Every string of both apps must exist in all four languages (uz, ru, en,
/// ko — project rule since 2026-11-09; the employer app's `biz…` since P43),
/// and the placeholders must agree.
void main() {
  const locales = ['uz', 'ru', 'en', 'ko'];
  // Halves of a sentence around a link: empty where the language needs no
  // text on that side (Uzbek puts the link first, English last).
  const mayBeEmpty = {
    'termsPrefix', 'termsSuffix', 'bizTermsSuffix',
    // Units after a number: Russian and English write the number alone.
    'bizUnitCount', 'bizUnitPeople',
  };

  Map<String, dynamic> read(String locale) =>
      jsonDecode(File('lib/l10n/app_$locale.arb').readAsStringSync()) as Map<String, dynamic>;

  Set<String> messages(Map<String, dynamic> arb) => arb.keys.where((k) => !k.startsWith('@')).toSet();

  final template = read('uz');

  /// The declared placeholders that [text] uses (`{name}`, or `{name,` of a
  /// plural): a plural's branch text («=0{Notifications}») is not one.
  Set<String> placeholders(String key, String text) {
    final declared = ((template['@$key'] as Map<String, dynamic>?)?['placeholders'] as Map<String, dynamic>?)?.keys.toSet() ?? {};
    return RegExp(r'\{(\w+)\s*[},]').allMatches(text).map((m) => m.group(1)!).where(declared.contains).toSet();
  }

  test('template messages are documented', () {
    for (final key in messages(template)) {
      expect(template['@$key'], isA<Map<String, dynamic>>(), reason: '@$key description missing in app_uz.arb');
    }
  });

  for (final locale in locales) {
    test('app_$locale.arb has exactly the template keys', () {
      final arb = read(locale);
      expect(arb['@@locale'], locale);
      expect(messages(arb), messages(template));
    });

    test('app_$locale.arb texts are filled and keep placeholders', () {
      final arb = read(locale);
      for (final key in messages(template)) {
        final value = arb[key] as String;
        if (!mayBeEmpty.contains(key)) {
          expect(value.trim(), isNotEmpty, reason: '$locale.$key is empty');
        }
        expect(placeholders(key, value), placeholders(key, template[key] as String), reason: '$locale.$key placeholders');
      }
    });
  }

  test('every terms sentence still has its link text', () {
    for (final locale in locales) {
      expect((read(locale)['termsLink'] as String).trim(), isNotEmpty);
    }
  });
}


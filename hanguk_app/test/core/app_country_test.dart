import 'dart:ui' show Locale;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/country/app_country.dart';
import 'package:hanguk_app/features/entry/data/entry_store.dart';

void main() {
  group('guessCountry', () {
    test("the phone's region decides first", () {
      expect(guessCountry(const Locale('ru', 'KG'), const Duration(hours: 6)), AppCountry.kg);
      expect(guessCountry(const Locale('ky', 'KG'), const Duration(hours: 5)), AppCountry.kg);
      expect(guessCountry(const Locale('uz', 'UZ'), const Duration(hours: 6)), AppCountry.uz);
      expect(guessCountry(const Locale('ru', 'kg'), Duration.zero), AppCountry.kg);
    });

    test('no region of ours: the UTC offset', () {
      expect(guessCountry(const Locale('ru', 'RU'), const Duration(hours: 6)), AppCountry.kg);
      expect(guessCountry(const Locale('ru', 'RU'), const Duration(hours: 5)), AppCountry.uz);
      expect(guessCountry(const Locale('en'), const Duration(hours: 5)), AppCountry.uz);
      expect(guessCountry(null, const Duration(hours: 6)), AppCountry.kg);
    });

    test('nothing points to either: no guess', () {
      expect(guessCountry(const Locale('ko', 'KR'), const Duration(hours: 9)), isNull);
      expect(guessCountry(const Locale('en', 'US'), Duration.zero), isNull);
      expect(guessCountry(null, const Duration(hours: 5, minutes: 30)), isNull);
    });
  });

  test('AppCountry.fromCode', () {
    expect(AppCountry.fromCode('KG'), AppCountry.kg);
    expect(AppCountry.fromCode(' uz '), AppCountry.uz);
    expect(AppCountry.fromCode(''), isNull);
    expect(AppCountry.fromCode('KZ'), isNull);
    expect(AppCountry.fromCode(null), isNull);
  });

  group('EntryStore and the country', () {
    late Map<String, String> saved;

    setUp(() {
      TestWidgetsFlutterBinding.ensureInitialized();
      saved = {};
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
        (call) async {
          final args = (call.arguments as Map?) ?? const {};
          final key = args['key'] as String?;
          switch (call.method) {
            case 'read':
              return saved[key];
            case 'write':
              saved[key!] = args['value'] as String;
              return null;
          }
          return null;
        },
      );
    });

    test('a first launch has neither', () async {
      final s = await EntryStore.load();
      expect(s.hasLanguage, isFalse);
      expect(s.hasCountry, isFalse);
    });

    test('an install from before the country screen is not asked', () async {
      saved['app_language_v1'] = 'uz';
      final s = await EntryStore.load();
      expect(s.languageCode, 'uz');
      // The phone's country; Uzbekistan when it says nothing (en_US in UTC).
      final expected = EntryStore.phoneCountry() ?? AppCountry.uz;
      expect(s.country, expected);
      expect(saved['app_country_v1'], expected.code);
    });

    test('a language picked on this build: the country screen comes next', () async {
      saved['app_language_v1'] = 'ru';
      await EntryStore.markCountryToAsk();
      expect(saved['app_country_v1'], '');
      final s = await EntryStore.load();
      expect(s.hasLanguage, isTrue);
      expect(s.hasCountry, isFalse);
    });

    test('a chosen country is kept', () async {
      saved['app_language_v1'] = 'ru';
      saved['app_country_v1'] = 'KG';
      await EntryStore.markCountryToAsk();
      expect((await EntryStore.load()).country, AppCountry.kg);
      expect(saved['app_country_v1'], 'KG');
    });
  });
}

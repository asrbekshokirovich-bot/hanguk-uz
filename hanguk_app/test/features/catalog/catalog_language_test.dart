// The catalogue speaks the student's language: the admission-timeline steps
// the Excel writes in Uzbek, and the city in Korean when the app is in Korean.
// Faculty names are left as written; they are not covered here.
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_format.dart';

void main() {
  // Every step name `v_app_university_rounds.etap_nomi` holds today.
  const steps = [
    'Online hujjat topshirish',
    "Application fee to'lash",
    'Offline hujjat topshirish',
    'Bank statement (universitet uchun)',
    'Intervyu',
    "Natija e'lon qilinishi",
    "Kontrakt to'lash",
    'Certificate of Admission berilishi',
    'Viza uchun bank statement',
    'Viza uchun tarjima va apostil',
    'Vizaga hujjat topshirish',
  ];

  group('roundNameFor', () {
    test('translates every step into every app language', () {
      for (final lang in ['en', 'ko', 'ru', 'vi', 'uz']) {
        final names = [for (final s in steps) roundNameFor(lang, s)];
        expect(names.toSet(), hasLength(steps.length), reason: '$lang: two steps share a name');
        if (lang != 'uz') {
          for (var i = 0; i < steps.length; i++) {
            expect(names[i], isNot(steps[i]), reason: '$lang left "${steps[i]}" untranslated');
          }
        }
      }
    });

    test('reads the visa step in Korean and Russian', () {
      expect(roundNameFor('ko', 'Vizaga hujjat topshirish'), '비자 서류 제출');
      expect(roundNameFor('ru', 'Vizaga hujjat topshirish'), 'Подача документов на визу');
    });

    test('ignores case, spacing and the apostrophe variant', () {
      expect(roundNameFor('ko', '  natija  E‘lon qilinishi '), '합격자 발표');
      expect(roundNameFor('en', 'Kontrakt to’lash'), 'Tuition payment');
    });

    test('keeps an unknown step as written, and falls back to English for an unknown language', () {
      expect(roundNameFor('ko', 'Yangi bosqich'), 'Yangi bosqich');
      expect(roundNameFor('de', 'Intervyu'), 'Interview');
      expect(roundNameFor('ko', null), '');
    });
  });

  test('knows the Korean spelling of every catalogue city', () {
    const cities = [
      'Seoul', 'Daejeon', 'Daegu', 'Jeonju', 'Gwangju', 'Seongnam', 'Changwon', 'Yongin', 'Bucheon',
      'Ulsan', 'Siheung', 'Nonsan', 'Chuncheon', 'Sejong', 'Yangju', 'Yeonggwang (Jeollanam-do)',
      'Gyeongsan', 'Suwon',
    ];
    for (final c in cities) {
      expect(cityKoOf(c), isNotNull, reason: c);
    }
    expect(cityKoOf('Seoul'), '서울');
  });
}

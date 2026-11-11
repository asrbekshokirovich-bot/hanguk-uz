import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/money/fx_rates.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_format.dart';

void main() {
  tearDown(() {
    FxRates.current = null;
    FxRates.country = 'UZ';
    KgsRates.current = null;
  });

  test('reads USD and KRW from the bank list', () {
    final r = FxRates.fromCbu([
      {'Ccy': 'EUR', 'Nominal': '1', 'Rate': '13000', 'Date': '22.10.2026'},
      {'Ccy': 'USD', 'Nominal': '1', 'Rate': '11965.51', 'Date': '22.10.2026'},
      {'Ccy': 'KRW', 'Nominal': '1', 'Rate': '9.03', 'Date': '22.10.2026'},
    ])!;
    expect(r.uzsPerUsd, 11965.51);
    expect(r.uzsPerKrw, 9.03);
    expect(r.date, '22.10.2026');
    expect(FxRates.fromCbu([{'Ccy': 'USD', 'Nominal': '1', 'Rate': '11965.51'}]), isNull);
  });

  test('the currency follows the language', () {
    expect(displayCurrencyFor('uz'), 'UZS');
    expect(displayCurrencyFor('en'), 'USD');
    expect(displayCurrencyFor('ru_RU'), 'USD');
    expect(displayCurrencyFor('ko'), isNull);
  });

  test('won shown in so\'m, dollars, or as quoted', () {
    expect(money(4134000, 'KRW', locale: 'uz').startsWith('₩'), isTrue);
    FxRates.current = const FxRates(uzsPerUsd: 11965.51, uzsPerKrw: 9.03, date: '22.10.2026');
    // 4 134 000 × 9.03 = 37 330 020 so'm → nearest thousand.
    expect(convertKrw(4134000, 'UZS', FxRates.current!), 37330000);
    // … ÷ 11 965.51 = 3 119.82 → $3 120.
    expect(convertKrw(4134000, 'USD', FxRates.current!), 3120);
    expect(money(4134000, 'KRW', locale: 'en'), '\$3,120');
    expect(money(4134000, 'KRW', locale: 'ko'), '₩4,134,000');
    expect(money(4134000, 'KRW', locale: 'uz').endsWith("so'm"), isTrue);
    expect(money(4134000, 'KRW', locale: 'ru').startsWith('\$'), isTrue);
    // Other currencies are never converted.
    expect(money(80, 'USD', locale: 'uz').startsWith('\$'), isTrue);
  });

  group('Kyrgyzstan: som at the National Bank of the Kyrgyz Republic (plan KG4)', () {
    // The lists as nbkr.kg serves them (read 2026-11-11): comma decimals,
    // KRW only in the weekly list, with a ValidFor.
    const daily = '<?xml version="1.0" encoding="windows-1251"?>'
        '<CurrencyRates Name="Daily Exchange Rates" Date="11.11.2026">'
        '<Currency ISOCode="USD"><Nominal>1</Nominal><Value>87,4498</Value></Currency>'
        '<Currency ISOCode="EUR"><Nominal>1</Nominal><Value>101,2000</Value></Currency>'
        '</CurrencyRates>';
    const weekly = '<CurrencyRates Name="Weekly Exchange Rates" Date="07.11.2026">\n'
        '<Currency ISOCode="JPY">\n<Nominal>1</Nominal>\n<ValidFor>7</ValidFor>\n<Value>0,5700</Value>\n</Currency>\n'
        '<Currency ISOCode="KRW">\n<Nominal>1</Nominal>\n<ValidFor>7</ValidFor>\n<Value>0,0645</Value>\n</Currency>\n'
        '</CurrencyRates>';

    test('reads USD from the daily list and KRW from the weekly one', () {
      final r = KgsRates.fromNbkr(daily, weekly)!;
      expect(r.kgsPerUsd, 87.4498);
      expect(r.kgsPerKrw, 0.0645);
      expect(r.date, '11.11.2026');
      expect(KgsRates.fromNbkr(daily, daily), isNull);
      expect(KgsRates.perUnit('<Currency ISOCode="KRW"><Nominal>100</Nominal><Value>6,45</Value></Currency>', 'KRW'), closeTo(0.0645, 1e-9));
    });

    test('the currency: uz and ky → som, en and ru → dollars, ko → won', () {
      expect(displayCurrencyFor('uz', country: 'KG'), 'KGS');
      expect(displayCurrencyFor('ky', country: 'KG'), 'KGS');
      expect(displayCurrencyFor('en', country: 'KG'), 'USD');
      expect(displayCurrencyFor('ru', country: 'KG'), 'USD');
      expect(displayCurrencyFor('ko', country: 'KG'), isNull);
      expect(displayCurrencyFor('uz', country: 'UZ'), 'UZS');
      expect(displayCurrencyFor('ky', country: 'UZ'), 'UZS');
    });

    test('fees in som and in dollars at the Kyrgyz rates', () {
      FxRates.current = const FxRates(uzsPerUsd: 11965.51, uzsPerKrw: 9.03, date: '22.10.2026');
      FxRates.country = 'KG';
      // No Kyrgyz rates yet: won as quoted, never so'm.
      expect(money(4134000, 'KRW', locale: 'uz').startsWith('₩'), isTrue);
      KgsRates.current = KgsRates.fromNbkr(daily, weekly);
      // 4 134 000 × 0.0645 = 266 643 som → nearest hundred.
      expect(convertKrwToKgs(4134000, KgsRates.current!), 266600);
      expect(money(4134000, 'KRW', locale: 'uz'), '${groupThousands(266600, locale: 'uz')} som');
      // … ÷ 87.4498 = 3 049.1 → $3 049.
      expect(money(4134000, 'KRW', locale: 'en'), '\$3,049');
      expect(money(4134000, 'KRW', locale: 'ko'), '₩4,134,000');
      expect(money(4134000, 'KRW', locale: 'ky').endsWith(' сом'), isTrue);
      // Back in Uzbekistan: so'm at the Uzbek bank's rate.
      FxRates.country = 'UZ';
      expect(money(4134000, 'KRW', locale: 'uz').endsWith("so'm"), isTrue);
      expect(money(4134000, 'KRW', locale: 'en'), '\$3,120');
    });

    test('on the web the Kyrgyz bank is read through our edge function (no CORS there)', () {
      expect(KgsRates.dailyUrl(web: false), 'https://www.nbkr.kg/XML/daily.xml');
      expect(KgsRates.weeklyUrl(web: false), 'https://www.nbkr.kg/XML/weekly.xml');
      expect(KgsRates.dailyUrl(web: true), endsWith('/functions/v1/fx-kgs?list=daily'));
      expect(KgsRates.weeklyUrl(web: true), endsWith('/functions/v1/fx-kgs?list=weekly'));
    });
  });
}

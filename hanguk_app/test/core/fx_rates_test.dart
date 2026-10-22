import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/money/fx_rates.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_format.dart';

void main() {
  tearDown(() => FxRates.current = null);

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
    expect(displayCurrencyFor('vi'), isNull);
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
    expect(money(4134000, 'KRW', locale: 'vi').startsWith('₩'), isTrue);
    expect(money(4134000, 'KRW', locale: 'uz').endsWith("so'm"), isTrue);
    expect(money(4134000, 'KRW', locale: 'ru').startsWith('\$'), isTrue);
    // Other currencies are never converted.
    expect(money(80, 'USD', locale: 'uz').startsWith('\$'), isTrue);
  });
}

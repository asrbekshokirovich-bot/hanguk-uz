import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// The Central Bank of Uzbekistan's official rates (cbu.uz), which fees in
/// won are shown in (owner, 2026-10-22): Uzbek → so'm, English and Russian →
/// US dollars, Korean and Vietnamese → won as the guideline quotes it.
///
/// The bank publishes once a day. The app reads the last rates it saved at
/// start, then asks the bank again; until it has rates at all, fees stay in
/// won.
@immutable
class FxRates {
  const FxRates({required this.uzsPerUsd, required this.uzsPerKrw, required this.date});

  /// So'm for one US dollar.
  final double uzsPerUsd;

  /// So'm for one won.
  final double uzsPerKrw;

  /// The bank's date for these rates, "22.10.2026".
  final String date;

  /// The rates in use; null until the first load.
  static FxRates? current;

  /// Goes up when [current] changes. The screens that show fees watch it
  /// ([fxRevisionProvider]) and redraw; nothing else does.
  static final ValueNotifier<int> revision = ValueNotifier(0);

  static const _url = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/';
  static const _key = 'fx_rates_cbu_v1';
  static const _storage = FlutterSecureStorage();

  /// From the bank's list: each row has `Ccy`, `Nominal` and `Rate` (so'm for
  /// `Nominal` units). Null when USD or KRW is missing or not a number.
  static FxRates? fromCbu(List<dynamic> rows) {
    double? perUnit(String ccy) {
      for (final r in rows) {
        if (r is Map && r['Ccy'] == ccy) {
          final rate = double.tryParse('${r['Rate']}');
          final nominal = double.tryParse('${r['Nominal']}') ?? 1;
          if (rate == null || rate <= 0 || nominal <= 0) return null;
          return rate / nominal;
        }
      }
      return null;
    }

    final usd = perUnit('USD');
    final krw = perUnit('KRW');
    if (usd == null || krw == null) return null;
    String date = '';
    for (final r in rows) {
      if (r is Map && r['Ccy'] == 'USD') date = '${r['Date'] ?? ''}';
    }
    return FxRates(uzsPerUsd: usd, uzsPerKrw: krw, date: date);
  }

  Map<String, Object> toJson() => {'usd': uzsPerUsd, 'krw': uzsPerKrw, 'date': date};

  static FxRates? fromJson(Map<String, dynamic> j) {
    final usd = (j['usd'] as num?)?.toDouble();
    final krw = (j['krw'] as num?)?.toDouble();
    if (usd == null || krw == null || usd <= 0 || krw <= 0) return null;
    return FxRates(uzsPerUsd: usd, uzsPerKrw: krw, date: '${j['date'] ?? ''}');
  }

  /// The rates saved last time, before the first frame. No network.
  static Future<void> loadSaved() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null) return;
      current ??= fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      // Nothing usable saved: fees stay in won until the bank answers.
    }
  }

  /// Asks the bank; true when the rates in use changed.
  static Future<bool> refresh({http.Client? client}) async {
    try {
      final c = client ?? http.Client();
      final res = await c.get(Uri.parse(_url)).timeout(const Duration(seconds: 10));
      if (client == null) c.close();
      if (res.statusCode != 200) return false;
      final next = fromCbu(jsonDecode(utf8.decode(res.bodyBytes)) as List<dynamic>);
      if (next == null) return false;
      final prev = current;
      current = next;
      unawaited(_storage.write(key: _key, value: jsonEncode(next.toJson())).catchError((_) {}));
      return prev == null || prev.uzsPerUsd != next.uzsPerUsd || prev.uzsPerKrw != next.uzsPerKrw;
    } catch (_) {
      // Offline, blocked (a browser without CORS) or a changed format: keep
      // what there is.
      return false;
    }
  }

  /// [refresh], then — if the rates changed — only the screens that show
  /// fees redraw ([revision]). Marking the whole element tree dirty, as this
  /// did, rebuilt every mounted screen at once just after start: a visible
  /// stall on a low-end phone.
  static Future<void> refreshAndRebuild() async {
    if (!await refresh()) return;
    revision.value++;
  }

  /// The country the app is set up for (`UZ` / `KG`, plan KG4): set up for
  /// Kyrgyzstan, Uzbek and Kyrgyz show fees in som at the National Bank of
  /// the Kyrgyz Republic's rates ([KgsRates]). Set at start and when it is
  /// changed; the fee screens redraw. The app asks that bank (main.dart).
  static String country = 'UZ';

  static void setCountry(String code) {
    if (code == country) return;
    country = code;
    revision.value++;
  }
}

/// The National Bank of the Kyrgyz Republic's official rates (nbkr.kg, plan
/// KG4): som for a US dollar from the daily list, som for a won from the
/// weekly one. Read like [FxRates]: the last saved at start, then the bank.
@immutable
class KgsRates {
  const KgsRates({required this.kgsPerUsd, required this.kgsPerKrw, required this.date});

  /// Som for one US dollar.
  final double kgsPerUsd;

  /// Som for one won.
  final double kgsPerKrw;

  /// The daily list's date, "11.11.2026".
  final String date;

  static KgsRates? current;

  static const _daily = 'https://www.nbkr.kg/XML/daily.xml';
  static const _weekly = 'https://www.nbkr.kg/XML/weekly.xml';
  static const _key = 'fx_rates_nbkr_v1';
  static const _storage = FlutterSecureStorage();

  /// Som for one unit of [iso] in a bank list: `<Currency ISOCode="USD">`
  /// with `<Nominal>` and a comma-decimal `<Value>` ("87,4498").
  static double? perUnit(String xml, String iso) {
    final m = RegExp(
      '<Currency\\s+ISOCode="$iso"\\s*>(.*?)</Currency>',
      dotAll: true,
    ).firstMatch(xml);
    if (m == null) return null;
    String? tag(String name) => RegExp('<$name>\\s*([^<]*?)\\s*</$name>').firstMatch(m.group(1)!)?.group(1);
    final value = double.tryParse((tag('Value') ?? '').replaceAll(',', '.'));
    final nominal = double.tryParse((tag('Nominal') ?? '1').replaceAll(',', '.')) ?? 1;
    if (value == null || value <= 0 || nominal <= 0) return null;
    return value / nominal;
  }

  /// From the daily (USD) and weekly (KRW) lists; null when either is missing.
  static KgsRates? fromNbkr(String dailyXml, String weeklyXml) {
    final usd = perUnit(dailyXml, 'USD');
    final krw = perUnit(weeklyXml, 'KRW');
    if (usd == null || krw == null) return null;
    final date = RegExp('<CurrencyRates[^>]*\\sDate="([^"]*)"').firstMatch(dailyXml)?.group(1) ?? '';
    return KgsRates(kgsPerUsd: usd, kgsPerKrw: krw, date: date);
  }

  Map<String, Object> toJson() => {'usd': kgsPerUsd, 'krw': kgsPerKrw, 'date': date};

  static KgsRates? fromJson(Map<String, dynamic> j) {
    final usd = (j['usd'] as num?)?.toDouble();
    final krw = (j['krw'] as num?)?.toDouble();
    if (usd == null || krw == null || usd <= 0 || krw <= 0) return null;
    return KgsRates(kgsPerUsd: usd, kgsPerKrw: krw, date: '${j['date'] ?? ''}');
  }

  static Future<void> loadSaved() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null) return;
      current ??= fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      // Nothing usable saved: fees stay as they were until the bank answers.
    }
  }

  /// Asks the bank; true when the rates in use changed.
  static Future<bool> refresh({http.Client? client}) async {
    try {
      final c = client ?? http.Client();
      final res = await Future.wait([
        c.get(Uri.parse(_daily)).timeout(const Duration(seconds: 10)),
        c.get(Uri.parse(_weekly)).timeout(const Duration(seconds: 10)),
      ]);
      if (client == null) c.close();
      if (res.any((r) => r.statusCode != 200)) return false;
      // Only ASCII is read (codes and numbers): whatever the page's encoding.
      final next = fromNbkr(
        utf8.decode(res[0].bodyBytes, allowMalformed: true),
        utf8.decode(res[1].bodyBytes, allowMalformed: true),
      );
      if (next == null) return false;
      final prev = current;
      current = next;
      unawaited(_storage.write(key: _key, value: jsonEncode(next.toJson())).catchError((_) {}));
      return prev == null || prev.kgsPerUsd != next.kgsPerUsd || prev.kgsPerKrw != next.kgsPerKrw;
    } catch (_) {
      // Offline, blocked (a browser without CORS) or a changed format.
      return false;
    }
  }

  static Future<void> refreshAndRebuild() async {
    if (!await refresh()) return;
    FxRates.revision.value++;
  }
}

/// The currency fees in won are shown in for [locale] ("uz", "ru_RU"…):
/// `UZS`, `KGS`, `USD`, or null for won as quoted. Set up for Kyrgyzstan
/// ([country] `KG`, Asrbek 2026-11-11): Uzbek and Kyrgyz → som, English and
/// Russian → dollars, Korean → won.
String? displayCurrencyFor(String? locale, {String? country}) {
  final lang = (locale ?? '').split(RegExp('[_-]')).first.toLowerCase();
  final kg = (country ?? FxRates.country) == 'KG';
  return switch (lang) {
    // Kyrgyz like Uzbek: the country's own money (plan KG7).
    'uz' || 'ky' => kg ? 'KGS' : 'UZS',
    'en' || 'ru' => 'USD',
    _ => null,
  };
}

/// [krw] in som at [rates]: to the nearest hundred.
num convertKrwToKgs(num krw, KgsRates rates) => (krw * rates.kgsPerKrw / 100).round() * 100;

/// [krw] in dollars at the Kyrgyz bank's rates: to the nearest dollar.
num convertKrwToUsdKg(num krw, KgsRates rates) => (krw * rates.kgsPerKrw / rates.kgsPerUsd).round();

/// [krw] in [currency] at [rates]: so'm to the nearest thousand, dollars to
/// the nearest dollar.
num convertKrw(num krw, String currency, FxRates rates) {
  final uzs = krw * rates.uzsPerKrw;
  return switch (currency) {
    'UZS' => (uzs / 1000).round() * 1000,
    'USD' => (uzs / rates.uzsPerUsd).round(),
    _ => krw,
  };
}

/// [FxRates.revision] for Riverpod: a screen that shows fees watches it and
/// redraws when the bank's rates arrive.
final fxRevisionProvider = Provider<int>((ref) {
  void changed() => ref.invalidateSelf();
  FxRates.revision.addListener(changed);
  ref.onDispose(() => FxRates.revision.removeListener(changed));
  return FxRates.revision.value;
});

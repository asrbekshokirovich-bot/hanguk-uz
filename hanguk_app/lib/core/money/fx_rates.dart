import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
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

  /// [refresh], then redraws every screen if the rates changed, so fees on
  /// screen follow at once.
  static Future<void> refreshAndRebuild() async {
    if (!await refresh()) return;
    void mark(Element e) {
      e.markNeedsBuild();
      e.visitChildren(mark);
    }

    WidgetsBinding.instance.rootElement?.visitChildren(mark);
  }
}

/// The currency fees in won are shown in for [locale] ("uz", "ru_RU"…):
/// `UZS`, `USD`, or null for won as quoted.
String? displayCurrencyFor(String? locale) {
  final lang = (locale ?? '').split(RegExp('[_-]')).first.toLowerCase();
  return switch (lang) {
    'uz' => 'UZS',
    'en' || 'ru' => 'USD',
    _ => null,
  };
}

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

import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../../../core/money/fx_rates.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/catalog_models.dart';

/// 4134000 → "4,134,000", grouped the way [locale] groups digits
/// ("4 134 000" in ru/uz). Without a locale, commas.
String groupThousands(num value, {String? locale}) {
  final n = value.round();
  if (locale != null) {
    try {
      return NumberFormat.decimalPattern(locale).format(n);
    } catch (_) {
      // Unknown locale — fall through to plain comma grouping.
    }
  }
  final s = n.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return b.toString();
}

/// An amount for the student. Won is shown in the currency of the app's
/// language at the Central Bank of Uzbekistan's rate ([FxRates]; owner,
/// 2026-10-22): Uzbek "37 330 000 so'm", English and Russian "\$3,120",
/// Korean and Vietnamese "₩4,134,000" as quoted — and as quoted too until the
/// app has rates. Other currencies are never converted and keep their ISO
/// code. [locale] picks the language and the digit grouping.
String money(num value, String? currency, {String? locale}) {
  var code = (currency ?? 'KRW').toUpperCase();
  var amount = value;
  final rates = FxRates.current;
  final target = displayCurrencyFor(locale);
  if (code == 'KRW' && rates != null && target != null) {
    amount = convertKrw(value, target, rates);
    code = target;
  }
  final n = groupThousands(amount, locale: locale);
  switch (code) {
    case 'KRW':
      return '₩$n';
    case 'USD':
      return '\$$n';
    case 'UZS':
      return "$n so'm";
    default:
      return '$n ${currency!.toUpperCase()}';
  }
}

/// "2027 Bahor" from the guideline's intake year and semester.
String? seasonLabel(AppLocalizations l, CatalogGuideline g) {
  final year = g.intakeYear;
  if (year == null) return null;
  final term = switch (g.semester) {
    'bahor' => l.catalogSeasonSpring,
    'kuz' => l.catalogSeasonAutumn,
    _ => null,
  };
  return term == null ? '$year' : l.catalogSeasonLabel('$year', term);
}

enum CatalogType { state, private, specialized, other }

CatalogType catalogType(String? institutionType) => switch (institutionType) {
  'national' || 'public' || 'national_special' => CatalogType.state,
  'private' => CatalogType.private,
  'specialized' => CatalogType.specialized,
  _ => CatalogType.other,
};

String? typeLabel(AppLocalizations l, String? institutionType, {bool short = false}) =>
    switch (catalogType(institutionType)) {
      CatalogType.state => short ? l.catalogTypeStateShort : l.catalogTypeState,
      CatalogType.private => short ? l.catalogTypePrivateShort : l.catalogTypePrivate,
      CatalogType.specialized =>
        short ? l.catalogTypeSpecializedShort : l.catalogTypeSpecialized,
      CatalogType.other => null,
    };

/// "/sem" or "/yil" after a fee, from the Excel's `kontrakt_davri`.
String periodSuffix(AppLocalizations l, String? period) => switch (period) {
  'semestr' => l.catalogSemSuffix,
  'yil' => l.catalogYearSuffix,
  _ => '',
};

/// "15-noy, 2026" in the student's language; the raw date if the locale has
/// no date symbols loaded.
String formatDate(BuildContext context, String isoDate) {
  final d = DateTime.tryParse(isoDate);
  if (d == null) return isoDate;
  try {
    return DateFormat.yMMMd(Localizations.localeOf(context).toLanguageTag()).format(d);
  } catch (_) {
    return isoDate;
  }
}

/// "21-sen – 2-okt, 2026": the year once when both ends share it.
String formatDateRange(BuildContext context, String from, String to) {
  final a = DateTime.tryParse(from);
  final b = DateTime.tryParse(to);
  if (a == null || b == null || a.year != b.year) {
    return '${formatDate(context, from)} – ${formatDate(context, to)}';
  }
  try {
    final tag = Localizations.localeOf(context).toLanguageTag();
    return '${DateFormat.MMMd(tag).format(a)} – ${DateFormat.yMMMd(tag).format(b)}';
  } catch (_) {
    return '$from – $to';
  }
}

/// "TOPIK 3+" / "IELTS 5.5+" — whole numbers without the ".0".
String scoreText(num v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// "Gangneung" and "Gangwon" from the Excel's "Gangneung (Gangwon-do)": the
/// city, and the province when the Excel names one (without its "-do").
({String city, String? province}) splitCity(String city) {
  final m = RegExp(r'^(.*?)\s*\((.+?)\)\s*$').firstMatch(city.trim());
  if (m == null) return (city: city.trim(), province: null);
  var province = m.group(2)!.trim();
  if (province.toLowerCase().endsWith('-do')) province = province.substring(0, province.length - 3);
  return (city: m.group(1)!.trim(), province: province.isEmpty ? null : province);
}

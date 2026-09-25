import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../../../l10n/app_localizations.dart';
import '../domain/catalog_models.dart';

/// 4134000 → "4,134,000".
String groupThousands(num value) {
  final s = value.round().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return b.toString();
}

/// An amount in the currency the guideline quotes it in — never converted.
/// KRW is the only currency the catalogue uses today and reads "₩4,134,000";
/// anything else keeps its ISO code.
String money(num value, String? currency) {
  final n = groupThousands(value);
  switch ((currency ?? 'KRW').toUpperCase()) {
    case 'KRW':
      return '₩$n';
    case 'USD':
      return '\$$n';
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

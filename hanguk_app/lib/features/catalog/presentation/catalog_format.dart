import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../../../l10n/app_localizations.dart';
import '../data/catalog_filters.dart';
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

/// The language the student picked ("ko", "ru", ...).
String _lang(BuildContext context) => Localizations.localeOf(context).languageCode;

/// The university's name in the student's language: the Korean name when the
/// app is in Korean, the English one otherwise. Faculty names are never
/// translated; this is only the university itself.
String universityName(BuildContext context, CatalogUniversity u) =>
    _lang(context) == 'ko' ? (u.nameKo ?? u.displayName) : u.displayName;

/// The city in the student's language: Korean spelling when the app is in
/// Korean and the table knows the city, the Excel's English spelling otherwise.
String? cityName(BuildContext context, CatalogUniversity u) {
  final city = u.city;
  if (city == null) return null;
  return _lang(context) == 'ko' ? (cityKoOf(city) ?? city) : city;
}

/// Admission-timeline steps. The Excel writes the eleven step names in Uzbek
/// (`etap_nomi`), whatever the student's language; this puts them in the
/// student's language. A step the table does not know keeps its Excel name.
const Map<String, Map<String, String>> _roundNames = {
  "online hujjat topshirish": {
    'en': 'Online application',
    'uz': 'Online hujjat topshirish',
    'ko': '온라인 원서 접수',
    'ru': 'Онлайн-подача документов',
    'vi': 'Nộp hồ sơ trực tuyến',
  },
  "application fee to'lash": {
    'en': 'Application fee payment',
    'uz': "Ariza to'lovini to'lash",
    'ko': '전형료 납부',
    'ru': 'Оплата сбора за подачу заявления',
    'vi': 'Nộp lệ phí xét tuyển',
  },
  "offline hujjat topshirish": {
    'en': 'Submitting original documents',
    'uz': 'Offline hujjat topshirish',
    'ko': '서류 원본 제출',
    'ru': 'Подача оригиналов документов',
    'vi': 'Nộp hồ sơ bản gốc',
  },
  "bank statement (universitet uchun)": {
    'en': 'Bank statement (for the university)',
    'uz': "Bank ma'lumotnomasi (universitet uchun)",
    'ko': '잔고 증명서 제출 (대학용)',
    'ru': 'Банковская выписка (для университета)',
    'vi': 'Sao kê ngân hàng (nộp cho trường)',
  },
  "intervyu": {
    'en': 'Interview',
    'uz': 'Intervyu',
    'ko': '면접',
    'ru': 'Собеседование',
    'vi': 'Phỏng vấn',
  },
  "natija e'lon qilinishi": {
    'en': 'Results announced',
    'uz': "Natija e'lon qilinishi",
    'ko': '합격자 발표',
    'ru': 'Объявление результатов',
    'vi': 'Công bố kết quả',
  },
  "kontrakt to'lash": {
    'en': 'Tuition payment',
    'uz': "Kontrakt to'lash",
    'ko': '등록금 납부',
    'ru': 'Оплата обучения',
    'vi': 'Đóng học phí',
  },
  "certificate of admission berilishi": {
    'en': 'Certificate of Admission issued',
    'uz': 'Qabul sertifikati (CoA) berilishi',
    'ko': '표준입학허가서 발급',
    'ru': 'Выдача подтверждения о зачислении (CoA)',
    'vi': 'Cấp giấy chấp nhận nhập học (CoA)',
  },
  "viza uchun bank statement": {
    'en': 'Bank statement for the visa',
    'uz': "Viza uchun bank ma'lumotnomasi",
    'ko': '비자용 잔고 증명서',
    'ru': 'Банковская выписка для визы',
    'vi': 'Sao kê ngân hàng cho visa',
  },
  "viza uchun tarjima va apostil": {
    'en': 'Translation and apostille for the visa',
    'uz': 'Viza uchun tarjima va apostil',
    'ko': '비자용 번역 및 아포스티유',
    'ru': 'Перевод и апостиль для визы',
    'vi': 'Dịch thuật và apostille cho visa',
  },
  "vizaga hujjat topshirish": {
    'en': 'Visa application',
    'uz': 'Vizaga hujjat topshirish',
    'ko': '비자 서류 제출',
    'ru': 'Подача документов на визу',
    'vi': 'Nộp hồ sơ xin visa',
  },
};

/// Lower-cased, single-spaced, with every apostrophe variant as `'`.
String _roundKey(String raw) => raw
    .trim()
    .toLowerCase()
    .replaceAll(RegExp("[\u2018\u2019\u02BB\u02BC`]"), "'")
    .replaceAll(RegExp(r'\s+'), ' ');

/// A timeline step's name in the student's language.
String roundName(BuildContext context, String? raw) => roundNameFor(_lang(context), raw);

/// [roundName] for a language code, for callers without a context.
String roundNameFor(String languageCode, String? raw) {
  if (raw == null || raw.trim().isEmpty) return '';
  final names = _roundNames[_roundKey(raw)];
  if (names == null) return raw.trim();
  return names[languageCode] ?? names['en']!;
}

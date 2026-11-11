import 'dart:ui' show Locale;

/// The country the app is set up for (plan KG2, Qirg'iziston): Uzbekistan or
/// Kyrgyzstan. It decides the phone code on the forms, the currency fees are
/// shown in, whose contacts and which airport the app names.
///
/// Chosen on the screen after the language (design B) and changed from the
/// account screen or, for a guest, from the Universitetlar header.
enum AppCountry {
  uz('UZ'),
  kg('KG');

  const AppCountry(this.code);

  /// ISO 3166-1 alpha-2, as stored and as sent with the analytics
  /// (`app_installs.country`).
  final String code;

  static AppCountry? fromCode(String? code) {
    final c = code?.trim().toUpperCase();
    for (final v in values) {
      if (v.code == c) return v;
    }
    return null;
  }
}

/// The country a phone points to: its region (`ru_KG` → Kyrgyzstan), else its
/// UTC offset (+6 h Kyrgyzstan, +5 h Uzbekistan) — the same two signals the
/// analytics records (devicePlace). Null when neither says.
AppCountry? guessCountry(Locale? phoneLocale, Duration utcOffset) {
  switch (phoneLocale?.countryCode?.toUpperCase()) {
    case 'KG':
      return AppCountry.kg;
    case 'UZ':
      return AppCountry.uz;
  }
  return switch (utcOffset.inMinutes) {
    360 => AppCountry.kg,
    300 => AppCountry.uz,
    _ => null,
  };
}

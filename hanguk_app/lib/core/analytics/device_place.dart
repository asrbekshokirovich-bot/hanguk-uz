import 'dart:ui' show Locale;

/// Where the phone is set up, sent with every batch of app events so the CRM
/// can tell which country an installation is in (plan KG1, Qirg'iziston):
///
/// * `device_region` — the region of the phone's own language setting:
///   "UZ" for uz_UZ / ru_UZ, "KG" for ky_KG / ru_KG. It is the phone's
///   setting, not the language the person picked inside the app.
/// * `tz_offset_min` — the phone's UTC offset in minutes: Tashkent +300,
///   Bishkek +360, Seoul +540.
///
/// Either is left out when the phone does not report a usable value.
Map<String, Object> devicePlace(Locale? phoneLocale, Duration utcOffset) {
  final place = <String, Object>{};
  final region = phoneLocale?.countryCode?.toUpperCase();
  if (region != null && _region.hasMatch(region)) place['device_region'] = region;
  final minutes = utcOffset.inMinutes;
  if (minutes >= -720 && minutes <= 840) place['tz_offset_min'] = minutes;
  return place;
}

final _region = RegExp(r'^[A-Z]{2}$');

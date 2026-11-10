import 'package:flutter/foundation.dart';

/// Business categories (database `businesses.category`).
enum BusinessCategory { cafe, restaurant, retail, logistics, event, office, other }

BusinessCategory businessCategoryFrom(String? value) => BusinessCategory.values.firstWhere(
      (c) => c.name == value,
      orElse: () => BusinessCategory.other,
    );

/// A business as workers see it.
@immutable
class Business {
  const Business({
    required this.id,
    required this.name,
    this.names = const {},
    this.area = '',
    this.areas = const {},
    required this.category,
    this.verified = true,
    this.address = '',
    this.addresses = const {},
    this.addressDetail = '',
    this.addressDetails = const {},
    this.lat,
    this.lng,
    this.logoIcon,
    this.photoUrl,
    this.rating,
    this.ratingCount = 0,
    this.completedShifts = 0,
  });

  final String id;

  /// As registered, in Korean (달빛카페 신촌점).
  final String name;

  /// Shown to workers per app language ({"uz": "Dalbit Kafe"}).
  final Map<String, String> names;

  /// Neighbourhood in Korean (신촌) and per language ({"uz": "Sinchon"}).
  final String area;
  final Map<String, String> areas;

  final BusinessCategory category;
  final bool verified;

  /// Street address in Korean and per language (마포구 신촌로12길 15).
  final String address;
  final Map<String, String> addresses;

  /// Floor or unit, in Korean and per language (2층 / 2-qavat).
  final String addressDetail;
  final Map<String, String> addressDetails;

  final double? lat;
  final double? lng;

  /// Name of a `HiIcons` icon used as the logo (e.g. 'moon'); null = first
  /// syllable of the Korean name.
  final String? logoIcon;
  final String? photoUrl;

  final double? rating;
  final int ratingCount;
  final int completedShifts;

  String displayName(String lang) => names[lang] ?? names['en'] ?? name;

  String displayArea(String lang) => areas[lang] ?? areas['en'] ?? area;

  /// The street address (A05 confirmation sheet).
  String displayAddress(String lang) => addresses[lang] ?? addresses['en'] ?? address;

  /// Street address with floor or unit (A05 detail, success).
  String fullAddress(String lang) {
    final street = displayAddress(lang);
    final detail = addressDetails[lang] ?? addressDetails['en'] ?? addressDetail;
    if (detail.isEmpty) return street;
    if (street.isEmpty) return detail;
    return '$street, $detail';
  }

  /// «Dalbit Kafe · Sinchon» (A05, A06).
  String nameWithArea(String lang) {
    final a = displayArea(lang);
    return a.isEmpty ? displayName(lang) : '${displayName(lang)} · $a';
  }

  /// First syllable of the Korean name, for the logo tile (뚝, 봄).
  String get initial => name.isEmpty ? '?' : String.fromCharCode(name.runes.first);
}

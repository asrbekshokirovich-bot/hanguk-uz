import 'package:flutter/foundation.dart';

import '../../core/money/won.dart';
import 'business.dart';

/// Status of the signed-in worker's application to a shift (database
/// `application_status`).
enum ApplicationStatus { pending, confirmed, rejected, cancelled, checkedIn, completed, noShow }

ApplicationStatus? applicationStatusFrom(String? value) => switch (value) {
      'pending' => ApplicationStatus.pending,
      'confirmed' => ApplicationStatus.confirmed,
      'rejected' => ApplicationStatus.rejected,
      'cancelled' => ApplicationStatus.cancelled,
      'checked_in' => ApplicationStatus.checkedIn,
      'completed' => ApplicationStatus.completed,
      'no_show' => ApplicationStatus.noShow,
      _ => null,
    };

/// The worker-facing text of a shift in one language.
@immutable
class ShiftText {
  const ShiftText({this.title, this.duties, this.dress, this.address});

  final String? title;
  final String? duties;
  final String? dress;
  final String? address;
}

/// A shift as the worker app shows it (feed card, map, detail).
@immutable
class ShiftListing {
  const ShiftListing({
    required this.id,
    required this.business,
    required this.title,
    this.duties = '',
    this.dress = '',
    this.address = '',
    this.translations = const {},
    required this.startsAt,
    required this.endsAt,
    required this.hourlyWage,
    required this.slots,
    required this.slotsLeft,
    this.autoConfirm = false,
    this.distanceKm,
    this.lat,
    this.lng,
    this.myStatus,
    this.myApplicationId,
  });

  final String id;
  final Business business;

  /// Korean originals, written by the business.
  final String title;
  final String duties;
  final String dress;
  final String address;

  /// Translations by language code.
  final Map<String, ShiftText> translations;

  final DateTime startsAt;
  final DateTime endsAt;
  final int hourlyWage;
  final int slots;
  final int slotsLeft;
  final bool autoConfirm;

  /// From the worker's position, when known.
  final double? distanceKm;
  final double? lat;
  final double? lng;

  final ApplicationStatus? myStatus;
  final String? myApplicationId;

  int get plannedMinutes => endsAt.difference(startsAt).inMinutes;

  /// What the whole shift pays (hours × hourly wage).
  int get totalPay => Pay.forMinutes(hourlyWage, plannedMinutes);

  String displayTitle(String lang) => translations[lang]?.title ?? title;

  String displayDress(String lang) => translations[lang]?.dress ?? dress;

  String displayAddress(String lang) =>
      translations[lang]?.address ?? (address.isNotEmpty ? address : business.displayAddress(lang));

  /// Duties as a list: one per line of the text.
  List<String> displayDuties(String lang) => (translations[lang]?.duties ?? duties)
      .split('\n')
      .map((d) => d.replaceFirst(RegExp(r'^[\s·•\-]+'), '').trim())
      .where((d) => d.isNotEmpty)
      .toList();

  ShiftListing copyWith({int? slotsLeft, ApplicationStatus? myStatus, String? myApplicationId}) => ShiftListing(
        id: id,
        business: business,
        title: title,
        duties: duties,
        dress: dress,
        address: address,
        translations: translations,
        startsAt: startsAt,
        endsAt: endsAt,
        hourlyWage: hourlyWage,
        slots: slots,
        slotsLeft: slotsLeft ?? this.slotsLeft,
        autoConfirm: autoConfirm,
        distanceKm: distanceKm,
        lat: lat,
        lng: lng,
        myStatus: myStatus ?? this.myStatus,
        myApplicationId: myApplicationId ?? this.myApplicationId,
      );
}

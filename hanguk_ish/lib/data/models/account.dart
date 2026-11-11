import 'package:flutter/foundation.dart';

/// The worker's track record (A11; database `worker_stats`).
@immutable
class WorkerStats {
  const WorkerStats({
    required this.completedShifts,
    required this.ratingCount,
    this.ratingAverage,
    required this.reliability,
  });

  final int completedShifts;
  final int ratingCount;
  final double? ratingAverage;

  /// 0–100: +1 per finished shift, −5 for a late cancel, −20 for a no-show.
  final int reliability;
}

/// Kinds of notifications (database `notifications.kind`).
/// [expired]: a request the business never answered before the shift began
/// (the upkeep job turns it down) — not «another worker was chosen».
/// [timeChanged]: the business moved a shift the worker was waiting for; the
/// request ended (it was for the old time) and the entry gives the new one.
enum NotificationKind {
  shiftReminder,
  confirmed,
  rejected,
  expired,
  timeChanged,
  cancelled,
  paid,
  message,
  newShift,
  nearbyShifts,
}

/// One entry of A12, with the values its sentence is built from (so it reads
/// in whatever language the app is set to).
@immutable
class HiNotification {
  const HiNotification({
    required this.id,
    required this.kind,
    required this.createdAt,
    this.read = false,
    this.businessNames = const {},
    this.businessId,
    this.shiftId,
    this.applicationId,
    this.startsAt,
    this.endsAt,
    this.minutesBefore,
    this.wage,
    this.wageMax,
    this.amount,
    this.distanceKm,
    this.count,
    this.areaNames = const {},
    this.categories = const [],
    this.lat,
    this.lng,
  });

  final String id;
  final NotificationKind kind;
  final DateTime createdAt;
  final bool read;

  /// The business as shown, per app language («Dalbit Kafe · Sinchon»).
  final Map<String, String> businessNames;
  final String? businessId;
  final String? shiftId;
  final String? applicationId;
  final DateTime? startsAt;
  final DateTime? endsAt;

  /// Reminders: how long before the start it was sent.
  final int? minutesBefore;
  final int? wage;
  final int? wageMax;
  final int? amount;
  final double? distanceKm;
  final int? count;

  /// Neighbourhood, per app language («Hongdae»).
  final Map<String, String> areaNames;

  /// Business category names (`BusinessCategory.name`).
  final List<String> categories;
  final double? lat;
  final double? lng;

  String businessName(String lang) => businessNames[lang] ?? businessNames['en'] ?? businessNames['ko'] ?? '';

  String areaName(String lang) => areaNames[lang] ?? areaNames['en'] ?? areaNames['ko'] ?? '';

  HiNotification markRead() => HiNotification(
        id: id,
        kind: kind,
        createdAt: createdAt,
        read: true,
        businessNames: businessNames,
        businessId: businessId,
        shiftId: shiftId,
        applicationId: applicationId,
        startsAt: startsAt,
        endsAt: endsAt,
        minutesBefore: minutesBefore,
        wage: wage,
        wageMax: wageMax,
        amount: amount,
        distanceKm: distanceKm,
        count: count,
        areaNames: areaNames,
        categories: categories,
        lat: lat,
        lng: lng,
      );
}

/// One chat message (A10; database `messages`).
@immutable
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.applicationId,
    required this.fromMe,
    required this.body,
    required this.createdAt,
    this.lang,
    this.translations = const {},
  });

  final String id;
  final String applicationId;
  final bool fromMe;
  final String body;
  final DateTime createdAt;

  /// Language of [body] when known ('ko', 'uz', …).
  final String? lang;

  /// [body] in other languages ({'uz': …}).
  final Map<String, String> translations;
}

/// What a report is about (A11 «Shikoyat qilish»; database `reports`).
enum ReportSubject { employer, payment, safety, other }

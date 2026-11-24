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

/// «Ishonch bali» (`my_trust`): the score and what makes it.
@immutable
class WorkerTrust {
  const WorkerTrust({
    required this.reliability,
    required this.went,
    this.onTimePercent,
    this.rating,
    this.ratingCount = 0,
    required this.noShows,
  });

  /// 0–100.
  final int reliability;

  /// Jobs gone to: finished shifts and opened jobs marked «Ishga chiqdim».
  final int went;

  /// Share of checked-in shifts without lateness; null before the first.
  final int? onTimePercent;

  /// The employers' stars for the worker.
  final double? rating;
  final int ratingCount;
  final int noShows;
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

  /// Hanguk's staff offered the worker a job (hanguk.uz, P39).
  jobOffer,

  /// The worker's shift is over (checked out): how long, how much, and to rate
  /// the business.
  finished,
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
    this.receivedAmount,
    this.distanceKm,
    this.count,
    this.areaNames = const {},
    this.categories = const [],
    this.lat,
    this.lng,
    this.note,
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

  /// [NotificationKind.finished]: what the worker said they received, once.
  final int? receivedAmount;
  final double? distanceKm;
  final int? count;

  /// Neighbourhood, per app language («Hongdae»).
  final Map<String, String> areaNames;

  /// Business category names (`BusinessCategory.name`).
  final List<String> categories;
  final double? lat;
  final double? lng;

  /// [NotificationKind.jobOffer]: what the staff wrote with the offer.
  final String? note;

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
        receivedAmount: receivedAmount,
        distanceKm: distanceKm,
        count: count,
        areaNames: areaNames,
        categories: categories,
        lat: lat,
        lng: lng,
        note: note,
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

/// Why coins moved (database `coin_ledger.reason`).
enum CoinReason { staff, unlock, topup, bonus, refund }

/// One move of the worker's coins (A11 «Tarix»).
@immutable
class CoinMove {
  const CoinMove({
    required this.delta,
    required this.balance,
    required this.reason,
    required this.createdAt,
    this.note = '',
    this.shiftTitle,
  });

  /// + in, − out.
  final int delta;

  /// The balance after this move.
  final int balance;
  final CoinReason reason;
  final DateTime createdAt;

  /// The staff's note (staff moves).
  final String note;

  /// The job that was opened.
  final String? shiftTitle;
}

/// The worker's puyl (`my_coins`): the balance and the last moves. Spent to
/// open a job's phone and address; the app holds no money, only this count.
@immutable
class CoinWallet {
  const CoinWallet({required this.balance, this.history = const []});

  final int balance;
  final List<CoinMove> history;
}

import 'package:flutter/foundation.dart';

/// Puyl to open a job's phone and address, by what the whole job pays
/// (the database's `unlock_price`).
int unlockPrice(int pay) => pay >= 150000
    ? 20
    : pay >= 110000
        ? 16
        : pay >= 80000
            ? 13
            : pay >= 50000
                ? 10
                : 7;

/// How long one personal offer lives.
const offerLifetime = Duration(minutes: 30);

enum JobOfferStatus {
  /// Waiting: the timer runs.
  sent,

  /// The worker opened it: it is in «Mening ishlarim».
  applied,

  /// The 30 minutes passed.
  expired,

  /// Others filled the places first.
  closed,
}

/// «Ishlar»: a job Hanguk's staff sent to this worker personally (`my_offers`).
/// No phone and no exact address until it is opened.
@immutable
class JobOffer {
  const JobOffer({
    required this.offerId,
    required this.shiftId,
    required this.status,
    required this.expiresAt,
    required this.title,
    this.titles = const {},
    required this.pay,
    required this.hourlyWage,
    required this.startsAt,
    required this.endsAt,
    required this.price,
    required this.sentCount,
    required this.slots,
    required this.taken,
    this.checkedAt,
    this.note = '',
    this.area = '',
    this.maskedAddress = '',
    this.maskedPhone = '010-••••-••••',
    this.distanceKm,
  });

  final String offerId;
  final String shiftId;
  final JobOfferStatus status;
  final DateTime? expiresAt;

  /// The Korean original and its translations by language.
  final String title;
  final Map<String, String> titles;

  /// What the whole job pays (won).
  final int pay;
  final int hourlyWage;
  final DateTime startsAt;
  final DateTime endsAt;

  /// Puyl to open it.
  final int price;

  /// To how many people it went at the same time.
  final int sentCount;
  final int slots;
  final int taken;

  /// When the staff last talked to the employer.
  final DateTime? checkedAt;
  final String note;
  final String area;
  final String maskedAddress;
  final String maskedPhone;
  final double? distanceKm;

  String displayTitle(String lang) => titles[lang] ?? title;

  int get placesLeft => (slots - taken).clamp(0, slots);

  /// Time left at [now]; zero once over.
  Duration leftAt(DateTime now) {
    final end = expiresAt;
    if (end == null) return Duration.zero;
    final left = end.difference(now);
    return left.isNegative ? Duration.zero : left;
  }

  /// Still waiting at [now] (sent and its time not over).
  bool liveAt(DateTime now) => status == JobOfferStatus.sent && leftAt(now) > Duration.zero;

  JobOffer copyWith({JobOfferStatus? status}) => JobOffer(
        offerId: offerId,
        shiftId: shiftId,
        status: status ?? this.status,
        expiresAt: expiresAt,
        title: title,
        titles: titles,
        pay: pay,
        hourlyWage: hourlyWage,
        startsAt: startsAt,
        endsAt: endsAt,
        price: price,
        sentCount: sentCount,
        slots: slots,
        taken: taken,
        checkedAt: checkedAt,
        note: note,
        area: area,
        maskedAddress: maskedAddress,
        maskedPhone: maskedPhone,
        distanceKm: distanceKm,
      );
}

/// The worker's own marks on an opened job.
enum JobStep { opened, called, wentToWork }

/// «Mening ishlarim»: a job the worker opened with puyl (`my_jobs`): now with
/// the employer's phone and the exact address.
@immutable
class OpenedJob {
  const OpenedJob({
    required this.applicationId,
    required this.shiftId,
    required this.title,
    this.titles = const {},
    required this.pay,
    required this.hourlyWage,
    required this.startsAt,
    required this.endsAt,
    required this.phone,
    required this.address,
    this.lat,
    this.lng,
    this.business = '',
    this.step = JobStep.opened,
    this.price = 0,
    this.stars,
    this.distanceKm,
  });

  final String applicationId;
  final String shiftId;
  final String title;
  final Map<String, String> titles;
  final int pay;
  final int hourlyWage;
  final DateTime startsAt;
  final DateTime endsAt;
  final String phone;
  final String address;
  final double? lat;
  final double? lng;
  final String business;
  final JobStep step;

  /// Puyl it cost.
  final int price;

  /// The worker's rating of the employer (after «Ishga chiqdim»).
  final int? stars;
  final double? distanceKm;

  String displayTitle(String lang) => titles[lang] ?? title;

  OpenedJob copyWith({JobStep? step, int? stars}) => OpenedJob(
        applicationId: applicationId,
        shiftId: shiftId,
        title: title,
        titles: titles,
        pay: pay,
        hourlyWage: hourlyWage,
        startsAt: startsAt,
        endsAt: endsAt,
        phone: phone,
        address: address,
        lat: lat,
        lng: lng,
        business: business,
        step: step ?? this.step,
        price: price,
        stars: stars ?? this.stars,
        distanceKm: distanceKm,
      );
}

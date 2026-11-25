import 'package:flutter/foundation.dart';

import 'shift.dart';

/// What a worker can praise about a workplace (A08; database
/// `ratings.tags`).
enum RatingTag {
  onTime('on_time'),
  polite('polite'),
  explainedWell('explained_well'),
  asDescribed('as_described'),
  breakGiven('break_given'),
  cleanWorkplace('clean_workplace'),
  wouldReturn('would_return');

  const RatingTag(this.dbName);

  /// The value stored in the database.
  final String dbName;

  static RatingTag? fromDb(String value) {
    for (final tag in values) {
      if (tag.dbName == value) return tag;
    }
    return null;
  }
}

/// One of the signed-in worker's applications with its shift (A06–A08).
@immutable
class MyShift {
  const MyShift({
    required this.applicationId,
    required this.shift,
    required this.status,
    this.checkInAt,
    this.checkOutAt,
    this.lateMinutes,
    this.workedMinutes,
    this.payAmount,
    this.paidAt,
    this.receivedAmount,
    this.receivedAt,
    this.cancelledAt,
    this.lateCancel = false,
    this.myStars,
    this.myTags = const {},
  });

  final String applicationId;
  final ShiftListing shift;
  final ApplicationStatus status;

  final DateTime? checkInAt;
  final DateTime? checkOutAt;
  final int? lateMinutes;

  /// Minutes counted for pay (inside the planned window, never more).
  final int? workedMinutes;

  /// What the business owes for this shift.
  final int? payAmount;

  /// When the business marked the pay as given.
  final DateTime? paidAt;

  /// What the worker says they were paid, and when they said it (the answer
  /// to «belgilangan pul berildimi yoki kamroqmi?» after the shift).
  final int? receivedAmount;
  final DateTime? receivedAt;

  final DateTime? cancelledAt;

  /// Cancelled with less than 24 hours to go.
  final bool lateCancel;

  /// The worker's rating of the business, once given.
  final int? myStars;
  final Set<RatingTag> myTags;

  /// «Kelgusi»: waiting, confirmed or at work.
  bool get isUpcoming =>
      status == ApplicationStatus.pending ||
      status == ApplicationStatus.confirmed ||
      status == ApplicationStatus.checkedIn;

  /// «Bajarilgan»: finished or missed.
  bool get isDone => status == ApplicationStatus.completed || status == ApplicationStatus.noShow;

  /// «Bekor qilingan»: cancelled by the worker or turned down.
  bool get isCancelled => status == ApplicationStatus.cancelled || status == ApplicationStatus.rejected;

  /// Paid: the business marked it, or the worker said what they received.
  bool get isPaid => paidAt != null || receivedAt != null;

  /// What is in the worker's hands: what they said they received, else the
  /// pay when the business marked it paid, else nothing yet.
  int get received => receivedAmount ?? (paidAt != null ? pay : 0);

  /// The worker said they received less than the shift came to.
  bool get paidLess => receivedAmount != null && receivedAmount! < pay;

  /// A finished shift the worker has not answered about yet.
  bool get awaitsPaymentAnswer => status == ApplicationStatus.completed && receivedAt == null;

  /// Pay for the finished shift, or the planned pay before it.
  int get pay => payAmount ?? shift.totalPay;

  MyShift copyWith({
    ApplicationStatus? status,
    DateTime? checkInAt,
    DateTime? checkOutAt,
    int? lateMinutes,
    int? workedMinutes,
    int? payAmount,
    DateTime? paidAt,
    int? receivedAmount,
    DateTime? receivedAt,
    DateTime? cancelledAt,
    bool? lateCancel,
    int? myStars,
    Set<RatingTag>? myTags,
    ShiftListing? shift,
  }) =>
      MyShift(
        applicationId: applicationId,
        shift: shift ?? this.shift,
        status: status ?? this.status,
        checkInAt: checkInAt ?? this.checkInAt,
        checkOutAt: checkOutAt ?? this.checkOutAt,
        lateMinutes: lateMinutes ?? this.lateMinutes,
        workedMinutes: workedMinutes ?? this.workedMinutes,
        payAmount: payAmount ?? this.payAmount,
        paidAt: paidAt ?? this.paidAt,
        receivedAmount: receivedAmount ?? this.receivedAmount,
        receivedAt: receivedAt ?? this.receivedAt,
        cancelledAt: cancelledAt ?? this.cancelledAt,
        lateCancel: lateCancel ?? this.lateCancel,
        myStars: myStars ?? this.myStars,
        myTags: myTags ?? this.myTags,
      );
}

/// The QR code a business shows at its door: `hanguk-ish:v1:<shift>:<token>`.
class ShiftQr {
  const ShiftQr(this.shiftId, this.token);

  final String shiftId;
  final String token;

  static const prefix = 'hanguk-ish';
  static const version = 'v1';

  String get payload => '$prefix:$version:$shiftId:$token';

  /// Null when [payload] is not a HanPyol code.
  static ShiftQr? parse(String payload) {
    final parts = payload.trim().split(':');
    if (parts.length != 4 || parts[0] != prefix || parts[1] != version) return null;
    if (parts[2].isEmpty || parts[3].isEmpty) return null;
    return ShiftQr(parts[2], parts[3]);
  }
}

import 'package:flutter/foundation.dart';

import '../../core/money/won.dart';
import 'shift.dart';

/// A worker as a business sees them: applicants and attendance (BA3), the
/// favourites and recent workers (BA4). Backend: `worker_stats` and
/// `favorites`.
@immutable
class WorkerCard {
  const WorkerCard({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.rating,
    this.completedShifts = 0,
    this.timesHere = 0,
    this.topik = 0,
    this.languages = const [],
    this.favorite = false,
    this.lastWorkedAt,
  });

  final String id;
  final String firstName;
  final String lastName;

  /// Average stars businesses gave the worker; null before the first rating.
  final double? rating;

  /// Completed shifts anywhere (근무 31회).
  final int completedShifts;

  /// Completed shifts at this business (우리 매장 7회).
  final int timesHere;

  /// TOPIK level, 0 = none.
  final int topik;

  /// Language codes in the worker's own order (uz, ru, en, ko, kk, ky, tg).
  final List<String> languages;

  /// In this business's favourites (BA4 ★).
  final bool favorite;

  /// End of the worker's last shift at this business.
  final DateTime? lastWorkedAt;

  String get fullName => '$firstName $lastName'.trim();

  /// «AK» — the avatar letters.
  String get initials {
    String first(String s) => s.isEmpty ? '' : s.substring(0, 1).toUpperCase();
    final letters = '${first(firstName)}${first(lastName)}';
    return letters.isEmpty ? '?' : letters;
  }

  /// One of the five avatar colour pairs, stable for a worker.
  int get tone => avatarTone(id);

  WorkerCard copyWith({bool? favorite, int? timesHere, DateTime? lastWorkedAt}) => WorkerCard(
        id: id,
        firstName: firstName,
        lastName: lastName,
        rating: rating,
        completedShifts: completedShifts,
        timesHere: timesHere ?? this.timesHere,
        topik: topik,
        languages: languages,
        favorite: favorite ?? this.favorite,
        lastWorkedAt: lastWorkedAt ?? this.lastWorkedAt,
      );
}

/// Index of the avatar colour pair for a worker id (0–4): the same worker
/// always gets the same colours, on every screen and every phone.
int avatarTone(String id) {
  var hash = 0;
  for (final unit in id.codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }
  return hash % 5;
}

/// One application to a shift, as the business sees it.
@immutable
class ShiftApplicant {
  const ShiftApplicant({
    required this.applicationId,
    required this.worker,
    required this.status,
    this.appliedAt,
    this.decidedAt,
    this.checkInAt,
    this.checkOutAt,
    this.lateMinutes,
    this.workedMinutes,
    this.payAmount,
    this.paidAt,
  });

  final String applicationId;
  final WorkerCard worker;
  final ApplicationStatus status;
  final DateTime? appliedAt;

  /// When the business accepted (or turned down) the application.
  final DateTime? decidedAt;
  final DateTime? checkInAt;
  final DateTime? checkOutAt;
  final int? lateMinutes;
  final int? workedMinutes;
  final int? payAmount;
  final DateTime? paidAt;

  /// Holds one of the shift's places (확정): confirmed, at work or done.
  /// From when a confirmed worker who has not checked in counts as missing:
  /// the start, or — for someone confirmed after the start — half an hour
  /// after the confirmation, so they have time to come.
  DateTime dueAt(DateTime startsAt) {
    final decided = decidedAt;
    return decided != null && decided.isAfter(startsAt) ? decided.add(lateConfirmGrace) : startsAt;
  }

  static const lateConfirmGrace = Duration(minutes: 30);

  bool get holdsPlace =>
      status == ApplicationStatus.confirmed ||
      status == ApplicationStatus.checkedIn ||
      status == ApplicationStatus.completed;

  ShiftApplicant copyWith({
    ApplicationStatus? status,
    WorkerCard? worker,
    DateTime? decidedAt,
    DateTime? checkInAt,
    DateTime? checkOutAt,
    int? lateMinutes,
    int? workedMinutes,
    int? payAmount,
    DateTime? paidAt,
    bool clearPaid = false,
  }) =>
      ShiftApplicant(
        applicationId: applicationId,
        worker: worker ?? this.worker,
        status: status ?? this.status,
        appliedAt: appliedAt,
        decidedAt: decidedAt ?? this.decidedAt,
        checkInAt: checkInAt ?? this.checkInAt,
        checkOutAt: checkOutAt ?? this.checkOutAt,
        lateMinutes: lateMinutes ?? this.lateMinutes,
        workedMinutes: workedMinutes ?? this.workedMinutes,
        payAmount: payAmount ?? this.payAmount,
        paidAt: clearPaid ? null : (paidAt ?? this.paidAt),
      );
}

/// Where a shift stands at a moment (the BA1 / BA3 status chip).
enum EmployerShiftState {
  /// Every place is taken; not started yet.
  scheduled,

  /// Places left, more than [EmployerShift.urgentWindow] before the start.
  recruiting,

  /// Places left and the start is near or past (긴급).
  urgent,

  /// Started, every place taken (진행 중).
  inProgress,

  /// Ended (완료).
  done,

  /// Called off by the business.
  cancelled,
}

/// A shift of the business with its applications (BA1, BA3).
@immutable
class EmployerShift {
  const EmployerShift({
    required this.id,
    required this.businessId,
    required this.title,
    this.duties = '',
    this.dress = '',
    this.address = '',
    required this.startsAt,
    required this.endsAt,
    required this.hourlyWage,
    required this.slots,
    this.autoConfirm = false,
    this.cancelled = false,
    this.templateId,
    this.applicants = const [],
  });

  /// How close to the start a shift with free places counts as urgent.
  static const urgentWindow = Duration(hours: 3);

  final String id;
  final String businessId;
  final String title;
  final String duties;
  final String dress;
  final String address;
  final DateTime startsAt;
  final DateTime endsAt;
  final int hourlyWage;
  final int slots;
  final bool autoConfirm;
  final bool cancelled;
  final String? templateId;

  /// Every application, in the order they came in.
  final List<ShiftApplicant> applicants;

  int get plannedMinutes => endsAt.difference(startsAt).inMinutes;

  /// Places taken (확정 3/4명).
  int get confirmed => applicants.where((a) => a.holdsPlace).length;

  /// Applications waiting for the business (지원자 2).
  List<ShiftApplicant> get waiting =>
      applicants.where((a) => a.status == ApplicationStatus.pending).toList();

  int get openSlots => slots > confirmed ? slots - confirmed : 0;

  /// The workers who hold a place, for the attendance list (출퇴근 현황).
  List<ShiftApplicant> get crew => applicants
      .where((a) => a.holdsPlace || a.status == ApplicationStatus.noShow)
      .toList();

  /// Workers who should be at work by [now] but have not checked in.
  int noShows(DateTime now) => applicants
      .where((a) =>
          a.status == ApplicationStatus.noShow ||
          (a.status == ApplicationStatus.confirmed && !now.isBefore(a.dueAt(startsAt))))
      .length;

  /// What the planned shift costs: places × hours × wage (예상 인건비).
  int get plannedCost => slots * Pay.forMinutes(hourlyWage, plannedMinutes);

  EmployerShiftState state(DateTime now) {
    if (cancelled) return EmployerShiftState.cancelled;
    if (!now.isBefore(endsAt)) return EmployerShiftState.done;
    if (openSlots > 0 && now.isAfter(startsAt.subtract(urgentWindow))) return EmployerShiftState.urgent;
    if (!now.isBefore(startsAt)) return EmployerShiftState.inProgress;
    return openSlots > 0 ? EmployerShiftState.recruiting : EmployerShiftState.scheduled;
  }

  /// Needs the owner now (BA1 «확인이 필요해요»): someone missing, a place
  /// to fill soon, or applicants waiting for an answer.
  bool needsAttention(DateTime now) {
    if (cancelled || !now.isBefore(endsAt)) return false;
    return noShows(now) > 0 || waiting.isNotEmpty || state(now) == EmployerShiftState.urgent;
  }

  EmployerShift copyWith({List<ShiftApplicant>? applicants, bool? cancelled}) => EmployerShift(
        id: id,
        businessId: businessId,
        title: title,
        duties: duties,
        dress: dress,
        address: address,
        startsAt: startsAt,
        endsAt: endsAt,
        hourlyWage: hourlyWage,
        slots: slots,
        autoConfirm: autoConfirm,
        cancelled: cancelled ?? this.cancelled,
        templateId: templateId,
        applicants: applicants ?? this.applicants,
      );
}

/// A saved shift form (BA2 템플릿). Backend: `shift_templates`.
@immutable
class ShiftTemplate {
  const ShiftTemplate({
    required this.id,
    required this.title,
    this.duties = '',
    this.dress = '',
    this.address = '',
    this.startMinute,
    this.endMinute,
    this.hourlyWage,
    this.slots,
  });

  final String id;
  final String title;
  final String duties;
  final String dress;
  final String address;

  /// Start and end, in minutes after midnight on the Korean clock.
  final int? startMinute;
  final int? endMinute;
  final int? hourlyWage;
  final int? slots;

  ShiftTemplate copyWith({String? duties, String? dress, String? address}) => ShiftTemplate(
        id: id,
        title: title,
        duties: duties ?? this.duties,
        dress: dress ?? this.dress,
        address: address ?? this.address,
        startMinute: startMinute,
        endMinute: endMinute,
        hourlyWage: hourlyWage,
        slots: slots,
      );
}

/// A new shift as BA2 sends it.
@immutable
class ShiftDraft {
  const ShiftDraft({
    required this.businessId,
    required this.title,
    this.duties = '',
    this.dress = '',
    this.address = '',
    required this.startsAt,
    required this.endsAt,
    required this.hourlyWage,
    required this.slots,
    this.autoConfirm = true,
    this.templateId,
  });

  final String businessId;
  final String title;
  final String duties;
  final String dress;
  final String address;
  final DateTime startsAt;
  final DateTime endsAt;
  final int hourlyWage;
  final int slots;
  final bool autoConfirm;
  final String? templateId;
}

/// One shift's line in the pay report (BA5 근무별 내역).
@immutable
class ReportRow {
  const ReportRow({
    required this.shiftId,
    required this.startsAt,
    required this.title,
    required this.workers,
    required this.minutes,
    required this.amount,
    required this.paid,
  });

  final String shiftId;
  final DateTime startsAt;
  final String title;

  /// Workers who completed the shift (2명).
  final int workers;

  /// Their worked time together (10시간).
  final int minutes;

  /// What they earned together.
  final int amount;

  /// Every completed worker has been paid (지급 완료).
  final bool paid;
}

/// The pay report of a period (BA5). Backend: `business_report`.
@immutable
class BusinessReport {
  const BusinessReport({required this.from, required this.to, required this.rows});

  /// First and last Korean dates of the period (inclusive).
  final DateTime from;
  final DateTime to;

  /// Newest first.
  final List<ReportRow> rows;

  int get total => rows.fold(0, (sum, r) => sum + r.amount);
  int get minutes => rows.fold(0, (sum, r) => sum + r.minutes);

  /// Person-shifts (연인원).
  int get persons => rows.fold(0, (sum, r) => sum + r.workers);

  Iterable<ReportRow> get paidRows => rows.where((r) => r.paid);
  Iterable<ReportRow> get pendingRows => rows.where((r) => !r.paid);
  int get paidAmount => paidRows.fold(0, (sum, r) => sum + r.amount);
  int get pendingAmount => pendingRows.fold(0, (sum, r) => sum + r.amount);
}

/// What an employer notification is about (database `notifications.kind`).
enum EmployerNotificationKind { newApplicant, workerCancelled, noShow, chatMessage }

EmployerNotificationKind? employerNotificationKindFrom(String? value) => switch (value) {
      'new_applicant' => EmployerNotificationKind.newApplicant,
      'worker_cancelled' => EmployerNotificationKind.workerCancelled,
      'no_show' => EmployerNotificationKind.noShow,
      'chat_message' => EmployerNotificationKind.chatMessage,
      _ => null,
    };

/// An in-app notification of the employer app (the bell on BA1).
@immutable
class EmployerNotification {
  const EmployerNotification({
    required this.id,
    required this.kind,
    required this.createdAt,
    required this.shiftId,
    required this.shiftTitle,
    this.workerName = '',
    this.read = false,
  });

  final String id;
  final EmployerNotificationKind kind;
  final DateTime createdAt;
  final String shiftId;
  final String shiftTitle;
  final String workerName;
  final bool read;

  EmployerNotification markRead() => EmployerNotification(
        id: id,
        kind: kind,
        createdAt: createdAt,
        shiftId: shiftId,
        shiftTitle: shiftTitle,
        workerName: workerName,
        read: true,
      );
}

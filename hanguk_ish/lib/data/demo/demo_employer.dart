/// Demo data of the employer app until the backend is connected, and for
/// its screen tests. It reproduces the employer prototype (BA1–BA5):
/// Dalbit Kafe on Tuesday 10 November 2026 at 18:20 — three shifts today,
/// two applicants for the evening one, one worker not in yet, and the pay
/// report of 1–10 November.
///
/// Everything is built around the day it is created for: shifts sit at
/// their wall-clock times on that Korean day, and check-ins only exist once
/// their time has passed, so the demo makes sense at any hour.
library;

import '../../core/format/business_number.dart';
import '../../core/money/won.dart';
import '../../core/time/kst.dart';
import '../models/business.dart';
import '../models/employer.dart';
import '../models/my_shift.dart';
import '../models/shift.dart';
import '../repositories/employer_repository.dart';
import '../repositories/shift_repository.dart';
import 'demo_shifts.dart';

/// The moment of the employer prototype: BA1 «11월 10일 (화) · 18:20 기준».
final employerPrototypeNow = Kst.instantOf(2026, 11, 10, 18, 20);

/// Unread notifications behind the bell on BA1 («알림 2건»).
const demoEmployerUnread = 2;

/// Statutory minimum hourly wage by year — the backend's `minimum_wages`
/// table (고용노동부 고시).
const minimumWages = {2026: 10320, 2027: 10700};

/// The minimum for the Korean calendar year of [at].
int minimumWageAt(DateTime at) {
  final year = Kst.wallClock(at).year;
  final known = minimumWages.keys.where((y) => y <= year).toList()..sort();
  return minimumWages[known.isEmpty ? minimumWages.keys.reduce((a, b) => a < b ? a : b) : known.last]!;
}

WorkerCard _w(String id, String first, String last, double rating, int done, int here, int topik, List<String> langs,
        {bool favorite = false, int lastDays = 1}) =>
    WorkerCard(
      id: id,
      firstName: first,
      lastName: last,
      rating: rating,
      completedShifts: done,
      timesHere: here,
      topik: topik,
      languages: langs,
      favorite: favorite,
      // Only orders the list (최근 근무자): days before the prototype's day.
      lastWorkedAt: Kst.instantOf(2026, 11, 10, 22).subtract(Duration(days: lastDays)),
    );

/// The people of the demo. Ids are chosen so the avatar colours are the
/// prototype's (AK blue, MY pink, DR teal, AB purple, AT olive).
final demoWorkers = <WorkerCard>[
  // Favourites (즐겨찾기 6): the prototype shows the first four.
  _w('demo-w-aziz6', 'Aziz', 'Karimov', 4.9, 24, 7, 4, ['uz', 'ru', 'en', 'ko'], favorite: true, lastDays: 0),
  _w('demo-w-malika4', 'Malika', 'Yusupova', 4.8, 19, 5, 5, ['uz', 'ru', 'ko'], favorite: true, lastDays: 0),
  _w('demo-w-timur5', 'Timur', 'Kim', 4.7, 27, 4, 6, ['ru', 'ko', 'en'], favorite: true, lastDays: 0),
  _w('demo-w-dilnoza6', 'Dilnoza', 'Rakhimova', 4.6, 12, 3, 5, ['uz', 'ru', 'ko'], favorite: true, lastDays: 0),
  _w('demo-w-jasur', 'Jasur', 'Tursunov', 4.8, 15, 2, 3, ['uz', 'ru', 'en', 'ko'], favorite: true, lastDays: 1),
  _w('demo-w-nilufar', 'Nilufar', 'Ergasheva', 4.7, 9, 2, 4, ['uz', 'ru', 'ko'], favorite: true, lastDays: 1),
  // Other recent workers (최근 근무자 18 with the favourites).
  _w('demo-w-aibek2', 'Aibek', 'Toktogulov', 4.5, 8, 2, 2, ['ky', 'ru', 'ko'], lastDays: 0),
  _w('demo-w-bekzod', 'Bekzod', 'Aliev', 4.6, 11, 3, 3, ['uz', 'ru', 'ko'], lastDays: 0),
  _w('demo-w-kamila', 'Kamila', 'Saidova', 4.8, 14, 2, 4, ['uz', 'en', 'ko'], lastDays: 0),
  _w('demo-w-ruslan', 'Ruslan', 'Abdullaev', 4.4, 6, 1, 2, ['uz', 'ru', 'ko'], lastDays: 1),
  _w('demo-w-madina', 'Madina', 'Ismoilova', 4.7, 10, 2, 5, ['uz', 'ru', 'en', 'ko'], lastDays: 2),
  _w('demo-w-aigerim', 'Aigerim', 'Sadykova', 4.9, 13, 2, 4, ['kk', 'ru', 'en', 'ko'], lastDays: 2),
  _w('demo-w-daniyar', 'Daniyar', 'Seitkali', 4.6, 7, 1, 3, ['kk', 'ru', 'ko'], lastDays: 3),
  _w('demo-w-farrukh', 'Farrukh', 'Nazarov', 4.5, 5, 1, 3, ['tg', 'ru', 'ko'], lastDays: 4),
  _w('demo-w-zarina', 'Zarina', 'Khasanova', 4.8, 9, 1, 4, ['uz', 'ru', 'ko'], lastDays: 5),
  _w('demo-w-otabek', 'Otabek', 'Rakhmonov', 4.3, 4, 1, 2, ['uz', 'ru', 'ko'], lastDays: 6),
  _w('demo-w-gulnora', 'Gulnora', 'Yuldasheva', 4.7, 8, 1, 3, ['uz', 'ru', 'ko'], lastDays: 7),
  _w('demo-w-eldor', 'Eldor', 'Mirzaev', 4.6, 6, 1, 3, ['uz', 'en', 'ko'], lastDays: 9),
  // Today's applicants, new to Dalbit Kafe.
  _w('demo-w-aruzhan2', 'Aruzhan', 'Bekova', 4.8, 31, 0, 3, ['kk', 'ru', 'en', 'ko']),
  _w('demo-w-sevara5', 'Sevara', 'Nazarova', 4.9, 18, 0, 5, ['uz', 'ru', 'ko']),
];

WorkerCard demoWorker(String id) => demoWorkers.firstWhere((w) => w.id == id);

/// BA2 템플릿.
const demoTemplates = [
  ShiftTemplate(
    id: 'demo-tpl-hall',
    title: '홀·카운터 보조',
    duties: '주문 접수 · 음료 보조 · 홀 정리',
    dress: '검은색 바지, 운동화 (앞치마 제공)',
    address: '마포구 신촌로12길 15, 2층',
    startMinute: 14 * 60,
    endMinute: 19 * 60,
    hourlyWage: 10500,
    slots: 3,
  ),
  ShiftTemplate(
    id: 'demo-tpl-open',
    title: '오픈 바리스타 보조',
    duties: '오픈 준비 · 음료 제조 보조 · 매장 청소',
    dress: '검은색 바지, 운동화 (앞치마 제공)',
    address: '마포구 신촌로12길 15, 2층',
    startMinute: 9 * 60,
    endMinute: 14 * 60,
    hourlyWage: 10500,
    slots: 2,
  ),
  ShiftTemplate(
    id: 'demo-tpl-close',
    title: '마감 정리 보조',
    duties: '설거지 · 홀 정리 · 마감 청소',
    dress: '검은색 바지, 운동화 (앞치마 제공)',
    address: '마포구 신촌로12길 15, 2층',
    startMinute: 18 * 60,
    endMinute: 22 * 60,
    hourlyWage: 11000,
    slots: 4,
  ),
];

/// A crew member's day: when they came and left (minutes after midnight),
/// applied only once [now] has passed those times.
class _Crew {
  const _Crew(this.workerId, {this.inAt, this.outAt});

  final String workerId;
  final int? inAt;
  final int? outAt;
}

/// The demo's shifts for the Korean day of [now]: today's three (BA1) and
/// the completed ones of the last weeks (BA5).
List<EmployerShift> demoEmployerShifts(DateTime now) {
  final today = Kst.wallClock(now);
  DateTime at(int dayOffset, int minute) =>
      Kst.instantOf(today.year, today.month, today.day + dayOffset).add(Duration(minutes: minute));

  var nextApp = 1;
  ShiftApplicant crewMember(EmployerShift base, _Crew c, int dayOffset) {
    final inAt = c.inAt == null ? null : at(dayOffset, c.inAt!);
    final outAt = c.outAt == null ? null : at(dayOffset, c.outAt!);
    final checkInAt = inAt != null && !now.isBefore(inAt) ? inAt : null;
    final checkOutAt = checkInAt != null && outAt != null && !now.isBefore(outAt) ? outAt : null;
    final late = checkInAt == null ? 0 : Kst.minutesBetween(base.startsAt, checkInAt);
    final from = checkInAt != null && checkInAt.isAfter(base.startsAt) ? checkInAt : base.startsAt;
    final to = checkOutAt != null && checkOutAt.isBefore(base.endsAt) ? checkOutAt : base.endsAt;
    final worked = checkOutAt == null ? null : Kst.minutesBetween(from, to);
    return ShiftApplicant(
      applicationId: 'demo-app-${nextApp++}',
      worker: demoWorker(c.workerId),
      status: checkOutAt != null
          ? ApplicationStatus.completed
          : (checkInAt != null ? ApplicationStatus.checkedIn : ApplicationStatus.confirmed),
      appliedAt: base.startsAt.subtract(const Duration(days: 1)),
      decidedAt: base.startsAt.subtract(const Duration(hours: 20)),
      checkInAt: checkInAt,
      checkOutAt: checkOutAt,
      lateMinutes: checkInAt == null ? null : (late > 0 ? late : 0),
      workedMinutes: worked,
      payAmount: worked == null ? null : Pay.forMinutes(base.hourlyWage, worked),
    );
  }

  EmployerShift shift(String id, int dayOffset, ShiftTemplate tpl, List<_Crew> crew,
      {String? title, int? start, int? end, int? wage, int? slots, bool auto = true, List<String> waiting = const [], bool paid = false}) {
    final base = EmployerShift(
      id: id,
      businessId: demoDalbit.id,
      templateId: tpl.id,
      title: title ?? tpl.title,
      duties: tpl.duties,
      dress: tpl.dress,
      address: tpl.address,
      startsAt: at(dayOffset, start ?? tpl.startMinute!),
      endsAt: at(dayOffset, end ?? tpl.endMinute!),
      hourlyWage: wage ?? tpl.hourlyWage!,
      slots: slots ?? tpl.slots!,
      autoConfirm: auto,
    );
    final apps = [
      for (final c in crew) crewMember(base, c, dayOffset),
      // Applications that have come in by now (09:12 and 10:47).
      for (final (i, w) in waiting.indexed)
        if (!now.isBefore(at(dayOffset, 9 * 60 + 12 + i * 95)))
          ShiftApplicant(
            applicationId: 'demo-app-${nextApp++}',
            worker: demoWorker(w),
            status: ApplicationStatus.pending,
            appliedAt: at(dayOffset, 9 * 60 + 12 + i * 95),
          ),
    ];
    final paidAt = paid ? base.endsAt.add(const Duration(days: 1)) : null;
    return base.copyWith(applicants: [
      for (final a in apps) a.status == ApplicationStatus.completed && paidAt != null ? a.copyWith(paidAt: paidAt) : a,
    ]);
  }

  // Past shifts: everyone came on time and left at the end.
  List<_Crew> done(List<String> ids, ShiftTemplate tpl, {int? start, int? end}) => [
        for (final id in ids) _Crew(id, inAt: (start ?? tpl.startMinute!) - 5, outAt: end ?? tpl.endMinute!),
      ];

  final hall = demoTemplates[0];
  final open = demoTemplates[1];
  final close = demoTemplates[2];
  final brunch = ShiftTemplate(
      id: 'demo-tpl-brunch', title: '주말 브런치 보조', duties: open.duties, dress: open.dress, address: open.address);
  final stock = ShiftTemplate(
      id: 'demo-tpl-stock', title: '재고 정리 보조', duties: '재고 확인 · 창고 정리', dress: open.dress, address: open.address);

  return [
    // Today (BA1 «오늘»).
    shift('demo-es-open', 0, open, const [
      _Crew('demo-w-bekzod', inAt: 8 * 60 + 55, outAt: 14 * 60),
      _Crew('demo-w-kamila', inAt: 8 * 60 + 58, outAt: 14 * 60 + 1),
    ]),
    shift('demo-es-hall', 0, hall, const [
      _Crew('demo-w-aziz6', inAt: 13 * 60 + 55, outAt: 19 * 60),
      _Crew('demo-w-dilnoza6', inAt: 13 * 60 + 58, outAt: 19 * 60 + 2),
      _Crew('demo-w-jasur', inAt: 14 * 60, outAt: 19 * 60 + 1),
    ]),
    shift('demo-es-close', 0, close, const [
      _Crew('demo-w-timur5', inAt: 17 * 60 + 56),
      _Crew('demo-w-malika4', inAt: 18 * 60 + 2),
      _Crew('demo-w-aibek2'),
    ], auto: false, waiting: const ['demo-w-aruzhan2', 'demo-w-sevara5']),
    // This month's pay report (BA5): 1–10 November in the prototype.
    shift('demo-es-p1', -1, hall, done(['demo-w-jasur', 'demo-w-nilufar', 'demo-w-ruslan'], hall)),
    shift('demo-es-p2', -2, brunch,
        done(['demo-w-aziz6', 'demo-w-malika4', 'demo-w-madina', 'demo-w-aigerim'], brunch, start: 9 * 60, end: 15 * 60),
        start: 9 * 60, end: 15 * 60, wage: 11000, slots: 4, paid: true),
    shift('demo-es-p3', -3, brunch,
        done(['demo-w-timur5', 'demo-w-dilnoza6', 'demo-w-kamila', 'demo-w-daniyar'], brunch, start: 9 * 60, end: 15 * 60),
        start: 9 * 60, end: 15 * 60, wage: 11000, slots: 4, paid: true),
    shift('demo-es-p4', -4, hall, done(['demo-w-aziz6', 'demo-w-farrukh'], hall), slots: 2, paid: true),
    shift('demo-es-p5', -5, close, done(['demo-w-timur5', 'demo-w-zarina'], close), slots: 2, paid: true),
    shift('demo-es-p6', -6, open, done(['demo-w-malika4', 'demo-w-otabek'], open), paid: true),
    shift('demo-es-p7', -7, hall, done(['demo-w-dilnoza6', 'demo-w-gulnora'], hall), slots: 2, paid: true),
    shift('demo-es-p8', -9, stock, done(['demo-w-bekzod', 'demo-w-eldor'], stock, start: 10 * 60, end: 13 * 60),
        start: 10 * 60, end: 13 * 60, wage: 11500, slots: 2, paid: true),
    // Last month (지난달).
    for (final (i, offset) in [-12, -14, -15, -18, -20, -22, -25, -28].indexed)
      shift('demo-es-o$i', offset, [hall, open, close][i % 3],
          done([demoWorkers[i % 6].id, demoWorkers[6 + i % 6].id], [hall, open, close][i % 3]),
          slots: 2, paid: true),
  ];
}

/// The bell on BA1: two new applicants (unread) and two older notes.
List<EmployerNotification> demoEmployerNotifications(DateTime now) {
  final today = Kst.wallClock(now);
  DateTime at(int dayOffset, int h, int m) => Kst.instantOf(today.year, today.month, today.day + dayOffset, h, m);
  return [
    for (final n in [
    EmployerNotification(
      id: 'demo-en-4',
      kind: EmployerNotificationKind.newApplicant,
      createdAt: at(0, 10, 47),
      shiftId: 'demo-es-close',
      shiftTitle: '마감 정리 보조',
      workerName: 'Sevara Nazarova',
    ),
    EmployerNotification(
      id: 'demo-en-3',
      kind: EmployerNotificationKind.newApplicant,
      createdAt: at(0, 9, 12),
      shiftId: 'demo-es-close',
      shiftTitle: '마감 정리 보조',
      workerName: 'Aruzhan Bekova',
    ),
    EmployerNotification(
      id: 'demo-en-2',
      kind: EmployerNotificationKind.workerCancelled,
      createdAt: at(-1, 21, 5),
      shiftId: 'demo-es-close',
      shiftTitle: '마감 정리 보조',
      workerName: 'Ruslan Abdullaev',
      read: true,
    ),
    EmployerNotification(
      id: 'demo-en-1',
      kind: EmployerNotificationKind.chatMessage,
      createdAt: at(-1, 13, 40),
      shiftId: 'demo-es-hall',
      shiftTitle: '홀·카운터 보조',
      workerName: 'Aziz Karimov',
      read: true,
    ),
    ])
      if (!n.createdAt.isAfter(now)) n,
  ];
}

/// The employer side of the demo, in memory.
class DemoEmployerRepository implements EmployerRepository {
  DemoEmployerRepository({DateTime? now, DateTime Function()? clock, this.latency = Duration.zero})
      : _clock = clock ?? DateTime.now {
    final start = now ?? _clock();
    for (final s in demoEmployerShifts(start)) {
      _shifts[s.id] = s;
    }
    for (final w in demoWorkers) {
      _workers[w.id] = w;
    }
    _notifications.addAll(demoEmployerNotifications(start));
  }

  final DateTime Function() _clock;

  /// Pretend network delay.
  final Duration latency;

  final Map<String, EmployerShift> _shifts = {};
  final Map<String, WorkerCard> _workers = {};
  final List<ShiftTemplate> _templates = [...demoTemplates];
  final List<EmployerNotification> _notifications = [];

  /// Invitations sent with «다시 요청»: (shift, worker).
  final List<(String, String)> invitations = [];

  /// The token in the demo's QR codes.
  static const qrToken = 'demo';

  int _nextShift = 1;

  Future<void> _wait() => latency == Duration.zero ? Future.value() : Future.delayed(latency);

  EmployerShift _shift(String id) {
    final s = _shifts[id];
    if (s == null) throw const ShiftActionException('NOT_FOUND');
    return s;
  }

  @override
  Future<List<Business>> businesses() async {
    await _wait();
    return const [demoDalbit];
  }

  @override
  Future<Business> registerBusiness(String businessNumber) async {
    await _wait();
    if (!isValidBusinessNumber(businessNumber)) throw const ShiftActionException('BIZ_NO_INVALID');
    return demoDalbit;
  }

  @override
  Future<List<EmployerShift>> shifts(String businessId, DateTime from, DateTime to) async {
    await _wait();
    return _shifts.values
        .where((s) => s.businessId == businessId && !s.startsAt.isBefore(from) && s.startsAt.isBefore(to))
        .toList()
      ..sort((a, b) => a.startsAt.compareTo(b.startsAt));
  }

  @override
  Future<EmployerShift?> shift(String shiftId) async {
    await _wait();
    return _shifts[shiftId];
  }

  @override
  Future<EmployerShift> decide(String applicationId, {required bool accept}) async {
    await _wait();
    final s = _shifts.values.firstWhere(
      (s) => s.applicants.any((a) => a.applicationId == applicationId),
      orElse: () => throw const ShiftActionException('NOT_FOUND'),
    );
    final app = s.applicants.firstWhere((a) => a.applicationId == applicationId);
    if (app.status != ApplicationStatus.pending) throw const ShiftActionException('NOT_PENDING');
    if (s.cancelled || !_clock().isBefore(s.endsAt)) throw const ShiftActionException('SHIFT_ENDED');
    if (accept && s.openSlots == 0) throw const ShiftActionException('SHIFT_FULL');
    var apps = [
      for (final a in s.applicants)
        a.applicationId == applicationId
            ? a.copyWith(status: accept ? ApplicationStatus.confirmed : ApplicationStatus.rejected, decidedAt: _clock())
            : a,
    ];
    var updated = s.copyWith(applicants: apps);
    if (accept && updated.openSlots == 0) {
      // The last place is taken: nobody keeps waiting for a full shift.
      apps = [
        for (final a in apps)
          a.status == ApplicationStatus.pending ? a.copyWith(status: ApplicationStatus.rejected, decidedAt: _clock()) : a,
      ];
      updated = updated.copyWith(applicants: apps);
    }
    return _shifts[s.id] = updated;
  }

  @override
  Future<String> shiftQr(String shiftId) async {
    await _wait();
    _shift(shiftId);
    return ShiftQr(shiftId, qrToken).payload;
  }

  @override
  Future<EmployerShift> cancelShift(String shiftId) async {
    await _wait();
    final s = _shift(shiftId);
    if (!_clock().isBefore(s.startsAt)) throw const ShiftActionException('SHIFT_STARTED');
    final cancelled = s.copyWith(
      cancelled: true,
      applicants: [
        for (final a in s.applicants)
          a.holdsPlace || a.status == ApplicationStatus.pending ? a.copyWith(status: ApplicationStatus.cancelled) : a,
      ],
    );
    return _shifts[shiftId] = cancelled;
  }

  @override
  Future<List<ShiftTemplate>> templates(String businessId) async {
    await _wait();
    return List.unmodifiable(_templates);
  }

  @override
  Future<ShiftTemplate> saveTemplate(String businessId, ShiftTemplate template) async {
    await _wait();
    final i = _templates.indexWhere((t) => t.id == template.id);
    if (i < 0) {
      _templates.add(template);
    } else {
      _templates[i] = template;
    }
    return template;
  }

  @override
  Future<int> minimumWage(DateTime at) async {
    await _wait();
    return minimumWageAt(at);
  }

  @override
  Future<EmployerShift> createShift(ShiftDraft draft) async {
    await _wait();
    if (!draft.endsAt.isAfter(draft.startsAt)) throw const ShiftActionException('INVALID_TIME');
    if (draft.endsAt.difference(draft.startsAt) > const Duration(hours: 16)) {
      throw const ShiftActionException('TOO_LONG');
    }
    if (!draft.startsAt.isAfter(_clock())) throw const ShiftActionException('IN_THE_PAST');
    if (draft.hourlyWage < minimumWageAt(draft.startsAt)) throw const ShiftActionException('WAGE_BELOW_MINIMUM');
    if (draft.slots < 1 || draft.slots > 50) throw const ShiftActionException('INVALID');
    final shift = EmployerShift(
      id: 'demo-es-new-${_nextShift++}',
      businessId: draft.businessId,
      templateId: draft.templateId,
      title: draft.title,
      duties: draft.duties,
      dress: draft.dress,
      address: draft.address,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      hourlyWage: draft.hourlyWage,
      slots: draft.slots,
      autoConfirm: draft.autoConfirm,
    );
    return _shifts[shift.id] = shift;
  }

  @override
  Future<EmployerShift> updateShift(String shiftId, ShiftDraft draft) async {
    await _wait();
    final s = _shift(shiftId);
    if (s.cancelled || !_clock().isBefore(s.endsAt)) throw const ShiftActionException('SHIFT_ENDED');
    final moved = draft.startsAt != s.startsAt || draft.endsAt != s.endsAt;
    if (moved && s.confirmed > 0) throw const ShiftActionException('HAS_CREW');
    if (moved && !draft.startsAt.isAfter(_clock())) throw const ShiftActionException('IN_THE_PAST');
    if (!draft.endsAt.isAfter(draft.startsAt)) throw const ShiftActionException('INVALID_TIME');
    if (draft.endsAt.difference(draft.startsAt) > const Duration(hours: 16)) {
      throw const ShiftActionException('TOO_LONG');
    }
    if (draft.hourlyWage < minimumWageAt(draft.startsAt)) throw const ShiftActionException('WAGE_BELOW_MINIMUM');
    if (draft.slots < s.confirmed || draft.slots > 50) throw const ShiftActionException('INVALID');
    final updated = EmployerShift(
      id: s.id,
      businessId: s.businessId,
      templateId: s.templateId,
      title: draft.title,
      duties: draft.duties,
      dress: draft.dress,
      address: draft.address,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      hourlyWage: draft.hourlyWage,
      slots: draft.slots,
      autoConfirm: draft.autoConfirm,
      applicants: s.applicants,
    );
    return _shifts[shiftId] = updated;
  }

  @override
  Future<List<WorkerCard>> workers(String businessId) async {
    await _wait();
    return _workers.values.where((w) => w.timesHere > 0).toList()
      ..sort((a, b) {
        final byDate = (b.lastWorkedAt ?? DateTime(0)).compareTo(a.lastWorkedAt ?? DateTime(0));
        return byDate != 0 ? byDate : b.timesHere.compareTo(a.timesHere);
      });
  }

  @override
  Future<bool> toggleFavorite(String businessId, String workerId) async {
    await _wait();
    final w = _workers[workerId];
    if (w == null) throw const ShiftActionException('NOT_FOUND');
    final updated = w.copyWith(favorite: !w.favorite);
    _workers[workerId] = updated;
    return updated.favorite;
  }

  @override
  Future<void> requestAgain(String shiftId, String workerId) async {
    await _wait();
    final s = _shift(shiftId);
    if (s.cancelled || !s.startsAt.isAfter(_clock())) throw const ShiftActionException('SHIFT_CLOSED');
    final worker = _workers[workerId];
    if (worker == null || worker.timesHere == 0) throw const ShiftActionException('NOT_FOUND');
    invitations.add((shiftId, workerId));
  }

  @override
  Future<BusinessReport> report(String businessId, DateTime from, DateTime to) async {
    await _wait();
    final first = Kst.instantOf(from.year, from.month, from.day);
    final end = Kst.instantOf(to.year, to.month, to.day + 1);
    final rows = <ReportRow>[];
    for (final s in _shifts.values) {
      if (s.businessId != businessId || s.startsAt.isBefore(first) || !s.startsAt.isBefore(end)) continue;
      final done = s.applicants.where((a) => a.status == ApplicationStatus.completed).toList();
      if (done.isEmpty) continue;
      rows.add(ReportRow(
        shiftId: s.id,
        startsAt: s.startsAt,
        title: s.title,
        workers: done.length,
        minutes: done.fold(0, (sum, a) => sum + (a.workedMinutes ?? 0)),
        amount: done.fold(0, (sum, a) => sum + (a.payAmount ?? 0)),
        paid: done.every((a) => a.paidAt != null),
      ));
    }
    rows.sort((a, b) => b.startsAt.compareTo(a.startsAt));
    return BusinessReport(from: from, to: to, rows: rows);
  }

  @override
  Future<void> setShiftPaid(String shiftId, {required bool paid}) async {
    await _wait();
    final s = _shift(shiftId);
    final now = _clock();
    _shifts[shiftId] = s.copyWith(applicants: [
      for (final a in s.applicants)
        a.status == ApplicationStatus.completed ? (paid ? a.copyWith(paidAt: a.paidAt ?? now) : a.copyWith(clearPaid: true)) : a,
    ]);
  }

  @override
  Future<List<EmployerNotification>> notifications() async {
    await _wait();
    return List.unmodifiable(_notifications..sort((a, b) => b.createdAt.compareTo(a.createdAt)));
  }

  @override
  Future<void> markNotificationsRead() async {
    await _wait();
    for (var i = 0; i < _notifications.length; i++) {
      _notifications[i] = _notifications[i].markRead();
    }
  }
}

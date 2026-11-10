/// The worker's demo account: the prototype's track record (A11) and
/// notifications (A12), dated around the demo's "now".
library;

import '../../core/time/kst.dart';
import '../models/account.dart';
import '../repositories/account_repository.dart';

/// The prototype's A11 numbers: 24 shifts, 21 ratings averaging 4.9,
/// reliability 98.
const demoStats = WorkerStats(completedShifts: 24, ratingCount: 21, ratingAverage: 4.9, reliability: 98);

const _dalbitNames = {'uz': 'Dalbit Kafe · Sinchon', 'ru': 'Dalbit Kafe · Синчхон', 'en': 'Dalbit Cafe · Sinchon', 'ko': '달빛카페 · 신촌'};
const _bomMartNames = {'uz': 'Bom Mart · Hongdae', 'ru': 'Bom Mart · Хондэ', 'en': 'Bom Mart · Hongdae', 'ko': '봄마트 · 홍대'};
const _sangamNames = {'uz': 'Sangam Logistika', 'ru': 'Sangam Logistics', 'en': 'Sangam Logistics', 'ko': '상암물류'};
const _hongdae = {'uz': 'Hongdae', 'ru': 'Хондэ', 'en': 'Hongdae', 'ko': '홍대'};

/// A12 of the prototype: two from today (unread), two from yesterday.
List<HiNotification> demoNotifications(DateTime now) {
  final d = Kst.wallClock(now);
  DateTime at(int dayOffset, int hour, int minute) => Kst.instantOf(d.year, d.month, d.day + dayOffset, hour, minute);
  return [
    HiNotification(
      id: 'demo-n1',
      kind: NotificationKind.shiftReminder,
      createdAt: at(0, 12, 0),
      businessNames: _dalbitNames,
      businessId: 'demo-dalbit',
      shiftId: 'demo-1',
      startsAt: at(0, 14, 0),
      endsAt: at(0, 19, 0),
      minutesBefore: 120,
      lat: 37.55798,
      lng: 126.950147,
    ),
    HiNotification(
      id: 'demo-n2',
      kind: NotificationKind.confirmed,
      createdAt: at(0, 9, 41),
      businessNames: _bomMartNames,
      businessId: 'demo-bommart',
      startsAt: at(4, 10, 0),
      endsAt: at(4, 15, 0),
    ),
    HiNotification(
      id: 'demo-n3',
      kind: NotificationKind.newShift,
      createdAt: at(-1, 21, 15),
      read: true,
      businessNames: _sangamNames,
      businessId: 'demo-sangam',
      startsAt: at(2, 18, 0),
      endsAt: at(2, 23, 0),
      wage: 12000,
      distanceKm: 3.8,
    ),
    HiNotification(
      id: 'demo-n4',
      kind: NotificationKind.nearbyShifts,
      createdAt: at(-1, 18, 2),
      read: true,
      areaNames: _hongdae,
      count: 3,
      categories: const ['cafe', 'retail'],
      wage: 10500,
      wageMax: 11500,
    ),
  ];
}

/// In-memory [WorkerAccountRepository].
class DemoAccountRepository implements WorkerAccountRepository {
  DemoAccountRepository({DateTime? now}) : _notifications = demoNotifications(now ?? DateTime.now());

  List<HiNotification> _notifications;
  final List<(ReportSubject, String)> reports = [];

  @override
  Future<WorkerStats> stats() async => demoStats;

  @override
  Future<List<HiNotification>> notifications() async => List.unmodifiable(_notifications);

  @override
  Future<void> markNotificationsRead() async {
    _notifications = [for (final n in _notifications) n.read ? n : n.markRead()];
  }

  @override
  Future<void> report(ReportSubject subject, String text) async {
    reports.add((subject, text));
  }
}

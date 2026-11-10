import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/time/clock.dart';
import '../../core/time/kst.dart';
import '../../data/models/business.dart';
import '../../data/models/employer.dart';
import '../../data/repositories/employer_repository.dart';

/// The business chosen in the BA1 header (null = the first one).
final selectedBusinessIdProvider = NotifierProvider<SelectedBusiness, String?>(SelectedBusiness.new);

class SelectedBusiness extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String id) => state = id;
}

/// The businesses of the signed-in owner.
final businessesProvider = FutureProvider<List<Business>>(
  (ref) => ref.watch(employerRepositoryProvider).businesses(),
  retry: (count, error) => null,
);

/// The business every screen works on.
final currentBusinessProvider = FutureProvider<Business>((ref) async {
  final all = await ref.watch(businessesProvider.future);
  final id = ref.watch(selectedBusinessIdProvider);
  return all.firstWhere((b) => b.id == id, orElse: () => all.first);
}, retry: (count, error) => null);

/// Start of the Korean day of [instant].
DateTime kstDayStart(DateTime instant, [int addDays = 0]) {
  final w = Kst.wallClock(instant);
  return Kst.instantOf(w.year, w.month, w.day + addDays);
}

/// Today's shifts and the next two weeks' (BA1).
final homeShiftsProvider = FutureProvider.autoDispose<List<EmployerShift>>((ref) async {
  final business = await ref.watch(currentBusinessProvider.future);
  final now = ref.watch(clockProvider)();
  return ref.watch(employerRepositoryProvider).shifts(business.id, kstDayStart(now), kstDayStart(now, 15));
}, retry: (count, error) => null);

/// One shift with its applicants (BA3).
final employerShiftProvider = FutureProvider.autoDispose.family<EmployerShift?, String>(
  (ref, id) => ref.watch(employerRepositoryProvider).shift(id),
  retry: (count, error) => null,
);

/// BA2 templates of the current business.
final templatesProvider = FutureProvider.autoDispose<List<ShiftTemplate>>((ref) async {
  final business = await ref.watch(currentBusinessProvider.future);
  return ref.watch(employerRepositoryProvider).templates(business.id);
}, retry: (count, error) => null);

/// The statutory minimum hourly wage on a Korean date.
final minimumWageProvider = FutureProvider.autoDispose.family<int, DateTime>(
  (ref, at) => ref.watch(employerRepositoryProvider).minimumWage(at),
  retry: (count, error) => null,
);

/// BA4: the people who have worked at the current business.
final businessWorkersProvider = FutureProvider.autoDispose<List<WorkerCard>>((ref) async {
  final business = await ref.watch(currentBusinessProvider.future);
  return ref.watch(employerRepositoryProvider).workers(business.id);
}, retry: (count, error) => null);

/// BA5 periods.
enum ReportPeriod { thisWeek, thisMonth, lastMonth }

/// First and last Korean dates of [period] on the day of [now]: this week
/// from Monday, this month from the 1st (both to today), last month whole.
(DateTime, DateTime) reportRange(ReportPeriod period, DateTime now) {
  final w = Kst.wallClock(now);
  final today = DateTime.utc(w.year, w.month, w.day);
  return switch (period) {
    ReportPeriod.thisWeek => (today.subtract(Duration(days: today.weekday - 1)), today),
    ReportPeriod.thisMonth => (DateTime.utc(w.year, w.month), today),
    ReportPeriod.lastMonth => (DateTime.utc(w.year, w.month - 1), DateTime.utc(w.year, w.month, 0)),
  };
}

final reportPeriodProvider = NotifierProvider<SelectedPeriod, ReportPeriod>(SelectedPeriod.new);

class SelectedPeriod extends Notifier<ReportPeriod> {
  @override
  ReportPeriod build() => ReportPeriod.thisMonth;

  void select(ReportPeriod period) => state = period;
}

final reportProvider = FutureProvider.autoDispose.family<BusinessReport, ReportPeriod>((ref, period) async {
  final business = await ref.watch(currentBusinessProvider.future);
  final (from, to) = reportRange(period, ref.watch(clockProvider)());
  return ref.watch(employerRepositoryProvider).report(business.id, from, to);
}, retry: (count, error) => null);

/// The bell on BA1.
final employerNotificationsProvider = FutureProvider.autoDispose<List<EmployerNotification>>(
  (ref) => ref.watch(employerRepositoryProvider).notifications(),
  retry: (count, error) => null,
);

final employerUnreadProvider = Provider.autoDispose<int>(
  (ref) => ref.watch(employerNotificationsProvider).value?.where((n) => !n.read).length ?? 0,
);

/// After a change to shifts: everything that shows them reloads.
void refreshShifts(WidgetRef ref, [String? shiftId]) {
  ref.invalidate(homeShiftsProvider);
  if (shiftId != null) ref.invalidate(employerShiftProvider(shiftId));
  ref.invalidate(reportProvider);
}

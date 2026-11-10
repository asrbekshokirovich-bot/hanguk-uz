import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/business.dart';
import '../../../data/models/shift.dart';
import '../../../data/repositories/shift_repository.dart';
import 'feed_area.dart';

/// The three day tabs of A03 / A04.
enum FeedDay { today, tomorrow, weekend }

/// Filters of the feed and the map (shared, so switching views keeps them).
@immutable
class FeedFilter {
  const FeedFilter({
    this.day = FeedDay.today,
    this.minWage,
    this.radiusKm = 3,
    this.categories = const {},
    this.dayParts = const {},
  });

  final FeedDay day;

  /// Only shifts paying at least this per hour; null = any.
  final int? minWage;

  /// Within this many km of the worker; null = any distance. The prototype
  /// opens with 3 km.
  final int? radiusKm;
  final Set<BusinessCategory> categories;

  /// Start time parts of day (0 = 06–12 … 3 = 00–06).
  final Set<int> dayParts;

  static const wageOptions = [11000, 12000, 13000];
  static const radiusOptions = [1, 3, 5, 10];

  FeedFilter copyWith({
    FeedDay? day,
    int? minWage,
    bool clearMinWage = false,
    int? radiusKm,
    bool clearRadius = false,
    Set<BusinessCategory>? categories,
    Set<int>? dayParts,
  }) =>
      FeedFilter(
        day: day ?? this.day,
        minWage: clearMinWage ? null : (minWage ?? this.minWage),
        radiusKm: clearRadius ? null : (radiusKm ?? this.radiusKm),
        categories: categories ?? this.categories,
        dayParts: dayParts ?? this.dayParts,
      );

  /// The Korean-clock window of [day] seen from [now].
  (DateTime, DateTime) window(DateTime now) {
    final w = Kst.wallClock(now);
    DateTime midnight(int addDays) => Kst.instantOf(w.year, w.month, w.day + addDays);
    switch (day) {
      case FeedDay.today:
        return (now, midnight(1));
      case FeedDay.tomorrow:
        return (midnight(1), midnight(2));
      case FeedDay.weekend:
        // Saturday 00:00 → Monday 00:00; during the weekend, from now.
        final weekday = w.weekday; // 1 = Monday … 7 = Sunday
        if (weekday >= DateTime.saturday) {
          return (now, midnight(8 - weekday));
        }
        return (midnight(DateTime.saturday - weekday), midnight(8 - weekday));
    }
  }
}

final feedFilterProvider = NotifierProvider<FeedFilterController, FeedFilter>(FeedFilterController.new);

class FeedFilterController extends Notifier<FeedFilter> {
  @override
  FeedFilter build() => const FeedFilter();

  void setDay(FeedDay day) => state = state.copyWith(day: day);

  void setMinWage(int? wage) =>
      state = wage == null ? state.copyWith(clearMinWage: true) : state.copyWith(minWage: wage);

  void setRadius(int? km) => state = km == null ? state.copyWith(clearRadius: true) : state.copyWith(radiusKm: km);

  void setCategories(Set<BusinessCategory> categories) => state = state.copyWith(categories: categories);

  void setDayParts(Set<int> parts) => state = state.copyWith(dayParts: parts);

  void replace(FeedFilter filter) => state = filter;
}

/// Shifts matching the filters. Errors are not retried automatically: the
/// offline screen offers «Qayta urinish».
final feedProvider = FutureProvider.autoDispose<List<ShiftListing>>(
  (ref) async {
    final filter = ref.watch(feedFilterProvider);
    final now = ref.watch(clockProvider)();
    final area = await ref.watch(feedAreaProvider.future);
    final (from, to) = filter.window(now);
    return ref.watch(shiftRepositoryProvider).feed(FeedQuery(
          from: from,
          to: to,
          lat: area.lat,
          lng: area.lng,
          radiusKm: filter.radiusKm?.toDouble(),
          minWage: filter.minWage,
          categories: filter.categories,
          dayParts: filter.dayParts,
        ));
  },
  retry: (count, error) => null,
);

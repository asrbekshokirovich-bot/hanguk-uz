import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Universities queued for side-by-side comparison in Guest Explorer.
///
/// DESIGN_SPEC §3b: at most two, and selecting a third evicts the oldest
/// rather than refusing the tap — the student never hits a dead end, the
/// grid just rolls forward.
///
/// Holds ids, not rows: `universitiesProvider` already owns the catalogue,
/// so storing whole objects here would mean two copies that can disagree.
class GuestCompareNotifier extends Notifier<List<String>> {
  static const int maxSlots = 2;

  @override
  List<String> build() => const [];

  bool contains(String id) => state.contains(id);

  void toggle(String id) {
    if (state.contains(id)) {
      state = [...state]..remove(id);
      return;
    }
    final next = [...state, id];
    // Oldest out, newest in.
    state = next.length > maxSlots
        ? next.sublist(next.length - maxSlots)
        : next;
  }

  void remove(String id) => state = [...state]..remove(id);

  void clear() => state = const [];
}

final guestCompareProvider =
    NotifierProvider<GuestCompareNotifier, List<String>>(
      GuestCompareNotifier.new,
    );

/// Free-text query on the guest Explore screen. Matches name or city.
class GuestSearchNotifier extends Notifier<String> {
  @override
  String build() => '';

  void set(String value) => state = value;
}

final guestSearchProvider = NotifierProvider<GuestSearchNotifier, String>(
  GuestSearchNotifier.new,
);

/// Selected city filter, or null for "All". Values are raw `city_ko` strings
/// so they compare directly against `University.location`.
class GuestCityFilterNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void set(String? value) => state = value;

  /// Tapping the active city clears it, so the row never traps the student
  /// on a filter they cannot undo without hunting for "All".
  void toggle(String city) => state = state == city ? null : city;
}

final guestCityFilterProvider =
    NotifierProvider<GuestCityFilterNotifier, String?>(
      GuestCityFilterNotifier.new,
    );

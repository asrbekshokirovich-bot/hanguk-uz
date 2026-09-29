import 'package:flutter_riverpod/flutter_riverpod.dart';

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

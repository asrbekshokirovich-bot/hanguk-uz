import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/catalog/places.dart';

/// Where the feed and the map look for shifts: the worker's position and
/// the neighbourhood it is named after (A03 «Sinchon, Mapo-gu»).
@immutable
class FeedArea {
  const FeedArea({required this.place, required this.lat, required this.lng});

  final Place place;
  final double lat;
  final double lng;
}

/// The prototype's position: Sinchon, Mapo-gu.
const sinchonArea = FeedArea(
  place: Place('sinchon', uz: 'Sinchon, Mapo-gu', ru: 'Синчхон, Мапхо-гу', en: 'Sinchon, Mapo-gu', ko: '마포구 신촌'),
  lat: 37.5559,
  lng: 126.9368,
);

/// The device's position, named by neighbourhood.
abstract interface class LocationService {
  Future<FeedArea> current();
}

/// Demo position until location access and reverse geocoding are wired.
class DemoLocationService implements LocationService {
  const DemoLocationService();

  @override
  Future<FeedArea> current() async => sinchonArea;
}

final locationServiceProvider = Provider<LocationService>((ref) => const DemoLocationService());

/// The current area. Refreshing it (the location button) reloads the feed.
final feedAreaProvider = FutureProvider<FeedArea>(
  (ref) => ref.watch(locationServiceProvider).current(),
  retry: (count, error) => null,
);

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../data/catalog/places.dart';
import '../../../data/repositories/account_repository.dart';

/// Where the feed and the map look for shifts: the worker's position and
/// the neighbourhood it is named after (A03 «Sinchon, Mapo-gu»).
@immutable
class FeedArea {
  const FeedArea({required this.place, this.lat, this.lng});

  final Place place;

  /// Null while the position is unknown (no permission, no fix): the feed is
  /// then ordered by start time, without distances.
  final double? lat;
  final double? lng;

  bool get located => lat != null && lng != null;
}

/// The prototype's position: Sinchon, Mapo-gu.
const sinchonArea = FeedArea(
  place: Place('sinchon', uz: 'Sinchon, Mapo-gu', ru: 'Синчхон, Мапхо-гу', en: 'Sinchon, Mapo-gu', ko: '마포구 신촌'),
  lat: 37.5559,
  lng: 126.9368,
);

/// The name of the area when the worker gave no district.
const seoulPlace = Place('seoul', uz: 'Seul', ru: 'Сеул', en: 'Seoul', ko: '서울');

/// The device's position, named by neighbourhood.
abstract interface class LocationService {
  Future<FeedArea> current();
}

/// Demo position (no backend configured; screen tests).
class DemoLocationService implements LocationService {
  const DemoLocationService();

  @override
  Future<FeedArea> current() async => sinchonArea;
}

/// The phone's position, (latitude, longitude); null when it may not or
/// cannot be known.
abstract interface class PositionSource {
  Future<(double, double)?> current();
}

/// Asks Android for an approximate position (coarse location is enough to
/// sort shifts by distance). The system asks the worker the first time; a
/// refusal is respected — the feed works without distances.
class GeolocatorPositionSource implements PositionSource {
  const GeolocatorPositionSource();

  @override
  Future<(double, double)?> current() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission != LocationPermission.always && permission != LocationPermission.whileInUse) return null;
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 10)),
      );
      return (position.latitude, position.longitude);
    } on Exception {
      try {
        final last = await Geolocator.getLastKnownPosition();
        return last == null ? null : (last.latitude, last.longitude);
      } on Exception {
        return null;
      }
    }
  }
}

/// With a backend: the phone's position, named after the district the worker
/// chose on A02 (or «Seul»).
class DeviceLocationService implements LocationService {
  const DeviceLocationService({required this.district, this.positions = const GeolocatorPositionSource()});

  /// The worker's district code (or typed text) from A02.
  final String? Function() district;
  final PositionSource positions;

  @override
  Future<FeedArea> current() async {
    final position = await positions.current();
    return FeedArea(place: areaPlace(district()), lat: position?.$1, lng: position?.$2);
  }
}

/// The district from A02 as a place name: one of Seoul's 25, typed text, or
/// «Seul» when none.
Place areaPlace(String? district) {
  if (district == null || district.trim().isEmpty) return seoulPlace;
  for (final place in seoulDistricts) {
    if (place.code == district) return place;
  }
  final text = district.trim();
  return Place(text, uz: text, ru: text, en: text, ko: text);
}

final locationServiceProvider = Provider<LocationService>((ref) => const DemoLocationService());

/// The current area. Refreshing it (the location button) reloads the feed.
/// A known position is also kept on the server for shifts nearby; a failure
/// there does not stop the feed.
final feedAreaProvider = FutureProvider<FeedArea>(
  (ref) async {
    final area = await ref.watch(locationServiceProvider).current();
    if (area case FeedArea(:final lat?, :final lng?)) {
      ref.read(accountRepositoryProvider).savePosition(lat, lng).catchError((Object _) {});
    }
    return area;
  },
  retry: (count, error) => null,
);

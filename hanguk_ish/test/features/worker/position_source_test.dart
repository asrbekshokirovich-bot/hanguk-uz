// GeolocatorPositionSource: what the feed gets from Android's location — a
// refusal is respected, the worker is asked once, a slow fix falls back to
// the last known position. The plugin is replaced by a pretend phone.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator_platform_interface/geolocator_platform_interface.dart';
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';

Position _at(double lat, double lng) => Position(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.utc(2026, 11, 10, 2, 20),
      accuracy: 500,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

/// A phone: location on or off, the permission before and after asking, a
/// fix or an error, a last known position or an error.
class _Phone extends GeolocatorPlatform {
  bool serviceOn = true;
  LocationPermission permission = LocationPermission.whileInUse;
  LocationPermission answer = LocationPermission.whileInUse;
  Object? fixError;
  Position? last;
  Object? lastError;

  int asked = 0;
  int fixes = 0;
  LocationSettings? settings;

  @override
  Future<bool> isLocationServiceEnabled() async => serviceOn;

  @override
  Future<LocationPermission> checkPermission() async => permission;

  @override
  Future<LocationPermission> requestPermission() async {
    asked++;
    return permission = answer;
  }

  @override
  Future<Position> getCurrentPosition({LocationSettings? locationSettings}) async {
    fixes++;
    settings = locationSettings;
    final error = fixError;
    if (error != null) throw error;
    return _at(37.5559, 126.9368);
  }

  @override
  Future<Position?> getLastKnownPosition({bool forceLocationManager = false}) async {
    final error = lastError;
    if (error != null) throw error;
    return last;
  }
}

void main() {
  late _Phone phone;

  setUp(() {
    final before = GeolocatorPlatform.instance;
    phone = _Phone();
    GeolocatorPlatform.instance = phone;
    addTearDown(() => GeolocatorPlatform.instance = before);
  });

  const source = GeolocatorPositionSource();

  test('location off: no position, and the worker is not asked', () async {
    phone.serviceOn = false;
    expect(await source.current(), isNull);
    expect(phone.asked, 0);
    expect(phone.fixes, 0);
  });

  test('allowed: the position — approximate, within 10 seconds', () async {
    expect(await source.current(), (37.5559, 126.9368));
    expect(phone.asked, 0);
    expect(phone.settings!.accuracy, LocationAccuracy.low);
    expect(phone.settings!.timeLimit, const Duration(seconds: 10));
  });

  test('not asked yet: asked once; allowed while in use → the position', () async {
    phone
      ..permission = LocationPermission.denied
      ..answer = LocationPermission.whileInUse;
    expect(await source.current(), (37.5559, 126.9368));
    expect(phone.asked, 1);
  });

  test('refused, or refused for good: no position, no fix asked for', () async {
    phone
      ..permission = LocationPermission.denied
      ..answer = LocationPermission.denied;
    expect(await source.current(), isNull);
    expect(phone.asked, 1);

    phone
      ..permission = LocationPermission.deniedForever
      ..asked = 0;
    expect(await source.current(), isNull);
    // Android would not show the question again; the app does not try.
    expect(phone.asked, 0);
    expect(phone.fixes, 0);
  });

  test('no fix in time: the last known position; without one, none', () async {
    phone
      ..fixError = TimeoutException('no fix', const Duration(seconds: 10))
      ..last = _at(37.5, 126.9);
    expect(await source.current(), (37.5, 126.9));

    phone.last = null;
    expect(await source.current(), isNull);

    phone.lastError = PlatformException(code: 'ERROR');
    expect(await source.current(), isNull);
  });
}

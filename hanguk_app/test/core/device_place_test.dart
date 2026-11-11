import 'dart:ui' show Locale;

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/device_place.dart';

void main() {
  test('a phone in Bishkek: region KG, UTC+6', () {
    expect(
      devicePlace(const Locale('ru', 'KG'), const Duration(hours: 6)),
      {'device_region': 'KG', 'tz_offset_min': 360},
    );
  });

  test('a phone in Tashkent: region UZ, UTC+5', () {
    expect(
      devicePlace(const Locale('uz', 'UZ'), const Duration(hours: 5)),
      {'device_region': 'UZ', 'tz_offset_min': 300},
    );
  });

  test('a region in lower case is sent in upper case', () {
    expect(devicePlace(const Locale('ky', 'kg'), Duration.zero)['device_region'], 'KG');
  });

  test('no region, a numeric region or no locale: only the offset is sent', () {
    expect(devicePlace(const Locale('ru'), const Duration(hours: 6)), {'tz_offset_min': 360});
    expect(devicePlace(const Locale('es', '419'), Duration.zero), {'tz_offset_min': 0});
    expect(devicePlace(null, const Duration(hours: 9)), {'tz_offset_min': 540});
  });

  test('half-hour and negative offsets are kept; impossible ones are not', () {
    expect(devicePlace(null, const Duration(hours: 5, minutes: 30))['tz_offset_min'], 330);
    expect(devicePlace(null, const Duration(hours: -5))['tz_offset_min'], -300);
    expect(devicePlace(null, const Duration(hours: 15)), isEmpty);
    expect(devicePlace(null, const Duration(hours: -13)), isEmpty);
  });
}

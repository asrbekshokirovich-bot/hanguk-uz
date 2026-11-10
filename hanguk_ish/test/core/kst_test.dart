import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/time/kst.dart';

void main() {
  group('Kst', () {
    test('is UTC+9 all year (no daylight saving)', () {
      for (final month in [1, 4, 7, 10]) {
        final utc = DateTime.utc(2026, month, 15, 3, 30);
        final wall = Kst.wallClock(utc);
        expect(wall.hour, 12, reason: 'month $month');
        expect(wall.minute, 30);
        expect(wall.day, 15);
      }
    });

    test('crosses midnight into the Korean next day', () {
      final wall = Kst.wallClock(DateTime.utc(2026, 11, 10, 20, 5));
      expect([wall.year, wall.month, wall.day, wall.hour, wall.minute], [2026, 11, 11, 5, 5]);
    });

    test('instantOf is the inverse of wallClock', () {
      final instant = Kst.instantOf(2026, 11, 10, 14, 0);
      expect(instant.isUtc, isTrue);
      expect(instant, DateTime.utc(2026, 11, 10, 5, 0));
      final wall = Kst.wallClock(instant);
      expect([wall.day, wall.hour, wall.minute], [10, 14, 0]);
    });

    test('hm prints the Korean clock with leading zeros', () {
      expect(Kst.hm(Kst.instantOf(2026, 11, 10, 9, 5)), '09:05');
      expect(Kst.hm(Kst.instantOf(2026, 11, 10, 19, 0)), '19:00');
      // The same instant expressed in another zone prints the same.
      final tashkent = Kst.instantOf(2026, 11, 10, 14, 0).toLocal();
      expect(Kst.hm(tashkent), '14:00');
    });

    test('minutesBetween', () {
      final start = Kst.instantOf(2026, 11, 10, 14, 0);
      final end = Kst.instantOf(2026, 11, 10, 19, 0);
      expect(Kst.minutesBetween(start, end), 300);
      expect(Kst.minutesBetween(end, start), -300);
    });
  });
}

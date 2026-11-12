import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/time/clock.dart';
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

  group('demoClockAt (the smoke test\'s set hour)', () {
    test('starts at that Korean time on today\'s Korean date and runs on', () {
      var real = DateTime.utc(2026, 11, 12, 10, 17, 30); // 19:17:30 in Seoul
      final clock = demoClockAt('13:30', () => real)!;
      final start = Kst.wallClock(clock());
      expect([start.year, start.month, start.day, start.hour, start.minute], [2026, 11, 12, 13, 30]);
      real = real.add(const Duration(minutes: 7, seconds: 5));
      final later = Kst.wallClock(clock());
      expect([later.hour, later.minute, later.second], [13, 37, 5]);
    });

    test('the Korean date, not UTC\'s: just after midnight in Seoul', () {
      final clock = demoClockAt('09:00', () => DateTime.utc(2026, 11, 12, 15, 30))!; // 00:30, Nov 13 in Seoul
      final wall = Kst.wallClock(clock());
      expect([wall.month, wall.day, wall.hour], [11, 13, 9]);
    });

    test('nothing set or not HH:MM: no demo clock', () {
      for (final value in ['', '9:00', '24:00', '13:60', '13:30:00', 'noon']) {
        expect(demoClockAt(value), isNull, reason: value);
      }
    });
  });
}

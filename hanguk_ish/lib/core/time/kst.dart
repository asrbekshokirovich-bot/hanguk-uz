/// Korea Standard Time helpers.
///
/// Every shift happens in Korea, whatever zone the phone is set to, so times
/// are always shown on the Korean wall clock: UTC+9, no daylight saving
/// (Korea has not observed DST since 1988).
abstract final class Kst {
  static const offset = Duration(hours: 9);

  /// The Korean wall clock at [instant], as a UTC [DateTime] whose fields
  /// (year … minute) read like a clock in Seoul.
  static DateTime wallClock(DateTime instant) => instant.toUtc().add(offset);

  /// The Korean wall clock now.
  static DateTime now() => wallClock(DateTime.now());

  /// The instant at which Seoul's clock shows the given date and time.
  static DateTime instantOf(int year, int month, int day,
          [int hour = 0, int minute = 0]) =>
      DateTime.utc(year, month, day, hour, minute).subtract(offset);

  /// `14:00` — 24-hour Korean time of [instant].
  static String hm(DateTime instant) {
    final w = wallClock(instant);
    return '${_two(w.hour)}:${_two(w.minute)}';
  }

  /// Whole minutes from [start] to [end] (negative if [end] is earlier).
  static int minutesBetween(DateTime start, DateTime end) =>
      end.difference(start).inMinutes;

  static String _two(int v) => v < 10 ? '0$v' : '$v';
}

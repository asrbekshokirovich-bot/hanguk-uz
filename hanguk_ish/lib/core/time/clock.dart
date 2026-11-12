import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'kst.dart';

/// The current instant. A provider so screens that say "Bugun", "2 soat
/// 40 daq qoldi" or "18:20 기준" can be rendered and tested at a fixed time.
final clockProvider = Provider<DateTime Function()>((ref) => DateTime.now);

/// A demo build can run at a set Korean time of day
/// (`--dart-define=ISH_DEMO_KST=13:30`; the emulator smoke test, P52). The
/// demo's shifts are laid out around today, so which one is under way, and
/// what the screens show, depends on the hour the test runs; with this it
/// sees the same day at any hour. The clock starts at that time on today's
/// Korean date and runs on from there. Null when [hhmm] is not `HH:MM`.
DateTime Function()? demoClockAt(String hhmm, [DateTime Function()? realClock]) {
  final m = RegExp(r'^([01][0-9]|2[0-3]):([0-5][0-9])$').firstMatch(hhmm);
  if (m == null) return null;
  final real = realClock ?? DateTime.now;
  final start = real();
  final today = Kst.wallClock(start);
  final shift = Kst.instantOf(today.year, today.month, today.day, int.parse(m[1]!), int.parse(m[2]!))
      .difference(start);
  return () => real().add(shift);
}

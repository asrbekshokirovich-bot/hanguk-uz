import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/format/dates.dart';
import 'package:hanguk_ish/core/time/kst.dart';

void main() {
  final now = Kst.instantOf(2026, 11, 10, 11, 20); // Tuesday
  final today14 = Kst.instantOf(2026, 11, 10, 14);
  final tomorrow18 = Kst.instantOf(2026, 11, 11, 18);
  final friday = Kst.instantOf(2026, 11, 13, 9);

  test('day names and dates in the four languages', () {
    expect(HiDates.dayAndDate(today14, now, 'uz'), 'Bugun, 10-noyabr');
    expect(HiDates.dayAndDate(today14, now, 'ru'), 'Сегодня, 10 ноября');
    expect(HiDates.dayAndDate(today14, now, 'en'), 'Today, Nov 10');
    expect(HiDates.dayAndDate(today14, now, 'ko'), '오늘, 11월 10일');
    expect(HiDates.dayName(tomorrow18, now, 'uz'), 'Ertaga');
    expect(HiDates.dayName(friday, now, 'uz'), 'Juma');
    expect(HiDates.timeRange(today14, today14.add(const Duration(hours: 5))), '14:00–19:00');
  });

  test('durations', () {
    expect(HiDates.duration(300, 'uz'), '5 soat');
    expect(HiDates.duration(270, 'uz'), '4 soat 30 daq');
    expect(HiDates.duration(300, 'ko'), '5시간');
    expect(HiDates.durationWords(160, 'uz'), '2 soat 40 daqiqa');
    expect(HiDates.durationWords(40, 'uz'), '40 daqiqa');
    expect(HiDates.durationWords(120, 'uz'), '2 soat');
    expect(HiDates.durationWords(160, 'ru'), '2 ч 40 мин');
    expect(HiDates.durationWords(160, 'en'), '2 h 40 min');
    expect(HiDates.durationWords(160, 'ko'), '2시간 40분');
  });

  test('the day inside a sentence', () {
    expect(HiDates.dayInSentence(today14, now, 'uz'), 'bugun');
    expect(HiDates.dayInSentence(tomorrow18, now, 'ru'), 'завтра');
    expect(HiDates.dayInSentence(today14, now, 'en'), 'today');
    expect(HiDates.dayInSentence(friday, now, 'uz'), '13-noyabr');
    expect(HiDates.dayInSentence(friday, now, 'en'), 'on Nov 13');
    expect(HiDates.dayInSentence(friday, now, 'ko'), '11월 13일');
  });

  test('distances', () {
    expect(formatKm(1.2, 'uz'), '1,2 km');
    expect(formatKm(1.2, 'ru'), '1,2 км');
    expect(formatKm(1.2, 'en'), '1.2 km');
    expect(formatKm(1.2, 'ko'), '1.2km');
  });
}

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/format/digit_mask.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/employer/ko.dart';
import 'package:hanguk_ish/features/employer/providers.dart';
import 'package:hanguk_ish/features/employer/report/ba5_report_screen.dart';
import 'package:hanguk_ish/features/employer/widgets.dart';

void main() {
  final now = employerPrototypeNow;

  DemoEmployerRepository repo([DateTime Function()? clock]) =>
      DemoEmployerRepository(now: now, clock: clock ?? () => now);

  Future<List<EmployerShift>> today(DemoEmployerRepository r) =>
      r.shifts(demoDalbit.id, kstDayStart(now), kstDayStart(now, 1));

  test('BA1 numbers: 3 shifts, 8/9 confirmed, 1 place left, 1 missing', () async {
    final shifts = await today(repo());
    expect(shifts.map((s) => s.title), ['오픈 바리스타 보조', '홀·카운터 보조', '마감 정리 보조']);
    expect(shifts.fold(0, (sum, s) => sum + s.confirmed), 8);
    expect(shifts.fold(0, (sum, s) => sum + s.slots), 9);
    expect(shifts.fold(0, (sum, s) => sum + s.openSlots), 1);
    expect(shifts.fold(0, (sum, s) => sum + s.noShows(now)), 1);
    expect(shifts.map((s) => s.state(now)),
        [EmployerShiftState.done, EmployerShiftState.inProgress, EmployerShiftState.urgent]);
    final close = shifts.last;
    expect(close.needsAttention(now), isTrue);
    expect(close.waiting.map((a) => a.worker.fullName), ['Aruzhan Bekova', 'Sevara Nazarova']);
    expect(Ko.attention(close.title, noShows: close.noShows(now), open: close.openSlots, waiting: close.waiting.length),
        '마감 정리 보조 · 미출근 1명, 빈자리 1 (지원자 2명)');
    expect(Ko.crewLine(close.confirmed, close.slots, close.waiting.length), '확정 3/4명 · 지원자 2');
    expect(Ko.asOf(now), '11월 10일 (화) · 18:20 기준');
  });

  test('BA3 attendance at 18:20: in at 17:56, late 2 min, missing 20 min', () async {
    final close = (await repo().shift('demo-es-close'))!;
    final crew = close.crew;
    expect(crew.map((a) => a.worker.fullName), ['Timur Kim', 'Malika Yusupova', 'Aibek Toktogulov']);
    expect(Kst.hm(crew[0].checkInAt!), '17:56');
    expect(crew[0].lateMinutes, 0);
    expect(Kst.hm(crew[1].checkInAt!), '18:02');
    expect(crew[1].lateMinutes, 2);
    expect(crew[2].checkInAt, isNull);
    expect(Kst.minutesBetween(close.startsAt, now), 20);
    expect(Ko.shiftWhen(close.startsAt, close.endsAt, now), '오늘 18:00–22:00 · 4시간');
    expect(Ko.shiftTerms(close.hourlyWage, close.confirmed, close.slots, close.autoConfirm),
        '시급 11,000원 · 확정 3/4명 · 자동 확정 꺼짐');
  });

  test('the demo only checks people in once their time has come', () async {
    final morning = Kst.instantOf(2026, 11, 10, 7, 30);
    final r = DemoEmployerRepository(now: morning, clock: () => morning);
    final shifts = await r.shifts(demoDalbit.id, kstDayStart(morning), kstDayStart(morning, 1));
    for (final s in shifts) {
      expect(s.applicants.where((a) => a.checkInAt != null), isEmpty);
      expect(s.noShows(morning), 0);
    }
    expect(shifts.first.state(morning), EmployerShiftState.scheduled);
    expect(shifts.last.state(morning), EmployerShiftState.recruiting);
  });

  test('accepting the last applicant fills the shift and turns the other one down', () async {
    final r = repo();
    final close = (await r.shift('demo-es-close'))!;
    final aruzhan = close.waiting.first;
    final updated = await r.decide(aruzhan.applicationId, accept: true);
    expect(updated.confirmed, 4);
    expect(updated.openSlots, 0);
    expect(updated.waiting, isEmpty);
    expect(updated.applicants.where((a) => a.status == ApplicationStatus.rejected).single.worker.fullName,
        'Sevara Nazarova');
    expect(updated.state(now), EmployerShiftState.inProgress);
    await expectLater(r.decide(aruzhan.applicationId, accept: true), throwsA(isA<ShiftActionException>()));
  });

  test('turning down keeps the place open', () async {
    final r = repo();
    final close = (await r.shift('demo-es-close'))!;
    final updated = await r.decide(close.waiting.last.applicationId, accept: false);
    expect(updated.confirmed, 3);
    expect(updated.waiting.single.worker.fullName, 'Aruzhan Bekova');
  });

  test('a finished shift takes no decisions', () async {
    final late = Kst.instantOf(2026, 11, 10, 22, 30);
    final r = repo(() => late);
    final close = (await r.shift('demo-es-close'))!;
    await expectLater(
      r.decide(close.waiting.first.applicationId, accept: true),
      throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'SHIFT_ENDED')),
    );
  });

  test('BA5 this month: the prototype\'s 1–10 November', () async {
    final (from, to) = reportRange(ReportPeriod.thisMonth, now);
    expect(Ko.totalPaid(from, to), '11월 1일–10일 총 지급액');
    final report = await repo().report(demoDalbit.id, from, to);
    expect(report.total, 1262500);
    expect(report.rows.length, 9);
    expect(report.minutes, 117 * 60);
    expect(report.persons, 23);
    expect(report.paidRows.length, 7);
    expect(report.paidAmount, 1000000);
    expect(report.pendingRows.length, 2);
    expect(report.pendingAmount, 262500);
    expect(Ko.reportCounts(report.rows.length, report.minutes, report.persons), '근무 9건 · 117시간 · 연인원 23명');
    final first = report.rows.first;
    expect([Ko.dotDate(first.startsAt), Ko.weekdayLong(first.startsAt), first.title, Ko.rowCrew(first.workers, first.minutes)],
        ['11.10', '화요일', '오픈 바리스타 보조', '2명 · 10시간']);
    expect(report.rows.take(4).map((r) => r.amount), [105000, 157500, 264000, 264000]);
    expect(report.rows.take(4).map((r) => r.paid), [false, false, true, true]);
    expect(report.rows.take(4).map((r) => Ko.weekdayLong(r.startsAt)), ['화요일', '월요일', '일요일', '토요일']);
  });

  test('BA5 periods: this week from Monday, last month whole', () async {
    final (wFrom, wTo) = reportRange(ReportPeriod.thisWeek, now);
    expect([wFrom, wTo], [DateTime.utc(2026, 11, 9), DateTime.utc(2026, 11, 10)]);
    final (mFrom, mTo) = reportRange(ReportPeriod.lastMonth, now);
    expect([mFrom, mTo], [DateTime.utc(2026, 10, 1), DateTime.utc(2026, 10, 31)]);
    expect(Ko.range(mFrom, mTo), '10월 1일–31일');
    expect(Ko.range(DateTime.utc(2026, 10, 27), DateTime.utc(2026, 11, 2)), '10월 27일–11월 2일');
    final r = repo();
    final week = await r.report(demoDalbit.id, wFrom, wTo);
    expect(week.rows.length, 2);
    expect(week.total, 262500);
    final last = await r.report(demoDalbit.id, mFrom, mTo);
    expect(last.rows.length, 8);
    expect(last.pendingRows, isEmpty);
  });

  test('marking a shift paid moves it between 지급 대기 and 지급 완료', () async {
    final r = repo();
    final (from, to) = reportRange(ReportPeriod.thisMonth, now);
    await r.setShiftPaid('demo-es-p1', paid: true);
    var report = await r.report(demoDalbit.id, from, to);
    expect(report.pendingAmount, 105000);
    await r.setShiftPaid('demo-es-p1', paid: false);
    report = await r.report(demoDalbit.id, from, to);
    expect(report.pendingAmount, 262500);
  });

  test('the CSV has a row per shift, readable by Excel', () async {
    final (from, to) = reportRange(ReportPeriod.thisMonth, now);
    final csv = reportCsv(await repo().report(demoDalbit.id, from, to));
    final lines = csv.trim().split('\r\n');
    expect(lines.first, '﻿${Ko.csvHeader}');
    expect(lines.length, 10);
    expect(lines[1], '2026-11-10,화요일,오픈 바리스타 보조,2,10,105000,지급 대기');
  });

  test('new shifts follow the backend\'s rules', () async {
    final r = repo();
    ShiftDraft draft({int wage = 10500, int dayOffset = 2, int startH = 14, int hours = 5}) {
      final start = Kst.instantOf(2026, 11, 10 + dayOffset, startH);
      return ShiftDraft(
        businessId: demoDalbit.id,
        title: '홀·카운터 보조',
        startsAt: start,
        endsAt: start.add(Duration(hours: hours)),
        hourlyWage: wage,
        slots: 3,
      );
    }

    Matcher code(String c) => throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', c));
    await expectLater(r.createShift(draft(wage: 10000)), code('BELOW_MINIMUM_WAGE'));
    await expectLater(r.createShift(draft(dayOffset: 0, startH: 9)), code('IN_THE_PAST'));
    await expectLater(r.createShift(draft(hours: 17)), code('TOO_LONG'));
    final created = await r.createShift(draft());
    expect(created.plannedCost, 157500);
    final listed = await r.shifts(demoDalbit.id, kstDayStart(now), kstDayStart(now, 15));
    expect(listed.last.id, created.id);
  });

  test('minimum wage by year (고용노동부 고시)', () {
    expect(minimumWageAt(Kst.instantOf(2026, 11, 12, 14)), 10320);
    expect(minimumWageAt(Kst.instantOf(2027, 1, 1, 0)), 10700);
    expect(Ko.minimumWageOk(10320), '최저시급 10,320원 이상');
  });

  test('editing a shift: times stay while workers hold places', () async {
    final r = repo();
    final close = (await r.shift('demo-es-close'))!;
    ShiftDraft same({DateTime? start, int slots = 4}) => ShiftDraft(
          businessId: close.businessId,
          title: close.title,
          startsAt: start ?? close.startsAt,
          endsAt: (start ?? close.startsAt).add(const Duration(hours: 4)),
          hourlyWage: 11500,
          slots: slots,
          autoConfirm: false,
        );
    await expectLater(r.updateShift(close.id, same(start: close.startsAt.add(const Duration(hours: 1)))),
        throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'HAS_CREW')));
    await expectLater(r.updateShift(close.id, same(slots: 2)), throwsA(isA<ShiftActionException>()));
    final updated = await r.updateShift(close.id, same(slots: 5));
    expect(updated.hourlyWage, 11500);
    expect(updated.openSlots, 2);
    expect(updated.applicants.length, close.applicants.length);
  });

  test('cancelling: only before the start, everyone is let go', () async {
    final r = repo();
    final created = await r.createShift(ShiftDraft(
      businessId: demoDalbit.id,
      title: '마감 정리 보조',
      startsAt: Kst.instantOf(2026, 11, 12, 18),
      endsAt: Kst.instantOf(2026, 11, 12, 22),
      hourlyWage: 11000,
      slots: 2,
    ));
    final cancelled = await r.cancelShift(created.id);
    expect(cancelled.state(now), EmployerShiftState.cancelled);
    await expectLater(r.cancelShift('demo-es-close'),
        throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'SHIFT_STARTED')));
  });

  test('favourites and the recent list (BA4)', () async {
    final r = repo();
    final workers = await r.workers(demoDalbit.id);
    expect(workers.length, 18);
    expect(workers.where((w) => w.favorite).length, 6);
    expect(workers.map((w) => w.fullName), isNot(contains('Aruzhan Bekova')));
    expect(await r.toggleFavorite(demoDalbit.id, 'demo-w-kamila'), isTrue);
    expect((await r.workers(demoDalbit.id)).where((w) => w.favorite).length, 7);
    final aziz = workers.firstWhere((w) => w.fullName == 'Aziz Karimov');
    expect(Ko.timesHere(aziz.timesHere, aziz.topik), '우리 매장 7회 · TOPIK 4급');
    expect(languageNamesKo(aziz.languages), '우즈베크어 · 러시아어 · 영어 · 한국어');
  });

  test('다시 요청 invites someone who has worked here to an open shift', () async {
    final r = repo();
    final created = await r.createShift(ShiftDraft(
      businessId: demoDalbit.id,
      title: '홀·카운터 보조',
      startsAt: Kst.instantOf(2026, 11, 12, 14),
      endsAt: Kst.instantOf(2026, 11, 12, 19),
      hourlyWage: 10500,
      slots: 3,
    ));
    await r.requestAgain(created.id, 'demo-w-aziz6');
    expect(r.invitations.single, (created.id, 'demo-w-aziz6'));
    await expectLater(r.requestAgain(created.id, 'demo-w-aruzhan2'), throwsA(isA<ShiftActionException>()));
    await expectLater(r.requestAgain('demo-es-close', 'demo-w-aziz6'),
        throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'SHIFT_CLOSED')));
  });

  test('the QR payload is the one the worker app reads', () async {
    final payload = await repo().shiftQr('demo-es-close');
    final qr = ShiftQr.parse(payload)!;
    expect(qr.shiftId, 'demo-es-close');
    expect(qr.token, DemoEmployerRepository.qrToken);
  });

  test('avatar colours stay the prototype\'s', () {
    int tone(String name) => demoWorkers.firstWhere((w) => w.fullName == name).tone;
    expect(tone('Aziz Karimov'), 0);
    expect(tone('Timur Kim'), 0);
    expect(tone('Malika Yusupova'), 1);
    expect(tone('Dilnoza Rakhimova'), 2);
    expect(tone('Sevara Nazarova'), 2);
    expect(tone('Aruzhan Bekova'), 3);
    expect(tone('Aibek Toktogulov'), 4);
    expect(demoWorkers.first.initials, 'AK');
  });

  test('Korean dates and durations', () {
    expect(Ko.duration(300), '5시간');
    expect(Ko.duration(270), '4시간 30분');
    expect(Ko.duration(30), '30분');
    expect(Ko.dayWord(Kst.instantOf(2026, 11, 11, 9), now), '내일');
    expect(Ko.dayWord(Kst.instantOf(2026, 11, 12, 9), now), '11월 12일 (목)');
    expect(Ko.dotDate(Kst.instantOf(2026, 11, 12, 9)), '11.12');
    expect(Ko.error(const ShiftActionException('SHIFT_FULL')), '자리가 모두 찼어요');
    expect(Ko.error(const OfflineException()), '인터넷 연결을 확인해 주세요');
  });

  test('wages are typed with thousands separators', () {
    final f = ThousandsFormatter();
    TextEditingValue type(String text) =>
        f.formatEditUpdate(TextEditingValue.empty, TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length)));
    expect(type('10500').text, '10,500');
    expect(type('1050000').text, '1,050,000');
    expect(type('0010').text, '10');
    expect(type('12a3').text, '123');
    expect(type('123456789').text, '1,234,567');
  });
}

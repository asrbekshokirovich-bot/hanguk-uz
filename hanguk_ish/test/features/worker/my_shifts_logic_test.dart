import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/format/dates.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';

import '../../helpers/worker_harness.dart';

void main() {
  String qr(String id) => ShiftQr(id, DemoShiftRepository.qrToken).payload;
  Matcher refused(String code) => throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', code));

  test('countdowns, worked time, timers', () {
    expect(HiDates.countdown(160, 'uz'), '2 soat 40 daq');
    expect(HiDates.countdown(29 * 60 + 40, 'uz'), '1 kun 5 soat');
    expect(HiDates.countdown(4, 'uz'), '4 daq');
    expect(HiDates.countdown(24 * 60, 'uz'), '1 kun');
    expect(HiDates.countdown(160, 'ru'), '2 ч 40 мин');
    expect(HiDates.countdown(29 * 60 + 40, 'ko'), '1일 5시간');
    expect(HiDates.durationHm(300, 'uz'), '5 soat 00 daq');
    expect(HiDates.durationHm(185, 'en'), '3 h 05 min');
    expect(HiDates.clock(const Duration(hours: 2, minutes: 14, seconds: 37)), '02:14:37');
    expect(HiDates.clock(const Duration(seconds: -5)), '00:00:00');
  });

  test('QR payloads', () {
    expect(ShiftQr.parse('hanguk-ish:v1:abc:tok')!.shiftId, 'abc');
    expect(ShiftQr.parse('hanguk-ish:v1:abc:tok')!.token, 'tok');
    expect(ShiftQr.parse('hanguk-ish:v2:abc:tok'), isNull);
    expect(ShiftQr.parse('https://example.com'), isNull);
    expect(ShiftQr.parse('hanguk-ish:v1::tok'), isNull);
    expect(const ShiftQr('s1', 't').payload, 'hanguk-ish:v1:s1:t');
  });

  test('demo history: the prototype\'s November (A09)', () async {
    final repo = DemoShiftRepository(now: prototypeNow);
    final mine = await repo.myShifts();
    final done = mine.where((m) => m.isDone).toList();
    expect(done, hasLength(5));
    expect(done.map((m) => m.pay).fold<int>(0, (a, b) => a + b), 291000);
    expect(done.where((m) => m.isPaid).map((m) => m.pay).fold<int>(0, (a, b) => a + b), 219000);
    expect(done.map((m) => Kst.wallClock(m.shift.startsAt).day).toList(), [1, 3, 5, 7, 8]);
  });

  test('cancel: free, late, waiting; the place comes back', () async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, history: false);
    final dalbit = await repo.apply('demo-1'); // starts in 2 h 40 min
    expect((await repo.shift('demo-1'))!.slotsLeft, 1);
    final late = await repo.cancelApplication(dalbit.applicationId);
    expect(late.status, ApplicationStatus.cancelled);
    expect(late.lateCancel, isTrue);
    expect((await repo.shift('demo-1'))!.slotsLeft, 2);
    await expectLater(repo.cancelApplication(dalbit.applicationId), refused('CANNOT_CANCEL'));

    final tomorrow = await repo.apply('demo-14'); // tomorrow 14:00, 26 h 40 min away
    expect((await repo.cancelApplication(tomorrow.applicationId)).lateCancel, isFalse);

    final pending = await repo.apply('demo-13');
    expect((await repo.cancelApplication(pending.applicationId)).lateCancel, isFalse);

    final started = await repo.apply('demo-6'); // 12:30 today
    clock.at(12, 40);
    await expectLater(repo.cancelApplication(started.applicationId), refused('SHIFT_STARTED'));
  });

  test('check-in and check-out with the backend\'s windows', () async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, strict: true, history: false);
    await expectLater(repo.checkIn('garbage'), refused('QR_INVALID'));
    await expectLater(repo.checkIn(qr('demo-1')), refused('NOT_CONFIRMED'));
    final app = await repo.apply('demo-1');
    await expectLater(repo.checkIn(qr('demo-1')), refused('TOO_EARLY'));
    await expectLater(repo.checkOut(qr('demo-1')), refused('NOT_CHECKED_IN'));
    clock.at(13, 31);
    final inside = await repo.checkIn(qr('demo-1'));
    expect(inside.status, ApplicationStatus.checkedIn);
    expect(inside.lateMinutes, 0);
    await expectLater(repo.checkIn(qr('demo-1')), refused('ALREADY_CHECKED_IN'));
    clock.at(19, 30);
    final out = await repo.checkOut(qr('demo-1'));
    expect(out.workedMinutes, 300, reason: 'counted inside 14:00–19:00 only');
    expect(out.payAmount, 52500);
    await expectLater(repo.checkOut(qr('demo-1')), refused('ALREADY_CHECKED_OUT'));
    await repo.rateBusiness(app.applicationId, 5, {RatingTag.polite});
    expect((await repo.myShift(app.applicationId))!.myStars, 5);
    await expectLater(repo.rateBusiness(app.applicationId, 6, const {}), refused('INVALID'));
  });

  test('late check-in counts the lateness; late check-out is refused', () async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, strict: true, history: false);
    await repo.apply('demo-1');
    clock.at(14, 12);
    expect((await repo.checkIn(qr('demo-1'))).lateMinutes, 12);
    clock.at(21, 1);
    await expectLater(repo.checkOut(qr('demo-1')), refused('TOO_LATE'));
  });

  test('the lenient demo counts the time actually worked', () async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, history: false);
    await repo.apply('demo-1');
    await repo.checkIn(qr('demo-1')); // 11:20, long before the start
    clock.at(11, 50);
    final out = await repo.checkOut(qr('demo-1'));
    expect(out.workedMinutes, 30);
    expect(out.payAmount, 5250);
  });
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

// What the real backend sends and the sample data does not, found on the
// end-to-end screens.

/// The sample shifts as a business registered with only its number sends
/// them: no neighbourhood and no street address yet (BA0 asks for neither).
class NumberOnlyBusinesses extends DemoShiftRepository {
  NumberOnlyBusinesses(TestClock clock, {this.shiftAddress = ''}) : super(now: prototypeNow, clock: clock.call);

  /// What the business wrote in BA2 «주소» for every shift ('' = nothing).
  final String shiftAddress;

  ShiftListing bare(ShiftListing s) => ShiftListing(
        id: s.id,
        business: Business(
          id: s.business.id,
          name: s.business.name,
          names: s.business.names,
          category: s.business.category,
          lat: s.business.lat,
          lng: s.business.lng,
        ),
        title: s.title,
        duties: s.duties,
        dress: s.dress,
        address: shiftAddress,
        translations: {
          for (final e in s.translations.entries)
            e.key: ShiftText(title: e.value.title, duties: e.value.duties, dress: e.value.dress),
        },
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        hourlyWage: s.hourlyWage,
        slots: s.slots,
        slotsLeft: s.slotsLeft,
        autoConfirm: s.autoConfirm,
        distanceKm: s.distanceKm,
        lat: s.lat,
        lng: s.lng,
        myStatus: s.myStatus,
        myApplicationId: s.myApplicationId,
      );

  @override
  Future<List<ShiftListing>> feed(FeedQuery query) async => [for (final s in await super.feed(query)) bare(s)];

  @override
  Future<ShiftListing?> shift(String id) async {
    final s = await super.shift(id);
    return s == null ? null : bare(s);
  }

  @override
  Future<List<MyShift>> myShifts() async => [for (final a in await super.myShifts()) a.copyWith(shift: bare(a.shift))];
}

/// The sample shifts whose one-shift load waits for [gate] while it is set:
/// a reload that has not come back yet.
class SlowReload extends DemoShiftRepository {
  SlowReload(TestClock clock) : super(now: prototypeNow, clock: clock.call);

  Completer<void>? gate;

  @override
  Future<MyShift?> myShift(String applicationId) async {
    final wait = gate;
    if (wait != null) await wait.future;
    return super.myShift(applicationId);
  }
}

void main() {
  setUpAll(loadHiFonts);

  Future<ProviderContainer> open(WidgetTester tester, ShiftRepository repo, TestClock clock, String location) async {
    usePhone(tester);
    final container = appContainer(location: location, repository: repo, clock: clock.call);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  /// The texts on screen that end with a distance («Sinchon · 1,2 km»).
  List<String> distanceLines(WidgetTester tester) => [
        for (final text in tester.widgetList<Text>(find.textContaining(RegExp(r'\d km$')))) ?text.data,
      ];

  testWidgets('A03: a business with no area yet shows the distance alone, not «· 1,2 km»', (tester) async {
    final clock = TestClock(prototypeNow);
    await open(tester, NumberOnlyBusinesses(clock), clock, WorkerRoutes.feed);
    final lines = distanceLines(tester);
    expect(lines.where((l) => RegExp(r'^\d+,\d km$').hasMatch(l)), isNotEmpty, reason: lines.join(' | '));
    expect(lines, everyElement(isNot(startsWith('·'))));
  });

  testWidgets('A06: a business with no address yet shows the distance alone', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = NumberOnlyBusinesses(clock);
    await repo.apply('demo-1');
    await open(tester, repo, clock, WorkerRoutes.myShifts);
    expect(find.text('Dalbit Kafe'), findsOneWidget, reason: 'the name without « · » and an area');
    expect(find.text('1,2 km'), findsOneWidget);
    expect(distanceLines(tester), everyElement(isNot(startsWith('·'))));
  });

  testWidgets("A03: the shift's own address stands in for the area the business has not named", (tester) async {
    final clock = TestClock(prototypeNow);
    await open(tester, NumberOnlyBusinesses(clock, shiftAddress: '서울 마포구 양화로 160'), clock, WorkerRoutes.feed);
    final lines = distanceLines(tester);
    expect(lines.where((l) => RegExp(r'^서울 마포구 양화로 160 · \d+,\d km$').hasMatch(l)), isNotEmpty,
        reason: lines.join(' | '));
  });

  testWidgets("A05 and A06 show the shift's own address", (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = NumberOnlyBusinesses(clock, shiftAddress: '서울 마포구 양화로 160');
    await repo.apply('demo-1');
    await open(tester, repo, clock, WorkerRoutes.myShifts);
    expect(find.text('서울 마포구 양화로 160 · 1,2 km'), findsOneWidget);
    await tester.tap(find.text('Dalbit Kafe'));
    await tester.pumpAndSettle();
    // A confirmed shift opens its entry screen; the detail page has it too.
    await tester.pumpWidget(const SizedBox());
    await open(tester, repo, clock, WorkerRoutes.shift('demo-1'));
    expect(find.text('서울 마포구 양화로 160'), findsOneWidget);
  });

  testWidgets('A07 waits for the finished shift instead of showing the plan first', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = SlowReload(clock);
    final app = await repo.apply('demo-1');
    clock.at(14);
    await repo.checkIn(const ShiftQr('demo-1', DemoShiftRepository.qrToken).payload);
    await open(tester, repo, clock, WorkerRoutes.atWork(app.applicationId));
    expect(find.byType(AtWorkScreen), findsOneWidget);

    // Out at 18:30, half an hour before the planned 19:00.
    clock.at(18, 30);
    await tester.tap(find.text('Chiqish — QR skanerlash'));
    await tester.pumpAndSettle();
    repo.gate = Completer<void>();
    await tester.tap(find.bySemanticsLabel('QR kodni skanerlash'));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.byType(ShiftResultScreen), findsOneWidget);
    expect(find.text('Smena yakunlandi'), findsOneWidget);
    expect(find.text('19:00'), findsNothing, reason: 'not the planned end');
    expect(find.text('5 soat 00 daq'), findsNothing, reason: 'not the planned hours');
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    HiButton rate() => tester.widget<HiButton>(find.widgetWithText(HiButton, 'Ish beruvchini baholash'));
    expect(rate().onPressed, isNull, reason: 'nothing to rate before the shift is known to be finished');

    repo.gate!.complete();
    repo.gate = null;
    await tester.pumpAndSettle();
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('18:30'), findsOneWidget);
    expect(find.text('4 soat 30 daq'), findsOneWidget);
    expect(rate().onPressed, isNotNull);
  });
}

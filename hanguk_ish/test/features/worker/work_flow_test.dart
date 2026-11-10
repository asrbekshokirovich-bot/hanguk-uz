import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/links/directions.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/features/worker/feed/feed_screen.dart';
import 'package:hanguk_ish/features/worker/my_shifts/my_shifts_screen.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

void main() {
  setUpAll(loadHiFonts);

  Future<ProviderContainer> start(
    WidgetTester tester,
    DemoShiftRepository repo,
    TestClock clock, {
    String location = WorkerRoutes.myShifts,
    LinkOpener? opener,
  }) async {
    usePhone(tester);
    final container = appContainer(
      location: location,
      repository: repo,
      clock: clock.call,
      overrides: [if (opener != null) linkOpenerProvider.overrideWithValue(opener)],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('my shifts: countdowns and states', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    await repo.apply('demo-1');
    await repo.apply('demo-13');
    await start(tester, repo, clock);
    expect(find.byType(MyShiftsScreen), findsOneWidget);
    expect(find.text('2 soat 40 daq qoldi'), findsOneWidget);
    expect(find.text('1 kun 5 soat qoldi'), findsOneWidget);
    expect(find.text('Tasdiqlangan'), findsOneWidget);
    expect(find.text('Tasdiq kutilmoqda'), findsOneWidget);
    expect(find.text('Dalbit Kafe · Sinchon'), findsOneWidget);
    expect(find.text('Bugun, 10-noyabr · 14:00–19:00'), findsOneWidget);
    expect(find.text('Mapo-gu, Sinchon-ro 12-gil · 1,2 km'), findsOneWidget);
    expect(find.text('Ertaga, 11-noyabr · 17:00–22:00'), findsOneWidget);
  });

  testWidgets('the whole workday: entry QR → at work → exit QR → result → rating', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    final app = await repo.apply('demo-1');
    clock.at(13, 56);
    final container = await start(tester, repo, clock);

    await tester.tap(find.text('Dalbit Kafe · Sinchon'));
    await tester.pumpAndSettle();
    expect(find.text('Ishga kirish'), findsOneWidget);
    expect(find.text('4 daq qoldi'), findsOneWidget);

    clock.at(14);
    await tester.tap(find.bySemanticsLabel('QR kodni skanerlash'));
    await tester.pumpAndSettle();
    expect(find.byType(AtWorkScreen), findsOneWidget);
    expect(find.text('Ishdasiz'), findsOneWidget);
    expect(find.text('00:00:00'), findsOneWidget);
    expect(find.text('14:00'), findsOneWidget);
    expect(find.text('19:00'), findsOneWidget);

    clock.at(19);
    await tester.tap(find.text('Chiqish — QR skanerlash'));
    await tester.pumpAndSettle();
    expect(find.text('Ishdan chiqish'), findsOneWidget);
    expect(find.text('Reja: 19:00 gacha'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('QR kodni skanerlash'));
    await tester.pumpAndSettle();
    expect(find.byType(ShiftResultScreen), findsOneWidget);
    expect(find.text('Smena yakunlandi'), findsOneWidget);
    expect(find.text('Rahmat, Aziz! Bugungi ishingiz qayd etildi.'), findsOneWidget);
    expect(find.text('5 soat 00 daq'), findsOneWidget);
    final done = await repo.myShift(app.applicationId);
    expect(done!.status, ApplicationStatus.completed);
    expect(done.payAmount, 52500);

    await tester.tap(find.text('Ish beruvchini baholash'));
    await tester.pumpAndSettle();
    expect(find.text('Ish beruvchini baholang'), findsOneWidget);
    expect(tester.widget<HiButton>(find.widgetWithText(HiButton, 'Bahoni yuborish')).onPressed, isNull);
    await tester.tap(find.bySemanticsLabel('4 yulduz'));
    await tester.pump();
    expect(find.text('Yaxshi'), findsOneWidget);
    await tester.tap(find.text('Xushmuomala'));
    await tester.tap(find.text('Bahoni yuborish'));
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
    expect(find.text('Rahmat! Bahoingiz yuborildi.'), findsOneWidget);
    final rated = await repo.myShift(app.applicationId);
    expect(rated!.myStars, 4);
    expect(container, isNotNull);
  });

  testWidgets('withdrawing a request and cancelling late', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    await repo.apply('demo-1');
    await repo.apply('demo-13');
    await start(tester, repo, clock);

    // Ttukbaegi (waiting): the request is withdrawn.
    await tester.tap(find.text('Bekor qilish').last);
    await tester.pumpAndSettle();
    expect(find.text('Smenani bekor qilasizmi?'), findsOneWidget);
    expect(find.text('Ariza qaytarib olinadi.'), findsOneWidget);
    await tester.tap(find.text('Ha, bekor qilish'));
    await tester.pumpAndSettle();
    expect(find.text('Smena bekor qilindi.'), findsOneWidget);
    expect(find.text('Tasdiq kutilmoqda'), findsNothing);

    // Dalbit starts in 2 h 40 min: the late warning.
    await tester.tap(find.text('Bekor qilish').first);
    await tester.pumpAndSettle();
    expect(
      find.text('Smena boshlanishiga 24 soatdan kam qoldi. Bekor qilsangiz, ishonchlilik balingiz pasayadi.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Orqaga'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Bekor qilingan'));
    await tester.pumpAndSettle();
    expect(find.text('Bekor qilindi'), findsOneWidget);
    expect(find.text('Ttukbaegi Sikdang · Mapo'), findsOneWidget);
  });

  testWidgets('entry QR too early (real time windows)', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, strict: true);
    final app = await repo.apply('demo-1');
    await start(tester, repo, clock, location: WorkerRoutes.checkIn(app.applicationId));
    await tester.tap(find.bySemanticsLabel('QR kodni skanerlash'));
    await tester.pumpAndSettle();
    expect(find.text('Kirish smena boshlanishidan 30 daqiqa oldin ochiladi.'), findsOneWidget);
    expect(find.text('Ishga kirish'), findsOneWidget);
  });

  testWidgets('«Yo\'nalish» opens the route in Kakao Map', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    await repo.apply('demo-1');
    Uri? opened;
    await start(tester, repo, clock, opener: (uri) async {
      opened = uri;
      return true;
    });
    await tester.tap(find.text("Yo'nalish"));
    await tester.pumpAndSettle();
    expect(opened.toString(), 'https://map.kakao.com/link/to/Dalbit%20Kafe,37.55798,126.950147');
  });

  testWidgets('completed shifts can be rated from the list', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    await start(tester, repo, clock);
    expect(find.text("Kelgusi smenalar yo'q"), findsOneWidget);
    await tester.tap(find.text('Bajarilgan'));
    await tester.pumpAndSettle();
    expect(find.text('Bahoyingiz: 5 ★'), findsWidgets);
    expect(find.text('Baholash'), findsWidgets);
    await tester.tap(find.text('Baholash').first);
    await tester.pumpAndSettle();
    expect(find.text('Ish beruvchini baholang'), findsOneWidget);
  });

  testWidgets('nothing upcoming → «Smenalarni ko\'rish» opens the feed', (tester) async {
    final clock = TestClock(prototypeNow);
    await start(tester, demoRepository(clock, history: false), clock);
    await tester.tap(find.text("Smenalarni ko'rish"));
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
  });
}

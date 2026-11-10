import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/money/won.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/design/widgets/forms.dart';
import 'package:hanguk_ish/features/worker/feed/feed_controller.dart';
import 'package:hanguk_ish/features/worker/feed/feed_screen.dart';
import 'package:hanguk_ish/features/worker/map/map_screen.dart';
import 'package:hanguk_ish/features/worker/shift/shift_detail_screen.dart';
import 'package:hanguk_ish/features/worker/shift/shift_widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

void main() {
  setUpAll(loadHiFonts);

  Future<ProviderContainer> start(WidgetTester tester, {String location = WorkerRoutes.feed, ShiftRepository? repository}) async {
    usePhone(tester);
    final container = appContainer(location: location, repository: repository);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  HiButton button(WidgetTester tester, String label) =>
      tester.widget<HiButton>(find.widgetWithText(HiButton, label).first);

  testWidgets('feed → detail → confirm → taken → back to the feed', (tester) async {
    final container = await start(tester);
    expect(find.byType(FeedScreen), findsOneWidget);
    expect(find.text('Sinchon, Mapo-gu'), findsOneWidget);
    expect(find.text('· 12 ta smena'), findsOneWidget);
    expect(find.text('Masofa: 3 km'), findsOneWidget);

    // The first card is Dalbit Kafe; open it.
    await tester.tap(find.text('Dalbit Kafe').first);
    await tester.pumpAndSettle();
    expect(find.byType(ShiftDetailScreen), findsOneWidget);
    expect(find.text('Kassa va zal yordamchisi'), findsOneWidget);
    expect(find.text('Bugun, 10-noyabr · 14:00–19:00 · 5 soat'), findsOneWidget);
    expect(find.text('Dalbit Kafe · Sinchon'), findsOneWidget);
    expect(find.text('4,8'), findsOneWidget);
    expect(find.text('· 126 ta smena bajarilgan'), findsOneWidget);
    expect(find.text('5 soat × ${Won.worker(10500)}'), findsOneWidget);
    expect(find.text(Won.worker(52500)), findsOneWidget);
    expect(find.text('Mapo-gu, Sinchon-ro 12-gil, 2-qavat'), findsOneWidget);
    expect(find.text('1,2 km · piyoda 15 daqiqa'), findsOneWidget);

    // Confirmation sheet.
    await tester.tap(find.text('Smenani olish'));
    await tester.pumpAndSettle();
    expect(find.text('Smenani olasizmi?'), findsOneWidget);
    expect(find.text("Tasdiqlaganingizdan so'ng smena sizga biriktiriladi."), findsOneWidget);
    expect(find.text('Mapo-gu, Sinchon-ro 12-gil'), findsOneWidget);
    expect(
      find.text('Smena 2 soat 40 daqiqadan keyin boshlanadi. Bekor qilsangiz, ishonchlilik balingiz pasayadi.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Tasdiqlash'));
    await tester.pumpAndSettle();

    // A05 «Smena olindi!».
    expect(find.text('Smena olindi!'), findsOneWidget);
    expect(find.text('Dalbit Kafe sizni bugun 14:00 da kutadi. Smena oldidan eslatma yuboramiz.'), findsOneWidget);
    expect(find.text('Ishga kirishda joyidagi QR kodni skanerlang'), findsOneWidget);
    final shift = await container.read(shiftRepositoryProvider).shift('demo-1');
    expect(shift!.myStatus, ApplicationStatus.confirmed);
    expect(shift.slotsLeft, 1);

    await tester.tap(find.text('Lentaga qaytish'));
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
    // The card now shows one place left and «Olish» is off.
    expect(find.text('1 joy qoldi'), findsWidgets);
    final card = tester.widget<ShiftCard>(find.byType(ShiftCard).first);
    expect(card.shift.id, 'demo-1');
    expect(card.shift.myStatus, ApplicationStatus.confirmed);
  });

  testWidgets('«Olish» on a card of a hand-confirmed shift sends a request', (tester) async {
    await start(tester);
    // Ttukbaegi Sikdang (17:00) confirms applications by hand.
    final card = find.ancestor(of: find.text('Ttukbaegi Sikdang'), matching: find.byType(ShiftCard));
    await tester.tap(find.descendant(of: card, matching: find.text('Olish')));
    await tester.pumpAndSettle();
    expect(find.text("Tasdiqlaganingizdan so'ng ariza ish beruvchiga yuboriladi."), findsOneWidget);
    await tester.tap(find.text('Tasdiqlash'));
    await tester.pumpAndSettle();
    expect(find.text('Ariza yuborildi!'), findsOneWidget);
    expect(find.text('Ttukbaegi Sikdang tasdiqlashi bilan xabar beramiz.'), findsOneWidget);
  });

  testWidgets('«Orqaga» closes the sheet without applying', (tester) async {
    final container = await start(tester);
    await tester.tap(find.text('Olish').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Orqaga'));
    await tester.pumpAndSettle();
    expect(find.text('Smenani olasizmi?'), findsNothing);
    final shift = await container.read(shiftRepositoryProvider).shift('demo-1');
    expect(shift!.myStatus, isNull);
  });

  testWidgets('a refusal closes the sheet and says why', (tester) async {
    await start(tester, repository: RefusingShiftRepository('SHIFT_FULL'));
    await tester.tap(find.text('Olish').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tasdiqlash'));
    await tester.pumpAndSettle();
    expect(find.text('Smenani olasizmi?'), findsNothing);
    expect(find.text("Afsuski, bo'sh joy qolmadi."), findsOneWidget);
  });

  testWidgets('offline, then «Qayta urinish» loads the feed', (tester) async {
    await start(tester, repository: FlakyShiftRepository(failures: 1));
    expect(find.text("Internet aloqasi yo'q"), findsOneWidget);
    expect(find.text('Oflayn rejim'), findsOneWidget);
    await tester.tap(find.text('Qayta urinish'));
    await tester.pumpAndSettle();
    expect(find.text("Internet aloqasi yo'q"), findsNothing);
    expect(find.text('· 12 ta smena'), findsOneWidget);
  });

  testWidgets('distance filter: 1 km leaves nothing nearby', (tester) async {
    final container = await start(tester);
    await tester.tap(find.text('Masofa: 3 km'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Masofa: 1 km'));
    await tester.pumpAndSettle();
    expect(container.read(feedFilterProvider).radiusKm, 1);
    expect(find.text("Yaqin atrofda smena yo'q"), findsOneWidget);
    expect(find.text('· 0 ta smena'), findsOneWidget);

    // Pay filter: 13 000 ₩+ (shown on the chip).
    await tester.tap(find.text('Maosh'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('${Won.worker(13000)}+'));
    await tester.pumpAndSettle();
    expect(find.text('Maosh: ${Won.worker(13000)}+'), findsOneWidget);
  });

  testWidgets('day tabs: tomorrow has 4 shifts', (tester) async {
    await start(tester);
    await tester.tap(find.text('Ertaga'));
    await tester.pumpAndSettle();
    expect(find.text('· 4 ta smena'), findsOneWidget);
    expect(find.textContaining('Ertaga ·'), findsWidgets);
  });

  testWidgets('map: Dalbit is selected; another pin switches the card; tapping it again opens it', (tester) async {
    await start(tester, location: WorkerRoutes.map);
    expect(find.byType(WorkerMapScreen), findsOneWidget);
    var card = tester.widget<ShiftCard>(find.byType(ShiftCard));
    expect(card.shift.business.id, 'demo-dalbit');

    await tester.tap(find.text(Won.worker(12000)));
    await tester.pumpAndSettle();
    card = tester.widget<ShiftCard>(find.byType(ShiftCard));
    expect(card.shift.business.id, 'demo-sangam');

    await tester.tap(find.text(Won.worker(12000)).first);
    await tester.pumpAndSettle();
    expect(find.byType(ShiftDetailScreen), findsOneWidget);
    expect(find.text('Yuk saralash'), findsOneWidget);
  });

  testWidgets('bottom menu and list / map switch', (tester) async {
    await start(tester);
    await tester.tap(find.text('Xarita').last);
    await tester.pumpAndSettle();
    expect(find.byType(WorkerMapScreen), findsOneWidget);
    await tester.tap(find.bySemanticsLabel("Ro'yxat"));
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Xarita').first);
    await tester.pumpAndSettle();
    expect(find.byType(WorkerMapScreen), findsOneWidget);
    await tester.tap(find.text('Smenalar').last);
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
  });

  testWidgets('the detail page of a full or taken shift cannot be taken again', (tester) async {
    final container = await start(tester, location: WorkerRoutes.shift('demo-1'));
    await container.read(shiftRepositoryProvider).apply('demo-1');
    container.invalidate(shiftDetailProvider('demo-1'));
    await tester.pumpAndSettle();
    expect(button(tester, 'Smenani olish').onPressed, isNull);
  });

  testWidgets('an unknown shift shows «Smena topilmadi»', (tester) async {
    await start(tester, location: WorkerRoutes.shift('nope'));
    expect(find.text('Smena topilmadi'), findsOneWidget);
    await tester.tap(find.text('Lentaga qaytish'));
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
  });

  testWidgets('the bell opens notifications', (tester) async {
    await start(tester);
    await tester.tap(find.bySemanticsLabel('Bildirishnomalar, 2 ta yangi'));
    await tester.pumpAndSettle();
    expect(find.text('Bildirishnomalar'), findsOneWidget);
    await tester.tap(find.byType(HiBackButton));
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
  });
}

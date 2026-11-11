// A03 filters the feed tests did not reach: «Soha» and «Vaqt» (the
// multi-choice sheet), «Barcha filtrlar», and a feed that failed for a reason
// other than the connection.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/widgets/navigation.dart';
import 'package:hanguk_ish/features/worker/feed/feed_controller.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// A feed that fails [failures] times with a server error (not offline).
class _BrokenFeed extends DemoShiftRepository {
  _BrokenFeed({this.failures = 1}) : super(now: prototypeNow);

  int failures;

  @override
  Future<List<ShiftListing>> feed(FeedQuery query) async {
    if (failures > 0) {
      failures--;
      throw Exception('500');
    }
    return super.feed(query);
  }
}

void main() {
  setUpAll(loadHiFonts);

  Future<ProviderContainer> start(WidgetTester tester, {ShiftRepository? repository}) async {
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.feed, repository: repository);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  /// Taps [label] in the chip row (it scrolls sideways).
  Future<void> chip(WidgetTester tester, String label) async {
    final found = find.descendant(of: find.byType(HiFilterChip), matching: find.text(label));
    await tester.ensureVisible(found);
    await tester.pumpAndSettle();
    await tester.tap(found);
    await tester.pumpAndSettle();
  }

  /// [label] in the sheet on top (the chips and cards behind can say the
  /// same: a card's «Kafe» pill).
  Finder sheet(String label) => find.descendant(of: find.byType(BottomSheet).last, matching: find.text(label));

  Future<void> inSheet(WidgetTester tester, String label) async {
    await tester.tap(sheet(label));
    await tester.pumpAndSettle();
  }

  testWidgets('«Soha»: only cafés, then «Tozalash» brings every shift back', (tester) async {
    final container = await start(tester);
    expect(find.text('· 12 ta smena'), findsOneWidget);

    await chip(tester, 'Soha');
    // The sheet lists the seven fields; nothing is chosen yet.
    for (final label in ['Kafe', 'Restoran', "Do'kon", 'Logistika', 'Tadbir', 'Ofis', 'Boshqa']) {
      expect(sheet(label), findsOneWidget, reason: label);
    }
    await inSheet(tester, 'Kafe');
    await inSheet(tester, "Qo'llash");
    expect(container.read(feedFilterProvider).categories, {BusinessCategory.cafe});
    // Today within 3 km: Dalbit (14:00), Yeonnam (13:00 and 20:00).
    expect(find.text('· 3 ta smena'), findsOneWidget);
    expect(find.text('Dalbit Kafe'), findsWidgets);
    expect(find.text('Ttukbaegi Sikdang'), findsNothing);
    expect(tester.widget<HiFilterChip>(find.widgetWithText(HiFilterChip, 'Soha')).active, isTrue);

    // Opened again it remembers the choice; «Tozalash» clears it.
    await chip(tester, 'Soha');
    await inSheet(tester, 'Tozalash');
    expect(container.read(feedFilterProvider).categories, isEmpty);
    expect(find.text('· 12 ta smena'), findsOneWidget);
    expect(tester.widget<HiFilterChip>(find.widgetWithText(HiFilterChip, 'Soha')).active, isFalse);
  });

  testWidgets('«Vaqt»: the evening, and the evening at cafés', (tester) async {
    final container = await start(tester);
    await chip(tester, 'Vaqt');
    for (final label in ['Ertalab 06–12', 'Kunduzi 12–18', 'Kechqurun 18–24', 'Tunda 00–06']) {
      expect(sheet(label), findsOneWidget, reason: label);
    }
    await inSheet(tester, 'Kechqurun 18–24');
    await inSheet(tester, "Qo'llash");
    expect(container.read(feedFilterProvider).dayParts, {2});
    // 18:00 Sangam, 19:00 Bom Mart, 20:00 Yeonnam, 21:00 Nanum and Sangam.
    expect(find.text('· 5 ta smena'), findsOneWidget);

    await chip(tester, 'Soha');
    await inSheet(tester, 'Kafe');
    await inSheet(tester, "Qo'llash");
    expect(find.text('· 1 ta smena'), findsOneWidget);
    expect(find.text('Kechki tozalash'), findsOneWidget);
  });

  testWidgets('«Barcha filtrlar» offers the four filters; each opens its own sheet', (tester) async {
    final container = await start(tester);
    Future<void> openAll() async {
      await tester.tap(find.byType(HiFilterAllButton));
      await tester.pumpAndSettle();
    }

    await openAll();
    for (final label in ['Maosh', 'Masofa', 'Soha', 'Vaqt']) {
      expect(sheet(label), findsOneWidget, reason: label);
    }
    await inSheet(tester, 'Masofa');
    await inSheet(tester, "Farqi yo'q");
    expect(container.read(feedFilterProvider).radiusKm, isNull);

    await openAll();
    await inSheet(tester, 'Vaqt');
    await inSheet(tester, 'Ertalab 06–12');
    await inSheet(tester, "Qo'llash");
    expect(container.read(feedFilterProvider).dayParts, {0});
    // Nothing starts before noon today: the empty state offers the filters.
    expect(find.text("Yaqin atrofda smena yo'q"), findsOneWidget);
    await tester.tap(find.text("Filtrni o'zgartirish"));
    await tester.pumpAndSettle();
    expect(sheet('Soha'), findsOneWidget);

    // Closing the sheet without a choice changes nothing.
    await tester.tapAt(const Offset(20, 60));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);
    expect(container.read(feedFilterProvider).dayParts, {0});
  });

  testWidgets('a server error (not the connection) says so; «Qayta urinish» loads the feed', (tester) async {
    await start(tester, repository: _BrokenFeed());
    expect(find.text("Xatolik yuz berdi. Qayta urinib ko'ring."), findsOneWidget);
    expect(find.text("Internet aloqasi yo'q"), findsNothing);
    expect(find.text('· 12 ta smena'), findsNothing);
    await tester.tap(find.text('Qayta urinish'));
    await tester.pumpAndSettle();
    expect(find.text("Xatolik yuz berdi. Qayta urinib ko'ring."), findsNothing);
    expect(find.text('· 12 ta smena'), findsOneWidget);
  });
}

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/money/won.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// After a finished shift: «Maosh to'landimi?» — the worker says what was
/// paid, and the amount counts in A09 «Daromad» at once.
void main() {
  setUpAll(loadHiFonts);

  // demo-app-past-5: Sangam Logistika, 6 h × 12 000 = 72 000, not paid yet.
  const app = 'demo-app-past-5';

  Future<ProviderContainer> open(WidgetTester tester) async {
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.result(app));
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('A07: «Paid in full» → what was owed counts as received', (tester) async {
    final container = await open(tester);
    expect(find.text('Kutilmoqda'), findsOneWidget);
    await tester.tap(find.text('Maoshni tasdiqlash'));
    await tester.pumpAndSettle();
    expect(find.text("Maosh to'landimi?"), findsOneWidget);
    expect(find.text('Hisoblangan maosh: ${Won.worker(72000)}'), findsOneWidget);
    await tester.tap(find.text("To'liq oldim"));
    await tester.pumpAndSettle();
    final saved = await container.read(shiftRepositoryProvider).myShift(app);
    expect(saved!.receivedAmount, 72000);
    expect(saved.isPaid, isTrue);
    expect(saved.paidLess, isFalse);
    expect(find.text("To'landi"), findsOneWidget);
    expect(find.text('Siz ${Won.worker(72000)} oldingiz'), findsOneWidget);
  });

  testWidgets('A07: «Paid less» with an amount → saved, marked, and A09 counts it', (tester) async {
    final container = await open(tester);
    await tester.tap(find.text('Maoshni tasdiqlash'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kamroq oldim'));
    await tester.pumpAndSettle();
    expect(find.text('Saqlash'), findsOneWidget);
    // More than it came to is refused.
    await tester.enterText(find.byType(TextField), '90000');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Saqlash'));
    await tester.pumpAndSettle();
    expect(find.textContaining("ko'p bo'lmasin"), findsOneWidget);
    expect((await container.read(shiftRepositoryProvider).myShift(app))!.receivedAmount, isNull);

    await tester.enterText(find.byType(TextField), '60000');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Saqlash'));
    await tester.pumpAndSettle();
    final saved = (await container.read(shiftRepositoryProvider).myShift(app))!;
    expect(saved.receivedAmount, 60000);
    expect(saved.paidLess, isTrue);
    expect(find.text("Kam to'langan"), findsOneWidget);
    expect(find.text('Siz ${Won.worker(60000)} oldingiz'), findsOneWidget);
    expect(find.text("Maosh daromadingizga qo'shildi"), findsOneWidget);
  });

  test('what the worker received is what A09 counts as paid', () async {
    final repo = DemoShiftRepository(now: prototypeNow);
    final before = (await repo.myShift('demo-app-past-5'))!;
    expect(before.received, 0, reason: 'the business has not marked it paid');
    final after = await repo.confirmPayment('demo-app-past-5', 50000);
    expect(after.received, 50000);
    expect(after.paidLess, isTrue);
    expect(() => repo.confirmPayment('nope', 1), throwsA(isA<ShiftActionException>()));
    expect(() => repo.confirmPayment('demo-app-past-5', -1), throwsA(isA<ShiftActionException>()));
  });
}

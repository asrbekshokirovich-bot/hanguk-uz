import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/features/worker/coins/bank_topup_screen.dart';

import '../../helpers/worker_harness.dart';

void main() {
  testWidgets('bank transfer (web / mini app): a pack, the account and code, «Pul o\'tkazdim», the order', (tester) async {
    final container = workerContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(workerHarness(container, BankTopupScreen(onBack: () {})));
    await tester.pumpAndSettle();

    // 1. The packs, with their won prices (only here).
    expect(find.text('1. Paketni tanlang'), findsOneWidget);
    expect(find.text('₩3,300'), findsOneWidget);
    await tester.tap(find.text('300 P'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Davom etish'), 200, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // 2. The account from the staff's settings, the amount and the code.
    expect(find.text('2. Pulni o\'tkazing'), findsOneWidget);
    expect(find.text('000-000000-00000'), findsOneWidget);
    expect(find.text('김민수'), findsOneWidget);
    expect(find.text('₩24,000'), findsWidgets);
    expect(find.textContaining(RegExp(r'^HP')), findsWidgets);

    // 3. «Pul o'tkazdim»: waiting for the staff; the order is in the list.
    await tester.scrollUntilVisible(find.text("Pul o'tkazdim"), 200, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text("Pul o'tkazdim"));
    await tester.pumpAndSettle();
    expect(find.textContaining('Tekshirilmoqda'), findsWidgets);
    await tester.scrollUntilVisible(find.text('Buyurtmalarim'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('300 P · ₩24,000'), findsOneWidget);
  });
}

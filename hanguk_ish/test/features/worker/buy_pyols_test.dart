import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/features/worker/coins/buy_pyols.dart';

import '../../helpers/worker_harness.dart';

void main() {
  testWidgets('«Puyl olish»: no payment details or links (store rules), only puyl and the invite code',
      (tester) async {
    final container = workerContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(workerHarness(
      container,
      Scaffold(body: Builder(builder: (context) => TextButton(onPressed: () => showBuyPyolsSheet(context), child: const Text('open')))),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Puyl olish'), findsOneWidget);
    expect(find.textContaining('DEMO01'), findsOneWidget);
    for (final banned in ['Demo Bank', 'KakaoPay', 'Toss', 'Bank', 'http', 't.me', 'Telegram']) {
      expect(find.textContaining(banned), findsNothing, reason: banned);
    }
  });

  testWidgets('«Puyl olish»: the store packs; a purchase adds the puyl', (tester) async {
    final container = workerContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(workerHarness(
      container,
      Scaffold(body: Builder(builder: (context) => TextButton(onPressed: () => showBuyPyolsSheet(context), child: const Text('open')))),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('30 P — ₩3,300'), findsOneWidget);
    expect(find.text('300 P — ₩24,000'), findsOneWidget);
    await tester.tap(find.text('100 P — ₩9,900'));
    await tester.pumpAndSettle();
    expect(find.textContaining("+100 P qo'shildi"), findsOneWidget);
  });
}

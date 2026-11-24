import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/repositories/pyol_repository.dart';
import 'package:hanguk_ish/features/worker/me/free_dates.dart';

import '../../helpers/worker_harness.dart';

void main() {
  testWidgets('«Bo\'sh kunlarim»: a day asks day/night/any, and saving asks to confirm', (tester) async {
    final repo = DemoPyolRepository();
    final container = workerContainer(overrides: [pyolRepositoryProvider.overrideWithValue(repo)]);
    addTearDown(container.dispose);
    await tester.pumpWidget(workerHarness(
      container,
      Scaffold(body: Builder(builder: (context) => TextButton(onPressed: () => showFreeDatesSheet(context), child: const Text('open')))),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // One tap is not a choice: a small sheet asks what the worker means.
    await tester.tap(find.byType(FilterChip).at(1));
    await tester.pumpAndSettle();
    expect(find.text("Bo'sh emasman"), findsOneWidget);
    await tester.tap(find.text('Tun'));
    await tester.pumpAndSettle();
    expect(find.textContaining('· Tun'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Ansan');
    await tester.tap(find.text('Saqlash'));
    await tester.pumpAndSettle();
    // The check: nothing is saved until «Ha, saqlash».
    expect(find.text("To'g'rimi?"), findsOneWidget);
    expect(find.textContaining('Shahar: Ansan'), findsOneWidget);
    await tester.tap(find.text('Orqaga'));
    await tester.pumpAndSettle();
    expect(await repo.freeDates(), isEmpty);

    await tester.tap(find.text('Saqlash'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ha, saqlash'));
    await tester.pumpAndSettle();
    final saved = await repo.freeDates();
    expect(saved, hasLength(1));
    expect(saved.single.part, 'night');
    expect(saved.single.district, 'Ansan');
  });
}

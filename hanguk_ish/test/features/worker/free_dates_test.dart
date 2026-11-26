import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/repositories/pyol_repository.dart';
import 'package:hanguk_ish/features/worker/me/free_dates.dart';

import '../../helpers/worker_harness.dart';

void main() {
  testWidgets('«Bo\'sh kunlarim»: a day asks «Are you really free?» before it is marked', (tester) async {
    final repo = DemoPyolRepository();
    final container = workerContainer(overrides: [pyolRepositoryProvider.overrideWithValue(repo)]);
    addTearDown(container.dispose);
    await tester.pumpWidget(workerHarness(
      container,
      Scaffold(body: Builder(builder: (context) => TextButton(onPressed: () => showFreeDatesSheet(context), child: const Text('open')))),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // A tap asks «Are you really free?»; «No» marks nothing.
    await tester.tap(find.byType(FilterChip).at(1));
    await tester.pumpAndSettle();
    expect(find.text("Rostdan bo'shmisiz?"), findsOneWidget);
    await tester.tap(find.text("Yo'q"));
    await tester.pumpAndSettle();
    expect(tester.widget<FilterChip>(find.byType(FilterChip).at(1)).selected, isFalse);

    await tester.tap(find.byType(FilterChip).at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Ha, bo'shman"));
    await tester.pumpAndSettle();
    // Then: which time and what matters most (no preference unless chosen).
    expect(find.text("Siz uchun eng muhimi?"), findsOneWidget);
    await tester.tap(find.text('Tayyor'));
    await tester.pumpAndSettle();
    expect(tester.widget<FilterChip>(find.byType(FilterChip).at(1)).selected, isTrue);

    // A second tap takes it off at once; a third asks again.
    await tester.tap(find.byType(FilterChip).at(1));
    await tester.pumpAndSettle();
    expect(find.text("Rostdan bo'shmisiz?"), findsNothing);
    expect(tester.widget<FilterChip>(find.byType(FilterChip).at(1)).selected, isFalse);
    await tester.tap(find.byType(FilterChip).at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Ha, bo'shman"));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kechasi (야간)'));
    await tester.tap(find.text("Ko'proq pul"));
    await tester.pump();
    await tester.ensureVisible(find.text('Tayyor'));
    await tester.tap(find.text('Tayyor'));
    await tester.pumpAndSettle();
    expect(find.text("Kechasi (야간) · Ko'proq pul"), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Ansan');
    await tester.ensureVisible(find.text('Saqlash'));
    await tester.tap(find.text('Saqlash'));
    await tester.pumpAndSettle();
    final saved = await repo.freeDates();
    expect(saved, hasLength(1));
    expect(saved.single.part, 'night');
    expect(saved.single.priority, 'pay');
    expect(saved.single.district, 'Ansan');
  });
}

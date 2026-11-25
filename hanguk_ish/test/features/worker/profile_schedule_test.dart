import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// «Qachon ishlay olaman» on the Profil: under the puyl, three parts of the
/// day; a tap and a preset are saved a moment after the last change.
void main() {
  setUpAll(loadHiFonts);

  testWidgets('Profil: the grid sits under the puyl, counts the cells and saves', (tester) async {
    usePhone(tester);
    final repo = InMemoryWorkerProfileRepository();
    final container = appContainer(
      location: WorkerRoutes.me,
      overrides: [workerProfileRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();

    final grid = tester.getTopLeft(find.text('Qachon ishlay olaman')).dy;
    final coins = tester.getTopLeft(find.text('Puyl balansi')).dy;
    expect(grid, greaterThan(coins), reason: 'under the puyl');
    // The prototype profile: 10 of the 14 cells (its mornings are not shown).
    expect(find.text('Haftasiga 10 ta vaqt'), findsOneWidget);
    for (final row in ['Kunduzi', 'Kechqurun']) {
      expect(find.text(row), findsOneWidget, reason: row);
    }
    expect(find.text('Ertalab'), findsNothing, reason: 'two parts of the day');
    expect(find.text('18–23'), findsNothing, reason: 'no hours');

    final before = container.read(workerProfileDraftProvider).isAvailable(6, 2);
    await tester.ensureVisible(find.bySemanticsLabel('Yakshanba, Kechqurun'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Yakshanba, Kechqurun'));
    await tester.pumpAndSettle();
    if (before) {
      expect(find.text("Rostdan bo'shmisiz?"), findsNothing, reason: 'taking a time off asks nothing');
    } else {
      // Marking a time free asks first.
      expect(find.text("Rostdan bo'shmisiz?"), findsOneWidget);
      await tester.tap(find.text("Ha, bo'shman"));
      await tester.pumpAndSettle();
    }
    await tester.pump(const Duration(seconds: 2));
    expect(container.read(workerProfileDraftProvider).isAvailable(6, 2), isNot(before));
    expect((await repo.load())!.isAvailable(6, 2), isNot(before));

    await tester.ensureVisible(find.text('Har kuni kechqurun'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Har kuni kechqurun'));
    await tester.pumpAndSettle();
    // «No» keeps the grid as it was.
    expect(find.text("Rostdan bo'shmisiz?"), findsOneWidget);
    expect(find.textContaining('Har kuni kechqurun\n'), findsOneWidget);
    await tester.tap(find.text("Yo'q"));
    await tester.pumpAndSettle();
    expect(find.text('Haftasiga 7 ta vaqt'), findsNothing);
    await tester.tap(find.text('Har kuni kechqurun'));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Ha, bo'shman"));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Haftasiga 7 ta vaqt'), findsOneWidget);
    final saved = (await repo.load())!;
    for (var d = 0; d < 7; d++) {
      expect(saved.isAvailable(d, 2), isTrue);
      expect(saved.isAvailable(d, 0), isFalse);
    }
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// The free-time grid is on the profile too (below the numbers, above the
/// languages), and a change is saved a moment after the last tap.
void main() {
  setUpAll(loadHiFonts);

  testWidgets('A11: the free-time grid sits between the numbers and the languages and saves', (tester) async {
    usePhone(tester);
    final repo = InMemoryWorkerProfileRepository();
    final container = appContainer(
      location: WorkerRoutes.me,
      overrides: [workerProfileRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();

    final numbers = tester.getTopLeft(find.text('Bajarilgan smenalar')).dy;
    // The coins card comes between: the grid is below the first screen.
    await tester.scrollUntilVisible(find.text("Bo'sh vaqt jadvali"), 200);
    final grid = tester.getTopLeft(find.text("Bo'sh vaqt jadvali")).dy;
    final coins = tester.getTopLeft(find.text('Puyl balansi')).dy;
    expect(grid, greaterThan(coins), reason: 'under reliability, completed shifts, ratings and the coins');
    expect(numbers, greaterThan(0));

    await tester.scrollUntilVisible(find.bySemanticsLabel('Yakshanba, Tunda'), 200);
    await tester.ensureVisible(find.bySemanticsLabel('Yakshanba, Tunda'));
    await tester.pumpAndSettle();
    final before = container.read(workerProfileDraftProvider).isAvailable(6, 3);
    await tester.tap(find.bySemanticsLabel('Yakshanba, Tunda'));
    await tester.pump(const Duration(seconds: 2));
    expect(container.read(workerProfileDraftProvider).isAvailable(6, 3), isNot(before));
    final saved = await repo.load();
    expect(saved, isNotNull);
    expect(saved!.isAvailable(6, 3), isNot(before));
  });
}

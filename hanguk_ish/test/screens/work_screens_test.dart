@Tags(['screens'])
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';
import 'package:hanguk_ish/l10n/gen/worker_l10n.dart';

import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

String _name(String screen, AppLanguage language) =>
    language == AppLanguage.uz ? screen : '$screen.${language.code}';

String _qr(String shiftId) => ShiftQr(shiftId, DemoShiftRepository.qrToken).payload;

/// A06 (my shifts), A07 (entry QR, at work, exit QR, result), A08 (rating)
/// at the prototype's moments of 10 November.
void main() {
  setUpAll(loadHiFonts);

  Future<void> open(WidgetTester tester, ProviderContainer container) async {
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
  }

  for (final language in AppLanguage.values) {
    testWidgets('A06-Mening-smenalarim — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      await repo.apply('demo-1');
      await repo.apply('demo-13');
      final container = appContainer(language: language, location: WorkerRoutes.myShifts, repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A06-Mening-smenalarim', language));
    });

    testWidgets('A07-QR-kirish — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      final app = await repo.apply('demo-1');
      clock.at(13, 56);
      final container = appContainer(language: language, location: WorkerRoutes.checkIn(app.applicationId), repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A07-QR-kirish', language));
    });

    testWidgets('A07-Ishdasiz — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      final app = await repo.apply('demo-1');
      clock.at(14);
      await repo.checkIn(_qr('demo-1'));
      clock.at(16, 14, 37);
      final container = appContainer(language: language, location: WorkerRoutes.atWork(app.applicationId), repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A07-Ishdasiz', language));
    });

    testWidgets('A07-QR-chiqish — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      final app = await repo.apply('demo-1');
      clock.at(14);
      await repo.checkIn(_qr('demo-1'));
      clock.at(18, 59, 12);
      final container = appContainer(language: language, location: WorkerRoutes.checkOut(app.applicationId), repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A07-QR-chiqish', language));
    });

    testWidgets('A07-Natija — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      final app = await repo.apply('demo-1');
      clock.at(14);
      await repo.checkIn(_qr('demo-1'));
      clock.at(19);
      await repo.checkOut(_qr('demo-1'));
      final container = appContainer(language: language, location: WorkerRoutes.result(app.applicationId), repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A07-Natija', language));
    });

    testWidgets('A08-Baho — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      final app = await repo.apply('demo-1');
      clock.at(14);
      await repo.checkIn(_qr('demo-1'));
      clock.at(19);
      await repo.checkOut(_qr('demo-1'));
      final container = appContainer(language: language, location: WorkerRoutes.rate(app.applicationId), repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      final l10n = lookupWorkerL10n(language.locale);
      await tester.tap(find.bySemanticsLabel(l10n.starLabel(5)));
      for (final tag in [l10n.tagOnTime, l10n.tagPolite, l10n.tagExplainedWell, l10n.tagWouldReturn]) {
        await tester.tap(find.text(tag));
      }
      await tester.pumpAndSettle();
      await expectScreen(tester, _name('A08-Baho', language));
    });
  }

  testWidgets('A06 — completed tab', (tester) async {
    usePhone(tester);
    final clock = TestClock(prototypeNow);
    final container = appContainer(location: WorkerRoutes.myShifts, repository: demoRepository(clock), clock: clock.call);
    addTearDown(container.dispose);
    await open(tester, container);
    await tester.tap(find.text('Bajarilgan'));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'A06-Mening-smenalarim.done');
  });

  testWidgets('A06 — nothing upcoming', (tester) async {
    usePhone(tester);
    final clock = TestClock(prototypeNow);
    final container = appContainer(location: WorkerRoutes.myShifts, repository: demoRepository(clock, history: false), clock: clock.call);
    addTearDown(container.dispose);
    await open(tester, container);
    await expectScreen(tester, 'A06-Mening-smenalarim.empty');
  });
}

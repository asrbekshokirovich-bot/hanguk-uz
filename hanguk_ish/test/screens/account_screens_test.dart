@Tags(['screens'])
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

String _name(String screen, AppLanguage language) =>
    language == AppLanguage.uz ? screen : '$screen.${language.code}';

String _qr(String shiftId) => ShiftQr(shiftId, DemoShiftRepository.qrToken).payload;

/// A09 (earnings), A10 (chat), A11 (profile), A12 (notifications).
void main() {
  setUpAll(loadHiFonts);

  Future<void> open(WidgetTester tester, ProviderContainer container) async {
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
  }

  for (final language in AppLanguage.values) {
    testWidgets('A09-Daromad — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      await repo.apply('demo-1');
      clock.at(14);
      await repo.checkIn(_qr('demo-1'));
      clock.at(19);
      await repo.checkOut(_qr('demo-1'));
      clock.at(20);
      final container = appContainer(language: language, location: WorkerRoutes.earnings, repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A09-Daromad', language));
    });

    testWidgets('A10-Chat — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      final app = await repo.apply('demo-1');
      clock.at(11, 30);
      final container = appContainer(language: language, location: WorkerRoutes.chat(app.applicationId), repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A10-Chat', language));
    });

    testWidgets('A11-Profil — ${language.code}', (tester) async {
      usePhone(tester);
      final container = appContainer(language: language, location: WorkerRoutes.me);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A11-Profil', language));
    });

    testWidgets('A12-Bildirishnomalar — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow)..at(12, 30);
      final container = appContainer(language: language, location: WorkerRoutes.notifications, clock: clock.call);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A12-Bildirishnomalar', language));
    });

    // P40: with an offer from Hanguk's staff on top (not in the prototype).
    testWidgets('A12-Taklif — ${language.code}', (tester) async {
      usePhone(tester);
      final clock = TestClock(prototypeNow)..at(12, 35);
      final container = appContainer(
        language: language,
        location: WorkerRoutes.notifications,
        clock: clock.call,
        account: DemoAccountRepository(now: prototypeNow, offers: true),
        unread: 3,
      );
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A12-Taklif', language));
    });
  }
}

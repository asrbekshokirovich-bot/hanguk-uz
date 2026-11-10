@Tags(['screens'])
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/features/worker/feed/feed_controller.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';
import 'package:hanguk_ish/l10n/gen/worker_l10n.dart';

import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

/// The prototype's 390 px frame at the full height of the long detail page.
const _tall = TestPhone('tall', Size(390, 1390), top: 47, bottom: 34);

String _name(String screen, AppLanguage language) =>
    language == AppLanguage.uz ? screen : '$screen.${language.code}';

/// A03 (feed and its states), A04 (map), A05 (detail, confirmation,
/// success) with the prototype's sample data.
void main() {
  setUpAll(loadHiFonts);

  Future<void> open(WidgetTester tester, ProviderContainer container) async {
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
  }

  for (final language in AppLanguage.values) {
    testWidgets('Main (A03 feed) — ${language.code}', (tester) async {
      usePhone(tester);
      final container = appContainer(language: language);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('Main', language));
    });

    testWidgets('A04-Xarita — ${language.code}', (tester) async {
      usePhone(tester);
      final container = appContainer(language: language, location: WorkerRoutes.map);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A04-Xarita', language));
    });

    testWidgets('A05-Tafsilot — ${language.code}', (tester) async {
      usePhone(tester, _tall);
      final container = appContainer(language: language, location: WorkerRoutes.shift('demo-1'));
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A05-Tafsilot', language));
    });

    testWidgets('A05-Tasdiqlash — ${language.code}', (tester) async {
      usePhone(tester);
      final container = appContainer(language: language, location: WorkerRoutes.shift('demo-1'));
      addTearDown(container.dispose);
      await open(tester, container);
      final l10n = lookupWorkerL10n(language.locale);
      await tester.tap(find.text(l10n.takeShift));
      await tester.pumpAndSettle();
      await expectScreen(tester, _name('A05-Tasdiqlash', language));
    });

    testWidgets('A05-Olindi — ${language.code}', (tester) async {
      usePhone(tester);
      final container = appContainer(language: language, location: WorkerRoutes.taken('demo-1', pending: false));
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, _name('A05-Olindi', language));
    });
  }

  testWidgets('A03-Yuklanish', (tester) async {
    usePhone(tester);
    final container = appContainer(repository: HangingShiftRepository(), unread: 0);
    addTearDown(container.dispose);
    await open(tester, container);
    await expectScreen(tester, 'A03-Yuklanish');
  });

  testWidgets('A03-Bosh-lenta', (tester) async {
    usePhone(tester);
    final container = appContainer(unread: 0);
    addTearDown(container.dispose);
    container.read(feedFilterProvider.notifier).replace(const FeedFilter(minWage: 13000, radiusKm: 1));
    await open(tester, container);
    await expectScreen(tester, 'A03-Bosh-lenta');
  });

  testWidgets('A03-Internet-yoq', (tester) async {
    usePhone(tester);
    final container = appContainer(repository: FlakyShiftRepository(), unread: 0);
    addTearDown(container.dispose);
    await open(tester, container);
    await expectScreen(tester, 'A03-Internet-yoq');
  });

  testWidgets('A05-Olindi — pending application', (tester) async {
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.taken('demo-2', pending: true));
    addTearDown(container.dispose);
    await open(tester, container);
    await expectScreen(tester, 'A05-Olindi.pending');
  });

  for (final phone in [TestPhone.android, TestPhone.small]) {
    testWidgets('Main — ${phone.name}', (tester) async {
      usePhone(tester, phone);
      final container = appContainer();
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, 'Main.${phone.name}');
    });

    testWidgets('A04-Xarita — ${phone.name}', (tester) async {
      usePhone(tester, phone);
      final container = appContainer(location: WorkerRoutes.map);
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, 'A04-Xarita.${phone.name}');
    });

    testWidgets('A05-Tafsilot — ${phone.name}', (tester) async {
      usePhone(tester, phone);
      final container = appContainer(location: WorkerRoutes.shift('demo-1'));
      addTearDown(container.dispose);
      await open(tester, container);
      await expectScreen(tester, 'A05-Tafsilot.${phone.name}');
    });

    testWidgets('A05-Tasdiqlash — ${phone.name}', (tester) async {
      usePhone(tester, phone);
      final container = appContainer(location: WorkerRoutes.shift('demo-1'));
      addTearDown(container.dispose);
      await open(tester, container);
      await tester.tap(find.text('Smenani olish'));
      await tester.pumpAndSettle();
      await expectScreen(tester, 'A05-Tasdiqlash.${phone.name}');
    });
  }
}

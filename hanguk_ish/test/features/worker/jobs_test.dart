import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/backend/json.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/job_offer.dart';
import 'package:hanguk_ish/data/repositories/offer_repository.dart';
import 'package:hanguk_ish/features/worker/jobs/jobs_screens.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

void main() {
  setUpAll(loadHiFonts);

  Future<ProviderContainer> start(WidgetTester tester, {DemoAccountRepository? account}) async {
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.jobs, account: account);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  test('the price follows the pay (as unlock_price)', () {
    expect([160000, 150000, 120000, 110000, 90000, 80000, 60000, 50000, 49999, 0].map(unlockPrice),
        [20, 20, 16, 16, 13, 13, 10, 10, 7, 7]);
  });

  test('a job fits when all its hours are in the schedule; no schedule fits all', () {
    // Tuesday 10 November 2026, 18:00–23:00 in Seoul: evenings (slot 2).
    final start = Kst.instantOf(2026, 11, 10, 18, 0);
    final end = Kst.instantOf(2026, 11, 10, 23, 0);
    expect(fitsSchedule(0, start, end), isTrue);
    expect(fitsSchedule(WorkerProfileDraft.bit(1, 2), start, end), isTrue);
    expect(fitsSchedule(WorkerProfileDraft.bit(1, 1), start, end), isFalse);
    expect(fitsSchedule(WorkerProfileDraft.bit(1, 2), Kst.instantOf(2026, 11, 10, 16, 0), end), isFalse,
        reason: '16:00–18:00 is the afternoon');
  });

  test('my_offers and my_jobs rows become the models', () {
    final offer = jobOfferFromJson({
      'offer_id': 'o1',
      'shift_id': 's1',
      'status': 'sent',
      'expires_at': '2026-11-10T02:50:00+00:00',
      'title': '주방 보조',
      'translations': {
        'uz': {'title': 'Oshxona yordamchisi'},
      },
      'pay': 60000,
      'hourly_wage': 12000,
      'starts_at': '2026-11-10T09:00:00+00:00',
      'ends_at': '2026-11-10T14:00:00+00:00',
      'price': 10,
      'sent_count': 4,
      'slots': 3,
      'taken': 2,
      'checked_at': '2026-11-10T02:00:00+00:00',
      'note': '',
      'area': 'Mapo-gu',
      'address': '마포구 독막로 •••',
      'phone': '010-••••-••••',
      'distance_km': 1.2,
    });
    expect(offer.displayTitle('uz'), 'Oshxona yordamchisi');
    expect(offer.displayTitle('ko'), '주방 보조');
    expect(offer.price, 10);
    expect(offer.placesLeft, 1);
    expect(offer.liveAt(DateTime.utc(2026, 11, 10, 2, 40)), isTrue);
    expect(offer.liveAt(DateTime.utc(2026, 11, 10, 2, 50)), isFalse);
    expect(jobOfferFromJson({'status': 'closed', 'pay': 120000}).status, JobOfferStatus.closed);
    expect(jobOfferFromJson({'status': 'expired', 'pay': 120000}).price, 16, reason: 'no price: from the pay');

    final job = openedJobFromJson({
      'application_id': 'a1',
      'shift_id': 's1',
      'title': '주방 보조',
      'pay': 60000,
      'starts_at': '2026-11-10T09:00:00+00:00',
      'ends_at': '2026-11-10T14:00:00+00:00',
      'phone': '010-4821-7730',
      'address': '마포구 독막로 4, 1층',
      'step': 2,
      'price': 10,
      'stars': 5,
    });
    expect(job.step, JobStep.wentToWork);
    expect(job.stars, 5);
    expect(job.phone, '010-4821-7730');
  });

  testWidgets('three tabs; an offer counts down with the phone and address hidden; opening spends puyl',
      (tester) async {
    final container = await start(tester);
    expect(find.byType(OffersScreen), findsOneWidget);
    for (final tab in ['Ishlar', 'Mening ishlarim', 'Profil']) {
      expect(find.text(tab), findsWidgets, reason: tab);
    }
    expect(find.text('Smenalar'), findsNothing, reason: 'the old tabs are gone');
    expect(find.text('Xarita'), findsNothing);

    expect(find.text('100'), findsOneWidget, reason: 'the demo puyl');
    expect(find.text('Restoran oshxonasiga yordamchi'), findsOneWidget);
    expect(find.text('24:00'), findsOneWidget);
    expect(find.text('Faqat 4 kishiga yuborildi · 1 joy'), findsOneWidget);
    expect(find.text('60,000 won'), findsOneWidget);
    expect(find.text('010-••••-••••'), findsWidgets);
    expect(find.text('마포구 독막로 •••'), findsOneWidget);
    expect(find.text('Bugun 18:00–23:00 · 5 soatlik ish · 1,2 km'), findsOneWidget);

    await tester.tap(find.text('Telefon va manzilni ochish · 10 P').first);
    await tester.pumpAndSettle();
    expect(find.text('Ish sizga biriktiriladi — boshqalarga yopiladi'), findsOneWidget);
    expect(find.text('Balans: 100 P'), findsOneWidget);
    expect(find.text('Qoladi: 90 P'), findsOneWidget);
    await tester.tap(find.text('10 puyl bilan ochish'));
    await tester.pumpAndSettle();

    expect(find.text("Ochilgan ✓ · Mening ishlarim'da"), findsOneWidget);
    expect(find.text('Siz oldingiz — ish sizga biriktirildi'), findsOneWidget);
    expect(find.text('90'), findsOneWidget);
    final jobs = await container.read(offerRepositoryProvider).jobs();
    expect(jobs.single.price, 10);

    await tester.tap(find.text('Mening ishlarim').last);
    await tester.pumpAndSettle();
    expect(find.byType(OpenedJobsScreen), findsOneWidget);
    expect(find.text('1 ta ochilgan · 0 tasida ishladingiz'), findsOneWidget);
    expect(find.text('Restoran oshxonasiga yordamchi'), findsOneWidget);
    expect(find.text('010-4821-7730'), findsOneWidget);
    expect(find.text('Ish beruvchini baholang'), findsNothing, reason: 'only after «Ishga chiqdim»');

    await tester.tap(find.text('Ishga chiqdim'));
    await tester.pumpAndSettle();
    expect(find.text('1 ta ochilgan · 1 tasida ishladingiz'), findsOneWidget);
    expect(find.text('Ish beruvchini baholang'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('5 yulduz'));
    await tester.pumpAndSettle();
    expect((await container.read(offerRepositoryProvider).jobs()).single.stars, 5);
  });

  testWidgets('not enough puyl: the sheet says so and does not open', (tester) async {
    final account = DemoAccountRepository(now: prototypeNow)..wallet = const CoinWallet(balance: 5);
    final container = await start(tester, account: account);
    expect(find.text('5'), findsOneWidget);
    await tester.tap(find.text('Telefon va manzilni ochish · 10 P').first);
    await tester.pumpAndSettle();
    expect(find.text('Qoladi: -5 P'), findsOneWidget);
    expect(find.text('Puyl yetmaydi'), findsOneWidget);
    await tester.tap(find.text('Puyl yetmaydi'));
    await tester.pumpAndSettle();
    expect(await container.read(offerRepositoryProvider).jobs(), isEmpty);
  });

  testWidgets('the last 5 minutes say «Tez bo\'ling!»; past 30 minutes the offer is gone', (tester) async {
    var now = prototypeNow;
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.jobs, clock: () => now);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    // The third card (lists build what is on screen).
    await tester.scrollUntilVisible(find.text("Tez bo'ling! Taklif tugayapti"), 300,
        scrollable: find.byType(Scrollable).first);
    expect(find.text("Tez bo'ling! Taklif tugayapti"), findsOneWidget, reason: 'the warehouse job has 5 minutes');

    now = prototypeNow.add(const Duration(minutes: 31));
    container.invalidate(offersProvider);
    await tester.pumpAndSettle();
    expect(find.text('Telefon va manzilni ochish · 10 P'), findsNothing);
    expect(find.text("4 ta taklif vaqti tugadi va boshqa odamlarga o'tdi. Yangisi chiqsa — push keladi."), findsOneWidget);
  });
}

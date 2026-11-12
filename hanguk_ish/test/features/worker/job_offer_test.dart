// An offer from Hanguk's staff (hanguk.uz, P39–P40): A12 «Sizga ish taklif
// qilindi» with the staff's note, A05 with the offer card, «Qiziqmayman» and
// «Smenani olish» answering it. The job is for the invited only: not in the
// feed.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

const _job = 'demo-offer-1';

/// Turning the offer down fails: no connection.
class _OfflineDecline extends DemoShiftRepository {
  _OfflineDecline() : super(now: prototypeNow, offers: true);

  @override
  Future<void> declineOffer(String shiftId) async => throw const OfflineException();
}

void main() {
  setUpAll(loadHiFonts);

  Future<DemoShiftRepository> open(
    WidgetTester tester,
    String location, {
    AppLanguage language = AppLanguage.uz,
    DemoShiftRepository? repository,
  }) async {
    usePhone(tester);
    final shifts = repository ?? DemoShiftRepository(now: prototypeNow, offers: true);
    final container = appContainer(
      language: language,
      location: location,
      repository: shifts,
      account: DemoAccountRepository(now: prototypeNow, offers: true),
      unread: 3,
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return shifts;
  }

  // Without the word joiner that keeps «₩/soat» together; no-break spaces as spaces.
  String plain(String s) => s.replaceAll('\u2060', '').replaceAll('\u00A0', ' ');

  testWidgets('A12: the offer comes first, with the job and the staff\'s note, and leads to A05', (tester) async {
    await open(tester, WorkerRoutes.notifications);
    expect(find.text('Sizga ish taklif qilindi'), findsOneWidget);
    final text = tester
        .widgetList<Text>(find.byType(Text))
        .map((t) => plain(t.data ?? ''))
        .singleWhere((t) => t.startsWith('Sangam Logistika · ') && t.contains('Xodim izohi'));
    expect(text, contains('09:00–14:00 · 12 000 ₩/soat'));
    expect(text, endsWith('\nXodim izohi: $demoOfferNote'));

    await tester.tap(find.text("Ko'rish").first);
    await tester.pumpAndSettle();
    expect(find.text('Yuk ortish va tushirish'), findsOneWidget, reason: 'A05 of the offered job');
    expect(find.text('Sizga ish taklif qilindi'), findsOneWidget, reason: 'the offer card');
    expect(find.textContaining('Hanguk xodimi bu ishni siz uchun tanladi.'), findsOneWidget);
    expect(find.text('Xodim izohi: $demoOfferNote'), findsOneWidget);
    expect(find.text('Qiziqmayman'), findsOneWidget);
    expect(find.text('Smenani olish'), findsOneWidget);
  });

  testWidgets('A12: the offer reads in every app language', (tester) async {
    const titles = {
      AppLanguage.ru: 'Вам предложили работу',
      AppLanguage.en: "You've been offered a job",
      AppLanguage.ko: '근무 제안이 왔어요',
    };
    for (final MapEntry(key: language, value: title) in titles.entries) {
      await open(tester, WorkerRoutes.notifications, language: language);
      expect(find.text(title), findsOneWidget, reason: language.code);
      await tester.pumpWidget(const SizedBox());
    }
  });

  testWidgets('A05: «Qiziqmayman» turns the offer down; the job can still be taken', (tester) async {
    final shifts = await open(tester, WorkerRoutes.shift(_job));
    await tester.tap(find.text('Qiziqmayman'));
    await tester.pumpAndSettle();
    expect((await shifts.shift(_job))!.offer!.status, OfferStatus.declined);
    expect(find.text('Taklifni rad etgansiz'), findsOneWidget);
    expect(find.text("Fikringiz o'zgarsa, smenani hali ham olishingiz mumkin."), findsOneWidget);
    expect(find.text('Qiziqmayman'), findsNothing);
    expect(find.text('Sizga ish taklif qilindi'), findsNothing);

    await tester.tap(find.text('Smenani olish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tasdiqlash'));
    await tester.pumpAndSettle();
    expect(find.text('Ariza yuborildi!'), findsOneWidget, reason: 'the staff decide (no 자동 확정)');
    final job = (await shifts.shift(_job))!;
    expect(job.offer!.status, OfferStatus.applied);
    expect(job.myStatus, ApplicationStatus.pending);
  });

  testWidgets('A05: taking the offered job answers the offer; the card goes', (tester) async {
    final shifts = await open(tester, WorkerRoutes.shift(_job));
    await tester.tap(find.text('Smenani olish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tasdiqlash'));
    await tester.pumpAndSettle();
    expect(find.text('Ariza yuborildi!'), findsOneWidget);
    expect((await shifts.shift(_job))!.offer!.status, OfferStatus.applied);

    // A05 again: the job is taken, the offer answered.
    await tester.pumpWidget(const SizedBox());
    await open(tester, WorkerRoutes.shift(_job), repository: shifts);
    expect(find.text('Yuk ortish va tushirish'), findsOneWidget);
    expect(find.text('Sizga ish taklif qilindi'), findsNothing);
    expect(find.text('Qiziqmayman'), findsNothing);
  });

  testWidgets('A05: no connection while turning it down says so; the offer stays open', (tester) async {
    await open(tester, WorkerRoutes.shift(_job), repository: _OfflineDecline());
    await tester.tap(find.text('Qiziqmayman'));
    await tester.pumpAndSettle();
    expect(find.text("Internet aloqasi yo'q. Ulanishni tekshirib, qayta urinib ko'ring."), findsOneWidget);
    expect(find.text('Qiziqmayman'), findsOneWidget);
    expect(find.text('Sizga ish taklif qilindi'), findsOneWidget);
  });

  test('the offered job is for the invited only: not in the feed', () async {
    final shifts = DemoShiftRepository(now: prototypeNow, offers: true);
    final feed = await shifts.feed(FeedQuery(from: prototypeNow, to: prototypeNow.add(const Duration(days: 7))));
    expect(feed.map((s) => s.id), isNot(contains(_job)));
    expect((await shifts.shift(_job))!.offer!.status, OfferStatus.sent);
    expect(() => DemoShiftRepository(now: prototypeNow).declineOffer('demo-1'), throwsA(isA<ShiftActionException>()),
        reason: 'no offer to turn down');
  });

  test('the demo app has the offer; the prototype screens do not', () async {
    final app = await DemoAccountRepository(now: prototypeNow, offers: true).notifications();
    expect(app.first.kind, NotificationKind.jobOffer);
    expect(app.first.shiftId, _job);
    final prototype = await DemoAccountRepository(now: prototypeNow).notifications();
    expect(prototype.map((n) => n.kind), isNot(contains(NotificationKind.jobOffer)));
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/format/text.dart';
import 'package:hanguk_ish/core/money/won.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/features/worker/chat/chat_screen.dart';
import 'package:hanguk_ish/features/worker/feed/feed_screen.dart';
import 'package:hanguk_ish/features/worker/notifications/unread.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';
import 'package:hanguk_ish/design/widgets/forms.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

String _qr(String shiftId) => ShiftQr(shiftId, DemoShiftRepository.qrToken).payload;

void main() {
  setUpAll(loadHiFonts);

  testWidgets('earnings: November totals, last month empty, a row opens the result', (tester) async {
    usePhone(tester);
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    final app = await repo.apply('demo-1');
    clock.at(14);
    await repo.checkIn(_qr('demo-1'));
    clock.at(19);
    await repo.checkOut(_qr('demo-1'));
    final container = appContainer(location: WorkerRoutes.earnings, repository: repo, clock: clock.call);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();

    expect(find.text('Noyabr 2026'), findsOneWidget);
    expect(find.text("Noyabr bo'yicha jami"), findsOneWidget);
    expect(find.text(Won.worker(343500)), findsOneWidget);
    expect(find.text('6 smena · 30 soat'), findsOneWidget);
    expect(find.text(Won.worker(219000)), findsOneWidget);
    expect(find.text(Won.worker(124500)), findsOneWidget);
    expect(find.text('5 soat × ${Won.worker(10500)}'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Oldingi oy'));
    await tester.pumpAndSettle();
    expect(find.text('Oktabr 2026'), findsOneWidget);
    expect(find.text("Bu oyda bajarilgan smena yo'q"), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Keyingi oy'));
    await tester.pumpAndSettle();
    expect(find.text('Noyabr 2026'), findsOneWidget);

    await tester.tap(find.text('Dalbit Kafe').first);
    await tester.pumpAndSettle();
    expect(find.byType(ShiftResultScreen), findsOneWidget);
    expect(app, isNotNull);
  });

  testWidgets('chat: the welcome thread with translations; sending a message', (tester) async {
    usePhone(tester);
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock);
    final app = await repo.apply('demo-1');
    clock.at(11, 30);
    final container = appContainer(location: WorkerRoutes.chat(app.applicationId), repository: repo, clock: clock.call);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();

    expect(find.byType(ChatScreen), findsOneWidget);
    expect(find.text("Koreyscha xabarlar avtomatik o'zbekchaga tarjima qilinadi"), findsOneWidget);
    expect(find.text('Qora shim kiyib keling. Fartukni do\'konda beramiz.'), findsOneWidget);
    expect(find.text('Tarjima'), findsNWidgets(3));
    expect(find.text('11:24'), findsOneWidget);
    expect(find.text('11:28'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Rahmat, 13:50 da boraman');
    await tester.tap(find.bySemanticsLabel('Yuborish'));
    await tester.pumpAndSettle();
    expect(find.text('Rahmat, 13:50 da boraman'), findsOneWidget);
    expect(find.text('11:30'), findsOneWidget);
    final messages = await repo.messages(app.applicationId);
    expect(messages.last.fromMe, isTrue);
    expect(messages, hasLength(6));

    // The database keeps a message up to 2 000 characters: the field stops there.
    await tester.enterText(find.byType(TextField), 'm' * 2001);
    await tester.pump();
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, hasLength(2000));
  });

  testWidgets('profile: data, puyl, trust, edit, app language, report, help', (tester) async {
    usePhone(tester);
    final account = DemoAccountRepository(now: prototypeNow);
    final container = appContainer(location: WorkerRoutes.me, account: account);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();

    expect(find.text('Aziz K.'), findsOneWidget);
    expect(find.text('AK'), findsOneWidget);
    expect(find.text('Mapo-gu'), findsOneWidget);
    expect(find.text('Puyl balansi'), findsOneWidget);
    expect(find.text('100'), findsOneWidget);
    expect(find.text("+ To'ldirish"), findsOneWidget);

    // «Ishonch bali»: 98 is gold; the rows.
    await tester.scrollUntilVisible(find.text('Kelmay qoldi'), 300);
    await tester.ensureVisible(find.text('Kelmay qoldi'));
    await tester.pumpAndSettle();
    expect(find.text('98'), findsOneWidget);
    expect(find.text('Oltin daraja'), findsOneWidget);
    expect(find.text("Yangi ishlarni hammadan 30 daqiqa oldin ko'rasiz"), findsOneWidget);
    expect(find.text('24 ta'), findsOneWidget);
    expect(find.text('100%'), findsOneWidget);
    expect(find.text('4,9 ★'), findsOneWidget);
    expect(find.text('0 marta'), findsOneWidget);

    // «Profilni o'zgartirish»: the name, the home address, 3 km, TOPIK 5.
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 3000));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel("Profilni o'zgartirish"));
    await tester.pumpAndSettle();
    expect(find.text('Ism familiya'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'Aziz Karimov');
    await tester.enterText(find.byType(TextField).at(1), '마포구 신촌로 22');
    await tester.tap(find.text('3 km'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('TOPIK 4'), 300);
    await tester.ensureVisible(find.text('TOPIK 4'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('TOPIK 4'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('TOPIK 5'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Saqlash'));
    await tester.pumpAndSettle();
    final draft = container.read(workerProfileDraftProvider);
    expect(draft.topik, 5);
    expect(draft.maxKm, 3);
    expect(draft.homeAddress, '마포구 신촌로 22');
    expect(find.text('Saqlandi'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    // Help → report.
    await tester.scrollUntilVisible(find.text('Yordam'), 300);
    await tester.ensureVisible(find.text('Yordam'));
    await tester.pumpAndSettle();
    expect(find.text('3 km ›'), findsOneWidget);
    expect(find.text('마포구 신촌로 22 ›'), findsOneWidget);
    await tester.tap(find.text('Yordam'));
    await tester.pumpAndSettle();
    expect(find.text("Maoshni kim to'laydi?"), findsOneWidget);
    await tester.ensureVisible(find.text('Shikoyat qilish'));
    await tester.tap(find.text('Shikoyat qilish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Maosh'));
    await tester.enterText(find.byType(TextField).last, "Maosh hali to'lanmadi");
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yuborish'));
    await tester.pumpAndSettle();
    expect(find.text("Shikoyatingiz qabul qilindi. Tez orada ko'rib chiqamiz."), findsOneWidget);
    expect(account.reports.single.$1, ReportSubject.payment);
    expect(account.reports.single.$2, "Maosh hali to'lanmadi");
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    // App language → Рус.
    await tester.ensureVisible(find.text('Рус'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Рус'));
    await tester.pumpAndSettle();
    expect(container.read(appLanguageProvider), AppLanguage.ru);
    expect(find.text('Профиль'), findsWidgets);
  });

  testWidgets('notifications: opening them clears the bell', (tester) async {
    usePhone(tester);
    final account = DemoAccountRepository(now: prototypeNow);
    final clock = TestClock(prototypeNow)..at(12, 30);
    final container = appContainer(account: account, unread: null, clock: clock.call);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
    expect(container.read(unreadNotificationsProvider), 2);

    await tester.tap(find.bySemanticsLabel('Bildirishnomalar, 2 ta yangi'));
    await tester.pumpAndSettle();
    expect(find.text('Smenangizga 2 soat qoldi'), findsOneWidget);
    expect(find.text('Dalbit Kafe · Sinchon, 14:00–19:00. Kirishda QR kodni skanerlang.'), findsOneWidget);
    expect(find.text('Bom Mart · Hongdae: shanba, 14-noyabr, 10:00–15:00 smenangiz tasdiqlandi.'), findsOneWidget);
    expect(find.text(keepSlashTogether('Sangam Logistika · payshanba, 18:00–23:00 · ${Won.worker(12000)}/soat · 3,8 km')), findsOneWidget);
    expect(find.text('Hongdae yaqinida 3 ta yangi smena'), findsOneWidget);
    expect(find.text(keepSlashTogether("Kafe va do'kon · ${Won.workerDigits(10500)}–${Won.worker(11500)}/soat")), findsOneWidget);
    expect(container.read(unreadNotificationsProvider), 0);

    await tester.tap(find.byType(HiBackButton));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Bildirishnomalar'), findsWidgets);
    final all = await account.notifications();
    expect(all.every((n) => n.read), isTrue);
    expect(all.first.kind, NotificationKind.shiftReminder);
  });
}

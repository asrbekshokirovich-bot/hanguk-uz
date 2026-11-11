// A06 «Mening smenalarim» states the flow tests did not reach: a list that
// did not load, empty «Bajarilgan» and «Bekor qilingan», where a card leads
// at each status, the late countdown, a refused cancel, and every server
// refusal's message.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/chat/chat_screen.dart';
import 'package:hanguk_ish/features/worker/my_shifts/my_shifts_screen.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';
import 'package:hanguk_ish/l10n/gen/worker_l10n.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// Offline for its first [failures] lists of the worker's shifts.
class _OfflineAtFirst extends DemoShiftRepository {
  _OfflineAtFirst(TestClock clock) : super(now: prototypeNow, clock: clock.call, history: false);

  int failures = 1;

  @override
  Future<List<MyShift>> myShifts() async {
    if (failures > 0) {
      failures--;
      throw const OfflineException();
    }
    return super.myShifts();
  }
}

/// Offline from the moment [offline] is set (a pull-to-refresh that fails).
class _GoesOffline extends DemoShiftRepository {
  _GoesOffline(TestClock clock) : super(now: prototypeNow, clock: clock.call, history: false);

  bool offline = false;

  @override
  Future<List<MyShift>> myShifts() async {
    if (offline) throw const OfflineException();
    return super.myShifts();
  }
}

/// The server refuses every cancel with [code].
class _RefusesCancel extends DemoShiftRepository {
  _RefusesCancel(TestClock clock, this.code) : super(now: prototypeNow, clock: clock.call, history: false);

  final String code;

  @override
  Future<MyShift> cancelApplication(String applicationId) async => throw ShiftActionException(code);
}

void main() {
  setUpAll(loadHiFonts);

  String qr(String id) => ShiftQr(id, DemoShiftRepository.qrToken).payload;

  Future<ProviderContainer> start(WidgetTester tester, DemoShiftRepository repo, TestClock clock) async {
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.myShifts, repository: repo, clock: clock.call);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('a list that did not load says why; «Qayta urinish» shows the shifts', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = _OfflineAtFirst(clock);
    await repo.apply('demo-1');
    await start(tester, repo, clock);
    expect(find.text("Internet aloqasi yo'q"), findsOneWidget);
    // Not «no shifts yet»: that would not be true.
    expect(find.text("Kelgusi smenalar yo'q"), findsNothing);
    await tester.tap(find.text('Qayta urinish'));
    await tester.pumpAndSettle();
    expect(find.text("Internet aloqasi yo'q"), findsNothing);
    expect(find.text('Dalbit Kafe · Sinchon'), findsOneWidget);
    expect(find.text('Tasdiqlangan'), findsOneWidget);
  });

  testWidgets('a failed pull-to-refresh keeps the list and says why', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = _GoesOffline(clock);
    await repo.apply('demo-1');
    await start(tester, repo, clock);
    repo.offline = true;
    await tester.fling(find.text('Dalbit Kafe · Sinchon'), const Offset(0, 400), 1000);
    await tester.pumpAndSettle();
    expect(find.text('Dalbit Kafe · Sinchon'), findsOneWidget, reason: 'the last list stays');
    expect(find.text("Internet aloqasi yo'q"), findsOneWidget);
  });

  testWidgets('empty «Bajarilgan» and «Bekor qilingan» say so', (tester) async {
    final clock = TestClock(prototypeNow);
    await start(tester, demoRepository(clock, history: false), clock);
    expect(find.text("Kelgusi smenalar yo'q"), findsOneWidget);
    await tester.tap(find.text('Bajarilgan'));
    await tester.pumpAndSettle();
    expect(find.text("Hali bajarilgan smena yo'q"), findsOneWidget);
    expect(find.text("Smenani tugatganingizdan so'ng u shu yerda ko'rinadi."), findsOneWidget);
    await tester.tap(find.text('Bekor qilingan'));
    await tester.pumpAndSettle();
    expect(find.text("Bekor qilingan smena yo'q"), findsOneWidget);
  });

  testWidgets('the card of a shift at work opens A07 «Ish kuni»', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, history: false);
    final app = await repo.apply('demo-1');
    await repo.checkIn(qr('demo-1'));
    await start(tester, repo, clock);
    expect(find.text('Ishdasiz'), findsOneWidget);
    await tester.tap(find.text('Dalbit Kafe · Sinchon'));
    await tester.pumpAndSettle();
    expect(find.byType(AtWorkScreen), findsOneWidget);
    expect(tester.widget<AtWorkScreen>(find.byType(AtWorkScreen)).applicationId, app.applicationId);
  });

  testWidgets('the card of a finished shift opens its result', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, history: false);
    final app = await repo.apply('demo-1');
    await repo.checkIn(qr('demo-1'));
    clock.at(11, 50);
    await repo.checkOut(qr('demo-1'));
    await start(tester, repo, clock);
    await tester.tap(find.text('Bajarilgan'));
    await tester.pumpAndSettle();
    expect(find.text('Bajarildi'), findsOneWidget);
    await tester.tap(find.text('Dalbit Kafe · Sinchon'));
    await tester.pumpAndSettle();
    expect(find.byType(ShiftResultScreen), findsOneWidget);
    expect(tester.widget<ShiftResultScreen>(find.byType(ShiftResultScreen)).applicationId, app.applicationId);
  });

  testWidgets('«Chat» on an upcoming card opens A10 for that shift', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, history: false);
    final app = await repo.apply('demo-1');
    await start(tester, repo, clock);
    await tester.tap(find.text('Chat'));
    await tester.pumpAndSettle();
    expect(find.byType(ChatScreen), findsOneWidget);
    expect(tester.widget<ChatScreen>(find.byType(ChatScreen)).applicationId, app.applicationId);
  });

  testWidgets('a confirmed shift that has started counts the lateness', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = demoRepository(clock, history: false);
    await repo.apply('demo-1'); // 14:00–19:00
    clock.at(14, 10);
    await start(tester, repo, clock);
    expect(find.text('10 daq kechikish'), findsOneWidget);
    expect(find.text('Tasdiqlangan'), findsOneWidget);
  });

  testWidgets('a cancel the server refuses keeps the shift and says why', (tester) async {
    final clock = TestClock(prototypeNow);
    final repo = _RefusesCancel(clock, 'SHIFT_STARTED');
    await repo.apply('demo-1');
    await start(tester, repo, clock);
    await tester.ensureVisible(find.text('Bekor qilish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bekor qilish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ha, bekor qilish'));
    await tester.pumpAndSettle();
    expect(find.text('Smena allaqachon boshlangan.'), findsOneWidget);
    expect(find.text('Smena bekor qilindi.'), findsNothing);
    expect(find.text('Tasdiqlangan'), findsOneWidget);
  });

  test('every refusal from the server has its own message', () {
    final l10n = lookupWorkerL10n(const Locale('uz'));
    const expected = {
      'CANNOT_CANCEL': "Bu smenani endi bekor qilib bo'lmaydi.",
      'NOT_FOUND': "Bu smenani endi bekor qilib bo'lmaydi.",
      'SHIFT_STARTED': 'Smena allaqachon boshlangan.',
      'QR_INVALID': 'Bu QR kod bu smenaga tegishli emas.',
      'NOT_CONFIRMED': 'Bu smena sizga tasdiqlanmagan.',
      'ALREADY_CHECKED_IN': 'Siz allaqachon ishga kirgansiz.',
      'TOO_EARLY': 'Kirish smena boshlanishidan 30 daqiqa oldin ochiladi.',
      'TOO_LATE': 'Smena vaqti tugagan.',
      'NOT_CHECKED_IN': 'Avval ishga kirish QR kodini skanerlang.',
      'ALREADY_CHECKED_OUT': 'Siz allaqachon ishdan chiqqansiz.',
      'TOO_MANY_REQUESTS': "Urinishlar juda ko'p. Birozdan keyin qayta urinib ko'ring.",
    };
    expected.forEach((code, text) => expect(myShiftError(l10n, ShiftActionException(code)), text, reason: code));
    expect(myShiftError(l10n, const OfflineException()), "Internet aloqasi yo'q. Ulanishni tekshirib, qayta urinib ko'ring.");
    expect(myShiftError(l10n, const ShiftActionException('SOMETHING_NEW')), "Xatolik yuz berdi. Qayta urinib ko'ring.");
    expect(myShiftError(l10n, StateError('x')), "Xatolik yuz berdi. Qayta urinib ko'ring.");
  });
}

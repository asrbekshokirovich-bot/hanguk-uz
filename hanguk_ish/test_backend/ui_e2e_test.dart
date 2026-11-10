// Both apps' real screens on the local Supabase stack. The worker sees a new
// shift in the feed, takes it and finds it in «Mening smenalarim»; the owner
// sees the shift on BA1 and the worker on BA3. Repositories, JSON,
// providers and widgets together, with the real network and data.
//
// Run with the integration tests (.github/workflows/ish-integration.yml):
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_KEY=… flutter test test_backend
// Without those variables every test is skipped.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/backend/supabase_account_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_auth_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_employer_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_shift_repository.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/account_repository.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/employer_repository.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';
import 'package:hanguk_ish/features/worker/work/qr_scanner.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../test/helpers/fonts.dart';
import '../test/helpers/phone.dart';

final _env = Platform.environment;
final _url = _env['SUPABASE_URL'] ?? '';
final _anonKey = _env['SUPABASE_ANON_KEY'] ?? '';
final _serviceKey = _env['SUPABASE_SERVICE_KEY'] ?? '';
final _skip = _url.isEmpty || _anonKey.isEmpty || _serviceKey.isEmpty
    ? 'set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY (a local supabase start)'
    : null;

final _config = BackendConfig(url: _url, publishableKey: _anonKey);

// Haeundae, Busan: far from the shifts of backend_test.dart (Sinchon), so
// no «new shift nearby» reaches its workers.
const _lat = 35.1587;
const _lng = 129.1604;

SupabaseClient _client(String key) =>
    SupabaseClient(_url, key, authOptions: const AuthClientOptions(autoRefreshToken: false));

Future<SupabaseClient> _signIn(String phone) async {
  final client = _client(_anonKey);
  await client.auth.signInWithOtp(phone: phone);
  await client.auth.verifyOTP(phone: phone, token: '123456', type: OtpType.sms);
  return client;
}

/// The phone is at the beach, by the business.
class _AtTheBeach implements LocationService {
  const _AtTheBeach();

  @override
  Future<FeedArea> current() async => const FeedArea(place: seoulPlace, lat: _lat, lng: _lng);
}

/// A07's camera, reading the business's printed code as soon as it opens.
class _ReadsTheDoorCode extends StatefulWidget {
  const _ReadsTheDoorCode(this.payload, this.onCode);

  final String payload;
  final ValueChanged<String> onCode;

  @override
  State<_ReadsTheDoorCode> createState() => _ReadsTheDoorCodeState();
}

class _ReadsTheDoorCodeState extends State<_ReadsTheDoorCode> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onCode(widget.payload);
    });
  }

  @override
  Widget build(BuildContext context) => const ColoredBox(color: Color(0xFF000000));
}

/// Text on screen, also inside rich text (a title mixing Latin and Hangul
/// is drawn in spans, one font each).
Finder _text(String text) => find.text(text, findRichText: true);

/// Lets the real network answer (outside the test's fake clock) and the
/// screens rebuild, until [finder] shows something or [seconds] pass.
Future<void> _until(WidgetTester tester, Finder finder, {int seconds = 20}) async {
  for (var i = 0; i < seconds * 10 && finder.evaluate().isEmpty; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(finder, findsWidgets);
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  // Past any page transition (taps are blocked while one runs).
  await tester.pump(const Duration(milliseconds: 500));
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(finder.first);
  await tester.pump(const Duration(milliseconds: 100));
}

/// The screen as it is, for looking at real data drawn by the apps
/// (`build/screens2x/e2e-<name>.png`, kept by the integration workflow).
Future<void> _shot(WidgetTester tester, String name) async {
  await tester.pump(const Duration(milliseconds: 600));
  await saveHiRes(tester, 'e2e-$name');
}

/// Unmounts the app and lets its timers run out.
Future<void> _close(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(minutes: 2));
}

void main() {
  // This file talks to the local stack: the real HttpClient, not the test
  // binding's (which answers every request with 400).
  TestWidgetsFlutterBinding.ensureInitialized();
  HttpOverrides.global = null;

  late SupabaseClient worker;
  late SupabaseClient owner;
  late EmployerShift shift;
  // Starts in 20 minutes: the door code works already (A07).
  late EmployerShift soon;
  late String doorCode;
  // The owner decides (BA3 확정).
  late EmployerShift manual;

  setUpAll(() async {
    if (_skip != null) return;
    // The real fonts: with the test font's wide boxes the cards overflow.
    await loadHiFonts();
    final admin = _client(_serviceKey);
    worker = await _signIn('+821000000021');
    owner = await _signIn('+821000000031');
    final business = await admin.rpc('register_business', params: {
      'p_owner': owner.auth.currentUser!.id,
      'p_biz_no': '9990000001',
      'p_name': '해운대 E2E 카페',
      'p_nts_status': '01',
      'p_category': 'cafe',
      'p_address': '부산 해운대구 해운대해변로 264',
      'p_district': 'Haeundae-gu',
      'p_lat': _lat,
      'p_lng': _lng,
    }) as Map<String, dynamic>;
    final businessId = business['id'] as String;
    await admin.from('businesses').update({
      'name_i18n': {'uz': 'E2E Kafe'},
    }).eq('id', businessId);
    final start = DateTime.now().toUtc().add(const Duration(hours: 2));
    shift = await SupabaseEmployerRepository(owner, _config).createShift(ShiftDraft(
      businessId: businessId,
      title: 'E2E 홀 보조',
      startsAt: start,
      endsAt: start.add(const Duration(hours: 4)),
      hourlyWage: 11000,
      slots: 2,
    ));
    final employer = SupabaseEmployerRepository(owner, _config);
    final inTwenty = DateTime.now().toUtc().add(const Duration(minutes: 20));
    soon = await employer.createShift(ShiftDraft(
      businessId: businessId,
      title: 'E2E 아침 보조',
      startsAt: inTwenty,
      endsAt: inTwenty.add(const Duration(hours: 1)),
      hourlyWage: 11000,
      slots: 1,
    ));
    doorCode = await employer.shiftQr(soon.id);
    final inThreeDays = DateTime.now().toUtc().add(const Duration(days: 3));
    manual = await employer.createShift(ShiftDraft(
      businessId: businessId,
      title: 'E2E 수동 확정',
      startsAt: inThreeDays,
      endsAt: inThreeDays.add(const Duration(hours: 3)),
      hourlyWage: 12000,
      slots: 1,
      autoConfirm: false,
    ));
    await SupabaseWorkerProfileRepository(worker, _config).save(const WorkerProfileDraft(
      firstName: 'Sardor',
      lastName: 'Testov',
      languages: {'uz', 'ko'},
      topik: 3,
      district: 'mapo',
      visa: 'D-2',
    ));
    final shifts = SupabaseShiftRepository(worker, _config);
    await shifts.apply(soon.id);
    await shifts.apply(manual.id);
  });

  testWidgets('worker: the new shift is in the feed; taken, it is in «Mening smenalarim»', skip: _skip != null,
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(worker),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(worker)),
        shiftRepositoryProvider.overrideWithValue(SupabaseShiftRepository(worker, _config)),
        accountRepositoryProvider.overrideWithValue(SupabaseAccountRepository(worker)),
        workerProfileRepositoryProvider.overrideWithValue(SupabaseWorkerProfileRepository(worker, _config)),
        locationServiceProvider.overrideWithValue(const _AtTheBeach()),
      ],
      child: const WorkerApp(),
    )));

    // The start screen loads the saved profile and opens the feed.
    await _until(tester, _text('Smenalar'));
    final today = Kst.wallClock(DateTime.now());
    final day = Kst.wallClock(shift.startsAt);
    if (day.day != today.day) await _tap(tester, _text('Ertaga'));
    // The card names the business (its title is in the card's label); A05
    // shows the title as the owner wrote it (no translation yet). The
    // business has more shifts today: the card of this one.
    await _until(tester, _text('E2E Kafe'));
    await _shot(tester, 'a03-feed');
    await _tap(tester, find.bySemanticsLabel(RegExp('E2E 홀 보조')));
    await _until(tester, _text('E2E 홀 보조'));
    await _until(tester, _text('Smenani olish'));
    await _shot(tester, 'a05-detail');
    await _tap(tester, _text('Smenani olish'));
    await _until(tester, _text('Tasdiqlash'));
    await _tap(tester, _text('Tasdiqlash'));
    await _until(tester, _text('Smena olindi!'));
    await _shot(tester, 'a05-taken');

    final mine = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    expect(mine!.where((a) => a.shift.id == shift.id), hasLength(1), reason: 'the server has the application');

    await _tap(tester, _text('Lentaga qaytish'));
    await _until(tester, _text('Mening smenalarim'));
    await _tap(tester, _text('Mening smenalarim'));
    await _until(tester, _text('E2E 홀 보조'));
    await _shot(tester, 'a06-my-shifts');
    await _close(tester);
  });

  testWidgets('owner: BA1 lists the shift; BA3 shows the worker who took it', skip: _skip != null, (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(owner),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(owner)),
        employerRepositoryProvider.overrideWithValue(SupabaseEmployerRepository(owner, _config)),
      ],
      child: const EmployerApp(),
    )));

    await _until(tester, _text('오늘의 근무'));
    await _until(tester, _text('해운대 E2E 카페'));
    await _until(tester, _text('E2E 홀 보조'));
    await _shot(tester, 'ba1-home');
    await _tap(tester, _text('E2E 홀 보조'));
    await _until(tester, _text('Sardor Testov'));
    await _shot(tester, 'ba3-shift');
    await _close(tester);
  });

  testWidgets('worker: the workday by the door code — in, at work, out, result, rating', skip: _skip != null,
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(worker),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(worker)),
        shiftRepositoryProvider.overrideWithValue(SupabaseShiftRepository(worker, _config)),
        accountRepositoryProvider.overrideWithValue(SupabaseAccountRepository(worker)),
        workerProfileRepositoryProvider.overrideWithValue(SupabaseWorkerProfileRepository(worker, _config)),
        locationServiceProvider.overrideWithValue(const _AtTheBeach()),
        liveTimersProvider.overrideWithValue(false),
        qrCameraBuilderProvider.overrideWithValue(
          ({required onCode, required torch, required onProblem}) => _ReadsTheDoorCode(doorCode, onCode),
        ),
      ],
      child: const WorkerApp(),
    )));

    await _until(tester, _text('Mening smenalarim'));
    await _tap(tester, _text('Mening smenalarim'));
    await _until(tester, _text('E2E 아침 보조'));
    await _tap(tester, _text('E2E 아침 보조'));
    // The entry screen reads the code at once; the server checks it in.
    await _until(tester, _text('Chiqish — QR skanerlash'));
    expect(find.byType(AtWorkScreen), findsOneWidget);
    await _shot(tester, 'a07-at-work');
    await _tap(tester, _text('Chiqish — QR skanerlash'));
    await _until(tester, _text('Smena yakunlandi'));
    await _shot(tester, 'a07-result');
    final done = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    expect(done!.singleWhere((a) => a.shift.id == soon.id).status, ApplicationStatus.completed);

    await _tap(tester, _text('Ish beruvchini baholash'));
    await _until(tester, find.bySemanticsLabel('5 yulduz'));
    await tester.tap(find.bySemanticsLabel('5 yulduz'));
    await tester.pump(const Duration(milliseconds: 100));
    await _tap(tester, _text('Bahoni yuborish'));
    await _until(tester, _text('Rahmat! Bahoingiz yuborildi.'));
    final rated = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    expect(rated!.singleWhere((a) => a.shift.id == soon.id).myStars, 5);
    await _close(tester);
  });

  testWidgets('owner: 확정 on BA3; the finished shift on BA5, marked paid', skip: _skip != null, (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(owner),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(owner)),
        employerRepositoryProvider.overrideWithValue(SupabaseEmployerRepository(owner, _config)),
      ],
      child: const EmployerApp(),
    )));

    await _until(tester, _text('E2E 수동 확정'));
    await _tap(tester, _text('E2E 수동 확정'));
    // BA3 with the applicant; then its «확정» button (chips say 확정 too).
    await _until(tester, _text('지원자 1명'));
    await _tap(tester, find.widgetWithText(HiButton, '확정'));
    await _until(tester, _text('Sardor Testov님을 확정했어요'));
    final decided = await tester.runAsync(() => SupabaseEmployerRepository(owner, _config).shift(manual.id));
    expect(decided!.confirmed, 1, reason: 'the server has the decision');

    // The list scrolled down to the button; back up to the header's «뒤로».
    await tester.dragUntilVisible(find.bySemanticsLabel('뒤로'), find.byType(Scrollable).first, const Offset(0, 300));
    await _tap(tester, find.bySemanticsLabel('뒤로'));
    await _until(tester, _text('리포트'));
    await _tap(tester, _text('리포트'));
    await _until(tester, _text('E2E 아침 보조'));
    await _tap(tester, _text('E2E 아침 보조'));
    await _until(tester, _text('지급 완료로 표시'));
    await _tap(tester, _text('지급 완료로 표시'));
    await _until(tester, _text('지급 완료 · 1건'));
    await _shot(tester, 'ba5-report');
    await _close(tester);
  });

  testWidgets('worker: A12 tells of the 확정 and the payment', skip: _skip != null, (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(worker),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(worker)),
        shiftRepositoryProvider.overrideWithValue(SupabaseShiftRepository(worker, _config)),
        accountRepositoryProvider.overrideWithValue(SupabaseAccountRepository(worker)),
        workerProfileRepositoryProvider.overrideWithValue(SupabaseWorkerProfileRepository(worker, _config)),
        locationServiceProvider.overrideWithValue(const _AtTheBeach()),
        workerInitialLocationProvider.overrideWithValue(WorkerRoutes.notifications),
      ],
      child: const WorkerApp(),
    )));

    await _until(tester, _text('Bildirishnomalar'));
    await _until(tester, _text('Smena tasdiqlandi'));
    expect(_text("Maosh to'landi"), findsWidgets);
    await _shot(tester, 'a12-notifications');
    // Opening A12 marks them read: let the screen's request go out (the app
    // runs on the test's clock) and ask the server.
    final account = SupabaseAccountRepository(worker);
    var unread = -1;
    for (var i = 0; i < 20 && unread != 0; i++) {
      for (var j = 0; j < 5; j++) {
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
        await tester.pump(const Duration(milliseconds: 100));
      }
      final all = await tester.runAsync(account.notifications);
      unread = all!.where((n) => !n.read).length;
    }
    expect(unread, 0, reason: 'opening A12 marked them read');
    await _close(tester);
  });

  /// The worker's app, signed in, opened at [location] (or the start).
  Widget workerApp({String? location}) => capture(ProviderScope(
        overrides: [
          backendConfigProvider.overrideWithValue(_config),
          supabaseClientProvider.overrideWithValue(worker),
          authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(worker)),
          shiftRepositoryProvider.overrideWithValue(SupabaseShiftRepository(worker, _config)),
          accountRepositoryProvider.overrideWithValue(SupabaseAccountRepository(worker)),
          workerProfileRepositoryProvider.overrideWithValue(SupabaseWorkerProfileRepository(worker, _config)),
          locationServiceProvider.overrideWithValue(const _AtTheBeach()),
          liveTimersProvider.overrideWithValue(false),
          if (location != null) workerInitialLocationProvider.overrideWithValue(location),
        ],
        child: const WorkerApp(),
      ));

  /// The owner's app, signed in, opened at [location] (or the start).
  Widget ownerApp({String? location}) => capture(ProviderScope(
        overrides: [
          backendConfigProvider.overrideWithValue(_config),
          supabaseClientProvider.overrideWithValue(owner),
          authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(owner)),
          employerRepositoryProvider.overrideWithValue(SupabaseEmployerRepository(owner, _config)),
          if (location != null) employerInitialLocationProvider.overrideWithValue(location),
        ],
        child: const EmployerApp(),
      ));

  void phone(WidgetTester tester) {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  testWidgets('worker: a message in A10 reaches the server', skip: _skip != null, (tester) async {
    phone(tester);
    final mine = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    final app = mine!.singleWhere((a) => a.shift.id == shift.id);
    await tester.pumpWidget(workerApp(location: WorkerRoutes.chat(app.applicationId)));
    await _until(tester, find.byType(TextField));
    await tester.enterText(find.byType(TextField), 'Salom, ertaga 13:50 da boraman');
    await tester.pump(const Duration(milliseconds: 100));
    await _tap(tester, find.bySemanticsLabel('Yuborish'));
    // Sent: the composer empties and the bubble is in the thread (the
    // composer's own text matched before).
    await _until(tester, find.descendant(of: find.byType(ListView), matching: _text('Salom, ertaga 13:50 da boraman')));
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);
    await _shot(tester, 'a10-chat');
    final thread = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).messages(app.applicationId));
    expect(thread!.last.body, 'Salom, ertaga 13:50 da boraman');
    await _close(tester);
  });

  testWidgets('owner: 알림 shows the message; BA2 posts a shift through the form', skip: _skip != null,
      (tester) async {
    phone(tester);
    await tester.pumpWidget(ownerApp(location: EmployerRoutes.notifications));
    await _until(tester, _text('Sardor Testov님이 메시지를 보냈어요 · E2E 홀 보조'));
    await _shot(tester, 'ba-notifications');
    await _close(tester);

    await tester.pumpWidget(ownerApp());
    await _until(tester, _text('오늘의 근무'));
    await _tap(tester, _text('근무 올리기'));
    // A new business has no template: the content first, from «근무 올리기».
    await _until(tester, find.widgetWithText(HiButton, '근무 올리기'));
    await _tap(tester, find.widgetWithText(HiButton, '근무 올리기'));
    await _until(tester, find.byType(BottomSheet));
    await tester.enterText(find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextField)).at(0), 'E2E 새 근무');
    await _tap(tester, find.descendant(of: find.byType(BottomSheet), matching: find.widgetWithText(HiButton, '저장하기')));
    // The day chips read «내일 11.13» (word and date in one line).
    final tomorrowChip = find.textContaining(RegExp('^내일'), findRichText: true);
    await _until(tester, tomorrowChip);
    await _tap(tester, tomorrowChip);
    await _shot(tester, 'ba2-form');
    expect(_text('최저시급 10,320원 이상'), findsWidgets, reason: 'the wage starts at the legal minimum');
    await _tap(tester, find.widgetWithText(HiButton, '근무 올리기'));
    await _until(tester, _text('근무를 올렸어요'));
    await _until(tester, _text('E2E 새 근무'));
    final posted = await tester.runAsync(() async {
      final business = (await SupabaseEmployerRepository(owner, _config).businesses()).single;
      final now = DateTime.now().toUtc();
      return SupabaseEmployerRepository(owner, _config).shifts(business.id, now, now.add(const Duration(days: 3)));
    });
    final created = posted!.singleWhere((s) => s.title == 'E2E 새 근무');
    expect(created.hourlyWage, 10320);
    await _close(tester);
  });

  testWidgets('worker: cancelling in A06 (more than a day ahead: free)', skip: _skip != null, (tester) async {
    phone(tester);
    await tester.pumpWidget(workerApp(location: WorkerRoutes.myShifts));
    await _until(tester, _text('E2E 수동 확정'));
    // Upcoming, by start: «E2E 홀 보조» today, then this one in three days —
    // its «Bekor qilish» is the last.
    await _tap(tester, find.text('Bekor qilish').last);
    await _until(tester, _text('Ha, bekor qilish'));
    await _tap(tester, _text('Ha, bekor qilish'));
    await _until(tester, _text('Smena bekor qilindi.'));
    final mine = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    expect(mine!.singleWhere((a) => a.shift.id == manual.id).status, ApplicationStatus.cancelled);
    await _close(tester);
  });

  testWidgets('owner: 알림 tells of the cancellation; the owner calls a shift off on BA3', skip: _skip != null,
      (tester) async {
    phone(tester);
    await tester.pumpWidget(ownerApp(location: EmployerRoutes.notifications));
    await _until(tester, _text('Sardor Testov님이 E2E 수동 확정 근무를 취소했어요'));
    await _close(tester);

    await tester.pumpWidget(ownerApp(location: EmployerRoutes.shift(shift.id)));
    await _until(tester, _text('수정'));
    await _tap(tester, _text('수정'));
    await _until(tester, _text('근무 취소'));
    await _tap(tester, _text('근무 취소'));
    await _until(tester, _text('근무를 취소할까요?'));
    await _tap(tester, find.widgetWithText(HiButton, '근무 취소'));
    await _until(tester, _text('근무를 취소했어요'));
    final gone = await tester.runAsync(() => SupabaseEmployerRepository(owner, _config).shift(shift.id));
    expect(gone!.cancelled, isTrue);
    await _close(tester);
  });

  testWidgets('worker: A12 says the business called the shift off', skip: _skip != null, (tester) async {
    phone(tester);
    await tester.pumpWidget(workerApp(location: WorkerRoutes.notifications));
    await _until(tester, _text('Smena bekor qilindi'));
    await _close(tester);
  });
}

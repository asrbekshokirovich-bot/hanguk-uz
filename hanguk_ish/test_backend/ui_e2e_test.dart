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
import 'package:hanguk_ish/core/format/dates.dart';
import 'package:hanguk_ish/core/money/won.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/backend/supabase_account_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_auth_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_employer_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_live_updates.dart';
import 'package:hanguk_ish/data/backend/supabase_shift_repository.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/account_repository.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/employer_repository.dart';
import 'package:hanguk_ish/data/repositories/live_updates.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/design/widgets/forms.dart';
import 'package:hanguk_ish/design/widgets/qr.dart';
import 'package:hanguk_ish/features/employer/ko.dart';
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';
import 'package:hanguk_ish/features/worker/shift/shift_widgets.dart';
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

/// Past a page transition: both pages are on screen while it runs (two text
/// fields, taps blocked).
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
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
      // Not at the business: workers see this address, not the business's.
      address: '부산 해운대구 구남로 30',
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
    // The business has no area (neighbourhood) yet: the card's place line is
    // its street (cut when long) and the distance, with no dot in front.
    final dangling = find.byWidgetPredicate((w) => w is Text && RegExp(r'^· [\d,.]+ km$').hasMatch(w.data ?? ''));
    expect(dangling, findsNothing);
    expect(_text('부산 해운대구 해운대해변로 264'), findsWidgets);
    expect(find.textContaining(RegExp(r'^ · [\d,.]+ km$')), findsWidgets);
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
    // The door code comes from the server (shift_qr).
    await _until(tester, find.byType(HiQrCode));
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
    // An hour and a half of work: the shift (now 95 minutes long) began 90
    // minutes ago and the worker came in on time. The server pays the time
    // inside the planned window: 90 minutes × 11,000원 = 16,500원.
    final began = DateTime.now().toUtc().subtract(const Duration(minutes: 90));
    await tester.runAsync(() async {
      final admin = _client(_serviceKey);
      await admin.from('shifts').update({
        'starts_at': began.toIso8601String(),
        'ends_at': began.add(const Duration(minutes: 95)).toIso8601String(),
      }).eq('id', soon.id);
      await admin
          .from('applications')
          .update({'check_in_at': began.toIso8601String()})
          .eq('shift_id', soon.id)
          .eq('worker_id', worker.auth.currentUser!.id);
    });
    await _tap(tester, _text('Chiqish — QR skanerlash'));
    await _until(tester, _text('Smena yakunlandi'));
    final done = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    final finished = done!.singleWhere((a) => a.shift.id == soon.id);
    expect(finished.status, ApplicationStatus.completed);
    expect(finished.workedMinutes, 90);
    expect(finished.payAmount, 16500);
    // The card shows what the server counted, never the planned 95 minutes
    // and their pay first.
    await _until(tester, _text(HiDates.durationHm(90, 'uz')));
    expect(_text(HiDates.durationHm(95, 'uz')), findsNothing);
    expect(_text(Won.worker(16500)), findsOneWidget, reason: 'the total');
    expect(_text(Kst.hm(began)), findsOneWidget, reason: 'in');
    await _shot(tester, 'a07-result');

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
    expect(find.textContaining('16,500', findRichText: true), findsWidgets, reason: 'the hour and a half paid');
    expect(find.textContaining('근무 1건 · 1시간 30분', findRichText: true), findsOneWidget);
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
    expect(find.textContaining(Won.worker(16500), findRichText: true), findsOneWidget, reason: 'the amount paid');
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

  /// The worker's app, signed in, opened at [location] (or the start);
  /// [live]: with Realtime, as the real app runs.
  Widget workerApp({String? location, bool live = false}) => capture(ProviderScope(
        overrides: [
          backendConfigProvider.overrideWithValue(_config),
          supabaseClientProvider.overrideWithValue(worker),
          authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(worker)),
          shiftRepositoryProvider.overrideWithValue(SupabaseShiftRepository(worker, _config)),
          accountRepositoryProvider.overrideWithValue(SupabaseAccountRepository(worker)),
          workerProfileRepositoryProvider.overrideWithValue(SupabaseWorkerProfileRepository(worker, _config)),
          locationServiceProvider.overrideWithValue(const _AtTheBeach()),
          liveTimersProvider.overrideWithValue(false),
          if (live) liveUpdatesProvider.overrideWith((ref) => SupabaseLiveUpdates(worker)),
          if (location != null) workerInitialLocationProvider.overrideWithValue(location),
        ],
        child: const WorkerApp(),
      ));

  /// The owner's app, signed in, opened at [location] (or the start);
  /// [live]: with Realtime, as the real app runs.
  Widget ownerApp({String? location, bool live = false}) => capture(ProviderScope(
        overrides: [
          backendConfigProvider.overrideWithValue(_config),
          supabaseClientProvider.overrideWithValue(owner),
          authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(owner)),
          employerRepositoryProvider.overrideWithValue(SupabaseEmployerRepository(owner, _config)),
          if (live) liveUpdatesProvider.overrideWith((ref) => SupabaseLiveUpdates(owner)),
          if (location != null) employerInitialLocationProvider.overrideWithValue(location),
        ],
        child: const EmployerApp(),
      ));

  void phone(WidgetTester tester) {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  testWidgets('worker: A09 counts the paid shift; A11 the finished one', skip: _skip != null, (tester) async {
    phone(tester);
    // Through the start gate, which loads the saved profile (A11's name).
    await tester.pumpWidget(workerApp());
    await _until(tester, _text('Smenalar'));
    await _tap(tester, _text('Daromad'));
    // The month total, the paid tile and the shift's row.
    await _until(tester, _text(Won.worker(16500)));
    expect(_text(Won.worker(16500)), findsNWidgets(3));
    expect(_text('1 smena · 1 soat'), findsOneWidget);
    expect(_text('E2E Kafe'), findsWidgets);
    await _shot(tester, 'a09-earnings');

    await _tap(tester, _text('Profil'));
    await _until(tester, _text('Sardor Testov'));
    final done = find.ancestor(
      of: _text('Bajarilgan smenalar'),
      matching: find.byWidgetPredicate((w) => w.runtimeType.toString() == '_StatCard'),
    );
    await _until(tester, find.descendant(of: done, matching: _text('1')));
    // Finished +1, never above 100; no business can rate a worker yet.
    expect(_text('100'), findsWidgets);
    await _shot(tester, 'a11-profile');
    await _close(tester);
  });

  testWidgets('worker: A04 puts the business on the map; its card is the open shift', skip: _skip != null,
      (tester) async {
    phone(tester);
    await tester.pumpWidget(workerApp(location: WorkerRoutes.map));
    final today = Kst.wallClock(DateTime.now());
    final day = Kst.wallClock(shift.startsAt);
    if (day.day != today.day) await _tap(tester, _text('Ertaga'));
    await _until(tester, find.byType(ShiftCard));
    // One pin for the business, placed from its point; selected, its card.
    expect(find.bySemanticsLabel(RegExp('^E2E Kafe, ')), findsOneWidget);
    expect(find.descendant(of: find.byType(ShiftCard), matching: _text('E2E Kafe')), findsOneWidget);
    await _shot(tester, 'a04-map');
    await _close(tester);
  });

  testWidgets('owner: BA4 lists the worker who finished a shift; ★ makes them a favourite', skip: _skip != null,
      (tester) async {
    phone(tester);
    await tester.pumpWidget(ownerApp(location: EmployerRoutes.workers));
    await _until(tester, _text(Ko.noFavorites));
    // The tabs read «최근 근무자 1» (the hint below says «최근 근무자에서…»).
    await _tap(tester, find.textContaining(RegExp('^${Ko.recentWorkers} '), findRichText: true));
    await _until(tester, _text('Sardor Testov'));
    expect(_text(Ko.timesHere(1, 3)), findsOneWidget, reason: 'one finished shift here, TOPIK 3');
    await _tap(tester, find.bySemanticsLabel(Ko.favorite('Sardor Testov')));
    // The star turns at once; the server's answer follows (the app runs on
    // the test's clock, so let its request go out while asking the server).
    await _until(tester, find.bySemanticsLabel(Ko.unfavorite('Sardor Testov')));
    final repo = SupabaseEmployerRepository(owner, _config);
    var favorite = false;
    for (var i = 0; i < 20 && !favorite; i++) {
      for (var j = 0; j < 3; j++) {
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
        await tester.pump(const Duration(milliseconds: 100));
      }
      final workers = await tester.runAsync(() async => repo.workers((await repo.businesses()).single.id));
      favorite = workers!.single.favorite;
    }
    expect(favorite, isTrue, reason: 'the server keeps the favourite');
    await _tap(tester, find.textContaining(RegExp('^${Ko.favorites} '), findRichText: true));
    await _until(tester, _text('Sardor Testov'));
    await _shot(tester, 'ba4-workers');
    await _close(tester);
  });

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
    // The wage starts at the legal minimum of the shift's year, kept across
    // days (고용노동부 고시: 2026 → 10,320원, 2027 → 10,700원).
    final year = Kst.wallClock(DateTime.now()).add(const Duration(days: 1)).year;
    final minimum = year >= 2027 ? 10700 : 10320;
    final minimumText = '${minimum ~/ 1000},${(minimum % 1000).toString().padLeft(3, '0')}';
    await _until(tester, _text('최저시급 $minimumText원 이상'));
    await _shot(tester, 'ba2-form');
    await _tap(tester, find.widgetWithText(HiButton, '근무 올리기'));
    await _until(tester, _text('근무를 올렸어요'));
    await _until(tester, _text('E2E 새 근무'));
    final posted = await tester.runAsync(() async {
      final business = (await SupabaseEmployerRepository(owner, _config).businesses()).single;
      final now = DateTime.now().toUtc();
      return SupabaseEmployerRepository(owner, _config).shifts(business.id, now, now.add(const Duration(days: 3)));
    });
    final created = posted!.singleWhere((s) => s.title == 'E2E 새 근무');
    expect(created.hourlyWage, minimum);
    expect(created.address, '부산 해운대구 해운대해변로 264', reason: "no template: the store's address");
    await _close(tester);
  });

  testWidgets('worker: cancelling in A06 (more than a day ahead: free)', skip: _skip != null, (tester) async {
    phone(tester);
    await tester.pumpWidget(workerApp(location: WorkerRoutes.myShifts));
    await _until(tester, _text('E2E 수동 확정'));
    // The shift's own address (BA2 «주소»), not the business's, and how far
    // it is from where the app last saw the worker.
    expect(find.textContaining(RegExp(r'^부산 해운대구 구남로 30 · [\d,.]+ km$')), findsOneWidget);
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

  testWidgets('worker: a new worker signs up — A01, T1, T2, the three A02 steps, then the feed', skip: _skip != null,
      (tester) async {
    phone(tester);
    final newcomer = _client(_anonKey);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(newcomer),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(newcomer)),
        shiftRepositoryProvider.overrideWithValue(SupabaseShiftRepository(newcomer, _config)),
        accountRepositoryProvider.overrideWithValue(SupabaseAccountRepository(newcomer)),
        workerProfileRepositoryProvider.overrideWithValue(SupabaseWorkerProfileRepository(newcomer, _config)),
        locationServiceProvider.overrideWithValue(const _AtTheBeach()),
      ],
      child: const WorkerApp(),
    )));
    // Signed out: the start gate opens A01.
    await _until(tester, _text('Telefon raqam bilan'));
    await _tap(tester, _text('Telefon raqam bilan'));
    await _until(tester, _text('Telefon raqamingiz'));
    await _settle(tester);
    await tester.enterText(find.byType(TextField).last, '01000000041');
    await _tap(tester, find.widgetWithText(HiButton, 'Kod olish'));
    await _until(tester, _text('Kodni kiriting'));
    await _settle(tester);
    await tester.enterText(find.byType(TextField).last, '123456');
    // A new account: A02 first.
    await _until(tester, _text('Profil · 1 / 3'));
    await _settle(tester);
    final names = find.byType(TextField);
    expect(names, findsNWidgets(2), reason: 'only A02 on screen');
    await tester.enterText(names.at(0), 'Dilnoza');
    await tester.enterText(names.at(1), 'Testova');
    await _tap(tester, find.widgetWithText(HiButton, 'Davom etish'));
    await _until(tester, _text('Profil · 2 / 3'));
    await _settle(tester);
    await _tap(tester, _text("O'zbekcha"));
    await _tap(tester, _text('Koreyscha'));
    await _tap(tester, _text('3'));
    await _tap(tester, find.byType(HiSelectField).at(1));
    await _until(tester, find.byType(TextField));
    await _settle(tester);
    await tester.enterText(find.byType(TextField).last, 'Mapo');
    await _until(tester, _text('Mapo-gu, Seul'));
    await _tap(tester, _text('Mapo-gu, Seul'));
    await _tap(tester, find.widgetWithText(HiButton, 'Davom etish'));
    await _until(tester, _text('Profil · 3 / 3'));
    await _settle(tester);
    await _tap(tester, find.bySemanticsLabel('Shanba, Ertalab'));
    await _tap(tester, find.widgetWithText(HiButton, 'Saqlash va boshlash'));
    await _until(tester, _text('Smenalar'));
    // The feed loaded (cards or none today: no more grey placeholders).
    for (var i = 0; i < 200 && find.byType(ShiftCardSkeleton).evaluate().isNotEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.byType(ShiftCardSkeleton), findsNothing);
    await _shot(tester, 'a02-signed-up-feed');
    final saved = await tester.runAsync(() => SupabaseWorkerProfileRepository(newcomer, _config).load());
    expect(saved!.firstName, 'Dilnoza');
    expect(saved.lastName, 'Testova');
    expect(saved.languages, containsAll(['uz', 'ko']));
    expect(saved.topik, 3);
    expect(saved.district, 'mapo');
    expect(saved.availability, WorkerProfileDraft.bit(5, 0), reason: 'Saturday morning only');
    await _close(tester);
  });

  testWidgets('owner: BA3 stays open and the applicant arrives by itself (Realtime)', skip: _skip != null,
      (tester) async {
    phone(tester);
    final employer = SupabaseEmployerRepository(owner, _config);
    final business = (await tester.runAsync(employer.businesses))!.single;
    final start = DateTime.now().toUtc().add(const Duration(days: 2));
    final live = (await tester.runAsync(() => employer.createShift(ShiftDraft(
          businessId: business.id,
          title: 'E2E 실시간',
          startsAt: start,
          endsAt: start.add(const Duration(hours: 3)),
          hourlyWage: 11000,
          slots: 1,
          autoConfirm: false,
        ))))!;
    await tester.pumpWidget(ownerApp(location: EmployerRoutes.shift(live.id), live: true));
    await _until(tester, _text('E2E 실시간'));
    expect(_text(Ko.applicants(1)), findsNothing);
    // The worker applies elsewhere; nothing is tapped here.
    final applied = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).apply(live.id));
    await _until(tester, _text(Ko.applicants(1)));
    await _until(tester, _text('Sardor Testov'));
    await _shot(tester, 'ba3-live-applicant');
    await _close(tester);

    // A12 open on the worker's side: the 확정 arrives by itself too.
    await tester.pumpWidget(workerApp(location: WorkerRoutes.notifications, live: true));
    await _until(tester, _text('Smena tasdiqlandi'));
    final before = _text('Smena tasdiqlandi').evaluate().length;
    await tester.runAsync(() => employer.decide(applied!.applicationId, accept: true));
    for (var i = 0; i < 200 && _text('Smena tasdiqlandi').evaluate().length == before; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(_text('Smena tasdiqlandi'), findsNWidgets(before + 1));
    await _close(tester);
  });

  testWidgets('owner: BA4 «다시 요청» posts a shift and invites the worker; A12 tells them how far it is',
      skip: _skip != null, (tester) async {
    phone(tester);
    await tester.pumpWidget(ownerApp(location: EmployerRoutes.workers));
    // The favourite of the BA4 test, who finished a shift here.
    await _until(tester, _text('Sardor Testov'));
    await _tap(tester, find.widgetWithText(HiButton, Ko.requestAgain));
    // BA2 for the invitation; no template yet: the content first.
    await _until(tester, find.widgetWithText(HiButton, '근무 올리기'));
    await _settle(tester);
    await _tap(tester, find.widgetWithText(HiButton, '근무 올리기'));
    await _until(tester, find.byType(BottomSheet));
    await tester.enterText(
        find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextField)).at(0), 'E2E 다시 요청');
    await _tap(tester, find.descendant(of: find.byType(BottomSheet), matching: find.widgetWithText(HiButton, '저장하기')));
    final tomorrowChip = find.textContaining(RegExp('^내일'), findRichText: true);
    await _until(tester, tomorrowChip);
    await _tap(tester, tomorrowChip);
    await _until(tester, find.textContaining('최저시급', findRichText: true));
    await _tap(tester, find.widgetWithText(HiButton, '근무 올리기'));
    // Posted and invited (the name when BA4's list is still at hand); a
    // refusal would say why instead.
    await _until(tester, find.textContaining(RegExp('요청을 보냈어요|근무를 올렸어요')));
    await _close(tester);

    await tester.pumpWidget(workerApp(location: WorkerRoutes.notifications));
    await _until(tester, _text('Sizga mos yangi smena'));
    // (Without the invisible word joiner that keeps «₩/soat» on one line.)
    final lines = [
      for (final t in tester.widgetList<Text>(find.byType(Text))) (t.data ?? '').replaceAll('\u2060', ''),
    ];
    final line = lines.firstWhere((t) => t.startsWith('E2E Kafe · '));
    expect(line, matches(RegExp(r'/soat · [\d,.]+ km$')), reason: 'how far, from where the app last saw the worker');
    // One notice for the invited shift: the invitation took the place of the
    // «new shift nearby» the shift sent when it was posted. (Its line can
    // read like another shift's of the same day, time and wage.)
    final invited = await tester.runAsync(() async {
      final employer = SupabaseEmployerRepository(owner, _config);
      final business = (await employer.businesses()).single;
      final now = DateTime.now().toUtc();
      final shifts = await employer.shifts(business.id, now, now.add(const Duration(days: 3)));
      final id = shifts.singleWhere((s) => s.title == 'E2E 다시 요청').id;
      return (await SupabaseAccountRepository(worker).notifications()).where((n) => n.shiftId == id).toList();
    });
    expect(invited, hasLength(1));
    await _shot(tester, 'a12-invitation');
    await _close(tester);
  });

  testWidgets('a confirmed worker who never came: the upkeep job marks it; 알림 says so, A11 drops by 20',
      skip: _skip != null, (tester) async {
    phone(tester);
    final employer = SupabaseEmployerRepository(owner, _config);
    final business = (await tester.runAsync(employer.businesses))!.single;
    final start = DateTime.now().toUtc().add(const Duration(days: 4));
    final missed = (await tester.runAsync(() => employer.createShift(ShiftDraft(
          businessId: business.id,
          title: 'E2E 노쇼',
          startsAt: start,
          endsAt: start.add(const Duration(hours: 3)),
          hourlyWage: 11000,
          slots: 1,
          autoConfirm: true,
        ))))!;
    await tester.runAsync(() => SupabaseShiftRepository(worker, _config).apply(missed.id));
    // The shift went by without the worker: it is moved into the past and the
    // upkeep job runs (pg_cron every ten minutes in production).
    await tester.runAsync(() async {
      final admin = _client(_serviceKey);
      final now = DateTime.now().toUtc();
      await admin.from('shifts').update({
        'starts_at': now.subtract(const Duration(hours: 4)).toIso8601String(),
        'ends_at': now.subtract(const Duration(hours: 1)).toIso8601String(),
      }).eq('id', missed.id);
      await admin.rpc('close_finished_shifts');
    });
    await tester.pumpWidget(ownerApp(location: EmployerRoutes.notifications));
    await _until(tester, _text(Ko.notifNoShowText('Sardor Testov', 'E2E 노쇼')));
    await _shot(tester, 'ba-no-show');
    await _close(tester);

    await tester.pumpWidget(workerApp());
    await _until(tester, _text('Smenalar'));
    await _tap(tester, _text('Profil'));
    await _until(tester, _text('Sardor Testov'));
    await _until(tester, _text('80'), seconds: 30);
    await _close(tester);
  });

  /// A shift of the E2E business, [inHours] from now, the worker applied.
  Future<(EmployerShift, ApplyResult)> appliedShift(WidgetTester tester, String title,
      {required int inHours, required bool auto}) async {
    final employer = SupabaseEmployerRepository(owner, _config);
    final business = (await tester.runAsync(employer.businesses))!.single;
    final start = DateTime.now().toUtc().add(Duration(hours: inHours));
    final created = (await tester.runAsync(() => employer.createShift(ShiftDraft(
          businessId: business.id,
          title: title,
          startsAt: start,
          endsAt: start.add(const Duration(hours: 3)),
          hourlyWage: 11000,
          slots: 1,
          autoConfirm: auto,
        ))))!;
    final applied = (await tester.runAsync(() => SupabaseShiftRepository(worker, _config).apply(created.id)))!;
    return (created, applied);
  }

  testWidgets('worker: cancelling within 24 hours warns first and costs 5 points; the owner is told',
      skip: _skip != null, (tester) async {
    phone(tester);
    final (late, _) = await appliedShift(tester, 'E2E 늦은 취소', inHours: 5, auto: true);
    await tester.pumpWidget(workerApp(location: WorkerRoutes.myShifts));
    await _until(tester, _text('E2E 늦은 취소'));
    final card = find.ancestor(
      of: _text('E2E 늦은 취소'),
      matching: find.byWidgetPredicate((w) => w.runtimeType.toString() == '_MyShiftCard'),
    );
    await _tap(tester, find.descendant(of: card, matching: find.text('Bekor qilish')));
    await _until(tester, _text('Smenani bekor qilasizmi?'));
    expect(_text("Smena boshlanishiga 24 soatdan kam qoldi. Bekor qilsangiz, ishonchlilik balingiz pasayadi."),
        findsOneWidget);
    await _tap(tester, _text('Ha, bekor qilish'));
    await _until(tester, _text('Smena bekor qilindi.'));
    final mine = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    final cancelled = mine!.singleWhere((a) => a.shift.id == late.id);
    expect(cancelled.status, ApplicationStatus.cancelled);
    expect(cancelled.lateCancel, isTrue);
    await _close(tester);

    // 80 after the no-show, now 75.
    await tester.pumpWidget(workerApp());
    await _until(tester, _text('Smenalar'));
    await _tap(tester, _text('Profil'));
    await _until(tester, _text('75'), seconds: 30);
    await _close(tester);

    await tester.pumpWidget(ownerApp(location: EmployerRoutes.notifications));
    await _until(tester, _text(Ko.notifCancelledText('Sardor Testov', 'E2E 늦은 취소')));
    await _close(tester);
  });

  testWidgets('owner: 거절 on BA3; the worker reads «Ariza qabul qilinmadi»', skip: _skip != null, (tester) async {
    phone(tester);
    final (turnedDown, _) = await appliedShift(tester, 'E2E 거절', inHours: 72, auto: false);
    await tester.pumpWidget(ownerApp(location: EmployerRoutes.shift(turnedDown.id)));
    await _until(tester, _text(Ko.applicants(1)));
    await _tap(tester, find.widgetWithText(HiButton, Ko.reject));
    await _until(tester, _text(Ko.rejected('Sardor Testov')));
    await _close(tester);

    await tester.pumpWidget(workerApp(location: WorkerRoutes.notifications));
    await _until(tester, find.textContaining('smenasiga boshqa ishchi tanlandi.'));
    await _close(tester);
  });

  testWidgets('a request nobody answered before the start: A12 says so, not «another worker was chosen»',
      skip: _skip != null, (tester) async {
    phone(tester);
    final (unanswered, _) = await appliedShift(tester, 'E2E 만료', inHours: 72, auto: false);
    // The shift begins with the request still waiting; the upkeep job turns
    // it down (pg_cron in production).
    await tester.runAsync(() async {
      final admin = _client(_serviceKey);
      final now = DateTime.now().toUtc();
      await admin.from('shifts').update({
        'starts_at': now.subtract(const Duration(minutes: 10)).toIso8601String(),
        'ends_at': now.add(const Duration(hours: 2)).toIso8601String(),
      }).eq('id', unanswered.id);
      await admin.rpc('close_finished_shifts');
    });
    await tester.pumpWidget(workerApp(location: WorkerRoutes.notifications));
    await _until(tester, find.textContaining('smenasi boshlandi, arizangizga javob berilmadi.'));
    await _shot(tester, 'a12-unanswered');
    await _close(tester);
  });

  testWidgets('owner: a new owner signs up on BA0; with no 국세청 key the business waits and BA1 says so',
      skip: _skip != null, (tester) async {
    phone(tester);
    final newcomer = _client(_anonKey);
    await tester.pumpWidget(capture(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(newcomer),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(newcomer)),
        employerRepositoryProvider.overrideWithValue(SupabaseEmployerRepository(newcomer, _config)),
      ],
      child: const EmployerApp(),
    )));
    // Signed out: the start gate opens BA0.
    await _until(tester, find.widgetWithText(HiButton, '시작하기'));
    await _settle(tester);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '01000000051');
    await tester.enterText(fields.at(1), '9990000054');
    await _tap(tester, find.widgetWithText(HiButton, '시작하기'));
    await _until(tester, _text('인증번호 입력'));
    await _settle(tester);
    await tester.enterText(find.byType(TextField).last, '123456');
    // The code signs in; business-register files the number (no key in the
    // local stack: it waits for 국세청) and BA1 opens on it.
    await _until(tester, _text('오늘의 근무'));
    await _until(tester, _text(Ko.reviewPendingTitle));
    expect(_text('사업장 999-00-00054'), findsWidgets, reason: 'the name until the store details are set');
    // A new business: no shifts yet (the day loaded, not still loading).
    await _until(tester, _text(Ko.noShiftsToday));
    await _shot(tester, 'ba0-ba1-waiting');
    final mine = await tester.runAsync(() => SupabaseEmployerRepository(newcomer, _config).businesses());
    expect(mine!.single.review, BusinessReview.pending);
    expect(mine.single.bizNo, '9990000054');
    await _close(tester);
  });
}

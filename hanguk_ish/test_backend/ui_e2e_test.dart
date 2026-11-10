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
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';
import 'package:hanguk_ish/features/worker/work/qr_scanner.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../test/helpers/fonts.dart';

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
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(finder.first);
  await tester.pump(const Duration(milliseconds: 100));
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
    await tester.pumpWidget(ProviderScope(
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
    ));

    // The start screen loads the saved profile and opens the feed.
    await _until(tester, _text('Smenalar'));
    final today = Kst.wallClock(DateTime.now());
    final day = Kst.wallClock(shift.startsAt);
    if (day.day != today.day) await _tap(tester, _text('Ertaga'));
    // The card names the business (its title is in the card's label); A05
    // shows the title as the owner wrote it (no translation yet). The
    // business has more shifts today: the card of this one.
    await _until(tester, _text('E2E Kafe'));
    await _tap(tester, find.bySemanticsLabel(RegExp('E2E 홀 보조')));
    await _until(tester, _text('E2E 홀 보조'));
    await _until(tester, _text('Smenani olish'));
    await _tap(tester, _text('Smenani olish'));
    await _until(tester, _text('Tasdiqlash'));
    await _tap(tester, _text('Tasdiqlash'));
    await _until(tester, _text('Smena olindi!'));

    final mine = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    expect(mine!.where((a) => a.shift.id == shift.id), hasLength(1), reason: 'the server has the application');

    await _tap(tester, _text('Lentaga qaytish'));
    await _until(tester, _text('Mening smenalarim'));
    await _tap(tester, _text('Mening smenalarim'));
    await _until(tester, _text('E2E 홀 보조'));
    await _close(tester);
  });

  testWidgets('owner: BA1 lists the shift; BA3 shows the worker who took it', skip: _skip != null, (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(owner),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(owner)),
        employerRepositoryProvider.overrideWithValue(SupabaseEmployerRepository(owner, _config)),
      ],
      child: const EmployerApp(),
    ));

    await _until(tester, _text('오늘의 근무'));
    await _until(tester, _text('해운대 E2E 카페'));
    await _until(tester, _text('E2E 홀 보조'));
    await _tap(tester, _text('E2E 홀 보조'));
    await _until(tester, _text('Sardor Testov'));
    await _close(tester);
  });

  testWidgets('worker: the workday by the door code — in, at work, out, result, rating', skip: _skip != null,
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
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
    ));

    await _until(tester, _text('Mening smenalarim'));
    await _tap(tester, _text('Mening smenalarim'));
    await _until(tester, _text('E2E 아침 보조'));
    await _tap(tester, _text('E2E 아침 보조'));
    // The entry screen reads the code at once; the server checks it in.
    await _until(tester, _text('Chiqish — QR skanerlash'));
    expect(find.byType(AtWorkScreen), findsOneWidget);
    await _tap(tester, _text('Chiqish — QR skanerlash'));
    await _until(tester, _text('Smena yakunlandi'));
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
    await tester.pumpWidget(ProviderScope(
      overrides: [
        backendConfigProvider.overrideWithValue(_config),
        supabaseClientProvider.overrideWithValue(owner),
        authRepositoryProvider.overrideWithValue(SupabaseAuthRepository(owner)),
        employerRepositoryProvider.overrideWithValue(SupabaseEmployerRepository(owner, _config)),
      ],
      child: const EmployerApp(),
    ));

    await _until(tester, _text('E2E 수동 확정'));
    await _tap(tester, _text('E2E 수동 확정'));
    await _until(tester, _text('확정'));
    await _tap(tester, _text('확정'));
    await _until(tester, _text('Sardor Testov님을 확정했어요'));
    final decided = await tester.runAsync(() => SupabaseEmployerRepository(owner, _config).shift(manual.id));
    expect(decided!.confirmed, 1, reason: 'the server has the decision');

    await _tap(tester, find.bySemanticsLabel('뒤로'));
    await _until(tester, _text('리포트'));
    await _tap(tester, _text('리포트'));
    await _until(tester, _text('E2E 아침 보조'));
    await _tap(tester, _text('E2E 아침 보조'));
    await _until(tester, _text('지급 완료로 표시'));
    await _tap(tester, _text('지급 완료로 표시'));
    await _until(tester, _text('지급 완료 · 1건'));
    await _close(tester);
  });
}

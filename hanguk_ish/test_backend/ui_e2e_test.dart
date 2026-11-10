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
import 'package:hanguk_ish/data/repositories/account_repository.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/employer_repository.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

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

  setUpAll(() async {
    if (_skip != null) return;
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
    await SupabaseWorkerProfileRepository(worker, _config).save(const WorkerProfileDraft(
      firstName: 'Sardor',
      lastName: 'Testov',
      languages: {'uz', 'ko'},
      topik: 3,
      district: 'mapo',
      visa: 'D-2',
    ));
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
    await _until(tester, find.text('Smenalar'));
    final today = Kst.wallClock(DateTime.now());
    final day = Kst.wallClock(shift.startsAt);
    if (day.day != today.day) await _tap(tester, find.text('Ertaga'));
    await _until(tester, find.text('E2E Kafe'));
    expect(find.text('E2E 홀 보조'), findsWidgets, reason: 'the title as the owner wrote it (no translation yet)');

    await _tap(tester, find.text('E2E Kafe'));
    await _until(tester, find.text('Smenani olish'));
    await _tap(tester, find.text('Smenani olish'));
    await _until(tester, find.text('Tasdiqlash'));
    await _tap(tester, find.text('Tasdiqlash'));
    await _until(tester, find.text('Smena olindi!'));

    final mine = await tester.runAsync(() => SupabaseShiftRepository(worker, _config).myShifts());
    expect(mine!.where((a) => a.shift.id == shift.id), hasLength(1), reason: 'the server has the application');

    await _tap(tester, find.text('Lentaga qaytish'));
    await _until(tester, find.text('Mening smenalarim'));
    await _tap(tester, find.text('Mening smenalarim'));
    await _until(tester, find.text('E2E 홀 보조'));
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

    await _until(tester, find.text('오늘의 근무'));
    await _until(tester, find.text('해운대 E2E 카페'));
    await _until(tester, find.text('E2E 홀 보조'));
    await _tap(tester, find.text('E2E 홀 보조'));
    await _until(tester, find.text('Sardor Testov'));
    await _close(tester);
  });
}

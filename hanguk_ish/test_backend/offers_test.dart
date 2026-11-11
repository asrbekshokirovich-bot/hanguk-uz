// Hanguk's staff match a job found outside the app (P39–P40), on a real local
// Supabase stack: the staff's functions as hanguk.uz calls them, the worker
// app's repositories for the offer — A12, A05, «Qiziqmayman», «Smenani
// olish» — and the 확정 the staff give after calling the employer.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_KEY=… flutter test test_backend
//
// Without those variables every test is skipped.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/backend/supabase_account_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_shift_repository.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final _env = Platform.environment;
final _url = _env['SUPABASE_URL'] ?? '';
final _anonKey = _env['SUPABASE_ANON_KEY'] ?? '';
final _serviceKey = _env['SUPABASE_SERVICE_KEY'] ?? '';
final _skip = _url.isEmpty || _anonKey.isEmpty || _serviceKey.isEmpty
    ? 'set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY (a local supabase start)'
    : null;

final config = BackendConfig(url: _url, publishableKey: _anonKey);

SupabaseClient _client(String key) =>
    SupabaseClient(_url, key, authOptions: const AuthClientOptions(autoRefreshToken: false));

/// Signs in with a test number: its code is fixed in supabase/config.toml.
Future<SupabaseClient> _signIn(String phone) async {
  final client = _client(_anonKey);
  await client.auth.signInWithOtp(phone: phone);
  await client.auth.verifyOTP(phone: phone, token: '123456', type: OtpType.sms);
  return client;
}

Matcher _refused(String code) => throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', code));

void main() {
  late SupabaseClient staff;
  late SupabaseClient worker;
  late SupabaseClient stranger;
  late SupabaseShiftRepository workerShifts;
  late String workerId;
  late String businessId;
  late String jobId;

  setUpAll(() async {
    if (_skip != null) return;
    final admin = _client(_serviceKey);
    staff = await _signIn('+821000000061');
    worker = await _signIn('+821000000062');
    stranger = await _signIn('+821000000063');
    workerId = worker.auth.currentUser!.id;
    // An admin makes the staff member staff (Supabase dashboard / SQL).
    await admin.from('staff_members').insert({'user_id': staff.auth.currentUser!.id});
    await admin.from('profiles').update({'first_name': 'Dilnoza', 'last_name': 'Rahimova'}).eq(
        'id', staff.auth.currentUser!.id);
    await SupabaseWorkerProfileRepository(worker, config).save(const WorkerProfileDraft(
      firstName: 'Sardor',
      lastName: 'Toshmatov',
      languages: {'uz', 'ru', 'ko'},
      topik: 3,
      district: 'mapo',
    ));
    await SupabaseAccountRepository(worker).savePosition(37.5563, 126.9236);
    await SupabaseWorkerProfileRepository(stranger, config).save(const WorkerProfileDraft(
      firstName: 'Jasur',
      lastName: 'Aliyev',
      languages: {'uz'},
      district: 'mapo',
    ));
    workerShifts = SupabaseShiftRepository(worker, config);
  });

  group('hanguk.uz → the worker app', skip: _skip, () {
    test('the staff keep an employer from Telegram and post an invite-only job', () async {
      expect(await staff.rpc('is_staff'), isTrue);
      expect(await worker.rpc('is_staff'), isFalse);
      businessId = await staff.rpc('staff_save_business', params: {
        'p_business': null,
        'p_name': '홍대 이삿짐센터',
        'p_category': 'logistics',
        'p_area': '홍대',
        'p_address': '마포구 와우산로 21',
        'p_district': 'Mapo-gu',
        'p_lat': 37.5560,
        'p_lng': 126.9230,
        'p_name_i18n': {'uz': "Hongdae ko'chish xizmati"},
        'p_contact': {'contact_name': '김사장', 'phone': '010-5555-1234', 'source': 'https://t.me/koreajobs_uz/1234'},
      }) as String;
      final start = DateTime.now().toUtc().add(const Duration(days: 1, hours: 2));
      final starts = DateTime.utc(start.year, start.month, start.day, start.hour);
      jobId = await staff.rpc('staff_save_shift', params: {
        'p_shift': null,
        'p_business': businessId,
        'p_title': '이삿짐 운반 보조',
        'p_starts_at': starts.toIso8601String(),
        'p_ends_at': starts.add(const Duration(hours: 4)).toIso8601String(),
        'p_hourly_wage': 13000,
        'p_slots': 2,
        'p_duties': '짐 나르기',
        'p_invite_only': true,
        'p_source': 'https://t.me/koreajobs_uz/1234',
        'p_notes': '오전 10시까지 도착',
      }) as String;
      // Others cannot: workers get FORBIDDEN, contacts stay the staff's.
      await expectLater(
        worker.rpc('staff_board', params: {'p_from': DateTime.now().toIso8601String(), 'p_to': starts.toIso8601String()}),
        throwsA(isA<PostgrestException>().having((e) => e.message, 'message', 'FORBIDDEN')),
      );
      await expectLater(worker.from('business_contacts').select(), throwsA(isA<PostgrestException>()));
    });

    test('nobody sees it before an offer: not in the feed, not on A05', () async {
      final feed = await workerShifts.feed(FeedQuery(
        from: DateTime.now(),
        to: DateTime.now().add(const Duration(days: 3)),
        lat: 37.5563,
        lng: 126.9236,
      ));
      expect(feed.map((s) => s.id), isNot(contains(jobId)));
      expect(await workerShifts.shift(jobId), isNull);
      await expectLater(workerShifts.apply(jobId), _refused('SHIFT_CLOSED'));
    });

    test('who fits: the worker near the job, onboarded, free then', () async {
      final candidates = await staff.rpc('staff_candidates', params: {'p_shift': jobId, 'p_max_km': 5}) as List;
      final sardor = candidates.cast<Map<String, dynamic>>().firstWhere((c) => c['id'] == workerId);
      expect(sardor['first_name'], 'Sardor');
      expect(sardor['busy'], isFalse);
      expect(sardor['available'], isTrue, reason: 'no schedule set: any time');
      expect((sardor['distance_km'] as num).toDouble(), lessThan(1));
      expect(sardor['offer_status'], isNull);
    });

    test('the offer: A12 «Sizga ish taklif qilindi» with the note, A05 with the offer', () async {
      final sent = await staff.rpc('staff_send_offers', params: {
        'p_shift': jobId,
        'p_workers': [workerId],
        'p_note': 'Ertalab 10 da yetib keling',
      });
      expect(sent, 1);
      final notices = await SupabaseAccountRepository(worker).notifications();
      final offer = notices.firstWhere((n) => n.kind == NotificationKind.jobOffer);
      expect(offer.shiftId, jobId);
      expect(offer.note, 'Ertalab 10 da yetib keling');
      expect(offer.wage, 13000);
      expect(offer.businessName('ko'), startsWith('홍대 이삿짐센터'));

      final job = (await workerShifts.shift(jobId))!;
      expect(job.offer!.status, OfferStatus.sent);
      expect(job.offer!.note, 'Ertalab 10 da yetib keling');
      expect(job.title, '이삿짐 운반 보조');
      expect(job.slotsLeft, 2);
      // Still nobody else's.
      expect(await SupabaseShiftRepository(stranger, config).shift(jobId), isNull);
    });

    test('«Qiziqmayman», then «Smenani olish» after all: the staff decide', () async {
      await workerShifts.declineOffer(jobId);
      expect((await workerShifts.shift(jobId))!.offer!.status, OfferStatus.declined);
      await expectLater(workerShifts.declineOffer(jobId), _refused('NOT_FOUND'), reason: 'answered once');

      final applied = await workerShifts.apply(jobId);
      expect(applied.status, ApplicationStatus.pending, reason: 'no 자동 확정: the staff call the employer first');
      final job = (await workerShifts.shift(jobId))!;
      expect(job.offer!.status, OfferStatus.applied);
      expect(job.myStatus, ApplicationStatus.pending);

      final page = await staff.rpc('staff_shift', params: {'p_shift': jobId}) as Map<String, dynamic>;
      expect((page['offers'] as List).single['status'], 'applied');
      expect((page['contact'] as Map)['phone'], '010-5555-1234');
      final application = (page['applications'] as List).single as Map<String, dynamic>;
      expect(application['status'], 'pending');
      expect((application['worker'] as Map)['phone'], isNotNull, reason: 'the staff call the worker');

      await staff.rpc('decide_application', params: {'p_application': application['id'], 'p_accept': true});
      final mine = await workerShifts.myShifts();
      expect(mine.firstWhere((s) => s.shift.id == jobId).status, ApplicationStatus.confirmed);
      final told = await SupabaseAccountRepository(worker).notifications();
      expect(told.any((n) => n.kind == NotificationKind.confirmed && n.shiftId == jobId), isTrue);
    });

    test('the board counts it; the chat reaches the staff', () async {
      final board = await staff.rpc('staff_board', params: {
        'p_from': DateTime.now().toUtc().toIso8601String(),
        'p_to': DateTime.now().toUtc().add(const Duration(days: 3)).toIso8601String(),
      }) as List;
      final row = board.cast<Map<String, dynamic>>().firstWhere((r) => r['id'] == jobId);
      expect(row['managed'], isTrue);
      expect(row['invite_only'], isTrue);
      expect((row['applications'] as Map)['confirmed'], 1);
      expect((row['offers'] as Map)['applied'], 1);

      final mine = await workerShifts.myShifts();
      final app = mine.firstWhere((s) => s.shift.id == jobId).applicationId;
      await workerShifts.sendMessage(app, 'Salom, ertaga boraman');
      final seen = await staff.from('messages').select('body').eq('application_id', app) as List;
      expect(seen.map((m) => m['body']), contains('Salom, ertaga boraman'));
    });
  });
}

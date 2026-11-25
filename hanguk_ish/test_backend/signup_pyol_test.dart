// A new worker from the first SMS code to the first puyl (2026-11-24), on a
// real local Supabase stack, with the app's own repositories: sign-up by
// phone, a wrong code, the profile and the 90 free puyl (once), the invite
// code, «Bo'sh kunlarim» as the staff see them at night, and buying puyl —
// the request, the staff's approval and the «+100 puyl» notice.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_KEY=… flutter test test_backend
//
// Without those variables every test is skipped.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/backend/supabase_account_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_auth_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_pyol_repository.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/repositories/pyol_repository.dart';
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
    SupabaseClient(_url, key,
        authOptions: const AuthClientOptions(autoRefreshToken: false), postgrestOptions: ishPostgrestOptions);

Matcher _refused(String code) => throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', code));

/// Signs up the way A01 does: the number as typed, then the SMS code.
Future<SupabaseClient> _signUp(String typed) async {
  // The stack sends one code per number every 5 seconds (max_frequency).
  await Future<void>.delayed(const Duration(seconds: 6));
  final client = _client(_anonKey);
  final auth = SupabaseAuthRepository(client);
  await auth.sendCode(typed);
  await auth.verifyCode(typed, '123456');
  return client;
}

String _day(int plus) {
  final k = DateTime.now().toUtc().add(Duration(hours: 9, days: plus));
  return '${k.year}-${k.month.toString().padLeft(2, '0')}-${k.day.toString().padLeft(2, '0')}';
}

void main() {
  late SupabaseClient admin;
  late SupabaseClient worker;
  late SupabaseClient friend;
  late SupabaseClient staff;
  late SupabasePyolRepository pyol;
  late SupabaseAccountRepository account;

  setUpAll(() async {
    if (_skip != null) return;
    admin = _client(_serviceKey);
  });

  group('A01 sign-up by phone', skip: _skip, () {
    test('a wrong code is refused, and nothing is made', () async {
      final client = _client(_anonKey);
      final auth = SupabaseAuthRepository(client);
      await auth.sendCode('010-0000-0091');
      await expectLater(auth.verifyCode('010-0000-0091', '000000'), _refused('CODE_INVALID'));
      await expectLater(auth.verifyCode('010-0000-0091', '12a456'), _refused('CODE_INVALID'));
      expect(client.auth.currentUser, isNull);
      await expectLater(() => auth.sendCode('12345'), _refused('PHONE_INVALID'));
    });

    test('the right code signs in: a Hanguk Ish account with its ish profile, no A02 yet', () async {
      worker = await _signUp('010-0000-0091');
      final user = worker.auth.currentUser!;
      expect(user.phone, '821000000091');
      expect(user.userMetadata?['app'], 'hanguk_ish');
      final row = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle();
      expect(row?['id'], user.id);
      expect(await SupabaseWorkerProfileRepository(worker, config).load(), isNull);
      pyol = SupabasePyolRepository(worker);
      account = SupabaseAccountRepository(worker);
    });

    test('before the profile: no free days, no puyl', () async {
      await expectLater(
        pyol.setFreeDates([FreeDate(day: DateTime.parse(_day(1)), part: 'any', district: 'Ansan')]),
        _refused('PROFILE_INCOMPLETE'),
      );
      expect((await account.coins()).balance, 0);
    });

    test('A02 saved: 90 free puyl, once per phone', () async {
      final profile = SupabaseWorkerProfileRepository(worker, config);
      await profile.save(const WorkerProfileDraft(
        firstName: 'Bekzod',
        lastName: 'Yusupov',
        languages: {'uz', 'ru'},
        topik: 2,
        district: 'mapo',
      ));
      expect((await profile.load())!.firstName, 'Bekzod');
      expect((await account.coins()).balance, 90);
      await profile.save((await profile.load())!.copyWith(topik: 3));
      expect((await account.coins()).balance, 90, reason: 'saving again gives nothing');
      // The client cannot mark itself onboarded.
      await expectLater(
        worker.from('worker_profiles').update({'onboarded_at': null}).eq('user_id', worker.auth.currentUser!.id),
        throwsA(isA<PostgrestException>()),
      );
    });

    test('signing out and in again: the same account, the same 90', () async {
      final id = worker.auth.currentUser!.id;
      await SupabaseAuthRepository(worker).signOut();
      worker = await _signUp('+82 10-0000-0091');
      expect(worker.auth.currentUser!.id, id);
      pyol = SupabasePyolRepository(worker);
      account = SupabaseAccountRepository(worker);
      expect((await account.coins()).balance, 90);
    });
  });

  group('invite a friend', skip: _skip, () {
    test('the friend enters the code once; a wrong one is NOT_FOUND', () async {
      final mine = (await pyol.referral())!;
      expect(mine.code, isNotEmpty);
      friend = await _signUp('010-0000-0092');
      final friends = SupabasePyolRepository(friend);
      await SupabaseWorkerProfileRepository(friend, config).save(const WorkerProfileDraft(
        firstName: 'Ulug\'bek',
        lastName: 'Nazarov',
        languages: {'uz'},
        district: 'mapo',
      ));
      await expectLater(friends.setReferrer('NOPE00'), _refused('NOT_FOUND'));
      await friends.setReferrer(mine.code.toLowerCase());
      expect((await friends.referral())!.invitedBy, isTrue);
      await expectLater(friends.setReferrer(mine.code), _refused('TOO_LATE'));
      await expectLater(pyol.setReferrer(mine.code), _refused('INVALID'), reason: 'not oneself');
    });
  });

  group('«Bo\'sh kunlarim» → the staff at night', skip: _skip, () {
    test('the worker posts two days; the staff see them', () async {
      final saved = await pyol.setFreeDates([
        FreeDate(day: DateTime.parse(_day(1)), part: 'day', district: 'Ansan'),
        FreeDate(day: DateTime.parse(_day(2)), part: 'night', district: 'Ansan'),
      ]);
      expect(saved.map((d) => d.part), ['day', 'night']);
      expect((await pyol.freeDates()).map((d) => d.dayText), [_day(1), _day(2)]);
      await expectLater(
        pyol.setFreeDates([FreeDate(day: DateTime.parse(_day(1)), part: 'day', district: ' ')]),
        _refused('DISTRICT_REQUIRED'),
      );
      await expectLater(
        pyol.setFreeDates([FreeDate(day: DateTime.parse(_day(40)), part: 'day', district: 'Ansan')]),
        _refused('INVALID'),
        reason: 'at most 31 days ahead',
      );

      staff = await _signUp('010-0000-0093');
      await admin.from('staff_members').insert({'user_id': staff.auth.currentUser!.id});
      final summary = (await staff.rpc('staff_free_dates_summary', params: {'p_days': 7}) as List)
          .cast<Map<String, dynamic>>();
      expect(summary.any((r) => r['day'] == _day(1) && r['district'] == 'Ansan'), isTrue);
      final free = (await staff.rpc('staff_free_workers', params: {'p_day': _day(2), 'p_district': 'ansan'}) as List)
          .cast<Map<String, dynamic>>();
      final me = free.firstWhere((w) => w['worker_id'] == worker.auth.currentUser!.id);
      expect(me['first_name'], 'Bekzod');
      expect(me['part'], 'night');
      expect(me['phone'], isNotNull, reason: 'the staff call the worker');
      // Workers cannot read them.
      await expectLater(friend.rpc('staff_free_workers', params: {'p_day': _day(2)}), throwsA(isA<PostgrestException>()));
    });
  });

  group('buying puyl', skip: _skip, () {
    test('no details yet, then the bank; a request; the staff approve; «+100 puyl»', () async {
      await staff.rpc('staff_set_payment_setting', params: {'p_key': 'bank', 'p_value': '국민은행 000-00-0000 (Hanguk)'});
      final details = await pyol.paymentDetails();
      expect(details.packs.map((p) => p.pyols), [30, 100, 300]);
      expect(details.methods['bank'], '국민은행 000-00-0000 (Hanguk)');

      await expectLater(pyol.requestTopup(pyols: 55, method: 'bank', payerName: 'BEKZOD'), _refused('INVALID'));
      await pyol.requestTopup(pyols: 100, method: 'bank', payerName: 'BEKZOD Y');
      final waiting = (await pyol.paymentDetails()).pending.single;
      expect(waiting.pyols, 100);
      expect(waiting.won, 9900);

      final requests = (await staff.rpc('staff_topups') as List).cast<Map<String, dynamic>>();
      final mine = requests.firstWhere((r) => r['worker_id'] == worker.auth.currentUser!.id);
      expect(mine['payer_name'], 'BEKZOD Y');
      await expectLater(worker.rpc('staff_approve_topup', params: {'p_request': mine['id']}),
          throwsA(isA<PostgrestException>()), reason: 'only the staff');
      expect(await staff.rpc('staff_approve_topup', params: {'p_request': mine['id']}), 190);
      expect((await account.coins()).balance, 190);
      expect((await pyol.paymentDetails()).pending, isEmpty);

      final notices = await account.notifications();
      final added = notices.firstWhere((n) => n.kind == NotificationKind.coinsAdded);
      expect(added.pyols, 100);
      expect(added.balance, 190);
      expect(added.why, 'topup');
    });

    test('a request the staff reject: «Top-up not accepted»', () async {
      await pyol.requestTopup(pyols: 30, method: 'bank', payerName: 'BEKZOD Y');
      final requests = (await staff.rpc('staff_topups') as List).cast<Map<String, dynamic>>();
      final mine = requests.firstWhere((r) => r['worker_id'] == worker.auth.currentUser!.id);
      await staff.rpc('staff_reject_topup', params: {'p_request': mine['id'], 'p_note': 'no money came'});
      final notices = await account.notifications();
      final rejected = notices.firstWhere((n) => n.kind == NotificationKind.topupRejected);
      expect(rejected.pyols, 30);
      expect((await account.coins()).balance, 190);
    });
  });
}

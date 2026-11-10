import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/backend/json.dart';
import 'package:hanguk_ish/data/backend/supabase_account_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_auth_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_employer_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_shift_repository.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'json_test.dart' show samples;

const me = '00000000-0000-0000-0000-0000000000a1';
const config = BackendConfig(url: 'https://ish.test', publishableKey: 'anon-key');

/// A Supabase client whose server is [respond]: every request is recorded,
/// and a signed-in session is set up without a network call.
class FakeBackend {
  FakeBackend(this.respond);

  /// The response for a request; null means 404.
  final Object? Function(http.Request request) respond;
  final requests = <http.Request>[];

  late final SupabaseClient client = SupabaseClient(
    config.url,
    config.publishableKey,
    httpClient: MockClient((request) async {
      requests.add(request);
      final answer = respond(request);
      final response = switch (answer) {
        http.Response r => r,
        null => reply({'message': 'not found'}, 404),
        _ => reply(answer),
      };
      // The client reads the request back from the response (as a real
      // server's response carries it).
      return http.Response.bytes(response.bodyBytes, response.statusCode,
          headers: response.headers, request: request);
    }),
    authOptions: const AuthClientOptions(autoRefreshToken: false),
  );

  late final accessToken = _jwt(me);

  Future<void> signIn() async {
    final exp = DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch ~/ 1000;
    await client.auth.recoverSession(jsonEncode({
      'access_token': accessToken,
      'token_type': 'bearer',
      'expires_in': 3600,
      'expires_at': exp,
      'refresh_token': 'refresh',
      'user': {
        'id': me,
        'aud': 'authenticated',
        'role': 'authenticated',
        'app_metadata': {'provider': 'phone'},
        'user_metadata': <String, Object?>{},
        'created_at': '2026-11-10T00:00:00Z',
      },
    }));
  }

  /// Requests to `/rest/v1/rpc/[name]`.
  Iterable<http.Request> calls(String name) => requests.where((r) => r.url.path == '/rest/v1/rpc/$name');

  Map<String, dynamic> params(String name) => jsonDecode(calls(name).last.body) as Map<String, dynamic>;
}

String _jwt(String sub) {
  String part(Map<String, Object?> json) => base64Url.encode(utf8.encode(jsonEncode(json))).replaceAll('=', '');
  final exp = DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch ~/ 1000;
  return '${part({'alg': 'HS256', 'typ': 'JWT'})}.${part({'sub': sub, 'role': 'authenticated', 'exp': exp})}.c2lnbmF0dXJl';
}

http.Response reply(Object? value, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(value)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

http.Response refuse(String code) => reply({'code': 'P0001', 'message': code, 'details': null, 'hint': null}, 400);

String rpcName(http.Request r) => r.url.path.startsWith('/rest/v1/rpc/') ? r.url.path.substring(13) : '';

void main() {
  group('worker: shifts', () {
    test('the feed sends the filters and keeps the asked parts of the day', () async {
      final backend = FakeBackend((r) => rpcName(r) == 'shift_feed' ? samples['shift_feed'] : null);
      await backend.signIn();
      final repo = SupabaseShiftRepository(backend.client, config);
      final from = DateTime.utc(2026, 11, 10, 15);
      final all = await repo.feed(FeedQuery(from: from, to: from.add(const Duration(days: 4)), lat: 37.558, lng: 126.95));
      expect(all, hasLength(5));
      final part = FeedQuery.dayPartOf(all.first.startsAt);
      final some = await repo.feed(FeedQuery(
        from: from,
        to: from.add(const Duration(days: 4)),
        lat: 37.558,
        lng: 126.95,
        radiusKm: 3,
        minWage: 10500,
        categories: const {BusinessCategory.cafe},
        dayParts: {part},
      ));
      expect(some, isNotEmpty);
      expect(some.length, all.where((s) => FeedQuery.dayPartOf(s.startsAt) == part).length);
      expect(some.every((s) => FeedQuery.dayPartOf(s.startsAt) == part), isTrue);
      expect(backend.params('shift_feed'), {
        'p_from': '2026-11-10T15:00:00.000Z',
        'p_to': '2026-11-14T15:00:00.000Z',
        'p_lat': 37.558,
        'p_lng': 126.95,
        'p_max_km': 3,
        'p_min_wage': 10500,
        'p_categories': ['cafe'],
      });
      final sent = backend.calls('shift_feed').last;
      expect(sent.headers['apikey'], 'anon-key');
      expect(sent.headers['Authorization'] ?? sent.headers['authorization'], 'Bearer ${backend.accessToken}');
    });

    test('details use the last position; a shift that is gone is null', () async {
      var gone = false;
      final backend = FakeBackend((r) => switch (rpcName(r)) {
            'shift_feed' => samples['shift_feed'],
            'shift_details' => gone ? refuse('NOT_FOUND') : samples['shift_details'],
            _ => null,
          });
      await backend.signIn();
      final repo = SupabaseShiftRepository(backend.client, config);
      await repo.feed(FeedQuery(from: DateTime.utc(2026), to: DateTime.utc(2027), lat: 37.5, lng: 126.9));
      final shift = await repo.shift('20000000-0000-0000-0000-000000000001');
      expect(shift?.title, '홀·카운터 보조');
      expect(backend.params('shift_details'), {'p_shift': '20000000-0000-0000-0000-000000000001', 'p_lat': 37.5, 'p_lng': 126.9});
      gone = true;
      expect(await repo.shift('x'), isNull);
    });

    test('taking a shift: the result, and the refusals with their codes', () async {
      var answer = 'ok';
      final backend = FakeBackend((r) => rpcName(r) == 'apply_to_shift'
          ? (answer == 'ok' ? samples['apply_to_shift'] : refuse(answer))
          : null);
      await backend.signIn();
      final repo = SupabaseShiftRepository(backend.client, config);
      final result = await repo.apply('20000000-0000-0000-0000-000000000002');
      expect(result.status, ApplicationStatus.pending);
      expect(result.applicationId, (samples['apply_to_shift'] as Map)['id']);
      expect(backend.params('apply_to_shift'), {'p_shift': '20000000-0000-0000-0000-000000000002'});
      for (final code in ['SHIFT_FULL', 'TIME_CONFLICT', 'PROFILE_INCOMPLETE', 'ALREADY_APPLIED']) {
        answer = code;
        await expectLater(repo.apply('s'), throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', code)));
      }
    });

    test('cancel, check in and out read the application back', () async {
      final row = {'id': '30000000-0000-0000-0000-000000000004', 'status': 'checked_in'};
      final backend = FakeBackend((r) => switch (rpcName(r)) {
            'cancel_application' || 'check_in' || 'check_out' => row,
            'my_shift' => samples['my_shift'],
            _ => null,
          });
      await backend.signIn();
      final repo = SupabaseShiftRepository(backend.client, config);
      final cancelled = await repo.cancelApplication('30000000-0000-0000-0000-000000000004');
      expect(cancelled.applicationId, '30000000-0000-0000-0000-000000000004');
      expect(backend.params('cancel_application'), {'p_application': '30000000-0000-0000-0000-000000000004'});
      await repo.checkIn('  hanguk-ish:v1:s:t \n');
      expect(backend.params('check_in'), {'p_payload': 'hanguk-ish:v1:s:t'});
      await repo.checkOut('hanguk-ish:v1:s:t');
      expect(backend.params('check_out'), {'p_payload': 'hanguk-ish:v1:s:t'});
      expect(backend.params('my_shift'), {'p_application': '30000000-0000-0000-0000-000000000004'});
    });

    test('my shifts and the rating', () async {
      final backend = FakeBackend((r) => switch (rpcName(r)) {
            'my_shifts' => samples['my_shifts_a2'],
            'rate_business' => {'id': 'r', 'stars': 4},
            _ => null,
          });
      await backend.signIn();
      final repo = SupabaseShiftRepository(backend.client, config);
      final mine = await repo.myShifts();
      expect(mine, hasLength(3));
      await repo.rateBusiness('a', 4, {RatingTag.polite, RatingTag.breakGiven});
      expect(backend.params('rate_business'), {
        'p_application': 'a',
        'p_stars': 4,
        'p_tags': ['polite', 'break_given'],
      });
      await expectLater(repo.rateBusiness('a', 6, const {}), throwsA(isA<ShiftActionException>()));
    });

    test('chat: the thread, marking it read, sending', () async {
      final backend = FakeBackend((r) {
        if (r.url.path != '/rest/v1/messages') return null;
        if (r.method == 'GET') return samples['messages'];
        if (r.method == 'PATCH') return <Object?>[];
        if (r.method == 'POST') {
          final sent = jsonDecode(r.body) as Map<String, dynamic>;
          return {...sent, 'id': 3, 'sender_id': me, 'translations': {}, 'created_at': '2026-11-10T03:00:00+00:00'};
        }
        return null;
      });
      await backend.signIn();
      final repo = SupabaseShiftRepository(backend.client, config);
      final thread = await repo.messages('30000000-0000-0000-0000-000000000004');
      expect(thread.map((m) => m.fromMe), [true, false]);
      final get = backend.requests.firstWhere((r) => r.method == 'GET');
      expect(get.url.queryParameters['application_id'], 'eq.30000000-0000-0000-0000-000000000004');
      expect(get.url.queryParameters['order'], allOf(contains('created_at.asc'), contains('id.asc')));
      final patch = backend.requests.firstWhere((r) => r.method == 'PATCH');
      expect(patch.url.queryParameters['sender_id'], 'neq.$me');
      expect(patch.url.queryParameters['read_at'], 'is.null');
      expect((jsonDecode(patch.body) as Map).keys, ['read_at']);

      final sent = await repo.sendMessage('30000000-0000-0000-0000-000000000004', '  안녕하세요  ');
      expect(sent.fromMe, isTrue);
      expect(sent.body, '안녕하세요');
      expect(sent.lang, 'ko');
      final post = backend.requests.lastWhere((r) => r.method == 'POST');
      expect(jsonDecode(post.body), {'application_id': '30000000-0000-0000-0000-000000000004', 'body': '안녕하세요', 'lang': 'ko'});
      await expectLater(repo.sendMessage('a', '   '), throwsA(isA<ShiftActionException>()));
    });

    test('no connection is an OfflineException; a signed-out call is refused', () async {
      final backend = FakeBackend((r) => throw const SocketException('no route'));
      final repo = SupabaseShiftRepository(backend.client, config);
      await expectLater(repo.messages('a'), throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'NOT_AUTHENTICATED')));
      await backend.signIn();
      await expectLater(repo.myShifts(), throwsA(isA<OfflineException>()));
    });
  });

  group('worker: account and profile', () {
    test('stats, notifications, reports', () async {
      var stats = samples['worker_stats'];
      final backend = FakeBackend((r) {
        if (r.url.path == '/rest/v1/reports' || r.url.path == '/rest/v1/worker_profiles') return <Object?>[];
        return switch (rpcName(r)) {
          'worker_stats' => stats,
          'my_notifications' => samples['my_notifications_worker'],
          'mark_notifications_read' => 3,
          _ => null,
        };
      });
      await backend.signIn();
      final repo = SupabaseAccountRepository(backend.client);
      expect((await repo.stats()).reliability, 80);
      expect(backend.params('worker_stats'), {'p_worker': me});
      stats = <Object?>[];
      expect((await repo.stats()).reliability, 100, reason: 'no worker profile yet');
      final notifications = await repo.notifications();
      expect(notifications, hasLength(7));
      expect(backend.params('my_notifications'), {'p_limit': 100, 'p_kinds': workerNotificationKinds});
      await repo.markNotificationsRead();
      expect(backend.params('mark_notifications_read'), {'p_kinds': workerNotificationKinds});
      await repo.savePosition(37.55612, 126.93678);
      final position = backend.requests.lastWhere((r) => r.url.path == '/rest/v1/worker_profiles');
      expect(position.method, 'PATCH');
      expect(position.url.queryParameters['user_id'], 'eq.$me');
      expect(jsonDecode(position.body), {'lat': 37.556, 'lng': 126.937});
      await repo.report(ReportSubject.safety, ' Sirpanchiq pol ');
      final report = backend.requests.lastWhere((r) => r.url.path == '/rest/v1/reports');
      expect(jsonDecode(report.body), {'reason': 'safety', 'body': 'Sirpanchiq pol'});
    });

    test('A02: a new photo uploads first; the saved one does not', () async {
      final backend = FakeBackend((r) => switch (rpcName(r)) {
            'save_worker_profile' => samples['my_profile_worker'],
            'my_profile' => samples['my_profile_worker'],
            _ => null,
          });
      await backend.signIn();
      final uploaded = <String>[];
      final repo = SupabaseWorkerProfileRepository(backend.client, config, upload: (client, userId, path) async {
        uploaded.add(path);
        return '$userId/avatar-1.jpg';
      });
      const draft = WorkerProfileDraft(
        firstName: ' Aziz ',
        lastName: 'Karimov',
        photoPath: '/data/user/0/uz.hanguk.ish/cache/photo.jpg',
        languages: {'uz', 'ko'},
        topik: 4,
        university: 'sogang',
        district: 'mapo',
        availability: 7,
        visa: 'D-2',
      );
      await repo.save(draft);
      expect(uploaded, ['/data/user/0/uz.hanguk.ish/cache/photo.jpg']);
      expect(backend.params('save_worker_profile'), {
        'p_first_name': 'Aziz',
        'p_last_name': 'Karimov',
        'p_languages': ['uz', 'ko'],
        'p_topik': 4,
        'p_university': 'sogang',
        'p_district': 'mapo',
        'p_availability': 7,
        'p_visa': 'D-2',
        'p_avatar_path': '$me/avatar-1.jpg',
      });
      await repo.save(draft.copyWith(photoPath: 'https://ish.test/storage/v1/object/public/avatars/$me/avatar-1.jpg'));
      expect(uploaded, hasLength(1));
      expect(backend.params('save_worker_profile')['p_avatar_path'], isNull);
      final loaded = await repo.load();
      expect(loaded?.firstName, 'Aziz');
    });
  });

  group('employer', () {
    test('board, one shift, deciding', () async {
      final backend = FakeBackend((r) => switch (rpcName(r)) {
            'my_businesses' => samples['my_businesses'],
            'business_board' => samples['business_board'],
            'employer_shift' => samples['employer_shift'],
            'decide_application' => {'id': 'app', 'shift_id': '20000000-0000-0000-0000-000000000005'},
            'shift_qr' => samples['shift_qr'],
            'cancel_shift' => {'id': '20000000-0000-0000-0000-000000000005'},
            _ => null,
          });
      await backend.signIn();
      final repo = SupabaseEmployerRepository(backend.client, config);
      expect((await repo.businesses()).single.name, '달빛카페 신촌점');
      final from = DateTime.utc(2026, 11, 9, 15);
      final board = await repo.shifts('biz', from, from.add(const Duration(days: 15)));
      expect(board, hasLength(7));
      expect(backend.params('business_board'),
          {'p_business': 'biz', 'p_from': '2026-11-09T15:00:00.000Z', 'p_to': '2026-11-24T15:00:00.000Z'});
      final decided = await repo.decide('app', accept: true);
      expect(backend.params('decide_application'), {'p_application': 'app', 'p_accept': true});
      expect(backend.params('employer_shift'), {'p_shift': '20000000-0000-0000-0000-000000000005'});
      expect(decided.id, '20000000-0000-0000-0000-000000000005');
      expect(await repo.shiftQr('s'), startsWith('hanguk-ish:v1:'));
      expect((await repo.cancelShift('20000000-0000-0000-0000-000000000005')).id,
          '20000000-0000-0000-0000-000000000005');
    });

    test('posting and editing a shift', () async {
      var updated = <Object?>[{'id': 'new'}];
      final backend = FakeBackend((r) {
        if (r.url.path == '/rest/v1/shifts') {
          if (r.method == 'POST') return {'id': 'new'};
          if (r.method == 'PATCH') return updated;
        }
        if (rpcName(r) == 'employer_shift') return samples['employer_shift'];
        if (rpcName(r) == 'minimum_wage') return 10320;
        return null;
      });
      await backend.signIn();
      final repo = SupabaseEmployerRepository(backend.client, config);
      final draft = ShiftDraft(
        businessId: 'biz',
        title: '홀·카운터 보조',
        startsAt: DateTime.utc(2026, 11, 12, 5),
        endsAt: DateTime.utc(2026, 11, 12, 10),
        hourlyWage: 10500,
        slots: 3,
      );
      await repo.createShift(draft);
      final post = backend.requests.firstWhere((r) => r.method == 'POST');
      expect(post.url.queryParameters['select'], 'id');
      expect(jsonDecode(post.body), shiftDraftToJson(draft));
      expect(backend.params('employer_shift'), {'p_shift': 'new'});

      await repo.updateShift('new', draft);
      final patch = backend.requests.firstWhere((r) => r.method == 'PATCH');
      expect(patch.url.queryParameters['id'], 'eq.new');
      expect((jsonDecode(patch.body) as Map).containsKey('business_id'), isFalse);
      updated = [];
      await expectLater(repo.updateShift('gone', draft),
          throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'NOT_FOUND')));

      final count = backend.requests.length;
      await expectLater(
          repo.createShift(ShiftDraft(
              businessId: 'biz', title: '홀', startsAt: draft.endsAt, endsAt: draft.startsAt, hourlyWage: 10500, slots: 1)),
          throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'INVALID_TIME')));
      await expectLater(
          repo.createShift(ShiftDraft(
              businessId: 'biz',
              title: '홀',
              startsAt: draft.startsAt,
              endsAt: draft.startsAt.add(const Duration(hours: 17)),
              hourlyWage: 10500,
              slots: 1)),
          throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'TOO_LONG')));
      expect(backend.requests.length, count, reason: 'checked before sending');
      expect(await repo.minimumWage(DateTime.utc(2026, 11, 12)), 10320);
    });

    test('templates are upserted by id', () async {
      final backend = FakeBackend((r) {
        if (r.url.path != '/rest/v1/shift_templates') return null;
        if (r.method == 'GET') return samples['shift_templates'];
        return (samples['shift_templates'] as List).first;
      });
      await backend.signIn();
      final repo = SupabaseEmployerRepository(backend.client, config);
      final templates = await repo.templates('10000000-0000-0000-0000-000000000001');
      expect(templates, hasLength(2));
      await repo.saveTemplate('10000000-0000-0000-0000-000000000001', templates.first.copyWith(dress: '흰 셔츠'));
      final post = backend.requests.lastWhere((r) => r.method == 'POST');
      expect(post.headers['Prefer'] ?? post.headers['prefer'], contains('resolution=merge-duplicates'));
      expect((jsonDecode(post.body) as Map)['dress'], '흰 셔츠');
      expect((jsonDecode(post.body) as Map)['start_time'], '14:00');
    });

    test('workers, favourites, inviting, the report and payments', () async {
      final backend = FakeBackend((r) => switch (rpcName(r)) {
            'business_workers' => samples['business_workers'],
            'toggle_favorite' => false,
            'request_again' => http.Response('', 204),
            'business_report' => samples['business_report'],
            'set_shift_paid' => 1,
            'my_notifications' => samples['my_notifications_employer'],
            'mark_notifications_read' => 5,
            _ => null,
          });
      await backend.signIn();
      final repo = SupabaseEmployerRepository(backend.client, config);
      expect((await repo.workers('biz')).single.fullName, 'Malika Yusupova');
      expect(await repo.toggleFavorite('biz', 'w'), isFalse);
      expect(backend.params('toggle_favorite'), {'p_business': 'biz', 'p_worker': 'w'});
      await repo.requestAgain('s', 'w');
      expect(backend.params('request_again'), {'p_shift': 's', 'p_worker': 'w'});
      final report = await repo.report('biz', DateTime.utc(2026, 11, 1), DateTime.utc(2026, 11, 30));
      expect(backend.params('business_report'), {'p_business': 'biz', 'p_from': '2026-11-01', 'p_to': '2026-12-01'});
      expect(report.total, 66000);
      expect(report.from, DateTime.utc(2026, 11, 1));
      await repo.setShiftPaid('s', paid: true);
      expect(backend.params('set_shift_paid'), {'p_shift': 's', 'p_paid': true});
      final bell = await repo.notifications();
      expect(bell.first.kind, EmployerNotificationKind.noShow);
      expect(backend.params('my_notifications'), {'p_limit': 100, 'p_kinds': employerNotificationKinds});
      await repo.markNotificationsRead();
      expect(backend.params('mark_notifications_read'), {'p_kinds': employerNotificationKinds});
    });

    test('database refusals reach the screens as codes', () async {
      final backend = FakeBackend((r) => switch (rpcName(r)) {
            'decide_application' => refuse('NOT_PENDING'),
            'cancel_shift' => refuse('SHIFT_STARTED'),
            _ => r.url.path == '/rest/v1/shifts'
                ? reply({'code': 'P0001', 'message': 'WAGE_BELOW_MINIMUM', 'details': 'hourly_wage 9000 < minimum 10320'}, 400)
                : null,
          });
      await backend.signIn();
      final repo = SupabaseEmployerRepository(backend.client, config);
      Matcher code(String c) => throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', c));
      await expectLater(repo.decide('a', accept: false), code('NOT_PENDING'));
      await expectLater(repo.cancelShift('s'), code('SHIFT_STARTED'));
      await expectLater(
          repo.createShift(ShiftDraft(
              businessId: 'b',
              title: '홀',
              startsAt: DateTime.utc(2026, 11, 12, 5),
              endsAt: DateTime.utc(2026, 11, 12, 9),
              hourlyWage: 9000,
              slots: 1)),
          code('WAGE_BELOW_MINIMUM'));
    });
  });

  group('sign-in', () {
    Map<String, Object?> session() => {
          'access_token': _jwt(me),
          'token_type': 'bearer',
          'expires_in': 3600,
          'expires_at': DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch ~/ 1000,
          'refresh_token': 'refresh',
          'user': {
            'id': me,
            'aud': 'authenticated',
            'role': 'authenticated',
            'phone': '821012345678',
            'app_metadata': {'provider': 'phone'},
            'user_metadata': <String, Object?>{},
            'created_at': '2026-11-10T00:00:00Z',
          },
        };

    test('a code by SMS, then the session', () async {
      final backend = FakeBackend((r) => switch (r.url.path) {
            '/auth/v1/otp' => <String, Object?>{},
            '/auth/v1/verify' => session(),
            _ => null,
          });
      final auth = SupabaseAuthRepository(backend.client);
      expect(auth.userId, isNull);
      final changes = <String?>[];
      final subscription = auth.changes.listen(changes.add);
      addTearDown(subscription.cancel);

      await auth.sendCode('010-1234-5678');
      final otp = jsonDecode(backend.requests.last.body) as Map<String, dynamic>;
      expect(otp['phone'], '+821012345678');
      await auth.verifyCode('010-1234-5678', ' 123456 ');
      final verify = jsonDecode(backend.requests.last.body) as Map<String, dynamic>;
      expect(verify['type'], 'sms');
      expect(verify['token'], '123456');
      expect(verify['phone'], '+821012345678');
      expect(auth.userId, me);
      await pumpEventQueue();
      expect(changes.last, me);
    });

    test('refusals are named; bad input never leaves the phone', () async {
      var answer = reply({'code': 403, 'error_code': 'otp_expired', 'msg': 'Token has expired or is invalid'}, 403);
      final backend = FakeBackend((r) => answer);
      final auth = SupabaseAuthRepository(backend.client);
      Matcher code(String c) => throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', c));
      await expectLater(auth.verifyCode('01012345678', '000000'), code('CODE_INVALID'));
      answer = reply({'code': 429, 'error_code': 'over_sms_send_rate_limit', 'msg': 'For security purposes…'}, 429);
      await expectLater(auth.sendCode('01012345678'), code('TOO_MANY_REQUESTS'));
      answer = reply({'code': 500, 'error_code': 'sms_send_failed', 'msg': 'Error sending sms'}, 500);
      await expectLater(auth.sendCode('01012345678'), code('SMS_FAILED'));
      answer = reply({'code': 'unexpected_failure', 'msg': 'boom'}, 502);
      await expectLater(auth.sendCode('01012345678'), code('SERVER_ERROR'));
      final sent = backend.requests.length;
      await expectLater(auth.sendCode('02-123-4567'), code('PHONE_INVALID'));
      await expectLater(auth.verifyCode('01012345678', '12345'), code('CODE_INVALID'));
      expect(backend.requests.length, sent);
      expect(authErrorCode(null, '429', 'slow down'), 'TOO_MANY_REQUESTS');
      expect(authErrorCode(null, '400', 'Token has expired or is invalid'), 'CODE_INVALID');
      expect(authErrorCode('phone_provider_disabled', '400', 'Unsupported phone provider'), 'SIGN_IN_UNAVAILABLE');
      expect(authErrorCode(null, '500', 'boom'), 'AUTH_FAILED');
      final offline = SupabaseAuthRepository(FakeBackend((r) => throw const SocketException('no route')).client);
      await expectLater(offline.sendCode('01012345678'), throwsA(isA<OfflineException>()));
    });
  });

  group('owner registration (business-register)', () {
    test('the 국세청 check runs on the server; the new business comes back', () async {
      var refusal = '';
      final backend = FakeBackend((r) {
        if (r.url.path == '/functions/v1/business-register') {
          return refusal.isEmpty
              ? {'business_id': '10000000-0000-0000-0000-000000000001', 'status': 'verified'}
              : reply({'error': refusal}, 409);
        }
        if (rpcName(r) == 'my_businesses') return samples['my_businesses'];
        return null;
      });
      await backend.signIn();
      final repo = SupabaseEmployerRepository(backend.client, config);
      final business = await repo.registerBusiness('124-81-00998');
      expect(business.id, '10000000-0000-0000-0000-000000000001');
      final call = backend.requests.firstWhere((r) => r.url.path == '/functions/v1/business-register');
      expect(jsonDecode(call.body), {'biz_no': '1248100998'});
      expect(call.headers['Authorization'] ?? call.headers['authorization'], 'Bearer ${backend.accessToken}');

      refusal = 'BIZ_NO_TAKEN';
      await expectLater(repo.registerBusiness('1248100998'),
          throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'BIZ_NO_TAKEN')));
      final count = backend.requests.length;
      await expectLater(repo.registerBusiness('1234567890'),
          throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'BIZ_NO_INVALID')));
      expect(backend.requests.length, count, reason: 'a wrong check digit is caught on the phone');
    });
  });
}

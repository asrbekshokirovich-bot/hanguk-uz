// ensureTestSession — the guest's test session (Tayyorgarlik T2; audit
// fixes C-F4, C-F7, C-F12, 2026-11-10).
//
// A fake stands in for Supabase (debugTestSessionBackend): no network, no
// secure storage. It answers as the real client does — a non-2xx status is
// thrown as a FunctionException, never handed back as data, and a refused
// password is an AuthApiException (guest_test_session_http_test.dart shows
// the real client doing both). It proves that taps made while one is on its
// way share it (one guest account), that a session sent by
// guest-test-session is set as it is (no password sign-in), that an older
// function's answer still signs in with the password, that a failure is
// false with data_ready 'failed' — the measurement merged in #664,
// unchanged — and that the phone's credentials are dropped only when the
// auth server refuses them.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart'
    show AuthApiException, AuthException, AuthRetryableFetchException, FunctionException;

/// guest-test-session's reply as the client hands it on: [body] for a 2xx
/// [status]; any other status is thrown as the FunctionException the client
/// throws (functions_client 2.5.0) — a 429 is never data.
class Reply {
  const Reply(this.status, this.body);

  final int status;
  final Object? body;
}

/// The function's answer when one IP or the day is over the guest limit.
const tooMany = Reply(429, {'error': 'rate_limited'});

/// What the client throws for a password the auth server refuses.
final invalidLogin = AuthApiException('Invalid login credentials', statusCode: '400', code: 'invalid_credentials');

class FakeBackend implements TestSessionBackend {
  FakeBackend({this.saved, List<Object?>? answers}) : answers = answers ?? [];

  /// The credentials on the phone.
  String? saved;

  bool signedIn = false;

  /// What each createGuest gets, in order: a [Reply], or an exception the
  /// request itself fails with (offline, a timeout), which is thrown.
  final List<Object?> answers;

  /// When set, createGuest waits for it.
  Completer<void>? gate;

  /// `inProjectRegion` of each createGuest.
  final asks = <bool>[];
  final recovered = <Map<String, dynamic>>[];
  final passwordSignIns = <(String, String)>[];
  bool recoverThrows = false;

  /// What signInWithPassword throws, when set.
  Object? passwordError;
  var deletes = 0;

  @override
  bool get hasSession => signedIn;

  @override
  Future<String?> readCreds() async => saved;

  @override
  Future<void> writeCreds(String creds) async {
    saved = creds;
  }

  @override
  Future<void> deleteCreds() async {
    deletes++;
    saved = null;
  }

  @override
  Future<Object?> createGuest({required bool inProjectRegion}) async {
    asks.add(inProjectRegion);
    final g = gate;
    if (g != null) await g.future;
    final a = answers[asks.length - 1];
    if (a is Exception) throw a;
    final r = a as Reply;
    if (r.status < 200 || r.status > 299) throw FunctionException(status: r.status, details: r.body);
    return r.body;
  }

  @override
  Future<bool> recoverSession(String sessionJson) async {
    if (recoverThrows) throw AuthException('Current session is missing data.');
    recovered.add(jsonDecode(sessionJson) as Map<String, dynamic>);
    return signedIn = true;
  }

  @override
  Future<bool> signInWithPassword(String email, String password) async {
    passwordSignIns.add((email, password));
    final e = passwordError;
    if (e != null) throw e;
    return signedIn = true;
  }
}

/// guest-test-session's 200 answer; [session] false is an older deploy's
/// (or the answer to an app that did not ask for it).
Reply answer({String n = '1', bool session = true}) => Reply(200, {
  'email': 'guest-$n@hanguk.local',
  'password': 'pw${n}Aa1',
  if (session)
    'session': {
      'access_token': 'at$n',
      'refresh_token': 'rt$n',
      'expires_in': 3600,
      'expires_at': 1794291367,
      'token_type': 'bearer',
      'user': {
        'id': 'u$n',
        'aud': 'authenticated',
        'email': 'guest-$n@hanguk.local',
        'app_metadata': {'provider': 'email', 'guest': true},
        'user_metadata': {'guest': true},
        'created_at': '2026-11-10T05:16:06Z',
      },
    },
});

void main() {
  late List<TrackedEvent> seen;

  /// The `data_ready` guest_session events' props.
  List<Map<String, Object?>> ready() => [
    for (final e in seen)
      if (e.event == 'data_ready' && e.props?['name'] == 'guest_session') e.props!,
  ];

  /// The `app_error` events' error types.
  List<Object?> errors() => [
    for (final e in seen)
      if (e.event == 'app_error') e.props?['type'],
  ];

  setUp(() {
    seen = [];
    AppEvents.debugReset();
    AppEvents.debugOnTrack = seen.add;
  });

  tearDown(() {
    AppEvents.debugOnTrack = null;
    debugTestSessionBackend = null;
  });

  test('two calls at once make one guest account', () async {
    final b = FakeBackend(answers: [answer()])..gate = Completer<void>();
    debugTestSessionBackend = b;

    final first = ensureTestSession();
    final second = ensureTestSession();
    await pumpEventQueue();
    expect(b.asks, [true], reason: 'one ask, in the project region');

    b.gate!.complete();
    expect(await first, isTrue);
    expect(await second, isTrue);
    expect(b.asks, hasLength(1), reason: 'the second tap made no account');
    expect(ready(), hasLength(1));
    expect(ready().single['source'], 'created');

    // Done: the next call has the session and asks nothing.
    expect(await ensureTestSession(), isTrue);
    expect(b.asks, hasLength(1));
    expect(ready(), hasLength(1));
  });

  test('a session in the answer is set as it is — no password sign-in', () async {
    final b = FakeBackend(answers: [answer()]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isTrue);
    expect(b.recovered, hasLength(1));
    expect(b.recovered.single['access_token'], 'at1');
    expect(b.recovered.single['refresh_token'], 'rt1');
    expect((b.recovered.single['user'] as Map)['app_metadata'], {'provider': 'email', 'guest': true},
        reason: 'the guest flag reaches the session, so it is not taken for a client');
    expect(b.passwordSignIns, isEmpty);
    expect(b.saved, 'guest-1@hanguk.local\npw1Aa1', reason: 'kept for later sign-ins');
    final r = ready().single;
    expect(r['source'], 'created');
    expect(r['ms'], isA<int>());
  });

  test('an answer without a session (older function) signs in with the password', () async {
    final b = FakeBackend(answers: [answer(session: false)]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isTrue);
    expect(b.recovered, isEmpty);
    expect(b.passwordSignIns, [('guest-1@hanguk.local', 'pw1Aa1')]);
    expect(b.saved, 'guest-1@hanguk.local\npw1Aa1');
    expect(ready().single['source'], 'created');
  });

  test('a session that does not take falls back to the password, no second account', () async {
    final b = FakeBackend(answers: [answer()])..recoverThrows = true;
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isTrue);
    expect(b.passwordSignIns, [('guest-1@hanguk.local', 'pw1Aa1')]);
    expect(b.asks, hasLength(1));
    expect(ready().single['source'], 'created');
  });

  test('saved credentials sign in without asking the server', () async {
    final b = FakeBackend(saved: 'guest-0@hanguk.local\nold');
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isTrue);
    expect(b.asks, isEmpty);
    expect(b.passwordSignIns, [('guest-0@hanguk.local', 'old')]);
    expect(ready().single['source'], 'saved');
  });

  test('saved credentials the auth server refuses: dropped, a fresh account', () async {
    final b = FakeBackend(saved: 'guest-0@hanguk.local\nold', answers: [answer()])..passwordError = invalidLogin;
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isTrue);
    expect(b.deletes, 1);
    expect(b.asks, [true]);
    expect(b.recovered.single['access_token'], 'at1');
    expect(b.saved, 'guest-1@hanguk.local\npw1Aa1');
    expect(ready().single['source'], 'created');
  });

  test('saved credentials and a failure that says nothing about them: kept, no new account', () async {
    // The Supabase client offline, the auth server failing, the sign-in's own
    // limit, the auth server's rate limit (audit C-F7).
    final failures = <Object>[
      AuthRetryableFetchException(message: 'ClientException with SocketException: Failed host lookup: lysjdtyanhdfphqyijsr.supabase.co'),
      AuthRetryableFetchException(message: 'upstream connect error', statusCode: '503'),
      TimeoutException('no answer', kTestSessionCallTimeout),
      AuthApiException('Request rate limit reached', statusCode: '429', code: 'over_request_rate_limit'),
    ];
    for (final failure in failures) {
      seen.clear();
      final b = FakeBackend(saved: 'guest-0@hanguk.local\nsecret0Aa1', answers: [answer()])..passwordError = failure;
      debugTestSessionBackend = b;

      expect(await ensureTestSession(), isFalse, reason: '$failure');
      expect(b.saved, 'guest-0@hanguk.local\nsecret0Aa1', reason: '$failure is no answer about the account');
      expect(b.deletes, 0, reason: '$failure');
      expect(b.asks, isEmpty, reason: '$failure: a new account would replace the saved one');
      expect(ready().single['source'], 'failed', reason: '$failure');
    }
  });

  test('a new account whose sign-in fails on the network is kept: the next tap signs in, no second account', () async {
    final b = FakeBackend(answers: [answer(session: false)])
      ..passwordError = AuthRetryableFetchException(message: 'ClientException: Connection reset by peer');
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.asks, [true]);
    expect(b.saved, 'guest-1@hanguk.local\npw1Aa1');
    expect(b.deletes, 0);

    b.passwordError = null;
    expect(await ensureTestSession(), isTrue);
    expect(b.asks, [true], reason: 'no second account');
    expect(b.passwordSignIns.last, ('guest-1@hanguk.local', 'pw1Aa1'));
    expect(ready().last['source'], 'saved');
  });

  test('failure: false and data_ready failed; the second ask goes where the platform sends it', () async {
    final b = FakeBackend(answers: [
      const Reply(503, {'error': 'unavailable'}),
      const Reply(500, {'error': 'failed'}),
    ]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.asks, [true, false]);
    expect(b.signedIn, isFalse);
    expect(ready(), hasLength(1));
    expect(ready().single['source'], 'failed');
    expect(errors(), ['FunctionException', 'FunctionException']);

    // Not stuck on the failed one: the next tap asks again.
    b.answers.add(answer(n: '2'));
    expect(await ensureTestSession(), isTrue);
    expect(b.asks, [true, false, true]);
    expect(ready().last['source'], 'created');
  });

  test('an ask that timed out is asked once more, too', () async {
    final b = FakeBackend(answers: [TimeoutException('no answer', kTestSessionCallTimeout), answer()]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isTrue);
    expect(b.asks, [true, false]);
    expect(ready().single['source'], 'created');
  });

  test('over the guest limit (429, thrown as the client does): false at once, no second ask', () async {
    final b = FakeBackend(answers: [tooMany, answer()]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.asks, hasLength(1), reason: 'the limit is the same wherever the ask goes');
    expect(b.passwordSignIns, isEmpty);
    expect(b.saved, isNull);
    expect(errors(), ['FunctionException']);
    expect(ready().single['source'], 'failed');
  });

  test('a 2xx answer that is not the function\'s (no credentials) is false at once, as before', () async {
    final b = FakeBackend(answers: [const Reply(200, '<html>captive portal</html>')]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.asks, hasLength(1));
    expect(b.passwordSignIns, isEmpty);
    expect(ready().single['source'], 'failed');
  });

  group('isInvalidCredentials — the one failure that drops the saved credentials', () {
    test('the auth server refusing the password', () {
      expect(isInvalidCredentials(invalidLogin), isTrue);
      // Before API 2024-01-01 there was no code, only the message.
      expect(isInvalidCredentials(AuthApiException('Invalid login credentials', statusCode: '400')), isTrue);
      expect(isInvalidCredentials(const AuthException('Invalid login credentials', statusCode: '400')), isTrue);
    });

    test('not a failure that says nothing about them', () {
      expect(isInvalidCredentials(AuthRetryableFetchException(message: 'ClientException: Failed host lookup')), isFalse);
      expect(isInvalidCredentials(AuthRetryableFetchException(message: 'Bad Gateway', statusCode: '502')), isFalse);
      expect(
        isInvalidCredentials(AuthApiException('Request rate limit reached', statusCode: '429', code: 'over_request_rate_limit')),
        isFalse,
      );
      expect(isInvalidCredentials(TimeoutException('no answer')), isFalse);
      expect(isInvalidCredentials(const FunctionException(status: 429, details: {'error': 'rate_limited'})), isFalse);
      expect(isInvalidCredentials(Exception('ClientException: Failed host lookup')), isFalse);
    });
  });
}

// ensureTestSession — the guest's test session (Tayyorgarlik T2).
//
// A fake stands in for Supabase (debugTestSessionBackend): no network, no
// secure storage. It proves that taps made while one is on its way share it
// (one guest account), that a session sent by guest-test-session is set as
// it is (no password sign-in), that an older function's answer still signs
// in with the password, and that a failure is false with data_ready
// 'failed' — the measurement merged in #664, unchanged.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthException, FunctionException;

class FakeBackend implements TestSessionBackend {
  FakeBackend({this.saved, List<Object?>? answers}) : answers = answers ?? [];

  /// The credentials on the phone.
  String? saved;

  bool signedIn = false;

  /// What each createGuest returns, in order; an Exception is thrown.
  final List<Object?> answers;

  /// When set, createGuest waits for it.
  Completer<void>? gate;

  /// `inProjectRegion` of each createGuest.
  final asks = <bool>[];
  final recovered = <Map<String, dynamic>>[];
  final passwordSignIns = <(String, String)>[];
  bool recoverThrows = false;
  bool passwordFails = false;
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
    return a;
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
    if (passwordFails) throw AuthException('Invalid login credentials', statusCode: '400');
    return signedIn = true;
  }
}

/// guest-test-session's answer; [session] false is an older deploy's.
Map<String, Object?> answer({String n = '1', bool session = true}) => {
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
};

void main() {
  late List<TrackedEvent> seen;

  /// The `data_ready` guest_session events' props.
  List<Map<String, Object?>> ready() => [
    for (final e in seen)
      if (e.event == 'data_ready' && e.props?['name'] == 'guest_session') e.props!,
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

  test('saved credentials that no longer sign in: dropped, a fresh account', () async {
    final b = FakeBackend(saved: 'guest-0@hanguk.local\nold', answers: [answer()])..passwordFails = true;
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isTrue);
    expect(b.deletes, 1);
    expect(b.asks, [true]);
    expect(b.recovered.single['access_token'], 'at1');
    expect(b.saved, 'guest-1@hanguk.local\npw1Aa1');
    expect(ready().single['source'], 'created');
  });

  test('failure: false and data_ready failed; the second ask goes where the platform sends it', () async {
    final b = FakeBackend(answers: [const FunctionException(status: 503), const FunctionException(status: 500)]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.asks, [true, false]);
    expect(b.signedIn, isFalse);
    expect(ready(), hasLength(1));
    expect(ready().single['source'], 'failed');
    expect(seen.where((e) => e.event == 'app_error'), hasLength(2));

    // Not stuck on the failed one: the next tap asks again.
    b.answers.add(answer(n: '2'));
    expect(await ensureTestSession(), isTrue);
    expect(b.asks, [true, false, true]);
    expect(ready().last['source'], 'created');
  });

  test('an answer without credentials is false at once, as before', () async {
    final b = FakeBackend(answers: [
      {'error': 'rate_limited'},
    ]);
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.asks, hasLength(1));
    expect(b.passwordSignIns, isEmpty);
    expect(ready().single['source'], 'failed');
  });
}

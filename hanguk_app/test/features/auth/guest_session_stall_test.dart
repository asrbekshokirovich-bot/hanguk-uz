// A request that never answers no longer holds the guest's test session for
// good (audit C-F4, 2026-11-10; from the QA audit's evidence test).
//
// ensureTestSession() is one call at a time: a call made while another is
// on its way gets that one's answer. Only the first, region-pinned ask had a
// timeout (15 s); the second ask and the password sign-in had none, and the
// app's http client sets none either. A request that never answered (a
// stalled mobile connection) held the shared answer for good: every later
// tap — the Tayyorgarlik row, which also refuses a tap while «Suhbat
// tayyorlanmoqda...» shows, and the university tests — waited on it until
// the app was restarted.
//
// The fake backends play the real one not answering. testWidgets runs in
// fake time, so the app's own limits (kTestSessionCallTimeout,
// kTestSessionTimeout) pass at once. Its own file: a stuck call stays in the
// library's state.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';

/// The QA evidence's backend: the first ask fails the way its 15 s timeout
/// fails (TimeoutException), the second never answers.
class _StalledBackend implements TestSessionBackend {
  final asks = <bool>[];

  @override
  bool get hasSession => false;

  @override
  Future<String?> readCreds() async => null;

  @override
  Future<void> writeCreds(String creds) async {}

  @override
  Future<void> deleteCreds() async {}

  @override
  Future<Object?> createGuest({required bool inProjectRegion}) {
    asks.add(inProjectRegion);
    if (inProjectRegion) return Future<Object?>.error(TimeoutException('the 15 s region-pinned timeout'));
    return Completer<Object?>().future;
  }

  @override
  Future<bool> recoverSession(String sessionJson) async => true;

  @override
  Future<bool> signInWithPassword(String email, String password) async => true;
}

/// A backend that answers, but one step never finishes: the password
/// sign-in ([signInStalls]) or setting the session ([recoverStalls]).
class _StuckBackend implements TestSessionBackend {
  _StuckBackend({this.saved, this.signInStalls = false, this.recoverStalls = false});

  String? saved;
  final bool signInStalls;
  final bool recoverStalls;
  bool signedIn = false;
  final asks = <bool>[];
  final signIns = <String>[];

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
    saved = null;
  }

  @override
  Future<Object?> createGuest({required bool inProjectRegion}) async {
    asks.add(inProjectRegion);
    return {
      'email': 'guest-1@hanguk.local',
      'password': 'pw1Aa1',
      'session': {'access_token': 'at1'},
    };
  }

  @override
  Future<bool> recoverSession(String sessionJson) {
    if (recoverStalls) return Completer<bool>().future;
    return Future.value(signedIn = true);
  }

  @override
  Future<bool> signInWithPassword(String email, String password) {
    signIns.add(email);
    if (signInStalls) return Completer<bool>().future;
    return Future.value(signedIn = true);
  }
}

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

  testWidgets('once the second ask stalls, a later tap still gets an answer', (t) async {
    final b = _StalledBackend();
    debugTestSessionBackend = b;

    unawaited(ensureTestSession());
    await t.pump();
    expect(b.asks, [true, false], reason: 'the pinned ask timed out, the second one is stalled');

    // The guest taps again (the retry, or a university's test) a while
    // later — at the latest when the whole call's limit is up.
    var answered = false;
    unawaited(ensureTestSession().then((_) => answered = true));
    await t.pump(kTestSessionTimeout);
    expect(
      answered || b.asks.length > 2,
      isTrue,
      reason: 'the later call shares the stalled one: no new ask (asks: ${b.asks}), no answer, and nothing times it out',
    );
  });

  testWidgets('the stalled ask is given up at its own limit: false, data_ready failed, and the next tap asks again',
      (t) async {
    final b = _StalledBackend();
    debugTestSessionBackend = b;

    bool? first;
    unawaited(ensureTestSession().then((ok) => first = ok));
    await t.pump(kTestSessionCallTimeout - const Duration(milliseconds: 1));
    expect(first, isNull, reason: 'still within the second ask\'s limit');
    await t.pump(const Duration(milliseconds: 1));
    expect(first, isFalse);
    expect(ready(), hasLength(1));
    expect(ready().single['source'], 'failed');

    unawaited(ensureTestSession());
    await t.pump();
    expect(b.asks, [true, false, true, false], reason: 'a new call, not the stalled one');
    await t.pump(kTestSessionCallTimeout);
    expect(ready(), hasLength(2));
  });

  testWidgets('a step with no limit of its own is given up at kTestSessionTimeout; the next tap uses what it kept',
      (t) async {
    final b = _StuckBackend(recoverStalls: true);
    debugTestSessionBackend = b;

    bool? first;
    unawaited(ensureTestSession().then((ok) => first = ok));
    await t.pump(kTestSessionTimeout - const Duration(milliseconds: 1));
    expect(first, isNull, reason: 'setting the session has no limit of its own');
    await t.pump(const Duration(milliseconds: 1));
    expect(first, isFalse);
    expect(ready().single['source'], 'failed');
    expect(
      [for (final e in seen) if (e.event == 'app_error') e.props?['type']],
      contains('TimeoutException'),
    );

    // Not stuck on it: the new user's credentials were kept, so the next tap
    // signs in with them — no second account.
    bool? second;
    unawaited(ensureTestSession().then((ok) => second = ok));
    await t.pump();
    expect(second, isTrue);
    expect(b.asks, [true]);
    expect(b.signIns, ['guest-1@hanguk.local']);
    expect(ready().last['source'], 'saved');
  });

  testWidgets('a sign-in with the saved credentials that never answers: false at its limit, the credentials kept',
      (t) async {
    final b = _StuckBackend(saved: 'guest-0@hanguk.local\nsecret0Aa1', signInStalls: true);
    debugTestSessionBackend = b;

    bool? first;
    unawaited(ensureTestSession().then((ok) => first = ok));
    await t.pump(kTestSessionCallTimeout - const Duration(milliseconds: 1));
    expect(first, isNull);
    await t.pump(const Duration(milliseconds: 1));
    expect(first, isFalse);
    expect(b.saved, 'guest-0@hanguk.local\nsecret0Aa1', reason: 'a timeout is no answer about the account (C-F7)');
    expect(b.asks, isEmpty, reason: 'a new account would replace it');
    expect(ready().single['source'], 'failed');
  });
}

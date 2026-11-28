// QA audit evidence (Tayyorgarlik T2, commit 8d7a150) — not to be merged.
//
// ensureTestSession() is now one call at a time: a call made while another
// is on its way gets that one's answer (auth_repository.dart:89). Only the
// first, region-pinned ask has a timeout (15 s, auth_repository.dart:241);
// the second ask (`await call`) and the password sign-in have none, and the
// app's http client sets none either. A request that never answers (a
// stalled mobile connection) therefore holds the shared future for good:
// every later tap — the Tayyorgarlik row, which also refuses a tap while
// «Suhbat tayyorlanmoqda...» shows, and the university tests — waits on it
// until the app is restarted.
//
// The fake backend below plays the real _SupabaseTestSession: the first ask
// fails the way its 15 s timeout fails (TimeoutException), the second never
// answers. Its own file: the stuck call stays in the library's state.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';

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

void main() {
  tearDown(() => debugTestSessionBackend = null);

  test('QA-BUG: once the second ask stalls, a later tap neither asks again nor gets an answer', () async {
    final b = _StalledBackend();
    debugTestSessionBackend = b;

    unawaited(ensureTestSession());
    await pumpEventQueue();
    expect(b.asks, [true, false], reason: 'the pinned ask timed out, the second one is stalled');

    // The guest taps again (the retry, or a university's test) a while later.
    var answered = false;
    unawaited(ensureTestSession().then((_) => answered = true));
    await Future<void>.delayed(const Duration(seconds: 2));
    expect(
      answered || b.asks.length > 2,
      isTrue,
      reason: 'the later call shares the stalled one: no new ask (asks: ${b.asks}), no answer, and nothing times it out',
    );
  });
}

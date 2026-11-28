// QA re-check after the fix (#674) — not to be merged.
//
// qa_guest_session_hang_test.dart waits 2 s of real time, shorter than the
// limit the approved fix gives the second ask (kTestSessionCallTimeout,
// 15 s), so it stays red: the guest still waits up to that limit. This file
// waits the limit itself, in real time, with the same stalled backend: the
// shared call must answer (false) and the next tap must ask again.
// Its own file: the stuck call of the other file stays in its library state.
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

  test('QA-RECHECK: at the app\'s own limit the stalled call answers, and the next tap asks again', () async {
    final b = _StalledBackend();
    debugTestSessionBackend = b;

    final first = ensureTestSession();
    await pumpEventQueue();
    expect(b.asks, [true, false], reason: 'the pinned ask timed out, the second one is stalled');

    final answer = await first.timeout(kTestSessionCallTimeout + const Duration(seconds: 3));
    expect(answer, isFalse, reason: 'given up at its limit, not held for good');

    unawaited(ensureTestSession());
    await pumpEventQueue();
    expect(b.asks, [true, false, true, false], reason: 'a new call, not the stalled one');
  }, timeout: const Timeout(Duration(seconds: 45)));
}

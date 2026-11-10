// A guest's tap while offline keeps the saved test account (audit C-F7,
// 2026-11-10; from the QA audit's evidence test).
//
// _signInTestUser dropped the phone's saved guest credentials on ANY failure
// of the first attempt, not only on a "these credentials no longer sign in"
// answer. A guest who tapped «Suhbat mashqi» while offline lost the
// credentials of the test account the phone already had; back online,
// guest-test-session made a new account (its interviews and weekly count
// started over, and the old one was orphaned).
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthRetryableFetchException;

/// Offline: every call to the server fails with a network error, until
/// [online].
class _OfflineBackend implements TestSessionBackend {
  _OfflineBackend(this.saved, {Object Function()? failure})
    : failure = failure ?? (() => Exception('ClientException: Failed host lookup: lysjdtyanhdfphqyijsr.supabase.co'));

  String? saved;
  var asks = 0;
  bool online = false;
  bool signedIn = false;
  final signIns = <(String, String)>[];

  /// What a call to the server throws while offline.
  final Object Function() failure;

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
    asks++;
    throw failure();
  }

  @override
  Future<bool> recoverSession(String sessionJson) async => false;

  @override
  Future<bool> signInWithPassword(String email, String password) async {
    signIns.add((email, password));
    if (!online) throw failure();
    return signedIn = true;
  }
}

void main() {
  tearDown(() => debugTestSessionBackend = null);

  test('a tap while offline keeps the saved guest credentials', () async {
    final b = _OfflineBackend('guest-0@hanguk.local\nsecret0Aa1');
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.saved, 'guest-0@hanguk.local\nsecret0Aa1', reason: 'a network error is no answer about the account (asks: ${b.asks})');
  });

  test('offline, no new account is asked for; back online, the same one signs in', () async {
    final b = _OfflineBackend('guest-0@hanguk.local\nsecret0Aa1');
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.asks, 0, reason: 'a new account would replace the saved one');

    b.online = true;
    expect(await ensureTestSession(), isTrue);
    expect(b.signIns.last, ('guest-0@hanguk.local', 'secret0Aa1'));
    expect(b.asks, 0);
  });

  test('the Supabase client\'s own offline error keeps them too', () async {
    // What gotrue throws when the request cannot be sent at all.
    final b = _OfflineBackend(
      'guest-0@hanguk.local\nsecret0Aa1',
      failure: () => AuthRetryableFetchException(
        message: "ClientException with SocketException: Failed host lookup: 'lysjdtyanhdfphqyijsr.supabase.co'",
      ),
    );
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.saved, 'guest-0@hanguk.local\nsecret0Aa1');
    expect(b.asks, 0);
  });
}

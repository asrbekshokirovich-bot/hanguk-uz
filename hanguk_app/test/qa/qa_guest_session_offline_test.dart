// QA audit evidence (Tayyorgarlik T2, commit 8d7a150) — not to be merged.
//
// _signInTestUser drops the phone's saved guest credentials on ANY failure
// of the first attempt (auth_repository.dart:161-167), not only on a "these
// credentials no longer sign in" answer. A guest who taps «Suhbat mashqi»
// while offline loses the credentials of the test account the phone already
// had; back online, guest-test-session makes a new account (its interviews
// and weekly count start over, and the old one is orphaned).
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';

/// Offline: every call to the server fails with a network error.
class _OfflineBackend implements TestSessionBackend {
  _OfflineBackend(this.saved);

  String? saved;
  var asks = 0;

  @override
  bool get hasSession => false;

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
    throw Exception('ClientException: Failed host lookup: lysjdtyanhdfphqyijsr.supabase.co');
  }

  @override
  Future<bool> recoverSession(String sessionJson) async => false;

  @override
  Future<bool> signInWithPassword(String email, String password) async {
    throw Exception('ClientException: Failed host lookup: lysjdtyanhdfphqyijsr.supabase.co');
  }
}

void main() {
  tearDown(() => debugTestSessionBackend = null);

  test('QA-BUG: a tap while offline drops the saved guest credentials', () async {
    final b = _OfflineBackend('guest-0@hanguk.local\nsecret0Aa1');
    debugTestSessionBackend = b;

    expect(await ensureTestSession(), isFalse);
    expect(b.saved, 'guest-0@hanguk.local\nsecret0Aa1', reason: 'a network error is no answer about the account (asks: ${b.asks})');
  });
}

import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/auth_repository.dart';
import '../repositories/shift_repository.dart';
import 'backend.dart';

/// [AuthRepository] on Supabase Auth: an anonymous account (P49 — no SMS),
/// marked as Hanguk Ish's (`user_metadata.app = 'hanguk_ish'`), so that
/// hanguk.uz, whose project it shares, makes no profile of its own for it.
/// The session is kept by `supabase_flutter` between launches.
class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository(this._client);

  final SupabaseClient _client;

  @override
  String? get userId => _client.auth.currentUser?.id;

  @override
  Stream<String?> get changes => _client.auth.onAuthStateChange.map((state) => state.session?.user.id);

  @override
  Future<void> signIn() => authCall(() => _client.auth.signInAnonymously(data: ishSignUpData));

  @override
  Future<void> signOut() => authCall(() => _client.auth.signOut());
}

/// Runs a Supabase Auth call and names its failures for the screens.
Future<T> authCall<T>(Future<T> Function() call) => backendCall(() async {
      try {
        return await call();
      } on AuthRetryableFetchException catch (e) {
        // No answer at all — or a server failure (5xx), whose body names it.
        if (e.statusCode == null) throw const OfflineException();
        final code = _bodyCode.firstMatch(e.message)?.group(1);
        final mapped = authErrorCode(code, e.statusCode, e.message);
        throw ShiftActionException(mapped == 'AUTH_FAILED' ? 'SERVER_ERROR' : mapped);
      } on AuthException catch (e) {
        throw ShiftActionException(authErrorCode(e.code, e.statusCode, e.message));
      }
    });

final _bodyCode = RegExp(r'"(?:error_)?code"\s*:\s*"([a-z_]+)"');

/// The app's code for a Supabase Auth error.
String authErrorCode(String? code, String? status, String message) {
  final text = message.toLowerCase();
  return switch (code) {
    'over_request_rate_limit' => 'TOO_MANY_REQUESTS',
    'anonymous_provider_disabled' || 'signup_disabled' => 'SIGN_IN_UNAVAILABLE',
    _ when status == '429' => 'TOO_MANY_REQUESTS',
    _ when text.contains('anonymous') && text.contains('disabled') => 'SIGN_IN_UNAVAILABLE',
    _ => 'AUTH_FAILED',
  };
}

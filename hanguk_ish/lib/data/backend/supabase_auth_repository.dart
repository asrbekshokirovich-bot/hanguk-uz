import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/format/phone.dart';
import '../repositories/auth_repository.dart';
import '../repositories/shift_repository.dart';
import 'backend.dart';

/// [AuthRepository] on Supabase Auth: an SMS code to the phone, verified by
/// the server; the session is kept by `supabase_flutter` between launches.
class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository(this._client);

  final SupabaseClient _client;

  @override
  String? get userId => _client.auth.currentUser?.id;

  @override
  Stream<String?> get changes => _client.auth.onAuthStateChange.map((state) => state.session?.user.id);

  String _e164(String phone) => KoreanPhone.toE164(phone) ?? (throw const ShiftActionException('PHONE_INVALID'));

  @override
  Future<void> sendCode(String phone) =>
      authCall(() => _client.auth.signInWithOtp(phone: _e164(phone), data: ishSignUpData));

  @override
  Future<void> verifyCode(String phone, String code) => authCall(() async {
        final token = code.trim();
        if (!RegExp(r'^\d{6}$').hasMatch(token)) throw const ShiftActionException('CODE_INVALID');
        await _client.auth.verifyOTP(phone: _e164(phone), token: token, type: OtpType.sms);
      });

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
    'otp_expired' || 'otp_disabled' => 'CODE_INVALID',
    'over_sms_send_rate_limit' || 'over_request_rate_limit' => 'TOO_MANY_REQUESTS',
    'sms_send_failed' => 'SMS_FAILED',
    'validation_failed' || 'phone_not_confirmed' => 'PHONE_INVALID',
    'phone_provider_disabled' || 'signup_disabled' => 'SIGN_IN_UNAVAILABLE',
    _ when status == '429' => 'TOO_MANY_REQUESTS',
    _ when text.contains('expired') || (text.contains('invalid') && (text.contains('otp') || text.contains('token'))) =>
      'CODE_INVALID',
    _ => 'AUTH_FAILED',
  };
}

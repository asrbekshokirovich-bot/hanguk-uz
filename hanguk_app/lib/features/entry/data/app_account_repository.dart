import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// What the server said about a sign-up or sign-in with phone and password
/// (`app_register` / `app_login`, migration 20260930200000_app_accounts.sql).
enum AppAccountStatus {
  ok,

  /// Sign-up: the number already has an account.
  exists,

  /// The number belongs to a Hanguk student, who signs in with a Magic Code.
  student,
  invalidPhone,
  weakPassword,

  /// Sign-in: no account with this number.
  notFound,
  wrongPassword,

  /// Ten wrong passwords in a row: the number waits 15 minutes.
  locked,

  /// The call did not reach the server or came back unreadable.
  network,
}

@immutable
class AppAccountResult {
  const AppAccountResult(this.status, {this.phone});

  final AppAccountStatus status;

  /// `+998XXXXXXXXX`, when [status] is [AppAccountStatus.ok].
  final String? phone;
}

/// Uzbek mobile numbers only: nine digits after the fixed +998.
const int kUzNationalDigits = 9;

/// `901234567` → `+998901234567`.
String uzE164(String national) => '+998$national';

AppAccountStatus _statusOf(Object? raw) => switch (raw) {
  'ok' => AppAccountStatus.ok,
  'exists' => AppAccountStatus.exists,
  'student' => AppAccountStatus.student,
  'invalid_phone' => AppAccountStatus.invalidPhone,
  'weak_password' => AppAccountStatus.weakPassword,
  'not_found' => AppAccountStatus.notFound,
  'wrong_password' => AppAccountStatus.wrongPassword,
  'locked' => AppAccountStatus.locked,
  _ => AppAccountStatus.network,
};

/// Reads the `{status, phone}` object both functions return.
@visibleForTesting
AppAccountResult parseAppAccountResponse(Object? data) {
  if (data is Map) {
    final phone = data['phone'];
    return AppAccountResult(
      _statusOf(data['status']),
      phone: phone is String ? phone : null,
    );
  }
  return const AppAccountResult(AppAccountStatus.network);
}

class AppAccountRepository {
  AppAccountRepository(this._client);

  final SupabaseClient _client;

  Future<AppAccountResult> register(String national, String password) =>
      _call('app_register', national, password);

  Future<AppAccountResult> signIn(String national, String password) =>
      _call('app_login', national, password);

  Future<AppAccountResult> _call(
    String function,
    String national,
    String password,
  ) async {
    try {
      final data = await _client.rpc(
        function,
        params: {'p_phone': uzE164(national), 'p_password': password},
      );
      return parseAppAccountResponse(data);
    } catch (e) {
      debugPrint('$function failed: $e');
      return const AppAccountResult(AppAccountStatus.network);
    }
  }
}

final appAccountRepositoryProvider = Provider<AppAccountRepository>((ref) {
  return AppAccountRepository(Supabase.instance.client);
});

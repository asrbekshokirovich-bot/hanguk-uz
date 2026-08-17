import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(Supabase.instance.client);
});

final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

/// The signed-in student's display name, read from `profiles.full_name`.
///
/// The magic-code login (`student-login-v2`) returns the name but recovers the
/// session with an empty `user_metadata`, so the profile row — not the JWT — is
/// the source of truth. Null when there is no session or the profile carries no
/// name; callers show the greeting alone rather than falling back to the
/// synthetic `student-<uuid>` email local part.
final studentFullNameProvider = FutureProvider<String?>((ref) async {
  final client = Supabase.instance.client;
  final uid = client.auth.currentUser?.id;
  if (uid == null) return null;
  final row = await client
      .from('profiles')
      .select('full_name')
      .eq('user_id', uid)
      .maybeSingle();
  final name = row?['full_name'];
  return name is String && name.trim().isNotEmpty ? name.trim() : null;
});

// ─── Transient backend failures ──────────────────────────────────────────────
//
// App Review rejected build 1.0 (2042) under guideline 2.1(a) on 2026-08-14:
// "we are unable to log in and an error message is displayed". The reviewer's
// code was correct — the project's REST origin was returning Cloudflare 522s
// that evening, so the magic-code call failed twice on infrastructure and the
// screen showed a dead end with no way forward.
//
// The server side now retries and reports SERVICE_UNAVAILABLE / 503 instead of
// a verdict on the code. The client half is here: a blip that clears in a
// second should never reach the student at all, and one that doesn't clear
// should say what it is.

/// Thrown internally when a magic-code attempt failed on infrastructure
/// rather than on the code. Never escapes [AuthRepository].
class _TransientBackendFailure implements Exception {
  const _TransientBackendFailure(this.detail);
  final String detail;
}

/// Delays between magic-code attempts. Three attempts, ~1.6 s worst case.
const _kTransientRetryDelays = <Duration>[
  Duration(milliseconds: 400),
  Duration(milliseconds: 1200),
];

/// True when [error] is the backend being briefly unreachable rather than an
/// answer about this sign-in.
///
/// Deliberately string- and type-name-based rather than importing `dart:io`:
/// the same repository compiles for web, where `SocketException` does not
/// exist and `http`'s `ClientException` takes its place.
@visibleForTesting
bool isTransientBackendFailure(Object error) {
  if (error is TimeoutException) return true;

  if (error is FunctionException) {
    // 503 is what student-login-v2 now returns for an unreachable database;
    // 502/504/522/524 come from the gateway itself when the function never
    // answered. 408/429 are "ask again".
    final status = error.status;
    if (status == 408 || status == 429 || (status >= 500 && status <= 599)) {
      return true;
    }
    final details = error.details;
    if (details is Map) {
      final code = details['error']?.toString();
      // CODE_LOOKUP_FAILED is the pre-fix spelling of the same condition — a
      // server still running the old build must not read as a bad code.
      if (code == 'SERVICE_UNAVAILABLE' || code == 'CODE_LOOKUP_FAILED') {
        return true;
      }
    }
  }

  final name = error.runtimeType.toString();
  if (name == 'SocketException' ||
      name == 'ClientException' ||
      name == 'HandshakeException' ||
      name == 'HttpException') {
    return true;
  }

  final text = error.toString().toLowerCase();
  const transient = <String>[
    'connection timed out',
    'connection closed',
    'connection refused',
    'connection reset',
    'connection attempt failed',
    'failed host lookup',
    'network is unreachable',
    'software caused connection abort',
    'timed out',
    'timeout',
    'bad gateway',
    'service unavailable',
    'temporarily unavailable',
  ];
  return transient.any(text.contains);
}

/// Mirrors the web Auth system conceptually, but strictly serves Students.
/// - Inner Student: magic code → `student-login` Edge Function → setSession
/// - Public Student: phone/password sign-up and sign-in
/// - Owner setup: checks system_settings.owner_created
class AuthRepository {
  final SupabaseClient _client;

  AuthRepository(this._client);

  GoTrueClient get _auth => _client.auth;

  Stream<AuthState> get authStateChanges => _auth.onAuthStateChange;
  User? get currentUser => _auth.currentUser;

  // ─── Owner Setup Check ──────────────────────────────────────────────────────

  /// Returns true if the owner account has already been created.
  /// Mirrors: supabase.from('system_settings').select('owner_created').eq('id','main').maybeSingle()
  Future<bool> checkOwnerExists() async {
    try {
      final data = await _client
          .from('system_settings')
          .select('owner_created')
          .eq('id', 'main')
          .maybeSingle();
      return data?['owner_created'] == true;
    } catch (_) {
      return false;
    }
  }

  // ─── Public Student Login (Phone + Password) ────────────────────────────────

  Future<({String? error})> signInWithPhone(
    String phone,
    String password,
  ) async {
    try {
      String formattedPhone = '+${phone.replaceAll(RegExp(r'[^0-9]'), '')}';

      await _auth.signInWithPassword(phone: formattedPhone, password: password);
      return (error: null);
    } on AuthException catch (e) {
      String msg = e.message;
      if (msg.toLowerCase().contains('phone') ||
          msg.toLowerCase().contains('credentials')) {
        msg = 'Invalid phone number or password.';
      }
      return (error: msg);
    } catch (e) {
      return (error: e.toString());
    }
  }

  // ─── Student Login (magic code) ──────────────────────────────────────────────

  /// Calls the `student-login-v2` Edge Function and stores the returned
  /// session via `recoverSession` (which accepts a full session JSON and
  /// avoids the fragile refresh-token-only path used previously).
  ///
  /// Maps typed server errors (CODE_NOT_FOUND, STAFF_BLOCKED, etc.) to
  /// human-readable messages.
  ///
  /// Retries the transient class — see [isTransientBackendFailure]. A database
  /// that is briefly unreachable is not an answer about the student's code, and
  /// the 2026-08-14 App Review rejection is what one unretried blip costs.
  Future<({String? error, String? studentName})> signInWithMagicCode(
    String magicCode,
  ) async {
    final normalized = magicCode.trim().toUpperCase().replaceAll(
      RegExp(r'\s+'),
      '',
    );

    for (var attempt = 0; ; attempt++) {
      try {
        return await _magicCodeAttempt(normalized);
      } on _TransientBackendFailure catch (e) {
        if (attempt < _kTransientRetryDelays.length) {
          await Future<void>.delayed(_kTransientRetryDelays[attempt]);
          continue;
        }
        return (
          error: _messageFor('SERVICE_UNAVAILABLE', e.detail),
          studentName: null,
        );
      }
    }
  }

  /// One attempt at the magic-code exchange.
  ///
  /// Throws [_TransientBackendFailure] when the attempt died on infrastructure;
  /// every other outcome comes back as a value for the caller to show.
  Future<({String? error, String? studentName})> _magicCodeAttempt(
    String normalized,
  ) async {
    try {
      final response = await _client.functions.invoke(
        'student-login-v2',
        body: {'magicCode': normalized},
      );

      if (response.data == null) {
        return (error: _messageFor('INTERNAL_ERROR', null), studentName: null);
      }

      final data = response.data as Map<String, dynamic>;

      // Typed error surface from v2 — see student-login.v2.ts
      final errorCode = data['error'] as String?;
      if (errorCode != null) {
        final detail = data['detail']?.toString();
        return (error: _messageFor(errorCode, detail), studentName: null);
      }

      final session = data['session'] as Map<String, dynamic>?;
      final user = data['user'] as Map<String, dynamic>?;
      if (session == null || user == null) {
        return (
          error: _messageFor('INTERNAL_ERROR', 'session missing'),
          studentName: null,
        );
      }

      // Hand the FULL session to recoverSession() so the SDK doesn't
      // round-trip the refresh token back to gotrue (which was the v1 bug).
      // Session.fromJson expects: access_token, refresh_token, expires_in,
      // expires_at?, token_type, user
      final sessionJson = jsonEncode({
        'access_token': session['access_token'],
        'refresh_token': session['refresh_token'],
        'expires_in': session['expires_in'],
        'expires_at': session['expires_at'],
        'token_type': session['token_type'] ?? 'bearer',
        'user': {
          'id': user['id'],
          'aud': 'authenticated',
          'email': user['email'],
          'app_metadata': const <String, dynamic>{},
          'user_metadata': const <String, dynamic>{},
          'created_at': DateTime.now().toUtc().toIso8601String(),
        },
      });
      await _auth.recoverSession(sessionJson);

      final profile = data['profile'] as Map<String, dynamic>?;
      final studentName = profile?['full_name']?.toString();
      return (error: null, studentName: studentName);
    } on FunctionException catch (e) {
      if (isTransientBackendFailure(e)) {
        throw _TransientBackendFailure('HTTP ${e.status}');
      }
      // FunctionException.details may carry our typed error code if v2
      // returned a non-2xx response that supabase_flutter wrapped.
      if (e.details is Map) {
        final m = e.details as Map;
        if (m['error'] != null) {
          return (
            error: _messageFor(m['error'].toString(), m['detail']?.toString()),
            studentName: null,
          );
        }
      }
      return (
        error: _messageFor('INTERNAL_ERROR', e.details?.toString()),
        studentName: null,
      );
    } on AuthException catch (e) {
      return (
        error: _messageFor('AUTH_SIGNIN_FAILED', e.message),
        studentName: null,
      );
    } catch (e) {
      // Socket resets, DNS failures, TLS handshakes, request timeouts: the
      // app is online enough to have tried and the backend did not answer.
      // Retryable, and not the student's problem to diagnose.
      if (isTransientBackendFailure(e)) {
        throw _TransientBackendFailure(e.runtimeType.toString());
      }
      return (
        error: _messageFor('INTERNAL_ERROR', e.toString()),
        studentName: null,
      );
    }
  }

  /// Maps the v2 Edge Function's typed error codes to user-facing messages.
  /// Unknown codes fall back to a generic message.
  String _messageFor(String code, String? detail) {
    switch (code) {
      case 'BAD_INPUT':
      case 'CODE_REQUIRED':
        return 'Please enter a valid 6–10 character access code.';
      case 'CODE_NOT_FOUND':
        return "We don't recognise this code. Please double-check it with your counsellor.";
      case 'SERVICE_UNAVAILABLE':
      case 'CODE_LOOKUP_FAILED':
        // Not a verdict on the code — the server could not be reached. Saying
        // "contact your counsellor" here, as this used to, sends a student
        // (and an App Review reviewer) chasing a problem that clears itself.
        return 'We could not reach the server. Please check your connection and tap sign in again.';
      case 'STAFF_BLOCKED':
        return 'Staff members must use username/password sign-in, not a magic code.';
      case 'AUTH_CREATE_FAILED':
        return 'Server is busy setting up your account. Please try again in 30 seconds.';
      case 'AUTH_SIGNIN_FAILED':
        return 'Login server error. Please try again, or ask your counsellor to reset your account.';
      case 'INTERNAL_ERROR':
        return 'Unexpected server error. Please try again, or contact your counsellor.';
      default:
        // Some legacy responses returned plain strings — show them directly.
        return code;
    }
  }

  // ─── Public Student Sign Up (Phone) ───────────────────────────────────────

  Future<({String? error, bool isCrmAccount, bool alreadyRegistered})>
  signUpStudent(String phone, String password, String fullName) async {
    try {
      // 1. Guard check: Pre-verify if this phone already exists in the CRM
      try {
        final response = await _client.functions.invoke(
          'check-student-phone',
          body: {'phone': phone.trim()},
        );

        if (response.data != null && response.data['exists'] == true) {
          return (
            error:
                'This account was created by your counselor. Please use the Magic Access Code they provided.',
            isCrmAccount: true,
            alreadyRegistered: true,
          );
        }
      } catch (e) {
        // Soft fail on check: proceed to attempt signup anyway if edge function fails
      }

      String formattedPhone = '+${phone.replaceAll(RegExp(r'[^0-9]'), '')}';

      final res = await _auth.signUp(
        phone: formattedPhone,
        password: password,
        data: {
          'full_name': fullName,
          'phone': formattedPhone, // Save standardized format
        },
      );

      if (res.user != null) {
        // Create profile directly to ensure the user drops into 'student' scope
        // Alternatively, your backend triggers might handle this.
        try {
          // If the trigger creates it, this might fail with duplicate key,
          // so we use upsert or just ignore. In Hanguk typically the trigger does it,
          // but we usually also assign user_roles.
          await _client.from('user_roles').insert({
            'user_id': res.user!.id,
            'role': 'student',
          });
        } catch (_) {}
      }

      return (error: null, isCrmAccount: false, alreadyRegistered: false);
    } on AuthException catch (e) {
      String msg = e.message;
      bool alreadyRegistered = false;

      if (msg.toLowerCase().contains('already registered') ||
          msg.toLowerCase().contains('user already exists')) {
        msg = 'This phone number is already registered. Please sign in.';
        alreadyRegistered = true;
      } else if (msg.toLowerCase().contains('phone signups are disabled') ||
          msg.toLowerCase().contains('provider')) {
        msg =
            'Registration is currently disabled on the server. Please contact an administrator.';
      } else if (msg.toLowerCase().contains('phone')) {
        msg =
            'Invalid phone number format. Please ensure you included the country code.';
      } else if (msg.toLowerCase().contains('credentials')) {
        msg = 'Invalid credentials provided.';
      }
      return (
        error: msg,
        isCrmAccount: false,
        alreadyRegistered: alreadyRegistered,
      );
    } catch (e) {
      return (
        error: e.toString(),
        isCrmAccount: false,
        alreadyRegistered: false,
      );
    }
  }

  // ─── Owner Setup ─────────────────────────────────────────────────────────────

  /// Mirrors: signUpOwner in AuthContext.tsx
  Future<({String? error})> signUpOwner(
    String username,
    String password,
    String fullName,
  ) async {
    final email = '${username.toLowerCase().trim()}@hanguk.local';
    try {
      final res = await _auth.signUp(
        email: email,
        password: password,
        data: {
          'full_name': fullName,
          'username': username.toLowerCase().trim(),
        },
      );

      if (res.user != null) {
        final userId = res.user!.id;

        await _client
            .from('profiles')
            .update({'username': username.toLowerCase().trim()})
            .eq('user_id', userId);

        await _client.from('user_roles').insert({
          'user_id': userId,
          'role': 'owner',
        });

        await _client
            .from('system_settings')
            .update({'owner_created': true, 'signup_enabled': false})
            .eq('id', 'main');
      }

      return (error: null);
    } on AuthException catch (e) {
      return (error: e.message);
    } catch (e) {
      return (error: e.toString());
    }
  }

  // ─── Sign Out ─────────────────────────────────────────────────────────────────

  Future<void> signOut() async {
    await _auth.signOut();
  }
}

import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(Supabase.instance.client);
});

final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

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
  Future<({String? error, String? studentName})> signInWithMagicCode(
    String magicCode,
  ) async {
    try {
      final normalized = magicCode.trim().toUpperCase().replaceAll(
        RegExp(r'\s+'),
        '',
      );
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
      case 'CODE_LOOKUP_FAILED':
        return 'Server error while verifying your code. Please contact your counsellor.';
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

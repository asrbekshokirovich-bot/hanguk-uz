import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/feature_flags/uni_db_flag.dart';
import '../../auth/data/auth_repository.dart';
import 'push_token_registrar.dart';

/// Returns the current device's push token (null if unavailable yet).
///
/// The default implementation returns null because no push-platform SDK
/// is integrated yet. When firebase_messaging / flutter_apns_only / a
/// web-push subscription helper is added, replace the default by
/// calling [PushTokenBootstrap.setTokenSource] from main.dart.
typedef PushTokenSource = Future<PlatformTokenInfo?> Function();

class PlatformTokenInfo {
  const PlatformTokenInfo({
    required this.token,
    required this.platform,
    this.appVersion,
    this.deviceLabel,
    this.preferredLang = 'en',
  });
  final String token;
  final String platform; // 'android' | 'ios' | 'web'
  final String? appVersion;
  final String? deviceLabel;
  final String preferredLang;
}

/// Listens for auth-state changes and registers the device's push token
/// each time the user signs in. Idempotent — server upserts on
/// (platform, token) so re-runs on the same device just bump
/// last_seen_at.
class PushTokenBootstrap {
  PushTokenBootstrap(this._registrar);

  final PushTokenRegistrar _registrar;
  PushTokenSource _source = _defaultNoOpSource;
  StreamSubscription<AuthState>? _sub;

  /// Replace the token source. Call this from main.dart after the FCM /
  /// APNs / web-push SDK has been initialised. Safe to call before
  /// start() or after — the next signedIn event will pick it up.
  void setTokenSource(PushTokenSource source) {
    _source = source;
  }

  /// Begin listening to auth state changes. Returns the running
  /// subscription so callers can cancel on app dispose.
  StreamSubscription<AuthState> start(Stream<AuthState> authChanges) {
    _sub?.cancel();
    _sub = authChanges.listen((state) async {
      if (state.event == AuthChangeEvent.signedIn ||
          state.event == AuthChangeEvent.tokenRefreshed) {
        await _maybeRegister();
      }
    });
    // Also fire once on startup if a session already exists.
    if (Supabase.instance.client.auth.currentUser != null) {
      // ignore: discarded_futures
      _maybeRegister();
    }
    return _sub!;
  }

  Future<void> _maybeRegister() async {
    if (!kUniDbEnabled) return;
    final info = await _source();
    if (info == null) return; // no SDK configured yet — silent no-op
    try {
      await _registrar.register(
        token: info.token,
        platformOverride: info.platform,
        appVersion: info.appVersion,
        deviceLabel: info.deviceLabel,
        preferredLang: info.preferredLang,
      );
    } catch (err, st) {
      // We deliberately swallow errors here. Push registration failing
      // should not block the user from using the rest of the app; the
      // outbox + cron will keep accruing events and the device will
      // re-register on the next auth-state change.
      // ignore: avoid_print
      print('PushTokenBootstrap.register failed: $err\n$st');
    }
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
  }
}

Future<PlatformTokenInfo?> _defaultNoOpSource() async => null;

/// Convenience: a default platform-detection helper that callers can
/// build on top of. Doesn't supply a token (no SDK) — only the platform
/// label. Useful for unit tests and documentation.
String? defaultPushPlatform() {
  if (kIsWeb) return 'web';
  // dart:io would let us distinguish Android vs iOS — kept out here so
  // this file remains compilable on all platforms without conditional
  // imports. The bootstrap caller already knows the right value.
  return null;
}

final pushTokenBootstrapProvider = Provider<PushTokenBootstrap>((ref) {
  final registrar = ref.watch(pushTokenRegistrarProvider);
  final bootstrap = PushTokenBootstrap(registrar);
  // Wire to the auth stream automatically. The provider stays alive for
  // the app lifetime (kept by the riverpod ProviderScope).
  final authRepo = ref.read(authRepositoryProvider);
  bootstrap.start(authRepo.authStateChanges);
  ref.onDispose(() {
    // ignore: discarded_futures
    bootstrap.dispose();
  });
  return bootstrap;
});

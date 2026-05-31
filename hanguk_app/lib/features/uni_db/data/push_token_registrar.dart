import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/feature_flags/uni_db_flag.dart';

/// Posts to the `register-push-token` Edge Function.
///
/// Decoupled from Firebase / APNs / web-push SDKs: callers obtain the
/// platform token via whatever transport they prefer (firebase_messaging,
/// flutter_apns, navigator.serviceWorker.pushManager) and pass it here.
/// Idempotent: same (platform, token) refreshes last_seen_at server-side.
class PushTokenRegistrar {
  PushTokenRegistrar(this._client);
  final SupabaseClient _client;

  Future<void> register({
    required String token,
    String? platformOverride,
    String? appVersion,
    String? deviceLabel,
    String preferredLang = 'en',
  }) async {
    if (!kUniDbEnabled) return; // no-op until the feature flag flips
    if (_client.auth.currentUser == null) return; // need a JWT
    final platform = platformOverride ?? _detectPlatform();
    if (platform == null) return; // unsupported platform — skip silently
    if (token.isEmpty) return;
    await _client.functions.invoke(
      'register-push-token',
      body: {
        'platform': platform,
        'token': token,
        'app_version': ?appVersion,
        'device_label': ?deviceLabel,
        'preferred_lang': preferredLang,
      },
    );
  }

  String? _detectPlatform() {
    if (kIsWeb) return 'web';
    try {
      if (Platform.isAndroid) return 'android';
      if (Platform.isIOS) return 'ios';
    } catch (_) {
      // dart:io not available (e.g. unit tests on non-web targets)
      return null;
    }
    return null;
  }
}

final pushTokenRegistrarProvider = Provider<PushTokenRegistrar>(
  (ref) => PushTokenRegistrar(Supabase.instance.client),
);

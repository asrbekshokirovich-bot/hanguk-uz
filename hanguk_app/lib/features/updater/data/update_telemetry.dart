import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Sends one upsert per app launch into `public.app_version_pings` so the
/// CRM can answer "how many devices are on which version?" without scraping
/// per-event analytics.
///
/// Wrapped in try/catch — a telemetry failure must never bubble to the UI.
final updateTelemetryProvider = Provider<UpdateTelemetry>((ref) {
  return UpdateTelemetry(Supabase.instance.client);
});

class UpdateTelemetry {
  UpdateTelemetry(this._client);
  final SupabaseClient _client;

  bool _alreadySentThisSession = false;

  /// Call once after auth resolves on app launch. Sends are deduplicated
  /// per app session so toggling the gate doesn't spam.
  Future<void> ping({String channel = 'stable'}) async {
    if (_alreadySentThisSession) return;
    _alreadySentThisSession = true;

    final user = _client.auth.currentUser;
    if (user == null) return; // Anonymous users don't ping.

    try {
      final pkg = await PackageInfo.fromPlatform();
      final platform = _platformLabel();
      final agent = await _userAgentString();

      await _client.from('app_version_pings').upsert({
        'user_id': user.id,
        'platform': platform,
        'version': pkg.version,
        'build': int.tryParse(pkg.buildNumber),
        'locale': PlatformDispatcher.instance.locale.toLanguageTag(),
        'channel': channel,
        'raw_user_agent': agent,
        'last_seen_at': DateTime.now().toUtc().toIso8601String(),
      });
    } catch (e) {
      // Telemetry is best-effort — never crash the app for it.
      debugPrint('[UpdateTelemetry] ping failed: $e');
    }
  }

  String _platformLabel() {
    if (kIsWeb) return 'web';
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    if (Platform.isMacOS) return 'macos';
    if (Platform.isWindows) return 'windows';
    if (Platform.isLinux) return 'linux';
    return 'unknown';
  }

  Future<String?> _userAgentString() async {
    try {
      final info = DeviceInfoPlugin();
      if (kIsWeb) {
        final web = await info.webBrowserInfo;
        return '${web.browserName.name}/${web.appVersion ?? ''}';
      }
      if (Platform.isAndroid) {
        final a = await info.androidInfo;
        return 'android/${a.version.release} ${a.manufacturer}/${a.model}';
      }
      if (Platform.isIOS) {
        final i = await info.iosInfo;
        return 'ios/${i.systemVersion} ${i.utsname.machine}';
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}

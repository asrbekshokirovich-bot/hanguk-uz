import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../design_system/seoul_night/widgets/hard_shadow.dart';
import '../../l10n/app_localizations.dart';
import '../analytics/app_events.dart';
import '../analytics/tracked.dart';

/// Push for guests (app analytics plan, stage 5; B3 — «telefon qoldirmagan
/// mehmonga push, ruxsat so'rab»). Until now only a signed-in student's phone
/// could get a push, so a guest who never left a phone could not be reached
/// again. After a guest's first report the app asks once, in its own words,
/// whether it may send news on deadlines and scholarships; on yes the phone
/// asks for permission, and on allow the token is registered by the install
/// id (`app_push_token_register`) with the app's language. The CRM sends
/// campaigns to these phones and counts the opens (push_opened carries the
/// campaign).
abstract final class GuestPush {
  static const _storage = FlutterSecureStorage();
  static const _askedKey = 'guest_push_asked_v1';
  static const _allowedKey = 'guest_push_allowed_v1';

  /// Reads and writes the flags; tests swap it.
  @visibleForTesting
  static GuestPushStore store = const _SecureStore();

  /// Whether this phone may be asked now: a guest (nobody signed in) on
  /// Android or iOS, never asked before.
  static Future<bool> shouldAsk({required bool signedIn, required bool mobile}) async {
    if (signedIn || !mobile) return false;
    return !(await store.read(_askedKey) ?? false);
  }

  /// After the report: asks once. [context] must still be mounted.
  static Future<void> maybeAsk(BuildContext context) async {
    final lang = Localizations.localeOf(context).languageCode;
    if (!await shouldAsk(signedIn: _signedIn, mobile: _mobile)) return;
    if (!context.mounted) return;
    final answer = _sheet(context);
    await store.write(_askedKey, true);
    final yes = await answer ?? false;
    if (!yes) return;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
      final status = settings.authorizationStatus;
      AppEvents.track('push_permission', props: {'result': status.name, 'source': 'guest'});
      if (status == AuthorizationStatus.authorized || status == AuthorizationStatus.provisional) {
        await store.write(_allowedKey, true);
        await register(lang);
      }
    } catch (e) {
      debugPrint('GuestPush: permission failed: $e');
    }
  }

  static String? _lastLang;

  /// Keeps an allowed guest's token current (a new token, another language):
  /// called with the app's language on each start and language change.
  static Future<void> refresh(String? languageCode) async {
    final lang = languageCode ?? 'uz';
    if (_lastLang == lang || _signedIn || !_mobile) return;
    _lastLang = lang;
    if (!(await store.read(_allowedKey) ?? false)) return;
    await register(lang);
  }

  /// Sends this phone's token with [lang]; quiet on failure (the next start tries again).
  static Future<void> register(String lang) async {
    final install = AppEvents.installId;
    if (install == null) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;
      String? version;
      try {
        version = (await PackageInfo.fromPlatform()).version;
      } catch (_) {}
      await Supabase.instance.client.rpc('app_push_token_register', params: registerParams(install, _platform, token, lang, version));
    } catch (e) {
      debugPrint('GuestPush: register failed: $e');
    }
  }

  /// The call's parameters, as the server takes them.
  @visibleForTesting
  static Map<String, Object?> registerParams(String install, String platform, String token, String lang, String? version) => {
    'p_install_id': install,
    'p_platform': platform,
    'p_token': token,
    'p_lang': lang,
    'p_app_version': version,
  };

  static bool get _signedIn {
    try {
      return Supabase.instance.client.auth.currentUser != null;
    } catch (_) {
      return false;
    }
  }

  static bool get _mobile {
    if (kIsWeb) return false;
    try {
      return Platform.isAndroid || Platform.isIOS;
    } catch (_) {
      return false;
    }
  }

  static String get _platform {
    try {
      return Platform.isIOS ? 'ios' : 'android';
    } catch (_) {
      return 'android';
    }
  }

  /// The app's own question before the phone's: true for yes.
  static Future<bool?> _sheet(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    AppEvents.overlayOpened('guest_push');
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: FdColors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.guestPushTitle, style: fdText(16, FontWeight.w800, FdColors.ink)),
              const SizedBox(height: 8),
              Text(l.guestPushBody, style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
              const SizedBox(height: 16),
              HardButton(label: l.guestPushYes, onPressed: tracked('guest_push.yes', () => Navigator.of(ctx).pop(true))),
              const SizedBox(height: 4),
              TextButton(
                onPressed: tracked('guest_push.later', () => Navigator.of(ctx).pop(false)),
                child: Text(l.guestPushLater, style: fdText(14, FontWeight.w700, FdColors.muted)),
              ),
            ],
          ),
        ),
      ),
    ).whenComplete(() => AppEvents.overlayClosed('guest_push'));
  }
}

/// Where the asked / allowed flags live.
abstract class GuestPushStore {
  Future<bool?> read(String key);
  Future<void> write(String key, bool value);
}

class _SecureStore implements GuestPushStore {
  const _SecureStore();

  @override
  Future<bool?> read(String key) async {
    try {
      final v = await GuestPush._storage.read(key: key);
      return v == null ? null : v == '1';
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String key, bool value) async {
    try {
      await GuestPush._storage.write(key: key, value: value ? '1' : '0');
    } catch (_) {}
  }
}

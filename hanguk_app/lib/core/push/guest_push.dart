import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

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
///
/// Ushlab qolish rejasi P11 (QU1): a guest is also asked when they first save
/// a university (♥) — the reminder is about that university. Each reason asks
/// once, so two asks at most; an allowed phone is never asked again.
enum GuestPushReason { report, heart }

abstract final class GuestPush {
  static const _storage = FlutterSecureStorage();
  static const _askedKey = 'guest_push_asked_v1';
  static const _askedHeartKey = 'guest_push_asked_heart_v1';
  static const _allowedKey = 'guest_push_allowed_v1';
  static const _quietKey = 'guest_push_quiet_v1';

  /// Reads and writes the flags; tests swap it.
  @visibleForTesting
  static GuestPushStore store = const _SecureStore();

  /// Whether this phone may be asked now for [reason]: a guest (nobody
  /// signed in) on Android or iOS, not allowed yet, not asked for it before.
  static Future<bool> shouldAsk({
    required bool signedIn,
    required bool mobile,
    GuestPushReason reason = GuestPushReason.report,
  }) async {
    if (signedIn || !mobile) return false;
    if (await store.read(_allowedKey) ?? false) return false;
    return !(await store.read(_keyFor(reason)) ?? false);
  }

  static String _keyFor(GuestPushReason reason) =>
      reason == GuestPushReason.heart ? _askedHeartKey : _askedKey;

  /// After the report, or the first ♥: asks once per reason. The sheet goes
  /// on the root navigator, so the screen that asked may already be closing.
  static Future<void> maybeAsk(BuildContext context, {GuestPushReason reason = GuestPushReason.report}) async {
    final host = Navigator.of(context, rootNavigator: true).context;
    final lang = Localizations.localeOf(host).languageCode;
    if (!await shouldAsk(signedIn: _signedIn, mobile: _mobile, reason: reason)) return;
    if (reason == GuestPushReason.heart) await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!host.mounted) return;
    final answer = _sheet(host, reason);
    await store.write(_keyFor(reason), true);
    final yes = await answer ?? false;
    if (!yes) return;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
      final status = settings.authorizationStatus;
      AppEvents.track('push_permission', props: {
        'result': status.name,
        'source': reason == GuestPushReason.heart ? 'guest_heart' : 'guest',
      });
      if (status == AuthorizationStatus.authorized || status == AuthorizationStatus.provisional) {
        await store.write(_allowedKey, true);
        await register(lang);
      } else if (status == AuthorizationStatus.denied && host.mounted) {
        // P17 (D3): the phone said no — the reminders can still come by Telegram.
        await telegramSheet(host);
      }
    } catch (e) {
      debugPrint('GuestPush: permission failed: $e');
    }
  }

  /// iOS quiet start (ushlab qolish P12): a guest's iPhone is given
  /// provisional permission on first start — no prompt, notifications land
  /// quietly in Notification Center — so a deadline reminder reaches it
  /// before the app has asked. The app's own question still comes after the
  /// report (or ♥) and turns it into a full permission.
  static bool wantsQuiet({required bool ios, required bool signedIn, required bool allowed, required bool done}) =>
      ios && !signedIn && !allowed && !done;

  static Future<void> _quietStart(String lang) async {
    final allowed = await store.read(_allowedKey) ?? false;
    final done = await store.read(_quietKey) ?? false;
    if (!wantsQuiet(ios: _ios, signedIn: _signedIn, allowed: allowed, done: done)) return;
    await store.write(_quietKey, true);
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: true,
      );
      final status = settings.authorizationStatus;
      AppEvents.track('push_permission', props: {'result': status.name, 'source': 'guest_quiet'});
      if (status == AuthorizationStatus.provisional || status == AuthorizationStatus.authorized) {
        await register(lang);
      }
    } catch (e) {
      debugPrint('GuestPush: provisional failed: $e');
    }
  }

  static const _remindersFlag = 'guest_reminders_off_v1';

  /// «Muddat eslatmalari» (ushlab qolish P10, D2): shown to a guest whose
  /// phone may get pushes (allowed, or quietly allowed on iOS).
  static Future<bool> remindersVisible() async {
    if (_signedIn || !_mobile) return false;
    return (await store.read(_allowedKey) ?? false) || (await store.read(_quietKey) ?? false);
  }

  static Future<bool> remindersOn() async => !(await store.read(_remindersFlag) ?? false);

  /// Turns the phone's deadline reminders on or off on the server
  /// (app_guest_push_set); campaigns are not affected. False when it failed.
  static Future<bool> setReminders(bool on) async {
    final install = AppEvents.installId;
    if (install == null) return false;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return false;
      final res = await Supabase.instance.client.rpc('app_guest_push_set', params: remindersParams(install, token, on));
      if (res is Map && res['status'] != 'ok') return false;
      await store.write(_remindersFlag, !on);
      AppEvents.track('push_permission', props: {'result': on ? 'reminders_on' : 'reminders_off', 'source': 'guest'});
      return true;
    } catch (e) {
      debugPrint('GuestPush: reminders failed: $e');
      return false;
    }
  }

  @visibleForTesting
  static Map<String, Object?> remindersParams(String install, String token, bool on) => {
    'p_install_id': install,
    'p_token': token,
    'p_enabled': on,
  };

  /// «Telegram'da olish» (ushlab qolish P17, Claude Design D3): the phone's
  /// code (app_telegram_sub_code) opens t.me/<bot>?start=D_<code>; the bot
  /// ties the chat to this phone and the reminders come there (P16).
  static Future<void> telegramSheet(BuildContext context) async {
    final l = AppLocalizations.of(context)!;
    final lang = Localizations.localeOf(context).languageCode;
    AppEvents.overlayOpened('guest_telegram');
    final go = await showModalBottomSheet<bool>(
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
              Text(l.guestTelegramTitle, style: fdText(16, FontWeight.w800, FdColors.ink)),
              const SizedBox(height: 8),
              Text(l.guestTelegramBody, style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
              const SizedBox(height: 16),
              HardButton(
                label: l.guestTelegramButton,
                onPressed: tracked('guest_telegram.open', () => Navigator.of(ctx).pop(true)),
              ),
              const SizedBox(height: 4),
              TextButton(
                onPressed: tracked('guest_telegram.later', () => Navigator.of(ctx).pop(false)),
                child: Text(l.guestPushLater, style: fdText(14, FontWeight.w700, FdColors.muted)),
              ),
            ],
          ),
        ),
      ),
    ).whenComplete(() => AppEvents.overlayClosed('guest_telegram'));
    if (go != true) return;
    final uri = await telegramLink(lang);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  /// t.me/<bot>?start=D_<code> for this phone, or null when the server or the
  /// bot cannot be reached.
  static Future<Uri?> telegramLink(String lang) async {
    final install = AppEvents.installId;
    if (install == null) return null;
    try {
      final client = Supabase.instance.client;
      final res = await client.rpc('app_telegram_sub_code', params: {'p_install_id': install, 'p_lang': lang});
      final code = res is Map ? res['code'] : null;
      final info = await client.functions.invoke('telegram-webhook?action=botinfo', method: HttpMethod.get);
      final bot = info.data is Map ? (info.data as Map)['username'] : null;
      return subLink(bot is String ? bot : null, code is String ? code : null);
    } catch (e) {
      debugPrint('GuestPush: telegram link failed: $e');
      return null;
    }
  }

  @visibleForTesting
  static Uri? subLink(String? bot, String? code) {
    final b = (bot ?? '').trim();
    final c = (code ?? '').trim();
    if (b.isEmpty || !RegExp(r'^[A-HJ-NP-Z2-9]{10}$').hasMatch(c)) return null;
    return Uri.parse('https://t.me/$b?start=D_$c');
  }

  static String? _lastLang;

  /// Keeps an allowed guest's token current (a new token, another language):
  /// called with the app's language on each start and language change.
  static Future<void> refresh(String? languageCode) async {
    final lang = languageCode ?? 'uz';
    if (_lastLang == lang || _signedIn || !_mobile) return;
    _lastLang = lang;
    if (!(await store.read(_allowedKey) ?? false)) {
      // a quietly allowed iPhone keeps its token current too
      if (await store.read(_quietKey) ?? false) {
        await register(lang);
      } else {
        await _quietStart(lang);
      }
      return;
    }
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

  static bool get _ios {
    if (kIsWeb) return false;
    try {
      return Platform.isIOS;
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
  static Future<bool?> _sheet(BuildContext context, GuestPushReason reason) {
    final l = AppLocalizations.of(context)!;
    final heart = reason == GuestPushReason.heart;
    AppEvents.overlayOpened(heart ? 'guest_push_heart' : 'guest_push');
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
              Text(heart ? l.guestPushHeartTitle : l.guestPushTitle, style: fdText(16, FontWeight.w800, FdColors.ink)),
              const SizedBox(height: 8),
              Text(heart ? l.guestPushHeartBody : l.guestPushBody, style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
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
    ).whenComplete(() => AppEvents.overlayClosed(heart ? 'guest_push_heart' : 'guest_push'));
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

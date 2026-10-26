import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_events.dart';

/// A lead's link code reaching the app, from the link an operator sent the
/// person (hanguk.uz/l/<code>, app analytics stage 2): opened with the app
/// installed (`hanguk://open/l/<code>`), installed from Google Play through it
/// (the install referrer `l=<code>`), or the web app opened with `?l=<code>`.
/// The phone is tied to that lead once (`app_identity_claim`), so the lead's
/// card shows what they do in the app.
abstract final class IdentityLinks {
  static const _storage = FlutterSecureStorage();
  static const _claimedKey = 'identity_links_claimed_v1';
  static const _referrerKey = 'install_referrer_checked_v1';

  /// Must match MainActivity.kt.
  static const _referrer = MethodChannel('com.hanguk.studentapp/install_referrer');

  /// True once a link tied this phone to a lead and the person has not been
  /// told yet ([LinkWelcome] tells them, once).
  static final ValueNotifier<bool> justLinked = ValueNotifier(false);

  static final Set<String> _inFlight = {};

  /// [raw] as a lead's link code, or null when it cannot be one.
  static String? codeOf(String? raw) {
    final c = (raw ?? '').trim().toLowerCase();
    return RegExp(r'^[a-z0-9]{6,32}$').hasMatch(c) ? c : null;
  }

  /// The code in an app path: '/l/<code>'.
  static String? codeFromPath(String path) {
    final m = RegExp(r'^/l/([^/?#]+)/?$').firstMatch(path);
    return m == null ? null : codeOf(m.group(1));
  }

  /// The code in a Play install referrer: 'l=<code>&utm_source=…'.
  static String? codeFromReferrer(String? referrer) {
    if (referrer == null || referrer.isEmpty) return null;
    try {
      return codeOf(Uri.splitQueryString(referrer)['l']);
    } catch (_) {
      return null;
    }
  }

  /// Ties this phone to the lead whose code [raw] is; [via] is 'link',
  /// 'referrer' or 'web'. Once per code: opening the same link again is not
  /// a new tie.
  static Future<void> claim(String? raw, String via) async {
    final code = codeOf(raw);
    final install = AppEvents.installId;
    if (code == null || install == null || !_inFlight.add(code)) return;
    try {
      final done = await _claimed();
      if (done.contains(code)) return;
      String status;
      try {
        final res = await Supabase.instance.client.rpc(
          'app_identity_claim',
          params: {'p_install_id': install, 'p_link_code': code, 'p_via': via},
        );
        status = res is Map && res['status'] is String ? res['status'] as String : 'error';
      } catch (_) {
        status = 'error';
      }
      AppEvents.track('link_open', props: {'via': via, 'result': status});
      if (status == 'ok') {
        await _storage.write(key: _claimedKey, value: [...done, code].join(','));
        justLinked.value = true;
      }
    } finally {
      _inFlight.remove(code);
    }
  }

  static Future<List<String>> _claimed() async {
    try {
      final raw = await _storage.read(key: _claimedKey);
      return raw == null || raw.isEmpty ? <String>[] : raw.split(',');
    } catch (_) {
      return <String>[];
    }
  }

  /// Android, the first launch only: the code Google Play kept from the link
  /// the app was installed through.
  static Future<void> checkInstallReferrer() async {
    if (kIsWeb) return;
    try {
      if (!Platform.isAndroid) return;
      if (await _storage.read(key: _referrerKey) != null) return;
      await _storage.write(key: _referrerKey, value: '1');
      final referrer = await _referrer.invokeMethod<String>('get');
      final code = codeFromReferrer(referrer);
      if (code != null) await claim(code, 'referrer');
    } catch (e) {
      debugPrint('[IdentityLinks] install referrer: $e');
    }
  }

  /// The web app opened with `?l=<code>`.
  static Future<void> checkWebLink() async {
    if (!kIsWeb) return;
    final code = codeOf(Uri.base.queryParameters['l']);
    if (code != null) await claim(code, 'web');
  }
}

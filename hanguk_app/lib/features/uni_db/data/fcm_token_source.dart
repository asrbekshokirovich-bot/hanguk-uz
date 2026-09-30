import 'dart:io' show Platform;
import 'dart:ui' show PlatformDispatcher;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:package_info_plus/package_info_plus.dart';

import '../../entry/data/entry_store.dart';
import 'push_token_bootstrap.dart';

/// The language push notifications should be written in: the one chosen in
/// the app ([languageCode], or the stored choice when none is passed), else
/// the phone's own language when the app offers it, else Uzbek.
Future<String> _pushLanguage(String? languageCode) async {
  if (languageCode != null && kEntryLanguages.contains(languageCode)) {
    return languageCode;
  }
  final stored = (await EntryStore.load()).languageCode;
  if (stored != null) return stored;
  final device = PlatformDispatcher.instance.locale.languageCode;
  return kEntryLanguages.contains(device) ? device : 'uz';
}

/// Reads the device's FCM token for [PushTokenBootstrap].
///
/// [languageCode] is the language chosen in the app; `main.dart` passes it on
/// every rebuild, so changing the language re-registers the token with it.
Future<PlatformTokenInfo?> fcmTokenSource({String? languageCode}) async {
  final messaging = FirebaseMessaging.instance;

  final settings = await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );

  if (settings.authorizationStatus == AuthorizationStatus.denied) {
    return null;
  }

  final token = await messaging.getToken();
  if (token == null || token.isEmpty) return null;

  String platform = 'android';
  if (kIsWeb) {
    platform = 'web';
  } else {
    try {
      if (Platform.isIOS) platform = 'ios';
    } catch (_) {}
  }

  String? appVersion;
  try {
    final info = await PackageInfo.fromPlatform();
    appVersion = info.version;
  } catch (_) {}

  return PlatformTokenInfo(
    token: token,
    platform: platform,
    appVersion: appVersion,
    preferredLang: await _pushLanguage(languageCode),
  );
}

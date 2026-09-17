import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:package_info_plus/package_info_plus.dart';

import 'push_token_bootstrap.dart';

Future<PlatformTokenInfo?> fcmTokenSource() async {
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
    preferredLang: 'uz',
  );
}

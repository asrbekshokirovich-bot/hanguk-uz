import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../repositories/push_service.dart';

/// [PushService] on Firebase Cloud Messaging (P56). Firebase reads the
/// build's `android/app/google-services.json` (both apps, in the Firebase
/// project of the student app); a build without it has no Firebase app, and
/// [start] answers false. The notifications themselves are drawn by the
/// phone (the server sends title and text); nothing runs in the background.
class FirebasePushService implements PushService {
  FirebasePushService({SharedPreferences? prefs}) : _prefs = prefs;

  /// Set once the permission was asked (the answer is the phone's to keep).
  static const askedKey = 'push_permission_asked';

  final SharedPreferences? _prefs;
  Future<bool>? _started;

  @override
  Future<bool> start() => _started ??= _start();

  Future<bool> _start() async {
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      return true;
    } on Object {
      return false;
    }
  }

  @override
  Future<void> askPermissionOnce() async {
    if (_prefs?.getBool(askedKey) ?? false) return;
    try {
      await FirebaseMessaging.instance.requestPermission();
      await _prefs?.setBool(askedKey, true);
    } on Object {
      // Asked again at the next launch.
    }
  }

  @override
  Future<String?> token() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } on Object {
      return null;
    }
  }

  @override
  Stream<String> get tokenRefreshes async* {
    if (!await start()) return;
    yield* FirebaseMessaging.instance.onTokenRefresh;
  }

  @override
  Stream<void> get opened async* {
    if (!await start()) return;
    yield* FirebaseMessaging.onMessageOpenedApp;
  }

  @override
  Future<bool> launchedByNotification() async {
    if (!await start()) return false;
    try {
      return await FirebaseMessaging.instance.getInitialMessage() != null;
    } on Object {
      return false;
    }
  }
}

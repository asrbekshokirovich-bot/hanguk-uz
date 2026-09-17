import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

const _bgChannelId = 'hanguk_default';

// Separate channel for foreground-generated notifications. Android caches a
// channel's importance at creation time and never upgrades it, so if Firebase
// created hanguk_default before flutter_local_notifications could set it to
// HIGH, foreground heads-up notifications silently fall back to the shade.
// A dedicated channel avoids that trap entirely.
const _fgChannelId = 'hanguk_foreground';
const _fgChannelName = 'Hanguk Foreground';

final _localNotifications = FlutterLocalNotificationsPlugin();

Future<void> initNotificationService() async {
  const androidSettings =
      AndroidInitializationSettings('@mipmap/launcher_icon');
  const initSettings = InitializationSettings(android: androidSettings);
  await _localNotifications.initialize(initSettings);

  final androidPlugin = _localNotifications
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();

  // Background channel (used by FCM system-tray notifications).
  const bgChannel = AndroidNotificationChannel(
    _bgChannelId,
    'Hanguk Notifications',
    importance: Importance.high,
  );
  await androidPlugin?.createNotificationChannel(bgChannel);

  // Foreground channel — guaranteed max importance for heads-up display.
  const fgChannel = AndroidNotificationChannel(
    _fgChannelId,
    _fgChannelName,
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );
  await androidPlugin?.createNotificationChannel(fgChannel);

  FirebaseMessaging.onMessage.listen(_showForegroundNotification);
}

void _showForegroundNotification(RemoteMessage message) {
  final notification = message.notification;
  if (notification == null) return;

  try {
    _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _fgChannelId,
          _fgChannelName,
          importance: Importance.max,
          priority: Priority.max,
          playSound: true,
          enableVibration: true,
        ),
      ),
    );
  } catch (e) {
    debugPrint('Foreground notification show failed: $e');
  }
}

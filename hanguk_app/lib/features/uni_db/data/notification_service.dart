import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'notification_store.dart';

const _bgChannelId = 'hanguk_default';

// Separate channel for foreground-generated notifications. Android caches a
// channel's importance at creation time and never upgrades it, so if Firebase
// created hanguk_default before flutter_local_notifications could set it to
// HIGH, foreground heads-up notifications silently fall back to the shade.
// A dedicated channel avoids that trap entirely.
const _fgChannelId = 'hanguk_foreground';
const _fgChannelName = 'Hanguk Foreground';

final _localNotifications = FlutterLocalNotificationsPlugin();

ProviderContainer? _container;

Future<void> initNotificationService({ProviderContainer? container}) async {
  _container = container;

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

  FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

  // Notifications received while backgrounded are written to disk by the
  // background isolate; the in-memory list must be re-read on resume.
  _lifecycleListener ??= AppLifecycleListener(
    onResume: () => _container?.read(notificationStoreProvider.notifier).refresh(),
  );
}

AppLifecycleListener? _lifecycleListener;

void _handleForegroundMessage(RemoteMessage message) {
  final notification = message.notification;
  if (notification == null) return;

  // Save to local history.
  _persistNotification(notification.title, notification.body, message.data);

  // Show heads-up notification.
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

void _persistNotification(String? title, String? body, Map<String, dynamic> data) {
  if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) return;
  final store = _container?.read(notificationStoreProvider.notifier);
  if (store == null) return;
  store.add(NotificationItem(
    title: title ?? '',
    body: body ?? '',
    receivedAt: DateTime.now(),
    data: data,
  ));
}

/// Called from the background message handler to persist notifications
/// received while the app was in the background.
Future<void> persistBackgroundNotification(RemoteMessage message) async {
  final notification = message.notification;
  if (notification == null) return;
  final title = notification.title ?? '';
  final body = notification.body ?? '';
  if (title.isEmpty && body.isEmpty) return;
  // Runs in the background isolate where no ProviderContainer exists.
  await NotificationStorage.append(NotificationItem(
    title: title,
    body: body,
    receivedAt: DateTime.now(),
    data: message.data,
  ));
}

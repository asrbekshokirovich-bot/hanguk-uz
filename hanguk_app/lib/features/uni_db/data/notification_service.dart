import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/app_router.dart';
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
  await _localNotifications.initialize(
    initSettings,
    onDidReceiveNotificationResponse: (response) {
      final payload = response.payload;
      if (payload == null || payload.isEmpty) return;
      try {
        _openFromData(
          (jsonDecode(payload) as Map).cast<String, dynamic>(),
        );
      } catch (e) {
        debugPrint('Notification payload parse failed: $e');
      }
    },
  );

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

  // Tapping a notification used to do nothing but raise the app — the
  // survey_id the CRM sends was never read. Both entry points matter: one
  // for a backgrounded app, one for a cold start off the notification.
  FirebaseMessaging.onMessageOpenedApp.listen((m) => _openFromData(m.data));
  final initial = await FirebaseMessaging.instance.getInitialMessage();
  if (initial != null) _openFromData(initial.data);

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
      payload: jsonEncode(message.data),
    );
  } catch (e) {
    debugPrint('Foreground notification show failed: $e');
  }
}

/// Routes a tapped notification to whatever it is about. The CRM sends
/// `{type: 'survey', survey_id: ...}`; anything else just opens the app, which
/// is what already happened.
void _openFromData(Map<String, dynamic> data) {
  final container = _container;
  if (container == null) return;

  final type = data['type'];
  final surveyId = data['survey_id'];
  if (type != 'survey' || surveyId is! String || surveyId.isEmpty) return;

  try {
    container.read(appRouterProvider).go('/surveys/$surveyId');
  } catch (e) {
    debugPrint('Notification navigation failed: $e');
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

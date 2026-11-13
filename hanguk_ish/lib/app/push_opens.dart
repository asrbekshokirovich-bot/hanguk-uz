import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/repositories/auth_repository.dart';
import '../data/repositories/push_service.dart';

/// P56, for an app's router: keeps the phone's token on the signed-in
/// account ([pushRegistrationProvider]) and opens [notifications] (A12 /
/// 알림) when a notification is tapped — at once when the app was in the
/// background; when the tap launched the app, once the start gate has
/// opened [home].
void handlePushes(
  Ref ref,
  GoRouter router, {
  required String start,
  required String home,
  required String notifications,
}) {
  ref.listen(pushRegistrationProvider, (_, _) {});
  final push = ref.read(pushServiceProvider);
  var waiting = false;
  var disposed = false;
  String here() => router.routerDelegate.currentConfiguration.uri.path;
  // Before the first route is in place, or on the start gate.
  bool starting() => here().isEmpty || here() == start;

  void open() {
    if (disposed || ref.read(authRepositoryProvider).userId == null) return;
    if (starting()) {
      waiting = true;
    } else if (here() != notifications) {
      router.push(notifications);
    }
  }

  // The start gate decides where a launch goes: the notifications open over
  // the home screen, not over sign-in or a profile still to fill.
  void afterStart() {
    if (!waiting || starting()) return;
    waiting = false;
    if (here() == home) {
      scheduleMicrotask(() {
        if (!disposed) router.push(notifications);
      });
    }
  }

  router.routerDelegate.addListener(afterStart);
  final taps = push.opened.listen((_) => open());
  unawaited(push.launchedByNotification().then((launched) {
    if (launched) open();
  }));
  ref.onDispose(() {
    disposed = true;
    router.routerDelegate.removeListener(afterStart);
    taps.cancel();
  });
}

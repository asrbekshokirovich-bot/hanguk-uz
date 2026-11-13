import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'live_updates.dart';

/// The phone's push service (P56: Firebase Cloud Messaging). The server
/// sends A12's and 알림's notifications to the token registered for the app
/// (`ish.register_push_token`); the phone shows them while the app is closed.
/// With the app open nothing extra is shown: the screens update by
/// themselves ([LiveUpdates]).
abstract interface class PushService {
  /// Sets the service up; false when this build has none (no Firebase
  /// configuration: `android/app/google-services.json`) — the app then
  /// works as before, without pushes. The answer stays for the launch.
  Future<bool> start();

  /// Asks to show notifications (Android 13+, iOS) — once per installation.
  Future<void> askPermissionOnce();

  /// This phone's token, or null when there is none now.
  Future<String?> token();

  /// A new token for this phone (the old one stops working).
  Stream<String> get tokenRefreshes;

  /// A notification tapped while the app was in the background.
  Stream<void> get opened;

  /// Whether a tapped notification launched the app (answers once).
  Future<bool> launchedByNotification();
}

/// No push service: the demo, the tests, and builds without Firebase.
class NoPushService implements PushService {
  const NoPushService();

  @override
  Future<bool> start() async => false;

  @override
  Future<void> askPermissionOnce() async {}

  @override
  Future<String?> token() async => null;

  @override
  Stream<String> get tokenRefreshes => const Stream<String>.empty();

  @override
  Stream<void> get opened => const Stream<void>.empty();

  @override
  Future<bool> launchedByNotification() async => false;
}

/// Where this phone's token is kept for the signed-in person
/// (`ish.push_tokens`, for this app).
abstract interface class PushTokens {
  Future<void> register(String token);

  /// Takes the token off the account (before signing out).
  Future<void> forget(String token);
}

/// Keeps this phone's token on the signed-in account for this app: after
/// signing in, and whenever the push service replaces it; before signing
/// out it is taken off, or the next pushes for that account would still
/// reach this phone. A failure is not shown: the next launch registers
/// again (the server keeps one row per token).
class PushRegistration {
  PushRegistration(this._push, this._tokens);

  final PushService _push;
  final PushTokens _tokens;
  StreamSubscription<String>? _refreshes;
  String? _registered;
  bool _disposed = false;

  /// After a sign-in, and at a launch already signed in.
  Future<void> signedIn() async {
    if (!await _push.start() || _disposed) return;
    await _push.askPermissionOnce();
    final token = await _push.token();
    if (token != null) await _register(token);
    if (_disposed) return;
    _refreshes ??= _push.tokenRefreshes.listen(_register, onError: (Object _) {});
  }

  Future<void> _register(String token) async {
    if (_disposed) return;
    try {
      await _tokens.register(token);
      _registered = token;
    } on Object {
      // Registered again at the next launch.
    }
  }

  /// Before signing out (with the session still valid).
  Future<void> signingOut() async {
    await _refreshes?.cancel();
    _refreshes = null;
    final token = _registered;
    _registered = null;
    if (token == null) return;
    try {
      await _tokens.forget(token);
    } on Object {
      // Offline: the token stays until the next person signs in here
      // (registering moves it) or the push service drops it.
    }
  }

  void dispose() {
    _disposed = true;
    _refreshes?.cancel();
    _refreshes = null;
  }
}

/// The phone's push service: none until a backend build sets Firebase up
/// (`bootstrap`).
final pushServiceProvider = Provider<PushService>((ref) => const NoPushService());

/// Where tokens are kept: nowhere in the demo; the database with a backend
/// (`backendOverrides`).
final pushTokensProvider = Provider<PushTokens?>((ref) => null);

/// The phone's token on the signed-in account (null without a backend). The
/// routers keep it alive for the app's life.
final pushRegistrationProvider = Provider<PushRegistration?>((ref) {
  final tokens = ref.watch(pushTokensProvider);
  if (tokens == null) return null;
  final registration = PushRegistration(ref.watch(pushServiceProvider), tokens);
  ref.listen<String?>(
    authUserProvider.select((user) => user.value),
    (previous, next) {
      if (next != null && next != previous) unawaited(registration.signedIn());
    },
    fireImmediately: true,
  );
  ref.onDispose(registration.dispose);
  return registration;
});

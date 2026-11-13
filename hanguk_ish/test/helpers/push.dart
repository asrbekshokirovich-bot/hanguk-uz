import 'dart:async';

import 'package:hanguk_ish/data/repositories/push_service.dart';

/// A pretend push service (P56): [token] now, [refresh] for a new one,
/// [tap] for a notification tapped in the background, [launched] for one
/// that launched the app.
class FakePush implements PushService {
  FakePush({String? token = 't1', this.available = true, this.launched = false}) : _token = token;

  String? _token;
  final bool available;
  final bool launched;
  int asked = 0;
  final _refreshes = StreamController<String>.broadcast();
  final _taps = StreamController<void>.broadcast();

  void refresh(String token) {
    _token = token;
    _refreshes.add(token);
  }

  void tap() => _taps.add(null);

  @override
  Future<bool> start() async => available;

  @override
  Future<void> askPermissionOnce() async {
    asked++;
  }

  @override
  Future<String?> token() async => _token;

  @override
  Stream<String> get tokenRefreshes => _refreshes.stream;

  @override
  Stream<void> get opened => _taps.stream;

  @override
  Future<bool> launchedByNotification() async => launched;
}

/// A pretend token store: what was registered and taken off.
class FakePushTokens implements PushTokens {
  final registered = <String>[];
  final forgotten = <String>[];
  bool failing = false;

  @override
  Future<void> register(String token) async {
    if (failing) throw StateError('offline');
    registered.add(token);
  }

  @override
  Future<void> forget(String token) async {
    forgotten.add(token);
  }
}

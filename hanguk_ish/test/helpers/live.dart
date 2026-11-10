import 'dart:async';

import 'package:hanguk_ish/data/repositories/live_updates.dart';

/// Server changes the test fires by hand.
class ManualLive implements LiveUpdates {
  final _events = StreamController<void>.broadcast();
  int listens = 0;

  @override
  Stream<void> changes() {
    listens++;
    return _events.stream;
  }

  void fire() => _events.add(null);
}

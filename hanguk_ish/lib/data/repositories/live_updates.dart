import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_repository.dart';

/// Changes on the server that concern the signed-in person — a notification
/// for them, a message in one of their chats — so the screens showing server
/// data reload at once (no push service needed while the app is open).
abstract interface class LiveUpdates {
  /// One event per change while listened to.
  Stream<void> changes();
}

/// No backend (demo): nothing changes behind the app's back.
class NoLiveUpdates implements LiveUpdates {
  const NoLiveUpdates();

  @override
  Stream<void> changes() => const Stream<void>.empty();
}

final liveUpdatesProvider = Provider<LiveUpdates>((ref) => const NoLiveUpdates());

/// Who is signed in, now and after every sign-in or sign-out.
final authUserProvider = StreamProvider<String?>((ref) async* {
  final auth = ref.watch(authRepositoryProvider);
  yield auth.userId;
  yield* auth.changes;
});

/// A counter of server changes for the signed-in person. Providers that show
/// server data watch it and reload when it moves; it reconnects on sign-in.
final liveTickProvider = StreamProvider<int>((ref) {
  ref.watch(authUserProvider.select((user) => user.value));
  var tick = 0;
  return ref.watch(liveUpdatesProvider).changes().map((_) => ++tick);
});

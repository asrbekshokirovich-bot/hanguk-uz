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

/// The app coming back to the foreground: changes made while the phone slept
/// may not have reached it, so the screens reload. None in the demo and in
/// tests; with a backend, the app's lifecycle (see `backendOverrides`).
final appResumesProvider = Provider<Stream<void>>((ref) => const Stream<void>.empty());

/// Who is signed in, now and after every sign-in or sign-out.
final authUserProvider = StreamProvider<String?>((ref) async* {
  final auth = ref.watch(authRepositoryProvider);
  yield auth.userId;
  yield* auth.changes;
});

/// A counter of server changes for the signed-in person, and of returns to
/// the app. Providers that show server data watch it and reload when it
/// moves; it reconnects on sign-in.
final liveTickProvider = StreamProvider<int>((ref) {
  ref.watch(authUserProvider.select((user) => user.value));
  var tick = 0;
  return _merge([ref.watch(liveUpdatesProvider).changes(), ref.watch(appResumesProvider)]).map((_) => ++tick);
});

Stream<void> _merge(List<Stream<void>> sources) {
  final subscriptions = <StreamSubscription<void>>[];
  late final StreamController<void> merged;
  merged = StreamController<void>(
    onListen: () {
      for (final source in sources) {
        subscriptions.add(source.listen(merged.add, onError: merged.addError));
      }
    },
    onCancel: () => Future.wait([for (final s in subscriptions) s.cancel()]),
  );
  return merged.stream;
}

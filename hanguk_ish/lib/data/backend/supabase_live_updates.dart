import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/live_updates.dart';
import 'ish_names.dart';

/// [LiveUpdates] over Supabase Realtime: new rows in `notifications` for the
/// signed-in user, new or changed `messages` (a translation arrives a few
/// seconds after the message, P55) and new or changed `applications` —
/// row-level security shows each person only their own chats and
/// applications, and an owner those of their shifts (a check-in reaches BA1
/// at once). Requires the tables in the `supabase_realtime` publication.
///
/// Joining counts as a change too, the first time and after a dropped
/// connection: what happened before the channel was live (since the screens
/// loaded, or while it was down) was not streamed.
///
/// Changes closer together than [coalesce] count as one (see
/// [coalesceEvents]): opening a chat marks all its unread messages read in
/// one statement, which Realtime streams row by row.
class SupabaseLiveUpdates implements LiveUpdates {
  SupabaseLiveUpdates(this._client, {this.coalesce = const Duration(milliseconds: 200)});

  final SupabaseClient _client;
  final Duration coalesce;

  @override
  Stream<void> changes() {
    final user = _client.auth.currentUser?.id;
    if (user == null) return const Stream<void>.empty();
    RealtimeChannel? channel;
    late final StreamController<void> controller;
    controller = StreamController<void>(
      onListen: () {
        channel = _client
            .channel('ish-live-$user')
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: ishSchema,
              table: 'notifications',
              filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'user_id', value: user),
              callback: (_) => controller.add(null),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: ishSchema,
              table: 'messages',
              callback: (_) => controller.add(null),
            )
            // ish-translate writes the translation into the message (A10
            // shows it under the original while the chat is open).
            .onPostgresChanges(
              event: PostgresChangeEvent.update,
              schema: ishSchema,
              table: 'messages',
              callback: (_) => controller.add(null),
            )
            // Inserts and updates only: deletes are not checked against
            // row-level security, and applications are never deleted.
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: ishSchema,
              table: 'applications',
              callback: (_) => controller.add(null),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.update,
              schema: ishSchema,
              table: 'applications',
              callback: (_) => controller.add(null),
            )
            .subscribe((status, error) {
              if (status == RealtimeSubscribeStatus.subscribed) controller.add(null);
            });
      },
      onCancel: () async {
        final open = channel;
        if (open != null) await _client.removeChannel(open);
      },
    );
    return coalesceEvents(controller.stream, coalesce);
  }
}

/// [source]'s events, at most one per [window]: the first starts the window,
/// one event comes out at its end — after the last of a burst, so the
/// screens reload once and see all of it.
Stream<void> coalesceEvents(Stream<void> source, Duration window) {
  StreamSubscription<void>? subscription;
  Timer? pending;
  late final StreamController<void> out;
  out = StreamController<void>(
    onListen: () {
      subscription = source.listen(
        (_) {
          pending ??= Timer(window, () {
            pending = null;
            out.add(null);
          });
        },
        onError: out.addError,
        onDone: () {
          if (pending != null) {
            pending!.cancel();
            pending = null;
            out.add(null);
          }
          out.close();
        },
      );
    },
    onCancel: () async {
      pending?.cancel();
      pending = null;
      await subscription?.cancel();
    },
  );
  return out.stream;
}

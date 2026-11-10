import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/live_updates.dart';

/// [LiveUpdates] over Supabase Realtime: new rows in `notifications` for the
/// signed-in user and in `messages`, and new or changed `applications` —
/// row-level security shows each person only their own chats and
/// applications, and an owner those of their shifts (a check-in reaches BA1
/// at once). Requires the tables in the `supabase_realtime` publication.
///
/// A reconnect after the connection dropped counts as a change too: what
/// happened meanwhile was not streamed.
class SupabaseLiveUpdates implements LiveUpdates {
  SupabaseLiveUpdates(this._client);

  final SupabaseClient _client;

  @override
  Stream<void> changes() {
    final user = _client.auth.currentUser?.id;
    if (user == null) return const Stream<void>.empty();
    RealtimeChannel? channel;
    var joined = false;
    late final StreamController<void> controller;
    controller = StreamController<void>(
      onListen: () {
        channel = _client
            .channel('ish-live-$user')
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'notifications',
              filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'user_id', value: user),
              callback: (_) => controller.add(null),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'messages',
              callback: (_) => controller.add(null),
            )
            // Inserts and updates only: deletes are not checked against
            // row-level security, and applications are never deleted.
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'applications',
              callback: (_) => controller.add(null),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.update,
              schema: 'public',
              table: 'applications',
              callback: (_) => controller.add(null),
            )
            .subscribe((status, error) {
              if (status != RealtimeSubscribeStatus.subscribed) return;
              if (joined) controller.add(null);
              joined = true;
            });
      },
      onCancel: () async {
        final open = channel;
        if (open != null) await _client.removeChannel(open);
      },
    );
    return controller.stream;
  }
}

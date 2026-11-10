import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/live_updates.dart';

/// [LiveUpdates] over Supabase Realtime: new rows in `notifications` for the
/// signed-in user and in `messages` (row-level security shows only their
/// chats). Requires both tables in the `supabase_realtime` publication.
class SupabaseLiveUpdates implements LiveUpdates {
  SupabaseLiveUpdates(this._client);

  final SupabaseClient _client;

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
            .subscribe();
      },
      onCancel: () async {
        final open = channel;
        if (open != null) await _client.removeChannel(open);
      },
    );
    return controller.stream;
  }
}

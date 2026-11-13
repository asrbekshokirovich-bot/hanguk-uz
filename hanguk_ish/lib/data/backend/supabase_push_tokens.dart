import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/push_service.dart';

/// [PushTokens] in the database: `ish.register_push_token` (one row per
/// token, moved to whoever registers it last) and the person's own rows of
/// `ish.push_tokens` (row-level security lets them delete theirs).
class SupabasePushTokens implements PushTokens {
  SupabasePushTokens(this._client, {required this.app, required this.platform});

  final SupabaseClient _client;

  /// `worker` or `employer` — which app the server sends this phone's
  /// notifications to.
  final String app;

  /// `android` or `ios`.
  final String platform;

  @override
  Future<void> register(String token) async {
    await _client.rpc('register_push_token', params: {'p_token': token, 'p_app': app, 'p_platform': platform});
  }

  @override
  Future<void> forget(String token) async {
    await _client.from('push_tokens').delete().eq('token', token);
  }
}

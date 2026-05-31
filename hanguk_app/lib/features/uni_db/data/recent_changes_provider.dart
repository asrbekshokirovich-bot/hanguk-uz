import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/feature_flags/uni_db_flag.dart';
import '../domain/recent_change.dart';

/// Recent change_events scoped to the current user (plan §H.6).
///
/// Returns empty when [kUniDbEnabled] is false so the home banner renders
/// nothing and existing layouts are unaffected.
final recentChangesProvider = FutureProvider<List<RecentChange>>((ref) async {
  if (!kUniDbEnabled) return const [];
  final client = Supabase.instance.client;
  final rows = await client
      .from('v_user_recent_changes')
      .select()
      .order('detected_at', ascending: false)
      .limit(20);
  return (rows as List)
      .map((r) => RecentChange.fromMap(r as Map<String, dynamic>))
      .toList(growable: false);
});

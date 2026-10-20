import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Each university's largest tuition waiver, in percent, for the board's
/// "Grant / stipendiya" filter: `app_grant_summary()` (migration
/// 20261020090000), open to guests too. A university that offers none is
/// simply absent.
final grantSummaryProvider = FutureProvider<Map<String, int>>((ref) async {
  final rows = await Supabase.instance.client.rpc('app_grant_summary').timeout(const Duration(seconds: 20));
  return {
    for (final r in (rows as List? ?? const []))
      if (r is Map && r['institution_id'] is String && r['max_waiver_pct'] is num)
        r['institution_id'] as String: (r['max_waiver_pct'] as num).toInt(),
  };
});

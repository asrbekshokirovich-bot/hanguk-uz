import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../catalog/domain/catalog_models.dart';

/// Every guideline's application window, read once for the card stack's
/// "Muddat" (design screen 03): the same step the university page's bottom
/// bar shows — in the first admission stage, the first step with a date.
final applicationWindowsProvider = FutureProvider<Map<String, CatalogRound>>((ref) async {
  final rows = await Supabase.instance.client
      .from('v_app_university_rounds')
      .select()
      .order('guideline_id')
      .order('bosqich')
      .order('etap_raqam')
      .timeout(const Duration(seconds: 20));
  return applicationWindowsFrom(rows as List);
});

@visibleForTesting
Map<String, CatalogRound> applicationWindowsFrom(List<dynamic> rows) {
  final byGuideline = <String, List<CatalogRound>>{};
  for (final r in rows) {
    final row = r as Map<String, dynamic>;
    final id = row['guideline_id'] as String?;
    if (id == null) continue;
    byGuideline.putIfAbsent(id, () => []).add(CatalogRound.fromRow(row));
  }
  final out = <String, CatalogRound>{};
  for (final e in byGuideline.entries) {
    final live = e.value.where((r) => r.status != 'etap_yoq').toList();
    if (live.isEmpty) continue;
    final first = live.map((r) => r.stage).reduce((a, b) => a < b ? a : b);
    final window = live
        .where((r) => r.stage == first)
        .where((r) => r.endDate != null || r.startDate != null)
        .firstOrNull;
    if (window != null) out[e.key] = window;
  }
  return out;
}

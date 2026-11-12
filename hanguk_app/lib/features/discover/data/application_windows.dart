import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/network/fetch_all_rows.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_detail_screen.dart' show catalogFirstStage;

/// Every guideline's application window, read once for the card stack's
/// "Muddat" (design screen 03): the same step the university page's bottom
/// bar shows — in the current admission stage, the first step with a date.
///
/// Read in pages: the view has a row per step of every guideline (3333 on
/// 2026-11-12) and one request returns at most 1000 — the universities past
/// the first thousand rows, 120 of 177, were shown with no deadline. The three
/// order columns are unique together, so the pages neither overlap nor skip.
/// Only the columns the window is picked by: the step names are most of the
/// view's weight and nothing here shows them.
final applicationWindowsProvider = FutureProvider<Map<String, CatalogRound>>((ref) async {
  final rows = await fetchAllRows(
    (from, to) => Supabase.instance.client
        .from('v_app_university_rounds')
        .select('guideline_id, bosqich, etap_raqam, boshlanish_sana, tugash_sana, holat')
        .order('guideline_id', ascending: true)
        .order('bosqich', ascending: true)
        .order('etap_raqam', ascending: true)
        .range(from, to)
        .timeout(const Duration(seconds: 20)),
  );
  return applicationWindowsFrom(rows);
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
    final window = catalogFirstStage(e.value)
        .where((r) => r.endDate != null || r.startDate != null)
        .firstOrNull;
    if (window != null) out[e.key] = window;
  }
  return out;
}

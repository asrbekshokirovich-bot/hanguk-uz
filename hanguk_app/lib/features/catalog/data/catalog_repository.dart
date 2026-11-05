import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/cache/cached_rows.dart';
import '../../../core/cache/snapshot_queries.dart';
import '../domain/catalog_models.dart';

final _catalogRows = CachedRows('catalog', query: kSnapshotReads[kCatalogAsset]!, asset: kCatalogAsset);

/// The universities staff have loaded a guideline Excel for — the CRM's
/// "Universitetlar → Ma'lumotli" section, read live from
/// `v_app_university_catalog`. An Excel uploaded today shows up here on the
/// next refresh. The last rows read (or, on a first launch, the copy shipped
/// in the app) show at once while the network brings the current ones
/// ([CachedRows]).
final catalogProvider = FutureProvider<List<CatalogUniversity>>((ref) async {
  final rows = await _catalogRows.load(() async {
    try {
      final data = await Supabase.instance.client
          .from(kCatalogView)
          .select()
          .order(kCatalogOrder, ascending: false)
          .timeout(const Duration(seconds: 20));
      return data as List;
    } on PostgrestException catch (e) {
      debugPrint('[Catalog] Postgrest error: ${e.code} ${e.message}');
      rethrow;
    }
  }, onFresh: () => _reread(ref));
  return groupCatalogRows(rows);
});

/// The provider reads the rows the network just brought. A provider already
/// rebuilt (or disposed) has nothing to re-read.
void _reread(Ref ref) {
  try {
    ref.invalidateSelf();
  } catch (_) {}
}

/// Rows (one per guideline) → one entry per university: official partners
/// first, then by name.
@visibleForTesting
List<CatalogUniversity> groupCatalogRows(List<dynamic> rows) {
  final byInstitution = <String, List<CatalogGuideline>>{};
  for (final row in rows) {
    final g = CatalogGuideline.fromRow(row as Map<String, dynamic>);
    byInstitution.putIfAbsent(g.institutionId, () => []).add(g);
  }
  final out = [
    for (final e in byInstitution.entries)
      CatalogUniversity(institutionId: e.key, guidelines: e.value),
  ]..sort((a, b) {
      if (a.isPartner != b.isPartner) return a.isPartner ? -1 : 1;
      return a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase());
    });
  return out;
}

/// Faculties, timeline and documents of one guideline, fetched when its
/// detail screen opens.
final catalogDetailProvider =
    FutureProvider.family<CatalogGuidelineDetail, String>((ref, guidelineId) async {
      final client = Supabase.instance.client;
      final results = await Future.wait([
        client
            .from('v_app_university_faculties')
            .select()
            .eq('guideline_id', guidelineId)
            .order('tartib'),
        client
            .from('v_app_university_rounds')
            .select()
            .eq('guideline_id', guidelineId)
            .order('bosqich')
            .order('etap_raqam'),
        client
            .from('v_app_university_docs')
            .select()
            .eq('guideline_id', guidelineId)
            .order('tartib'),
      ]).timeout(const Duration(seconds: 20));

      return CatalogGuidelineDetail(
        faculties: [
          for (final r in results[0] as List) CatalogFaculty.fromRow(r as Map<String, dynamic>),
        ],
        rounds: [
          for (final r in results[1] as List) CatalogRound.fromRow(r as Map<String, dynamic>),
        ],
        docs: [
          for (final r in results[2] as List) CatalogDoc.fromRow(r as Map<String, dynamic>),
        ],
      );
    });

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/catalog_models.dart';

/// The universities staff have loaded a guideline Excel for — the CRM's
/// "Universitetlar → Ma'lumotli" section, read live from
/// `v_app_university_catalog`. An Excel uploaded today shows up here on the
/// next refresh; nothing in the app keeps its own list.
final catalogProvider = FutureProvider<List<CatalogUniversity>>((ref) async {
  try {
    final data = await Supabase.instance.client
        .from('v_app_university_catalog')
        .select()
        .order('qabul_yili', ascending: false)
        .timeout(const Duration(seconds: 20));
    return groupCatalogRows(data as List);
  } on PostgrestException catch (e) {
    debugPrint('[Catalog] Postgrest error: ${e.code} ${e.message}');
    rethrow;
  }
});

/// Rows (one per guideline) → one entry per university, sorted by name.
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
  ]..sort((a, b) => a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase()));
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

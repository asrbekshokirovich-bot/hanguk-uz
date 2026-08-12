import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../map/data/map_repository.dart';
import '../../map/domain/university.dart';

/// The institutions whose admission data the review queue has actually
/// approved — the only ones any "the universities we have researched" list
/// should show.
///
/// One definition, read live from `v_guest_approved_admissions`, so Explore
/// and the Applications browse list can never disagree and no one maintains a
/// list by hand: a guideline approved today joins on the next refresh.
///
/// Why not `University.hasIntakeData`, which Explore used before: that flag is
/// true when a non-superseded admission cycle exists for the CRM's *default*
/// intake, which is neither "approved" nor complete. It counts a cycle that
/// carries no extracted field at all — a card of dashes — and drops an
/// institution approved for a year that is not the default one. Against this
/// catalogue it answers 45 where the approved set is 57.
///
/// Why not filter the map list by approved ids: `v_institutions_for_map` gates
/// on `is_visible_on_map`, false for 10 institutions that do have approved
/// data. Filtering would silently lose them, which is the bug the sibling app
/// fixed by reading this view directly. So the map rows are used where they
/// exist — they carry coordinates and the tour fields — and the remaining 10
/// are built from the view's own display columns.
final approvedUniversitiesProvider = FutureProvider<List<University>>((
  ref,
) async {
  // The map rows first: they are the richer record, and this provider is
  // already cached for the map and every other list in the app.
  final onMap = await ref.watch(universitiesProvider.future);
  final byId = {for (final u in onMap) u.id: u};

  try {
    final data = await Supabase.instance.client
        .from('v_guest_approved_admissions')
        .select(
          'institution_id, name_ko, name_ko_short, name_en, name_uz, '
          'city_ko, tier, ieqas_status, is_partner, logo_url, primary_domain',
        )
        // Weak-network guard: fail (→ Retry) instead of an endless spinner,
        // matching universitiesProvider.
        .timeout(const Duration(seconds: 20));

    return mergeApprovedRows(data as List, byId);
  } on PostgrestException catch (e) {
    debugPrint('[ApprovedUniversities] Postgrest error: ${e.code} ${e.message}');
    rethrow;
  } on Exception catch (e) {
    debugPrint('[ApprovedUniversities] Failed to load: $e');
    rethrow;
  }
});

/// Turn view rows into the list the screens render: one entry per institution,
/// the map's record where there is one, sorted the way every other list in the
/// app is sorted.
///
/// Split out from the provider so it can be tested against real row shapes
/// without a backend — the network call is the only part that needs one.
@visibleForTesting
List<University> mergeApprovedRows(
  List<dynamic> rows,
  Map<String, University> byId,
) {
  // The view is one row per (institution, intake year), so an institution
  // approved for both 2026 and 2027 arrives twice.
  final seen = <String>{};
  final approved = <University>[];
  for (final row in rows) {
    final map = row as Map<String, dynamic>;
    final id = map['institution_id'] as String?;
    if (id == null || !seen.add(id)) continue;
    approved.add(byId[id] ?? _fromViewRow(id, map));
  }

  // Top tier first, then by name — the order the map provider already sorts
  // by, so a student reading two screens sees one order. Unclassified (null)
  // tiers sort last rather than leading the list.
  approved.sort((a, b) {
    final at = a.tier ?? 99;
    final bt = b.tier ?? 99;
    return at != bt ? at.compareTo(bt) : a.name.compareTo(b.name);
  });
  return approved;
}

/// Build the catalogue entry for an approved institution the map view does not
/// carry. Name resolution mirrors `map_repository` exactly — en → uz → ko_short
/// → ko, and its 'South Korea' stand-in for a missing city — so a tile built
/// here reads the same as one built there.
///
/// No coordinates: this institution is absent from the map view, so there are
/// none to have. Nothing that needs them puts these rows on a map.
University _fromViewRow(String id, Map<String, dynamic> map) {
  final nameEn = map['name_en'] as String?;
  final nameUz = map['name_uz'] as String?;
  final nameKoShort = map['name_ko_short'] as String?;
  final nameKo = map['name_ko'] as String?;
  final cityKo = map['city_ko'] as String?;

  return University(
    id: id,
    name: (nameEn?.isNotEmpty ?? false)
        ? nameEn!
        : (nameUz?.isNotEmpty ?? false)
        ? nameUz!
        : (nameKoShort?.isNotEmpty ?? false)
        ? nameKoShort!
        : nameKo ?? 'Unknown Institution',
    location: (cityKo?.isNotEmpty ?? false) ? cityKo! : University.unknownCity,
    nameKo: nameKo,
    nameKoShort: nameKoShort,
    nameEn: nameEn,
    nameUz: nameUz,
    logoUrl: map['logo_url'] as String?,
    tier: (map['tier'] as num?)?.toInt(),
    ieqasStatus: map['ieqas_status'] as String?,
    isPartner: map['is_partner'] as bool? ?? false,
    isVisibleOnMap: false,
    primaryDomain: map['primary_domain'] as String?,
    // It is in the approved view; that is what the flag means to every list
    // reading this provider.
    hasIntakeData: true,
  );
}

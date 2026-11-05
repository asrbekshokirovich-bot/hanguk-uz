import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/cache/cached_rows.dart';
import '../../../core/cache/snapshot_queries.dart';
import '../domain/university.dart';

final _mapRows = CachedRows('map_universities', query: kSnapshotReads[kMapAsset]!, asset: kMapAsset);

/// Audit K1 / M1 (2026-05-11): the legacy `universities` table this
/// provider used to query was dropped on 2026-05-10 by
/// `supabase/migrations/20260510130000_uni_db_v3_drop_legacy_universities.sql`.
/// The replacement contract is `v_institutions_for_map`, defined in
/// `supabase/migrations/20260601000100_uni_db_v1_views.sql`.
///
/// Audit M24 (2026-05-12): the provider now re-throws on failure so
/// `AsyncValue.error` reaches `MapTab._buildErrorState`, which has a
/// retry button. The previous "swallow → []" shape made every
/// failure look like an empty list, hiding the actual problem. The
/// catch blocks below preserve the structured `debugPrint` for
/// diagnostics, then rethrow so the UI distinguishes "no
/// institutions yet" from "the network is down."
///
/// The columns are [kMapColumns] (virtual_tour/walkaround_url: migration
/// 20260512120000; primary_domain: 20260728120000; has_intake_data — a
/// non-superseded cycle for the CRM's default intake, which guest Explore
/// lists: 20260914000000). The last rows read, or the copy shipped in the
/// app, show at once while the network brings the current ones
/// ([CachedRows]).
final universitiesProvider = FutureProvider<List<University>>((ref) async {
  try {
    final data = await _mapRows.load(
      () => Supabase.instance.client
          .from(kMapView)
          .select(kMapColumns)
          .eq('is_visible_on_map', true)
          // No `ranking` column on the new view — `tier` is the closest
          // proxy (0 = flagship, 4 = unclassified). NULLS LAST so
          // unclassified institutions sort to the bottom.
          .order('tier', ascending: true, nullsFirst: false)
          // Weak-network guard: fail (→ Retry) instead of an endless spinner.
          .timeout(const Duration(seconds: 20)),
      onFresh: () {
        try {
          ref.invalidateSelf();
        } catch (_) {}
      },
    );

    return data.map((row) {
      final map = row as Map<String, dynamic>;

      // Display-name resolution priority: en → uz → ko_short → ko.
      // The student-app primary locale is English / Uzbek; Korean is
      // a last-resort fallback so the student always sees something
      // readable. (Locale-aware rendering is M19.)
      final nameEn = map['name_en'] as String?;
      final nameUz = map['name_uz'] as String?;
      final nameKoShort = map['name_ko_short'] as String?;
      final nameKo = map['name_ko'] as String?;
      final resolvedName = (nameEn?.isNotEmpty ?? false)
          ? nameEn!
          : (nameUz?.isNotEmpty ?? false)
          ? nameUz!
          : (nameKoShort?.isNotEmpty ?? false)
          ? nameKoShort!
          : nameKo ?? 'Unknown Institution';

      final cityKo = map['city_ko'] as String?;
      final resolvedLocation = (cityKo?.isNotEmpty ?? false)
          ? cityKo!
          : University.unknownCity;

      final nextEventRaw = map['next_event_at'] as String?;
      final nextEventAt = (nextEventRaw != null && nextEventRaw.isNotEmpty)
          ? DateTime.tryParse(nextEventRaw)
          : null;

      return University(
        id: map['id'] as String,
        name: resolvedName,
        location: resolvedLocation,
        nameKo: nameKo,
        nameKoShort: nameKoShort,
        nameEn: nameEn,
        nameUz: nameUz,
        latitude: (map['latitude'] as num?)?.toDouble(),
        longitude: (map['longitude'] as num?)?.toDouble(),
        logoUrl: map['logo_url'] as String?,
        tier: (map['tier'] as num?)?.toInt(),
        ieqasStatus: map['ieqas_status'] as String?,
        nextEventAt: nextEventAt,
        isPartner: map['is_partner'] as bool? ?? false,
        isVisibleOnMap: map['is_visible_on_map'] as bool? ?? true,
        virtualTour: map['virtual_tour'] is Map<String, dynamic>
            ? map['virtual_tour'] as Map<String, dynamic>
            : null,
        walkaroundUrl: map['walkaround_url'] as String?,
        primaryDomain: map['primary_domain'] as String?,
        // Defaults false: a client reading an older view (or a cached row
        // written before the column existed) should not claim coverage it
        // cannot show. Explore then lists nothing rather than everything,
        // which is the visible, reportable failure of the two.
        hasIntakeData: map['has_intake_data'] as bool? ?? false,
        // Deprecated legacy fields — always null after the migration.
      );
    }).toList();
  } on PostgrestException catch (e) {
    debugPrint('[MapRepository] Postgrest error: ${e.code} ${e.message}');
    rethrow;
  } on Exception catch (e) {
    debugPrint('[MapRepository] Failed to load institutions: $e');
    rethrow;
  }
});

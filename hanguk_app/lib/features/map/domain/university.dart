import 'package:flutter/foundation.dart';

/// Audit M2 (2026-05-11): the domain object was remodelled to match
/// `v_institutions_for_map` (defined in
/// `supabase/migrations/20260601000100_uni_db_v1_views.sql`). The
/// legacy `universities` table this used to mirror was dropped in
/// Phase 3R-B (migration
/// `20260510130000_uni_db_v3_drop_legacy_universities.sql`).
///
/// Field shape:
///
/// - `id`, `name`, `location`, `latitude`, `longitude`, `logoUrl`,
///   `isPartner`, `isVisibleOnMap` are still present so existing
///   callers (cards, sheets, markers) continue to compile.
/// - `name` resolves to the most-appropriate language per the
///   repository, in priority order: Uzbek display name → English →
///   Korean (so the student always sees something readable).
/// - `nameKo` / `nameKoShort` / `nameEn` / `nameUz` are the raw
///   per-language fields for future locale-aware rendering (M19).
/// - `tier` is the new 0–4 quality tier on `institutions` (replaces
///   the legacy `ranking` column). `tier ≤ 1` corresponds to "top"
///   institutions (was `ranking ≤ 100`).
/// - `ieqasStatus` is the Korean Education accreditation status —
///   used for a "verified by counselor"-style badge.
/// - `nextEventAt` is the next admission-cycle event (apply_open or
///   apply_close) coming up, surfaced by the view.
/// - Legacy fields (`ranking`, `localRank`, `acceptanceRate`,
///   `tuitionMin`, `tuitionMax`, `website`, `descriptionEn`) are
///   *deprecated* — they don't exist on `institutions`. Kept on the
///   domain object as nullable for backwards UI compatibility, but
///   the repository always emits `null` for them. Long-term, the
///   detail-sheet UI should pull those signals from the joined
///   `tuition`, `scholarships`, and `recruitment_units` tables via
///   the uni_db feature (see `lib/features/uni_db/`).
@immutable
class University {
  final String id;

  /// Primary display label (already locale-resolved by the repository).
  final String name;

  /// Primary city label.
  final String location;

  // Raw per-language labels, kept so the UI can prefer locale.
  final String? nameKo;
  final String? nameKoShort;
  final String? nameEn;
  final String? nameUz;

  final double? latitude;
  final double? longitude;
  final String? logoUrl;

  // New (post-Phase-3R-B) signals.
  final int? tier;
  final String? ieqasStatus;
  final DateTime? nextEventAt;

  final bool isPartner;
  final bool isVisibleOnMap;

  // Audit M17/M18 (2026-05-12). When `virtualTour` is non-null, the
  // detail sheet surfaces a curated "Virtual Tour" button (Pannellum
  // viewer). When `walkaroundUrl` is non-null and `virtualTour` is
  // null, the tour button instead opens the official VR page in an
  // external browser. Otherwise, the Kakao Roadview "Virtual
  // Walkaround" remains the only option.
  final Map<String, dynamic>? virtualTour;
  final String? walkaroundUrl;

  // Official university homepage domain (e.g. 'yonsei.ac.kr'), sourced from
  // institutions.primary_domain via v_institutions_for_map. The detail sheet
  // turns it into https://<domain> for the "Visit University Website" button.
  // This replaces the deprecated `website` field below (which was always null).
  final String? primaryDomain;

  // True when this institution has a non-superseded admission cycle for the
  // intake the CRM has marked default — i.e. we hold researched admission
  // data for the season currently on sale, not just a name and a map pin.
  // Sourced from `v_institutions_for_map.has_intake_data`
  // (migration 20260914000000), which is computed against
  // `intakes.is_default` so it moves with the season on its own.
  final bool hasIntakeData;

  // ── Deprecated legacy fields ────────────────────────────────────────────
  // Kept nullable so existing widgets continue to compile during the
  // transition. The repository always emits `null` — these fields used
  // to live on the dropped `universities` table.
  @Deprecated('Source-table dropped; use `tier` (0–4 quality tier) instead.')
  final int? ranking;
  @Deprecated('Source-table dropped.')
  final int? localRank;
  @Deprecated('Source-table dropped; sourced from `tuition` rows in uni_db.')
  final double? acceptanceRate;
  @Deprecated('Source-table dropped; sourced from `tuition` rows in uni_db.')
  final int? tuitionMin;
  @Deprecated('Source-table dropped; sourced from `tuition` rows in uni_db.')
  final int? tuitionMax;
  @Deprecated('Source-table dropped.')
  final String? website;
  @Deprecated('Source-table dropped.')
  final String? descriptionEn;

  const University({
    required this.id,
    required this.name,
    required this.location,
    this.nameKo,
    this.nameKoShort,
    this.nameEn,
    this.nameUz,
    this.latitude,
    this.longitude,
    this.logoUrl,
    this.tier,
    this.ieqasStatus,
    this.nextEventAt,
    this.isPartner = false,
    this.isVisibleOnMap = true,
    this.virtualTour,
    this.walkaroundUrl,
    this.primaryDomain,
    this.hasIntakeData = false,
    // ignore: deprecated_member_use_from_same_package
    this.ranking,
    // ignore: deprecated_member_use_from_same_package
    this.localRank,
    // ignore: deprecated_member_use_from_same_package
    this.acceptanceRate,
    // ignore: deprecated_member_use_from_same_package
    this.tuitionMin,
    // ignore: deprecated_member_use_from_same_package
    this.tuitionMax,
    // ignore: deprecated_member_use_from_same_package
    this.website,
    // ignore: deprecated_member_use_from_same_package
    this.descriptionEn,
  });

  /// Convenience: returns true if this institution is in the new
  /// "top tier" (tier 0 = flagship, tier 1 = top-ranked). Used by the
  /// "Top" filter chip — replaces the legacy `ranking <= 100` check.
  bool get isTopTier => tier != null && tier! <= 1;

  /// IEQAS "outstanding" or "accredited" status — surfaced as a small
  /// "verified" badge on cards and the detail sheet.
  ///
  /// Note `ieqas_status` is `'none'` for 74 of the 204 visible institutions
  /// and means *not accredited*, so a null check is not enough: rendering the
  /// raw value puts the literal word "none" in front of a student.
  bool get isAccredited =>
      ieqasStatus == 'outstanding' || ieqasStatus == 'accredited';

  /// Placeholder the repository substitutes when `city_ko` is null — true for
  /// 87 of the 204 visible institutions.
  static const String unknownCity = 'South Korea';

  /// Whether [location] is a real city rather than the placeholder.
  ///
  /// Without this the placeholder gets treated as data: it became the
  /// highest-count entry in the guest city filter, outranking 서울, and
  /// showed up as "City: South Korea" in comparisons.
  bool get hasRealCity => location.isNotEmpty && location != unknownCity;

  /// True when a curated Pannellum tour spec is set for this row.
  bool get hasVirtualTour => virtualTour != null;

  /// Audit M19 (2026-05-12): returns the most appropriate display
  /// name for the given locale code. Falls back to the
  /// repository-resolved `name` if no locale-specific label is set.
  String nameForLocale(String localeCode) {
    switch (localeCode) {
      case 'ko':
        return (nameKoShort?.isNotEmpty ?? false)
            ? nameKoShort!
            : (nameKo?.isNotEmpty ?? false)
            ? nameKo!
            : name;
      case 'uz':
        return (nameUz?.isNotEmpty ?? false) ? nameUz! : name;
      case 'en':
      case 'ru':
      case 'vi':
      default:
        return (nameEn?.isNotEmpty ?? false) ? nameEn! : name;
    }
  }
}

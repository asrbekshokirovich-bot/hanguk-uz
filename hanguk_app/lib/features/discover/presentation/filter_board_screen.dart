import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/app_localizations.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../data/field_filter.dart';
import '../data/grant_tiers.dart';

// The filter board's shared pieces: what its choices leave and their labels.
// The board screen itself (FilterBoardScreen) had no way in from the app and
// is gone (owner, 2026-11-06, plan R7.1); the filter is FilterScreen.

/// What the filter board's choices leave of [all], with the field search's
/// answer for the chosen field folded in.
List<CatalogUniversity> boardResults(WidgetRef ref, List<CatalogUniversity> all, CatalogFilter f) {
  final matches = f.field == null ? null : ref.watch(fieldUniversitiesProvider(f.field!)).value;
  // The grant each university gives for the student's own TOPIK / IELTS,
  // from its guideline's scholarship table.
  final tiers = f.grant == null ? null : ref.watch(grantTiersProvider).value;
  final profile = ref.watch(assessmentProvider);
  final grants = tiers == null
      ? null
      : {
          for (final u in all)
            if (guidelineFor(u, f) case final g?)
              u.institutionId: grantPercentFor(tiers[g.id] ?? const [], topik: profile.topikCounted, ielts: profile.ielts),
        };
  return applyCatalogFilter(all, f.copyWith(query: ''), fieldMatches: matches, grants: grants);
}

/// A field tile's label ("IT", "Muhandislik").
String fieldLabel(AppLocalizations l, String key) => switch (key) {
  'it' => l.fdFieldIt,
  'business' => l.fdFieldBusiness,
  'engineering' => l.fdFieldEngineering,
  'medicine' => l.fdFieldMedicine,
  'design' => l.fdFieldDesign,
  'tourism' => l.fdFieldTourism,
  'education' => l.fdFieldEducation,
  _ => key,
};

/// A city group's label: the design's own names, two of them translated.
String regionLabel(AppLocalizations l, String region) => switch (region) {
  CatalogRegion.seoul => l.fdRegionSeoul,
  CatalogRegion.other => l.fdOther,
  _ => region,
};

/// "Muhandislik · TOPIK ≤3 · ₩2 000 000 gacha": the board's choices in one
/// line, for the results' search field (design screen 06). Null when none.
String? filterSummary(AppLocalizations l, CatalogFilter f) {
  final parts = [
    if (f.field != null) fieldLabel(l, f.field!),
    for (final r in f.regions) regionLabel(l, r),
    if (f.degree == CatalogDegree.bachelor) l.catalogDegreeBachelor,
    if (f.degree == CatalogDegree.master) l.catalogDegreeMaster,
    if (f.topik == CatalogTopik.none) 'TOPIK: ${l.fdTopikNone}' else if (f.topik != null) 'TOPIK ≤${f.topik}',
    if (f.ielts != null) 'IELTS ${_ielts(f.ielts!)}',
    if (f.maxPrice != null) l.fdFeeUpTo(money(f.maxPrice!, 'KRW', locale: l.localeName)),
    if (f.type == 'state') l.catalogTypeStateShort,
    if (f.type == 'private') l.catalogTypePrivateShort,
    if (f.grant != null) l.fdGrantSummary(f.grant!),
  ];
  return parts.isEmpty ? null : parts.join(' · ');
}

String _ielts(double v) => v.toStringAsFixed(1);

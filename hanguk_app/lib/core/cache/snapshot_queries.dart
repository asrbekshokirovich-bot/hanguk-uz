// The public catalogue reads the app keeps a copy of (CachedRows), written
// once for both the app and tools/fetch_data_snapshots.dart, which fills the
// copies shipped in the app before a build. Plain Dart: the tool runs outside
// Flutter.

/// `v_app_university_catalog`, newest intake first.
const kCatalogView = 'v_app_university_catalog';
const kCatalogOrder = 'qabul_yili';

/// `v_institutions_for_map`: the columns the map and the university lists read.
const kMapView = 'v_institutions_for_map';
const kMapColumns =
    'id, name_ko, name_ko_short, name_en, name_uz, '
    'city_ko, latitude, longitude, logo_url, tier, '
    'ieqas_status, is_partner, is_visible_on_map, '
    'last_verified_at, next_event_at, '
    'virtual_tour, walkaround_url, '
    'primary_domain, '
    'has_intake_data';

/// `eligibility_rules`: the assessment's thresholds.
const kRulesTable = 'eligibility_rules';
const kRulesColumns = 'key, value';

/// Where each copy is shipped in the app (pubspec: assets/data/).
const kCatalogAsset = 'assets/data/catalog.json';
const kMapAsset = 'assets/data/map.json';
const kRulesAsset = 'assets/data/eligibility_rules.json';

/// The PostgREST paths that read the same rows, in the same order.
const kSnapshotReads = <String, String>{
  kCatalogAsset: '$kCatalogView?select=*&order=$kCatalogOrder.desc',
  kMapAsset: '$kMapView?select=$kMapColumns&is_visible_on_map=eq.true&order=tier.asc.nullslast',
  kRulesAsset: '$kRulesTable?select=$kRulesColumns',
};

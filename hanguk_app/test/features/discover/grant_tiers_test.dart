import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/discover/data/grant_tiers.dart';

/// Rows as app_grant_tiers() returns them, from real guidelines' tables.
final _rows = [
  // Every new student 30%, then by TOPIK level (a regional university).
  {'guideline_id': 'g1', 'mezon': 'TOPIK', 'topik_min': null, 'topik_max': null, 'ielts_min': null, 'grant_pct': 30},
  {'guideline_id': 'g1', 'mezon': 'TOPIK', 'topik_min': 3, 'topik_max': 3, 'ielts_min': null, 'grant_pct': 50},
  {'guideline_id': 'g1', 'mezon': 'TOPIK', 'topik_min': 5, 'topik_max': 6, 'ielts_min': null, 'grant_pct': 70},
  // TOPIK 6 or IELTS 8 for 100%, TOPIK 5 or IELTS 7 for 50% (HUFS-like).
  {'guideline_id': 'g2', 'mezon': 'TOPIK yoki IELTS', 'topik_min': 6, 'topik_max': 6, 'ielts_min': 8, 'grant_pct': 100},
  {'guideline_id': 'g2', 'mezon': 'TOPIK yoki IELTS', 'topik_min': 5, 'topik_max': 5, 'ielts_min': 7, 'grant_pct': 50},
  // IELTS 5.5 for 50%.
  {
    'guideline_id': 'g3',
    'mezon': 'IELTS yoki TOEFL',
    'topik_min': null,
    'topik_max': null,
    'ielts_min': 5.5,
    'grant_pct': 50,
  },
];

Map<String, dynamic> _uni(String guideline, String id) => {
  'is_partner': false,
  'guideline_id': guideline,
  'institution_id': id,
  'name_en': id,
  'univ_nomi_en': id,
  'institution_type': 'private',
  'shahar': 'Seoul',
  'daraja': 'bakalavr',
  'topik_min': 0,
  'narx_valyuta': 'KRW',
  'kontrakt_min': 3000000,
};

void main() {
  final tiers = grantTiersFrom(_rows);

  test('the largest grant the scores earn, guideline by guideline', () {
    int pct(String g, {int topik = 0, double ielts = 0}) => grantPercentFor(tiers[g]!, topik: topik, ielts: ielts);
    expect(pct('g1'), 30);
    expect(pct('g1', topik: 3), 50);
    expect(pct('g1', topik: 4), 30);
    expect(pct('g1', topik: 6), 70);
    expect(pct('g2', topik: 5), 50);
    expect(pct('g2', ielts: 8), 100);
    expect(pct('g2', ielts: 6.5), 0);
    expect(pct('g3', ielts: 5.5), 50);
    expect(pct('g3', ielts: 5.0), 0);
  });

  test('IELTS 5.5 asking for 100%: nothing; for 50%: the one that gives it', () {
    final all = groupCatalogRows([_uni('g1', 'a'), _uni('g2', 'b'), _uni('g3', 'c')]);
    Map<String, int> grants({int topik = 0, double ielts = 0}) => {
      for (final u in all)
        u.institutionId: grantPercentFor(tiers[u.primary.id] ?? const [], topik: topik, ielts: ielts),
    };
    List<String> ids(int want, {int topik = 0, double ielts = 0}) => [
      for (final u in applyCatalogFilter(
        all,
        CatalogFilter(grant: want),
        grants: grants(topik: topik, ielts: ielts),
      ))
        u.institutionId,
    ];
    expect(ids(100, ielts: 5.5), isEmpty);
    expect(ids(50, ielts: 5.5), ['c']);
    expect(ids(30, ielts: 5.5)..sort(), ['a', 'c']);
    expect(ids(100, topik: 6), ['b']);
  });
}

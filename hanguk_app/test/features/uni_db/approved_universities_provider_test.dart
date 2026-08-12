// `mergeApprovedRows` — the part of `approvedUniversitiesProvider` that turns
// `v_guest_approved_admissions` rows into the list Guest Explore and the
// Applications browse list render.
//
// Both screens used to read the whole catalogue: Applications listed all 204
// institutions to a student who had not applied anywhere, and Explore narrowed
// them with `hasIntakeData`, which answers 45 against an approved set of 57.
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/map/domain/university.dart';
import 'package:hanguk_app/features/uni_db/data/approved_universities_provider.dart';

Map<String, dynamic> _row(
  String id, {
  String? nameEn,
  String? nameUz,
  String? nameKoShort,
  String? nameKo,
  String? cityKo,
  int? tier,
  bool partner = false,
}) => <String, dynamic>{
  'institution_id': id,
  'name_en': nameEn,
  'name_uz': nameUz,
  'name_ko_short': nameKoShort,
  'name_ko': nameKo,
  'city_ko': cityKo,
  'tier': tier,
  'ieqas_status': null,
  'is_partner': partner,
  'logo_url': null,
  'primary_domain': null,
};

University _mapRow(String id, {String name = 'From map', int? tier}) =>
    University(
      id: id,
      name: name,
      location: 'Seoul',
      tier: tier,
      latitude: 37.5,
      longitude: 127.0,
      isVisibleOnMap: true,
    );

void main() {
  group('one entry per institution', () {
    test('an institution approved for two intake years is listed once', () {
      // 70 view rows over 57 institutions in the live catalogue today.
      final out = mergeApprovedRows([
        _row('a', nameEn: 'Alpha'),
        _row('b', nameEn: 'Beta'),
        _row('a', nameEn: 'Alpha'),
      ], {});
      expect(out.map((u) => u.id), ['a', 'b']);
    });

    test('a row with no institution id is skipped, not rendered blank', () {
      final out = mergeApprovedRows([
        _row('a', nameEn: 'Alpha'),
        <String, dynamic>{'institution_id': null, 'name_en': 'Ghost'},
      ], {});
      expect(out, hasLength(1));
    });

    test('an empty result is an empty list, not an error', () {
      expect(mergeApprovedRows([], {}), isEmpty);
    });
  });

  group('the map record wins where there is one', () {
    test('an institution on the map keeps its coordinates', () {
      final out = mergeApprovedRows([
        _row('a', nameEn: 'From view'),
      ], {'a': _mapRow('a', name: 'From map')});

      expect(out.single.name, 'From map');
      expect(out.single.latitude, 37.5);
    });

    test('an approved institution off the map is still listed', () {
      // 10 of the 57 approved institutions have is_visible_on_map = false, so
      // v_institutions_for_map does not carry them — Dong Seoul among them,
      // with 14 admission cycles. Filtering the map list by approved ids would
      // drop all ten silently.
      final out = mergeApprovedRows([
        _row('off-map', nameEn: 'Dong Seoul University', cityKo: '서울'),
      ], {});

      expect(out.single.name, 'Dong Seoul University');
      expect(out.single.location, '서울');
      expect(out.single.isVisibleOnMap, isFalse);
      expect(out.single.latitude, isNull);
      // Every entry here is approved by construction; a screen reading the
      // flag must not conclude otherwise.
      expect(out.single.hasIntakeData, isTrue);
    });
  });

  group('name and city resolution matches map_repository', () {
    test('English, then Uzbek, then short Korean, then Korean', () {
      String nameOf(Map<String, dynamic> row) =>
          mergeApprovedRows([row], {}).single.name;

      expect(nameOf(_row('1', nameEn: 'En', nameUz: 'Uz', nameKo: 'Ko')), 'En');
      expect(nameOf(_row('2', nameUz: 'Uz', nameKo: 'Ko')), 'Uz');
      expect(nameOf(_row('3', nameKoShort: 'Short', nameKo: 'Ko')), 'Short');
      expect(nameOf(_row('4', nameKo: 'Ko')), 'Ko');
    });

    test('an empty string is not a name', () {
      // PostgREST returns '' rather than null for a blank text column, and an
      // untrimmed fallback chain would render an empty tile.
      expect(mergeApprovedRows([_row('1', nameEn: '', nameUz: 'Uz')], {}).single.name, 'Uz');
    });

    test('a missing city falls back the way the map does', () {
      expect(
        mergeApprovedRows([_row('1', nameEn: 'X')], {}).single.location,
        University.unknownCity,
      );
    });
  });

  group('ordering', () {
    test('top tier first, then by name', () {
      final out = mergeApprovedRows([
        _row('c', nameEn: 'Woosong', tier: 3),
        _row('a', nameEn: 'Yonsei', tier: 1),
        _row('b', nameEn: 'Korea', tier: 1),
      ], {});
      expect(out.map((u) => u.name), ['Korea', 'Yonsei', 'Woosong']);
    });

    test('an unclassified institution sorts last, not first', () {
      // `tier` is null for institutions nobody has classified; treated as 0 it
      // would open the list.
      final out = mergeApprovedRows([
        _row('n', nameEn: 'Unranked'),
        _row('t', nameEn: 'Tiered', tier: 2),
      ], {});
      expect(out.first.name, 'Tiered');
    });
  });
}

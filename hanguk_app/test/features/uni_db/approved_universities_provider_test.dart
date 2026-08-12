// `mergeApprovedRows` — the part of `approvedCatalogueProvider` that turns
// `v_guest_approved_admissions` rows into what the screens render: the list
// Guest Explore and the Applications browse list show, and the admission
// detail Compare reads.
//
// Both list screens used to read the whole catalogue: Applications listed all
// 204 institutions to a student who had not applied anywhere, and Explore
// narrowed them with `hasIntakeData`, which answers 45 against an approved set
// of 57.
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
  int intakeYear = 2027,
  int? tuitionMin,
  int? tuitionMax,
  int? tuitionYear,
  String? appStart,
  String? appEnd,
  String? docDeadline,
  int? topik,
  bool? interview,
  bool? english,
  int docs = 0,
  bool? apostille,
}) => <String, dynamic>{
  'institution_id': id,
  'intake_year': intakeYear,
  'tuition_min_krw': tuitionMin,
  'tuition_max_krw': tuitionMax,
  'tuition_academic_year': tuitionYear,
  'application_start': appStart,
  'application_end': appEnd,
  'document_deadline': docDeadline,
  'topik_min_level': topik,
  'interview_required': interview,
  'english_accepted': english,
  'required_document_count': docs,
  'apostille_required': apostille,
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

/// The universities half of the merge — most cases below are about the list.
List<University> _unis(List<dynamic> rows, Map<String, University> byId) =>
    mergeApprovedRows(rows, byId).universities;

/// The detail the merge kept for [id].
ApprovedAdmission? _detail(
  List<dynamic> rows,
  String id, [
  Map<String, University> byId = const {},
]) => mergeApprovedRows(rows, byId).details[id];

void main() {
  group('one entry per institution', () {
    test('an institution approved for two intake years is listed once', () {
      // 70 view rows over 57 institutions in the live catalogue today.
      final out = _unis([
        _row('a', nameEn: 'Alpha'),
        _row('b', nameEn: 'Beta'),
        _row('a', nameEn: 'Alpha'),
      ], {});
      expect(out.map((u) => u.id), ['a', 'b']);
    });

    test('a row with no institution id is skipped, not rendered blank', () {
      final out = _unis([
        _row('a', nameEn: 'Alpha'),
        <String, dynamic>{'institution_id': null, 'name_en': 'Ghost'},
      ], {});
      expect(out, hasLength(1));
    });

    test('an empty result is an empty list, not an error', () {
      expect(_unis([], {}), isEmpty);
    });
  });

  group('the map record wins where there is one', () {
    test('an institution on the map keeps its coordinates', () {
      final out = _unis([
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
      final out = _unis([
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
          _unis([row], {}).single.name;

      expect(nameOf(_row('1', nameEn: 'En', nameUz: 'Uz', nameKo: 'Ko')), 'En');
      expect(nameOf(_row('2', nameUz: 'Uz', nameKo: 'Ko')), 'Uz');
      expect(nameOf(_row('3', nameKoShort: 'Short', nameKo: 'Ko')), 'Short');
      expect(nameOf(_row('4', nameKo: 'Ko')), 'Ko');
    });

    test('an empty string is not a name', () {
      // PostgREST returns '' rather than null for a blank text column, and an
      // untrimmed fallback chain would render an empty tile.
      expect(_unis([_row('1', nameEn: '', nameUz: 'Uz')], {}).single.name, 'Uz');
    });

    test('a missing city falls back the way the map does', () {
      expect(
        _unis([_row('1', nameEn: 'X')], {}).single.location,
        University.unknownCity,
      );
    });
  });

  group('ordering', () {
    test('top tier first, then by name', () {
      final out = _unis([
        _row('c', nameEn: 'Woosong', tier: 3),
        _row('a', nameEn: 'Yonsei', tier: 1),
        _row('b', nameEn: 'Korea', tier: 1),
      ], {});
      expect(out.map((u) => u.name), ['Korea', 'Yonsei', 'Woosong']);
    });

    test('an unclassified institution sorts last, not first', () {
      // `tier` is null for institutions nobody has classified; treated as 0 it
      // would open the list.
      final out = _unis([
        _row('n', nameEn: 'Unranked'),
        _row('t', nameEn: 'Tiered', tier: 2),
      ], {});
      expect(out.first.name, 'Tiered');
    });
  });

  group('the admission detail', () {
    test('the newest intake year wins', () {
      // The provider orders ascending, so the last row for an institution is
      // its newest year — the intake still open to a student reading today.
      final d = _detail([
        _row('a', nameEn: 'Alpha', intakeYear: 2026, topik: 4),
        _row('a', nameEn: 'Alpha', intakeYear: 2027, topik: 3),
      ], 'a');
      expect(d!.intakeYear, 2027);
      expect(d.topikMinLevel, 3);
    });

    test('reads every field the compare rows render', () {
      final d = _detail([
        _row(
          'a',
          nameEn: 'Alpha',
          tuitionMin: 3169000,
          tuitionMax: 3295000,
          tuitionYear: 2026,
          appStart: '2026-11-10',
          appEnd: '2026-12-05',
          docDeadline: '2027-01-21',
          topik: 3,
          interview: true,
          english: false,
          docs: 13,
          apostille: true,
        ),
      ], 'a')!;

      expect(d.tuitionMinKrw, 3169000);
      expect(d.tuitionMaxKrw, 3295000);
      expect(d.applicationStart, '2026-11-10');
      expect(d.applicationEnd, '2026-12-05');
      expect(d.documentDeadline, '2027-01-21');
      expect(d.topikMinLevel, 3);
      expect(d.interviewRequired, isTrue);
      expect(d.englishAccepted, isFalse);
      expect(d.requiredDocumentCount, 13);
      expect(d.apostilleRequired, isTrue);
    });

    test('a 2026 fee under a 2027 intake is flagged as another year', () {
      // The common case: Korean guidelines quote the current year's fees, so
      // every fee in the catalogue today is 2026 while most intakes are 2027.
      final d = _detail([
        _row('a', nameEn: 'A', intakeYear: 2027, tuitionMin: 5124000,
            tuitionYear: 2026),
      ], 'a')!;
      expect(d.tuitionIsFromAnotherYear, isTrue);
    });

    test('a matching year is not flagged', () {
      final d = _detail([
        _row('a', nameEn: 'A', intakeYear: 2027, tuitionMin: 5124000,
            tuitionYear: 2027),
      ], 'a')!;
      expect(d.tuitionIsFromAnotherYear, isFalse);
    });

    test('no fee year means nothing to disclaim', () {
      expect(_detail([_row('a', nameEn: 'A')], 'a')!.tuitionIsFromAnotherYear,
          isFalse);
    });

    test('a timestamp is trimmed to a plain date', () {
      // The view returns `date`, but a column widened to timestamptz later
      // must not put a clock time on a deadline row.
      final d = _detail([
        _row('a', nameEn: 'A', appStart: '2026-11-10T00:00:00+00:00'),
      ], 'a')!;
      expect(d.applicationStart, '2026-11-10');
    });

    test('empty strings read as absent, not as a value', () {
      final d = _detail([
        _row('a', nameEn: 'A', appStart: '', docDeadline: ''),
      ], 'a')!;
      expect(d.applicationStart, isNull);
      expect(d.documentDeadline, isNull);
    });

    test('an institution the map carries still gets its detail', () {
      // The list entry comes from the map record; the detail must still come
      // from the view row beside it.
      final d = _detail(
        [_row('a', nameEn: 'From view', topik: 2)],
        'a',
        {'a': _mapRow('a', name: 'From map')},
      );
      expect(d!.topikMinLevel, 2);
    });
  });
}

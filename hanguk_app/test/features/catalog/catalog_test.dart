// The university catalogue shown in Guest Explore and in the Applications tab
// of a student with no applications: the CRM's "Ma'lumotli" universities,
// read from `v_app_university_catalog`.
//
// Pinned here: rows group into one entry per university; the filter does what
// its labels say; fees stay in the guideline's currency; and the screen lists
// exactly what the provider returns — including the no-photo fallback that
// writes the university's name on the cover.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/catalog/data/campus_photos.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_browser.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_format.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

Map<String, dynamic> _row(
  String guideline,
  String institution, {
  required String name,
  String? nameKo,
  String city = 'Seoul',
  String degree = 'bakalavr',
  num? fee,
  num? ielts,
  bool? english,
  String type = 'private',
}) => {
  'guideline_id': guideline,
  'institution_id': institution,
  'name_ko': nameKo,
  'name_en': name,
  'institution_type': type,
  'univ_nomi_en': name,
  'shahar': city,
  'qabul_yili': 2027,
  'semestr': 'bahor',
  'daraja': degree,
  'english_track': english,
  'ielts_min': ielts,
  'topik_min': 3,
  'narx_valyuta': 'KRW',
  'kontrakt_min': fee,
  'kontrakt_max': fee,
  'kontrakt_davri': 'semestr',
};

List<CatalogUniversity> _catalogue() => groupCatalogRows([
  _row('g1', 'u1', name: 'Alpha University', nameKo: '알파대학교', fee: 4134000, ielts: 5.5, english: true),
  _row('g2', 'u1', name: 'Alpha University', nameKo: '알파대학교', degree: 'magistratura', fee: 6000000),
  _row('g3', 'u2', name: 'Beta National University', city: 'Daegu', fee: 1954000, type: 'national'),
  _row('g4', 'u3', name: 'Gamma University', city: 'Daejeon', ielts: 6.5, english: true),
]);

void main() {
  group('groupCatalogRows', () {
    test('one entry per university, every degree kept', () {
      final all = _catalogue();
      expect(all.map((u) => u.institutionId), ['u1', 'u2', 'u3']);
      final alpha = all.first;
      expect(alpha.hasDegree(CatalogDegree.bachelor), isTrue);
      expect(alpha.hasDegree(CatalogDegree.master), isTrue);
      // "all" shows the bachelor's guideline.
      expect(alpha.forDegree(null)!.id, 'g1');
    });
  });

  group('applyCatalogFilter', () {
    final all = _catalogue();

    test('no filter lists everything, cheapest first, no fee last', () {
      final out = applyCatalogFilter(all, const CatalogFilter());
      expect(out.map((u) => u.institutionId), ['u2', 'u1', 'u3']);
    });

    test('city', () {
      final out = applyCatalogFilter(all, const CatalogFilter(cities: {'Daegu'}));
      expect(out.map((u) => u.institutionId), ['u2']);
    });

    test('degree keeps only universities with that guideline', () {
      final out = applyCatalogFilter(all, const CatalogFilter(degree: CatalogDegree.master));
      expect(out.map((u) => u.institutionId), ['u1']);
    });

    test('IELTS: English track whose bar the score meets', () {
      expect(
        applyCatalogFilter(all, const CatalogFilter(ielts: 6.0)).map((u) => u.institutionId),
        ['u1'],
      );
      expect(
        applyCatalogFilter(all, const CatalogFilter(ielts: 6.5)).map((u) => u.institutionId),
        ['u1', 'u3'],
      );
    });

    test('a price range drops universities with no fee', () {
      final out = applyCatalogFilter(all, const CatalogFilter(minPrice: 1000000, maxPrice: 5000000));
      expect(out.map((u) => u.institutionId), ['u2', 'u1']);
    });

    test('search matches the English and Korean names', () {
      expect(applyCatalogFilter(all, const CatalogFilter(query: 'beta')).length, 1);
      expect(applyCatalogFilter(all, const CatalogFilter(query: '알파')).length, 1);
    });
  });

  test('fees stay in the currency the guideline quotes', () {
    expect(money(4134000, 'KRW'), '₩4,134,000');
    expect(money(80, 'USD'), '\$80');
  });

  test('price bounds round out to 500,000', () {
    final b = priceBounds(_catalogue());
    expect(b.min, 1500000);
    expect(b.max, 6000000);
  });

  testWidgets('the browser lists the catalogue and writes the name when there is no photo', (tester) async {
    final all = _catalogue();
    expect(campusPhotoAsset('u1'), isNull);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [catalogProvider.overrideWith((ref) async => all)],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(
            body: CustomScrollView(slivers: [CatalogBrowser(allowCompare: false)]),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final l = AppLocalizations.of(tester.element(find.byType(CatalogBrowser)))!;
    expect(find.text(l.guestUniversitiesCount(3)), findsOneWidget);
    expect(find.text('Alpha University'), findsOneWidget);
    // No Korean name either → the English name is both the cover and the title.
    expect(find.text('Beta National University'), findsNWidgets(2));
    // No photo for u1 → its Korean name is the cover.
    expect(find.text('알파대학교'), findsOneWidget);
    expect(find.text('₩1,954,000'), findsOneWidget);
  });
}

// The "Guest University" card above the catalogue list: Daegu Haany's
// delegation is visiting, so its card is pinned between the search header and
// the "Universities" title for guests and students alike.
//
// Pinned here: the card shows whenever the catalogue holds Daegu Haany — even
// when the search hides it from the list — never otherwise, and a tap opens
// the university's normal detail page.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_browser.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_detail_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

const _daeguHaany = '8f7d4351-c37d-4d26-b982-bfc76885225e';
const _card = Key('catalog-guest-university');

Map<String, dynamic> _row(
  String guideline,
  String institution, {
  required String name,
  String city = 'Seoul',
  String type = 'private',
  num? fee,
}) => {
  'is_partner': false,
  'guideline_id': guideline,
  'institution_id': institution,
  'name_ko': null,
  'name_en': name,
  'institution_type': type,
  'univ_nomi_en': name,
  'shahar': city,
  'qabul_yili': 2027,
  'semestr': 'bahor',
  'daraja': 'bakalavr',
  'english_track': true,
  'ielts_min': 5.5,
  'topik_min': 3,
  'narx_valyuta': 'KRW',
  'kontrakt_min': fee,
  'kontrakt_max': fee,
  'kontrakt_davri': 'semestr',
};

final _haanyRow = _row(
  'g-dh',
  _daeguHaany,
  name: 'Daegu Haany University',
  city: 'Gyeongsan (Gyeongsangbuk-do)',
  fee: 3000000,
);
final _alphaRow = _row('g-alpha', 'u-alpha', name: 'Alpha University', fee: 2000000);

Future<void> _pump(WidgetTester tester, List<CatalogUniversity> all) async {
  // Tall enough that the header, the card and the title row are all laid out.
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        catalogProvider.overrideWith((ref) async => all),
        catalogDetailProvider.overrideWith(
          (ref, id) async => const CatalogGuidelineDetail(faculties: [], rounds: [], docs: []),
        ),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        // The live dot pulses forever; with animations off it stays still, so
        // pumpAndSettle can settle.
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
        home: const Scaffold(
          body: CustomScrollView(slivers: [CatalogBrowser()]),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

AppLocalizations _l(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(CatalogBrowser)))!;

Finder _inCard(String text) => find.descendant(of: find.byKey(_card), matching: find.text(text));

void main() {
  testWidgets('Daegu Haany in the catalogue: the guest card sits above the list title', (tester) async {
    await _pump(tester, groupCatalogRows([_haanyRow, _alphaRow]));
    final l = _l(tester);

    expect(find.byKey(_card), findsOneWidget);
    expect(find.text('${l.catalogGuestUniTitle} · 방문 중'), findsOneWidget);
    expect(find.text(l.catalogGuestUniWhere), findsOneWidget);
    expect(_inCard(l.catalogGuestUniBadge), findsOneWidget);
    expect(_inCard('Daegu Haany University'), findsOneWidget);
    expect(_inCard('Gyeongsan (Gyeongsangbuk-do)'), findsOneWidget);

    final title = find.text(l.catalogListTitle);
    expect(title, findsOneWidget);
    expect(tester.getTopLeft(find.byKey(_card)).dy, lessThan(tester.getTopLeft(title).dy));
  });

  testWidgets('no Daegu Haany in the catalogue: no guest card', (tester) async {
    await _pump(tester, groupCatalogRows([_alphaRow]));
    final l = _l(tester);

    expect(find.byKey(_card), findsNothing);
    expect(find.text('${l.catalogGuestUniTitle} · 방문 중'), findsNothing);
    expect(find.text(l.catalogGuestUniBadge), findsNothing);
  });

  testWidgets('a search that hides Daegu Haany from the list keeps the guest card', (tester) async {
    await _pump(tester, groupCatalogRows([_haanyRow, _alphaRow]));
    final container = ProviderScope.containerOf(tester.element(find.byType(CatalogBrowser)));
    container.read(catalogFilterProvider.notifier).setQuery('alpha');
    await tester.pumpAndSettle();
    final l = _l(tester);

    // The list now holds only Alpha…
    expect(find.text(l.guestUniversitiesCount(1)), findsOneWidget);
    // …and Daegu Haany is named only on the guest card.
    expect(find.byKey(_card), findsOneWidget);
    expect(find.text('Daegu Haany University'), findsOneWidget);
    expect(_inCard('Daegu Haany University'), findsOneWidget);
  });

  testWidgets('tapping the guest card opens the university detail page', (tester) async {
    await _pump(tester, groupCatalogRows([_haanyRow, _alphaRow]));
    expect(find.byType(CatalogDetailScreen), findsNothing);

    await tester.tap(find.byKey(_card));
    await tester.pumpAndSettle();

    expect(find.byType(CatalogDetailScreen), findsOneWidget);
  });
}

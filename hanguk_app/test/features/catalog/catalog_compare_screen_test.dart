// The Taqqoslash screen: the two universities picked in compare mode, side by
// side.
//
// Pinned here: each key-facts row shows both values and marks the lower one
// only when both exist and differ; "Only differences" hides the rows whose two
// values read the same; the requirements are the guideline's required
// documents; fewer than two picks shows the "choose 2" message; and only a
// guest gets the contact button.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/design_system/seoul_night/widgets/svg_path_icon.dart';
import 'package:hanguk_app/features/catalog/data/catalog_compare_provider.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_compare_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

Map<String, dynamic> _row(
  String guideline,
  String institution, {
  required String name,
  required String city,
  required num fee,
  required num topik,
  num? ielts,
}) => {
  'guideline_id': guideline,
  'institution_id': institution,
  'name_en': name,
  'univ_nomi_en': name,
  'shahar': city,
  'qabul_yili': 2027,
  'semestr': 'bahor',
  'daraja': 'bakalavr',
  'topik_min': topik,
  'ielts_min': ielts,
  'narx_valyuta': 'KRW',
  'kontrakt_min': fee,
  'kontrakt_max': fee,
  'kontrakt_davri': 'semestr',
};

final _catalogue = groupCatalogRows([
  _row('g1', 'u1', name: 'Alpha University', city: 'Daegu', fee: 1954000, topik: 3, ielts: 5.5),
  _row('g2', 'u2', name: 'Beta University', city: 'Changwon', fee: 1997900, topik: 4, ielts: 5.5),
]);

final _details = {
  'g1': CatalogGuidelineDetail(
    faculties: const [],
    rounds: [
      CatalogRound.fromRow({'bosqich': 1, 'etap_raqam': 1, 'boshlanish_sana': '2026-10-12', 'tugash_sana': '2026-10-30', 'holat': 'tasdiqlangan'}),
    ],
    docs: [
      CatalogDoc.fromRow({'hujjat_nomi': 'Application form', 'majburiy': 'ha'}),
      CatalogDoc.fromRow({'hujjat_nomi': 'Portfolio', 'majburiy': 'shartli'}),
      CatalogDoc.fromRow({'hujjat_nomi': 'Passport copy', 'majburiy': 'ha'}),
    ],
  ),
  'g2': CatalogGuidelineDetail.empty,
};

class _Picked extends CatalogCompareNotifier {
  _Picked(this.ids);

  final List<String> ids;

  @override
  CatalogCompareState build() => CatalogCompareState(active: true, ids: ids);
}

Future<AppLocalizations> _pump(WidgetTester tester, {required bool isGuest, List<String> ids = const ['u1', 'u2']}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        catalogProvider.overrideWith((ref) async => _catalogue),
        catalogDetailProvider.overrideWith((ref, id) async => _details[id]!),
        catalogCompareProvider.overrideWith(() => _Picked(ids)),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: CatalogCompareScreen(isGuest: isGuest),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return AppLocalizations.of(tester.element(find.byType(CatalogCompareScreen)))!;
}

void main() {
  testWidgets('rows show both values and mark the lower one', (tester) async {
    final l = await _pump(tester, isGuest: false);

    expect(find.text(l.compareMainInfo), findsOneWidget);
    expect(find.text('₩1,954,000'), findsOneWidget);
    expect(find.text('₩1,997,900'), findsOneWidget);
    expect(find.text(l.compareBestCheaper), findsOneWidget);
    // TOPIK 3+ beats 4+; IELTS 5.5+ on both sides is not "better" anywhere.
    expect(find.text('3+'), findsOneWidget);
    expect(find.text('4+'), findsOneWidget);
    expect(find.text('5.5+'), findsNWidgets(2));
    expect(find.text(l.compareBestLower), findsOneWidget);
    // Deadline: end of the first dated step; none loaded for Beta → a dash.
    expect(find.text('October 30'), findsOneWidget);
    expect(find.text('—'), findsNWidgets(2));
    expect(find.text('Daegu'), findsOneWidget);
    expect(find.text('Changwon'), findsOneWidget);
    // Requirements: the required documents only.
    expect(find.text(l.compareDetails), findsOneWidget);
    expect(find.text('Application form, Passport copy.'), findsOneWidget);
  });

  testWidgets('only differences hides the rows that read the same', (tester) async {
    final l = await _pump(tester, isGuest: false);
    expect(find.text(l.compareRowIelts), findsOneWidget);

    await tester.tap(find.text(l.compareOnlyDiff));
    await tester.pump();

    expect(find.text(l.compareRowIelts), findsNothing);
    expect(find.text('5.5+'), findsNothing);
    expect(find.text(l.compareRowTuition), findsOneWidget);
    expect(find.text(l.compareRowTopik), findsOneWidget);
    expect(find.text(l.compareRowCity), findsOneWidget);
    // The details are not filtered.
    expect(find.text(l.compareRowRequirements), findsOneWidget);
  });

  testWidgets('one pick asks for a second and shows an empty slot', (tester) async {
    final l = await _pump(tester, isGuest: false, ids: const ['u1']);

    expect(find.text(l.compareNeedTwo), findsOneWidget);
    expect(find.text(l.compareAddSlot), findsOneWidget);
    expect(find.text(l.compareMainInfo), findsNothing);
    expect(find.text(l.compareDetails), findsNothing);
  });

  testWidgets('a column\'s ✕ removes that pick and keeps compare mode on', (tester) async {
    final l = await _pump(tester, isGuest: false);
    final container = ProviderScope.containerOf(tester.element(find.byType(CatalogCompareScreen)));
    final removeButtons = find.byWidgetPredicate(
      (w) => w is SvgPathIcon && w.paths.single == 'M6 6l12 12M18 6L6 18',
    );
    expect(removeButtons, findsNWidgets(2));

    await tester.tap(removeButtons.last);
    await tester.pump();

    expect(container.read(catalogCompareProvider).active, isTrue);
    expect(container.read(catalogCompareProvider).ids, ['u1']);
    expect(find.text(l.compareNeedTwo), findsOneWidget);
  });

  testWidgets('only a guest gets the contact button', (tester) async {
    var l = await _pump(tester, isGuest: true);
    expect(find.text(l.guestContactCta), findsOneWidget);

    l = await _pump(tester, isGuest: false);
    expect(find.text(l.guestContactCta), findsNothing);
  });
}

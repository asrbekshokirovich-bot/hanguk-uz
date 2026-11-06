import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/discover/data/slots.dart';
import 'package:hanguk_app/features/discover/presentation/filter_screen.dart';
import 'package:hanguk_app/features/discover/presentation/universities_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

Map<String, dynamic> _row(String g, String id, String en, String city, String type) => {
  'is_partner': false,
  'guideline_id': g,
  'institution_id': id,
  'name_ko': null,
  'name_en': en,
  'univ_nomi_en': en,
  'institution_type': type,
  'shahar': city,
  'daraja': 'bakalavr',
  'topik_min': 2,
  'narx_valyuta': 'KRW',
  'kontrakt_min': 1900000,
  'kontrakt_davri': 'semestr',
};

final _rows = [
  _row('g1', 'u1', 'Honam University', 'Gwangju', 'private'),
  _row('g2', 'u2', 'Kumoh National Inst. of Tech.', 'Gumi', 'national'),
];

Future<(AppLocalizations, ProviderContainer)> _pump(WidgetTester t, Widget page) async {
  t.view.physicalSize = const Size(390 * 3, 1400 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final c = ProviderContainer(overrides: [catalogProvider.overrideWith((ref) async => groupCatalogRows(_rows))]);
  addTearDown(c.dispose);
  await t.pumpWidget(
    UncontrolledProviderScope(
      container: c,
      child: MaterialApp(
        locale: const Locale('uz'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: Scaffold(body: page),
      ),
    ),
  );
  await t.pump(const Duration(milliseconds: 200));
  return (await AppLocalizations.delegate.load(const Locale('uz')), c);
}

void main() {
  testWidgets('the cards, the search, and the heart that picks', (t) async {
    final (l, c) = await _pump(t, const UniversitiesScreen());
    expect(find.text('Honam University'), findsOneWidget);
    expect(find.text(l.ulPrivate), findsOneWidget);
    expect(find.text(l.ulState), findsOneWidget);
    expect(find.text('Gumi · TOPIK 2+'), findsOneWidget);
    await t.enterText(find.byType(TextField), 'gumi');
    await t.pump();
    expect(find.text('Honam University'), findsNothing);
    expect(find.text(l.ulCount(1)), findsOneWidget);
    await t.tap(find.byIcon(Icons.favorite_border));
    await t.pump();
    expect(c.read(slotsProvider), contains('u2'));
  });

  testWidgets('Filtr: the count, the sections, the grant box', (t) async {
    final (l, _) = await _pump(t, const FilterScreen());
    expect(find.text(l.fltTitle), findsOneWidget);
    expect(find.text(l.fltCount(2)), findsOneWidget);
    for (final s in [
      l.fdSectionField,
      l.fdSectionCityMap,
      l.fltFeeSem,
      l.fdSectionType,
      l.fdSectionGrant,
      l.fdGrantStepScores,
    ]) {
      await t.scrollUntilVisible(find.text(s), 200);
      expect(find.text(s), findsOneWidget, reason: s);
    }
  });

  testWidgets('the search box: a focus, then one search once typing pauses', (t) async {
    final seen = <TrackedEvent>[];
    AppEvents.debugOnTrack = seen.add;
    addTearDown(() => AppEvents.debugOnTrack = null);
    await _pump(t, const UniversitiesScreen());
    await t.tap(find.byType(TextField));
    await t.pump();
    expect(seen.where((e) => e.event == 'field_focus').map((e) => e.props), [
      {'form': 'universities', 'field': 'search'},
    ]);
    await t.enterText(find.byType(TextField), 'gu');
    await t.pump(const Duration(milliseconds: 500));
    await t.enterText(find.byType(TextField), 'gumi');
    await t.pump();
    expect(seen.where((e) => e.event == 'search'), isEmpty, reason: 'not while typing');
    await t.pump(kUniversitiesSearchPause);
    final searches = seen.where((e) => e.event == 'search').toList();
    expect(searches, hasLength(1));
    expect(searches.single.props, {'chars': 4, 'q': 'gumi', 'results': 1});
    // The same search again is not a new one.
    await t.testTextInput.receiveAction(TextInputAction.search);
    await t.pump();
    expect(seen.where((e) => e.event == 'search'), hasLength(1));
  });

  testWidgets('Filtr: filter_apply when it is left with other choices, and only then', (t) async {
    final seen = <TrackedEvent>[];
    AppEvents.debugOnTrack = seen.add;
    addTearDown(() => AppEvents.debugOnTrack = null);
    await _pump(t, const FilterScreen());
    await t.pumpWidget(const SizedBox());
    expect(seen.where((e) => e.event == 'filter_apply'), isEmpty, reason: 'nothing changed');

    final (_, c) = await _pump(t, const FilterScreen());
    c.read(catalogFilterProvider.notifier).set(const CatalogFilter(type: 'private'));
    await t.pump();
    await t.pumpWidget(const SizedBox());
    final applied = seen.where((e) => e.event == 'filter_apply').toList();
    expect(applied, hasLength(1));
    expect(applied.single.props?['type'], 'private');
    expect(applied.single.props?.containsKey('results'), isTrue);
  });
}

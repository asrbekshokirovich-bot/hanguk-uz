// The catalogue's search box, by field of study (ai-university-search).
//
// Pinned here: the answer is read from the server's JSON; only the newest
// text's answer is kept and nothing is sent until typing pauses; a field
// lists every university of it in the server's order, never one the Filtr
// screen hides, with the guideline of the chosen degree; a text that names no
// field gives way to the app's own name filter; and each result names its
// programmes of the field.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/catalog/data/ai_search.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_browser.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';
import 'package:hanguk_app/l10n/app_localizations_en.dart';

Map<String, dynamic> _row(
  String guideline,
  String institution, {
  required String name,
  String city = 'Seoul',
  String degree = 'bakalavr',
  num? fee,
}) => {
  'is_partner': false,
  'guideline_id': guideline,
  'institution_id': institution,
  'name_en': name,
  'institution_type': 'private',
  'univ_nomi_en': name,
  'shahar': city,
  'qabul_yili': 2027,
  'semestr': 'bahor',
  'daraja': degree,
  'english_track': false,
  'topik_min': 3,
  'narx_valyuta': 'KRW',
  'kontrakt_min': fee,
  'kontrakt_max': fee,
  'kontrakt_davri': 'semestr',
};

List<CatalogUniversity> _catalogue() => groupCatalogRows([
  _row('g1', 'u1', name: 'Alpha University', fee: 4000000),
  _row('g2', 'u2', name: 'Beta University', city: 'Daejeon', fee: 2000000),
  _row('g2m', 'u2', name: 'Beta University', city: 'Daejeon', degree: 'magistratura', fee: 5000000),
  _row('g3', 'u3', name: 'Gamma University', city: 'Daejeon', fee: 3000000),
]);

AiSearchResult _answer(Map<String, dynamic> json) => AiSearchResult.fromJson(json);

/// "IT": Gamma, then Beta — its bachelor's and its master's guideline.
final _it = _answer({
  'results': [
    {'institution_id': 'u3', 'guideline_id': 'g3', 'matched': ['Computer Engineering'], 'match_count': 1},
    {
      'institution_id': 'u2',
      'guideline_id': 'g2',
      'matched': ['Software', 'Computer Science', 'AI', 'Data Science', 'Information Security'],
      'match_count': 5,
    },
    {'institution_id': 'u2', 'guideline_id': 'g2m', 'matched': ['Information Security'], 'match_count': 1},
  ],
  'terms': ['comput', 'software'],
  'mode': 'field',
});

void main() {
  final l = AppLocalizationsEn();

  test('the server answer is read, unknown shapes are skipped', () {
    final r = _answer({
      'results': [
        {'institution_id': 'u1', 'guideline_id': 'g1', 'matched': ['A', 3], 'match_count': 2},
        'junk',
      ],
      'mode': 'field',
    });
    expect(r.hits.single.matched, ['A']);
    expect(r.hits.single.matchCount, 2);
    expect(r.byField, isTrue);
    expect(_answer({'results': <Object>[], 'mode': 'none'}).byField, isFalse);
    expect(_answer({'results': <Object>[], 'mode': 'text'}).byField, isFalse);
  });

  group('catalogSearchRows', () {
    final all = _catalogue();
    const it = CatalogFilter(query: 'IT');

    test("a field: every university of it, in the server's order, once each", () {
      final rows = catalogSearchRows(all, it, AiSearchState(query: 'IT', result: _it));
      expect(rows.map((r) => r.university.institutionId), ['u3', 'u2']);
      expect(rows.last.guideline.id, 'g2');
      expect(rows.last.hit!.matchCount, 5);
    });

    test('the Filtr screen still applies, its degree picks the guideline', () {
      expect(
        catalogSearchRows(all, it.copyWith(maxPrice: () => 2500000), AiSearchState(query: 'IT', result: _it))
            .map((r) => r.university.institutionId),
        ['u2'],
      );
      final master = catalogSearchRows(
        all,
        it.copyWith(degree: CatalogDegree.master),
        AiSearchState(query: 'IT', result: _it),
      );
      expect(master.map((r) => r.guideline.id), ['g2m']);
    });

    test('a field with no university: nothing, not the name filter', () {
      final none = _answer({'results': <Object>[], 'mode': 'field'});
      expect(catalogSearchRows(all, const CatalogFilter(query: 'gamma'), AiSearchState(query: 'gamma', result: none)),
          isEmpty);
    });

    test('no field in the text, or no answer yet: the name filter', () {
      const f = CatalogFilter(query: 'gamma');
      expect(
        catalogSearchRows(all, f, const AiSearchState(query: 'gamma', loading: true))
            .map((r) => r.university.institutionId),
        ['u3'],
      );
      final rows = catalogSearchRows(
        all,
        f,
        AiSearchState(query: 'gamma', result: _answer({'results': <Object>[], 'mode': 'none'})),
      );
      expect(rows.map((r) => r.university.institutionId), ['u3']);
      expect(rows.single.hit, isNull);
    });
  });

  test('the reason line: two programmes and how many more', () {
    final rows = catalogSearchRows(_catalogue(), const CatalogFilter(query: 'IT'), AiSearchState(query: 'IT', result: _it));
    expect(catalogSearchReason(l, rows.first), 'Programs: Computer Engineering');
    expect(catalogSearchReason(l, rows.last), 'Programs: Software, Computer Science +3');
    final byName = catalogSearchRows(_catalogue(), const CatalogFilter(query: 'alpha'), const AiSearchState());
    expect(catalogSearchReason(l, byName.single), isNull);
  });

  testWidgets('waits for a pause, then keeps only the newest answer', (tester) async {
    final calls = <String>[];
    final pending = <String, Completer<AiSearchResult?>>{};
    final container = ProviderContainer(
      overrides: [
        catalogProvider.overrideWith((ref) async => _catalogue()),
        aiSearchCallProvider.overrideWithValue((q) {
          calls.add(q);
          return (pending[q] = Completer<AiSearchResult?>()).future;
        }),
      ],
    );
    addTearDown(container.dispose);
    container.listen(aiSearchProvider, (_, _) {});
    final filter = container.read(catalogFilterProvider.notifier);

    filter.setQuery('i');
    expect(container.read(aiSearchProvider).loading, isFalse); // too short
    filter.setQuery('it');
    await tester.pump(const Duration(milliseconds: 200));
    filter.setQuery('it ');
    await tester.pump(const Duration(milliseconds: 200));
    expect(calls, isEmpty); // still typing
    await tester.pump(AiSearchNotifier.debounce);
    expect(calls, ['it']);
    expect(container.read(aiSearchProvider).loading, isTrue);

    // A newer text goes out before the older answer comes back.
    filter.setQuery('it security');
    await tester.pump(AiSearchNotifier.debounce);
    expect(calls, ['it', 'it security']);

    pending['it security']!.complete(_it);
    await tester.pump();
    pending['it']!.complete(_answer({'results': <Object>[], 'mode': 'field'}));
    await tester.pump();

    final s = container.read(aiSearchProvider);
    expect(s.query, 'it security');
    expect(s.loading, isFalse);
    expect(s.result!.hits.length, 3);

    // Clearing the box clears the search.
    filter.setQuery('');
    expect(container.read(aiSearchProvider).result, isNull);

    // A university's name is left to the name filter: the model is not asked.
    await container.read(catalogProvider.future);
    filter.setQuery('gamma');
    await tester.pump(AiSearchNotifier.debounce * 2);
    expect(calls, ['it', 'it security']);
    expect(container.read(aiSearchProvider).loading, isFalse);
  });

  test('a university name is the start of a name, three characters at least', () {
    final all = _catalogue();
    expect(startsUniversityName(all, 'Gam'), isTrue);
    expect(startsUniversityName(all, 'beta univ'), isTrue);
    expect(startsUniversityName(all, 'ga'), isFalse); // too short
    expect(startsUniversityName(all, 'University'), isFalse); // not the start
    expect(startsUniversityName(all, 'IT'), isFalse);
  });

  testWidgets('typing a field shows its universities as rows with their programmes', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          catalogProvider.overrideWith((ref) async => _catalogue()),
          aiSearchCallProvider.overrideWithValue((_) async => _it),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: CustomScrollView(slivers: [CatalogBrowser()])),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'IT');
    await tester.pump();
    expect(find.text(l.catalogAiSearching), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.text(l.catalogAiResultsTitle), findsOneWidget);
    expect(find.text(l.guestUniversitiesCount(2)), findsOneWidget);
    expect(find.text('Gamma University'), findsWidgets);
    expect(find.text('Alpha University'), findsNothing);
    expect(find.text('Programs: Computer Engineering'), findsOneWidget);
    expect(find.text('Programs: Software, Computer Science +3'), findsOneWidget);
  });
}

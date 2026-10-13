// The catalogue's search box, read by a language model (ai-university-search).
//
// Pinned here: the answer is read from the server's JSON; only the newest
// text's answer is kept and nothing is sent until typing pauses; the results
// follow the model's order but never show what the Filtr screen hides; a
// name-only server answer gives way to the app's own name filter; and each
// result says why it is there.
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
  num? topik = 3,
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
  'topik_min': topik,
  'narx_valyuta': 'KRW',
  'kontrakt_min': fee,
  'kontrakt_max': fee,
  'kontrakt_davri': 'semestr',
};

List<CatalogUniversity> _catalogue() => groupCatalogRows([
  _row('g1', 'u1', name: 'Alpha University', fee: 4000000),
  _row('g2', 'u2', name: 'Beta University', city: 'Daejeon', fee: 2000000, topik: 4),
  _row('g3', 'u3', name: 'Gamma University', city: 'Daejeon', fee: 3000000),
]);

AiSearchResult _answer(Map<String, dynamic> json) => AiSearchResult.fromJson(json);

final _daejeonIt = _answer({
  'results': [
    {'institution_id': 'u3', 'guideline_id': 'g3', 'matched': ['Computer Engineering'], 'match_count': 1},
    {
      'institution_id': 'u2',
      'guideline_id': 'g2',
      'matched': ['Software', 'Computer Science', 'AI'],
      'match_count': 5,
    },
  ],
  'interpreted': {'cities': ['Daejeon'], 'keywords': ['comput'], 'topik_max': 3, 'max_tuition_krw': null},
  'relaxed': <String>[],
  'mode': 'ai',
});

void main() {
  final l = AppLocalizationsEn();

  test('the server answer is read, unknown shapes are skipped', () {
    final r = _answer({
      'results': [
        {'institution_id': 'u1', 'guideline_id': 'g1', 'matched': ['A', 3], 'match_count': 2},
        'junk',
      ],
      'interpreted': {'cities': ['Seoul', 1], 'topik_max': 0, 'english_only': true},
      'relaxed': ['tuition'],
      'mode': 'text',
    });
    expect(r.hits.single.matched, ['A']);
    expect(r.hits.single.matchCount, 2);
    expect(r.intent.cities, ['Seoul']);
    expect(r.intent.topikMax, 0);
    expect(r.intent.englishOnly, isTrue);
    expect(r.relaxed, ['tuition']);
    expect(r.byModel, isFalse);
  });

  group('catalogSearchRows', () {
    final all = _catalogue();

    test("the model's order, with its guideline and hit", () {
      final rows = catalogSearchRows(
        all,
        const CatalogFilter(query: 'daejeon it'),
        AiSearchState(query: 'daejeon it', result: _daejeonIt),
      );
      expect(rows.map((r) => r.university.institutionId), ['u3', 'u2']);
      expect(rows.first.guideline.id, 'g3');
      expect(rows.first.hit!.matched, ['Computer Engineering']);
    });

    test('the Filtr screen still applies', () {
      final rows = catalogSearchRows(
        all,
        const CatalogFilter(query: 'daejeon it', maxPrice: 2500000),
        AiSearchState(query: 'daejeon it', result: _daejeonIt),
      );
      expect(rows.map((r) => r.university.institutionId), ['u2']);
    });

    test('no answer yet, or a name-only one: the name filter', () {
      const f = CatalogFilter(query: 'gamma');
      expect(
        catalogSearchRows(all, f, const AiSearchState(query: 'gamma', loading: true))
            .map((r) => r.university.institutionId),
        ['u3'],
      );
      final textOnly = _answer({'results': <Object>[], 'mode': 'text'});
      final rows = catalogSearchRows(all, f, AiSearchState(query: 'gamma', result: textOnly));
      expect(rows.map((r) => r.university.institutionId), ['u3']);
      expect(rows.single.hit, isNull);
    });
  });

  group('catalogSearchReason', () {
    final all = _catalogue();
    CatalogSearchRow rowFor(AiSearchResult r, String id) =>
        catalogSearchRows(all, const CatalogFilter(query: 'x x'), AiSearchState(query: 'x x', result: r))
            .firstWhere((row) => row.university.institutionId == id);

    test('two matching faculties, and how many more', () {
      expect(catalogSearchReason(l, rowFor(_daejeonIt, 'u2'), _daejeonIt), 'Programs: Software, Computer Science +3');
      expect(catalogSearchReason(l, rowFor(_daejeonIt, 'u3'), _daejeonIt), 'Programs: Computer Engineering');
    });

    test('a dropped condition is named on the rows that miss it', () {
      final r = _answer({
        'results': [
          {'institution_id': 'u2', 'guideline_id': 'g2'},
          {'institution_id': 'u3', 'guideline_id': 'g3'},
        ],
        'interpreted': {'max_tuition_krw': 2500000, 'topik_max': 3},
        'relaxed': ['tuition', 'topik'],
        'mode': 'ai',
      });
      expect(catalogSearchReason(l, rowFor(r, 'u2'), r), 'Needs TOPIK 4');
      expect(catalogSearchReason(l, rowFor(r, 'u3'), r), 'Above your budget');
    });

    test('nothing to say: no line', () {
      final r = _answer({
        'results': [
          {'institution_id': 'u1', 'guideline_id': 'g1'},
        ],
        'interpreted': {'cities': ['Seoul']},
        'mode': 'ai',
      });
      expect(catalogSearchReason(l, rowFor(r, 'u1'), r), isNull);
    });
  });

  testWidgets('waits for a pause, then keeps only the newest answer', (tester) async {
    final calls = <String>[];
    final pending = <String, Completer<AiSearchResult?>>{};
    final container = ProviderContainer(
      overrides: [
        aiSearchCallProvider.overrideWithValue((q) {
          calls.add(q);
          return (pending[q] = Completer<AiSearchResult?>()).future;
        }),
      ],
    );
    addTearDown(container.dispose);
    container.listen(aiSearchProvider, (_, _) {});
    final filter = container.read(catalogFilterProvider.notifier);

    filter.setQuery('d');
    expect(container.read(aiSearchProvider).loading, isFalse); // too short
    filter.setQuery('da');
    await tester.pump(const Duration(milliseconds: 200));
    filter.setQuery('dae');
    await tester.pump(const Duration(milliseconds: 200));
    expect(calls, isEmpty); // still typing
    await tester.pump(AiSearchNotifier.debounce);
    expect(calls, ['dae']);
    expect(container.read(aiSearchProvider).loading, isTrue);

    // A newer text goes out before the older answer comes back.
    filter.setQuery('daejeon');
    await tester.pump(AiSearchNotifier.debounce);
    expect(calls, ['dae', 'daejeon']);

    pending['daejeon']!.complete(_daejeonIt);
    await tester.pump();
    pending['dae']!.complete(_answer({'results': <Object>[], 'mode': 'ai'}));
    await tester.pump();

    final s = container.read(aiSearchProvider);
    expect(s.query, 'daejeon');
    expect(s.loading, isFalse);
    expect(s.result!.hits.length, 2);

    // Clearing the box clears the search.
    filter.setQuery('');
    expect(container.read(aiSearchProvider).result, isNull);
  });

  testWidgets('typing shows the results as rows with the reason line', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          catalogProvider.overrideWith((ref) async => _catalogue()),
          aiSearchCallProvider.overrideWithValue((_) async => _daejeonIt),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: CustomScrollView(slivers: [CatalogBrowser()])),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'Daejeonda IT');
    await tester.pump();
    expect(find.text(l.catalogAiSearching), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.text(l.catalogAiResultsTitle), findsOneWidget);
    expect(find.text(l.guestUniversitiesCount(2)), findsOneWidget);
    expect(find.text('Gamma University'), findsWidgets);
    expect(find.text('Alpha University'), findsNothing);
    expect(find.text('Programs: Computer Engineering'), findsOneWidget);
    // What the model read: the city and the TOPIK level, not the stems.
    expect(find.text(l.catalogAiUnderstood), findsOneWidget);
    expect(find.text('Daejeon'), findsOneWidget);
    expect(find.text('TOPIK ≤ 3'), findsOneWidget);
    expect(find.text('comput'), findsNothing);
  });
}

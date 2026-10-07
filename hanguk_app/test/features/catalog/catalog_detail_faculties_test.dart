// The Fakultetlar card of one university.
//
// Pinned here: faculties are grouped under their college as before, except
// Daegu Haany, whose two programmes sit under one "Adventure College" — there
// each faculty gets its own row. With no contract fee in the guideline the
// fee card still shows, with a dash for the amount.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_detail_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

const _haany = '71e70627-7f40-4829-a121-f02bf90918de';

CatalogUniversity _uni(String guideline) => groupCatalogRows([
  {
    'guideline_id': guideline,
    'institution_id': 'u-$guideline',
    'name_en': 'Some University',
    'univ_nomi_en': 'Some University',
    'qabul_yili': 2027,
    'semestr': 'bahor',
    'daraja': 'bakalavr',
    'narx_valyuta': 'KRW',
  },
]).single;

final _faculties = [
  for (final (i, f) in ['Business Administration (English)', 'IT (English)'].indexed)
    CatalogFaculty.fromRow({
      'tartib': i + 1,
      'track': 'english',
      'kollej_en': 'Adventure College',
      'kollej_kr': 'Adventure College',
      'fakultet_en': f,
    }),
];

Future<void> _pump(WidgetTester tester, String guideline) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        catalogDetailProvider.overrideWith(
          (ref, id) async => CatalogGuidelineDetail(faculties: _faculties, rounds: const [], docs: const []),
        ),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: CatalogDetailScreen(university: _uni(guideline), initialDegree: CatalogDegree.all, isGuest: false),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Daegu Haany lists each faculty on its own row', (tester) async {
    await _pump(tester, _haany);
    expect(find.text('Business Administration (English)'), findsWidgets);
    expect(find.text('IT (English)'), findsOneWidget);
    expect(find.text('Adventure College'), findsNothing);
  });

  testWidgets('other universities keep one row per college', (tester) async {
    await _pump(tester, 'another-guideline');
    expect(find.text('Adventure College'), findsWidgets);
    expect(find.text('IT (English)'), findsNothing);
  });

  testWidgets('no contract fee: the fee card shows a dash', (tester) async {
    await _pump(tester, _haany);
    final l = AppLocalizations.of(tester.element(find.byType(CatalogDetailScreen)))!;
    expect(find.text(l.catalogTuitionTitle('Business Administration (English)')), findsOneWidget);
    expect(find.text('—'), findsOneWidget);
    expect(find.text(l.catalogPerSemester), findsNothing);
  });
}

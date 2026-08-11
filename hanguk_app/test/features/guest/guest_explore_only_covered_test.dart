// Guest Explore lists only the institutions we hold admission data for.
//
// The catalogue carries 204 visible rows but a published guideline for 45 of
// them. Listing all 204 put a name-and-a-map-pin beside a school whose
// deadlines, requirements and documents had actually been read, with nothing
// to tell them apart — on the screen a student uses to decide where to apply.
//
// `hasIntakeData` comes from the view and tracks the CRM's default intake, so
// what these tests pin is the filter itself: covered in, uncovered out, and
// the city chips built from the same narrowed set rather than from everything.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/guest/presentation/guest_explore_screen.dart';
import 'package:hanguk_app/features/map/data/map_repository.dart';
import 'package:hanguk_app/features/map/domain/university.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

University _uni(
  String id, {
  required String name,
  required String city,
  required bool covered,
}) {
  return University(
    id: id,
    name: name,
    location: city,
    nameKo: '대학',
    hasIntakeData: covered,
  );
}

Future<void> _pump(WidgetTester tester, List<University> catalogue) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        universitiesProvider.overrideWith((ref) async => catalogue),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: GuestExploreScreen(onOpenCompare: () {}),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('an institution without intake data is not listed', (
    tester,
  ) async {
    await _pump(tester, [
      _uni('a', name: 'Covered University', city: 'Seoul', covered: true),
      _uni('b', name: 'Pin Only University', city: 'Seoul', covered: false),
    ]);

    expect(find.text('Covered University'), findsOneWidget);
    expect(find.text('Pin Only University'), findsNothing);
  });

  testWidgets('the count reflects the covered set, not the catalogue', (
    tester,
  ) async {
    await _pump(tester, [
      _uni('a', name: 'Alpha', city: 'Seoul', covered: true),
      _uni('b', name: 'Beta', city: 'Busan', covered: false),
      _uni('c', name: 'Gamma', city: 'Daejeon', covered: false),
    ]);

    final l = AppLocalizations.of(
      tester.element(find.byType(GuestExploreScreen)),
    )!;

    // One covered of three — the header must not advertise three.
    expect(find.text(l.guestUniversitiesCount(1)), findsOneWidget);
    expect(find.text(l.guestUniversitiesCount(3)), findsNothing);
  });

  testWidgets('city chips come from the covered set only', (tester) async {
    await _pump(tester, [
      _uni('a', name: 'Alpha', city: 'Seoul', covered: true),
      // Busan exists in the catalogue but only via an uncovered school, so
      // offering it as a filter would lead to a guaranteed empty list.
      _uni('b', name: 'Beta', city: 'Busan', covered: false),
    ]);

    // Busan is the assertion: it must appear nowhere — not as a chip, since
    // tapping it would guarantee an empty list, and not in a card, since its
    // only school is filtered out. Seoul appears twice over (chip and the
    // surviving card's location line), so it is matched loosely.
    expect(find.text('Busan'), findsNothing);
    expect(find.text('Seoul'), findsWidgets);
  });

  testWidgets('no coverage at all shows the empty state, not the catalogue', (
    tester,
  ) async {
    await _pump(tester, [
      _uni('a', name: 'Alpha', city: 'Seoul', covered: false),
      _uni('b', name: 'Beta', city: 'Busan', covered: false),
    ]);

    final l = AppLocalizations.of(
      tester.element(find.byType(GuestExploreScreen)),
    )!;

    expect(find.text('Alpha'), findsNothing);
    expect(find.text(l.noUniversitiesMatch), findsOneWidget);
  });
}

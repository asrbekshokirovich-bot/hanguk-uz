// Guest Explore lists only the institutions the review queue has approved.
//
// The catalogue carries 204 visible rows against an approved set of 57.
// Listing all 204 put a name-and-a-map-pin beside a school whose deadlines,
// requirements and documents had actually been read, with nothing to tell them
// apart — on the screen a student uses to decide where to apply.
//
// The narrowing itself moved into `approvedUniversitiesProvider`, which reads
// `v_guest_approved_admissions` and is shared with the Applications browse
// list so the two screens cannot disagree. (It replaced a `hasIntakeData`
// filter applied here, which answered 45: that flag follows the CRM's default
// intake, counting cycles with no extracted field and dropping institutions
// approved for any other year.)
//
// What these tests pin is the screen's half of that contract: it renders the
// approved list and nothing else, and everything derived on screen — the
// count, the city chips, the empty state — is derived from that same list.
// `mergeApprovedRows` in the provider's own test file covers the other half.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/guest/presentation/guest_explore_screen.dart';
import 'package:hanguk_app/features/map/domain/university.dart';
import 'package:hanguk_app/features/uni_db/data/approved_universities_provider.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

University _uni(String id, {required String name, required String city}) {
  return University(
    id: id,
    name: name,
    location: city,
    nameKo: '대학',
    hasIntakeData: true,
  );
}

/// [approved] is what the provider resolves to — i.e. already narrowed.
///
/// Overrides `approvedCatalogueProvider`, not the derived
/// `approvedUniversitiesProvider`: the screen now reads the catalogue
/// directly (it needs `details` too, for the card's tuition/TOPIK/deadline
/// rows), and overriding the derived provider alone would leave that read
/// hitting the real network call.
Future<void> _pump(WidgetTester tester, List<University> approved) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        approvedCatalogueProvider.overrideWith(
          (ref) async =>
              ApprovedCatalogue(universities: approved, details: const {}),
        ),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: GuestExploreScreen(onOpenCompare: () {})),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('it lists the approved set and adds nothing to it', (
    tester,
  ) async {
    await _pump(tester, [
      _uni('a', name: 'Covered University', city: 'Seoul'),
    ]);

    expect(find.text('Covered University'), findsOneWidget);
    // The catalogue's other 203 institutions are not in the provider's result,
    // so nothing on this screen may reach for them.
    expect(find.text('Pin Only University'), findsNothing);
  });

  testWidgets('the count reflects the approved set, not the catalogue', (
    tester,
  ) async {
    await _pump(tester, [_uni('a', name: 'Alpha', city: 'Seoul')]);

    final l = AppLocalizations.of(
      tester.element(find.byType(GuestExploreScreen)),
    )!;

    expect(find.text(l.guestUniversitiesCount(1)), findsOneWidget);
    expect(find.text(l.guestUniversitiesCount(204)), findsNothing);
  });

  testWidgets('city chips come from the approved set only', (tester) async {
    await _pump(tester, [_uni('a', name: 'Alpha', city: 'Seoul')]);

    // Busan is the assertion: no approved institution is there, so offering it
    // as a filter would lead to a guaranteed empty list. Seoul appears twice
    // over (chip and the card's location line), so it is matched loosely.
    expect(find.text('Busan'), findsNothing);
    expect(find.text('Seoul'), findsWidgets);
  });

  testWidgets('nothing approved shows the empty state, not the catalogue', (
    tester,
  ) async {
    await _pump(tester, const <University>[]);

    final l = AppLocalizations.of(
      tester.element(find.byType(GuestExploreScreen)),
    )!;

    expect(find.text(l.noUniversitiesMatch), findsOneWidget);
  });
}

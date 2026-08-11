// Two columns whose rows do not line up are not a comparison.
//
// Each column used to build its own row list from its own university, so the
// rows were whatever that school happened to have. Put a university with a
// tier but no accreditation beside one with accreditation but no tier and the
// labels came out staggered: "Tier" on the left sat level with "IEQAS" on the
// right, and a reader scanning across compared two different fields.
//
// The schema is now decided once for the pair — a field shows when EITHER
// university has it — and the column that lacks it renders an em dash. These
// tests pin both halves of that: same labels on both sides, and a missing
// value that reads as missing rather than silently shifting the rows below it.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/guest/data/guest_compare_provider.dart';
import 'package:hanguk_app/features/guest/presentation/guest_compare_screen.dart';
import 'package:hanguk_app/features/map/data/map_repository.dart';
import 'package:hanguk_app/features/map/domain/university.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

/// A university carrying only the fields named — everything else absent, so a
/// test can build a pair whose available fields do not overlap.
University _uni(
  String id, {
  required String name,
  String? city,
  int? tier,
  String? ieqas,
  String? domain,
  bool partner = false,
}) {
  return University(
    id: id,
    name: name,
    // The repository substitutes this literal when `city_ko` is null, and
    // `hasRealCity` is what the screen keys off.
    location: city ?? University.unknownCity,
    nameKo: '대학',
    tier: tier,
    ieqasStatus: ieqas,
    isPartner: partner,
    primaryDomain: domain,
  );
}

Future<void> _pump(WidgetTester tester, List<University> catalogue) async {
  final container = ProviderContainer(
    overrides: [universitiesProvider.overrideWith((ref) async => catalogue)],
  );
  addTearDown(container.dispose);
  // `toggle` is the only way in, which is also how Explore fills the tray.
  for (final u in catalogue) {
    container.read(guestCompareProvider.notifier).toggle(u.id);
  }

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: GuestCompareScreen(onExplore: () {}, onJoin: () {}),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Labels are rendered once per column, so a field present in the schema shows
/// up exactly as many times as there are columns.
void main() {
  testWidgets('a field either side has appears in BOTH columns', (
    tester,
  ) async {
    await _pump(tester, [
      // Left: a tier, no accreditation.
      _uni('a', name: 'Alpha University', city: 'Seoul', tier: 1),
      // Right: accreditation, no tier.
      _uni('b', name: 'Beta University', city: 'Busan', ieqas: 'accredited'),
    ]);

    final l = AppLocalizations.of(
      tester.element(find.byType(GuestCompareScreen)),
    )!;

    // Both labels are in the schema because one side has each — and each label
    // is drawn in both columns, which is what puts them at the same height.
    expect(find.text(l.guestRowTier), findsNWidgets(2));
    expect(find.text(l.guestRowIeqas), findsNWidgets(2));
    expect(find.text(l.guestRowCity), findsNWidgets(2));
  });

  testWidgets('the column missing a value shows an em dash, not a gap', (
    tester,
  ) async {
    await _pump(tester, [
      _uni('a', name: 'Alpha University', city: 'Seoul', tier: 1),
      _uni('b', name: 'Beta University', city: 'Busan', ieqas: 'accredited'),
    ]);

    // Exactly two blanks: Alpha's missing IEQAS and Beta's missing tier.
    expect(find.text('—'), findsNWidgets(2));
    // The values that do exist are still rendered.
    expect(find.text('accredited'), findsOneWidget);
  });

  testWidgets('a field neither side has is left out entirely', (tester) async {
    await _pump(tester, [
      _uni('a', name: 'Alpha University', city: 'Seoul'),
      _uni('b', name: 'Beta University', city: 'Busan'),
    ]);

    final l = AppLocalizations.of(
      tester.element(find.byType(GuestCompareScreen)),
    )!;

    // Neither has a tier, accreditation, partnership or domain, so those rows
    // are absent rather than four em dashes down both columns.
    expect(find.text(l.guestRowTier), findsNothing);
    expect(find.text(l.guestRowIeqas), findsNothing);
    expect(find.text(l.guestRowPartner), findsNothing);
    expect(find.text(l.guestRowWebsite), findsNothing);
    expect(find.text('—'), findsNothing);
    // City is on both, so it survives.
    expect(find.text(l.guestRowCity), findsNWidgets(2));
  });

  testWidgets('one university alone still renders its own fields', (
    tester,
  ) async {
    await _pump(tester, [
      _uni('a', name: 'Alpha University', city: 'Seoul', tier: 1),
    ]);

    final l = AppLocalizations.of(
      tester.element(find.byType(GuestCompareScreen)),
    )!;

    // The empty slot is not a column of dashes — the schema comes from the one
    // pick, and the other side is the "add from Explore" placeholder.
    expect(find.text(l.guestRowTier), findsOneWidget);
    expect(find.text(l.guestCompareEmptySlot), findsOneWidget);
    expect(find.text('—'), findsNothing);
  });
}

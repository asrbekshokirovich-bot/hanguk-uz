// Compare shows what a student actually chooses on: the fee, the application
// window, the document deadline, the TOPIK floor, English and the interview.
//
// Read off `v_institutions_for_map` none of those exist, so the screen used to
// compare city, tier, IEQAS accreditation, partner status and a domain name —
// five rows, none of which decides where anyone applies. They live in the
// approved review, which `approvedCatalogueProvider` now carries alongside the
// list.
//
// These pin the rendering rules that are judgement calls rather than plumbing:
// which absent values are allowed to say "no", how a fee from a different
// academic year is labelled, and that a row still disappears when neither
// university has it.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/guest/data/guest_compare_provider.dart';
import 'package:hanguk_app/features/guest/presentation/guest_compare_screen.dart';
import 'package:hanguk_app/features/map/domain/university.dart';
import 'package:hanguk_app/features/uni_db/data/approved_universities_provider.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

University _uni(String id, String name) =>
    University(id: id, name: name, location: 'Seoul', nameKo: '대학');

Future<AppLocalizations> _pump(
  WidgetTester tester,
  Map<String, ApprovedAdmission> details,
) async {
  final unis = [
    for (final id in details.keys) _uni(id, 'University $id'),
  ];
  final container = ProviderContainer(
    overrides: [
      approvedCatalogueProvider.overrideWith(
        (ref) async => ApprovedCatalogue(universities: unis, details: details),
      ),
    ],
  );
  addTearDown(container.dispose);
  for (final u in unis) {
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

  return AppLocalizations.of(
    tester.element(find.byType(GuestCompareScreen)),
  )!;
}

void main() {
  testWidgets('the fee, window, deadline and language bar all render', (
    tester,
  ) async {
    final l = await _pump(tester, {
      'a': const ApprovedAdmission(
        intakeYear: 2027,
        tuitionMinKrw: 3169000,
        tuitionMaxKrw: 3295000,
        tuitionAcademicYear: 2027,
        applicationStart: '2026-11-10',
        applicationEnd: '2026-12-05',
        documentDeadline: '2027-01-21',
        topikMinLevel: 3,
        englishAccepted: true,
        interviewRequired: true,
        requiredDocumentCount: 13,
      ),
    });

    expect(find.text('3,169,000–3,295,000 ₩'), findsOneWidget);
    expect(find.text('2026-11-10 → 2026-12-05'), findsOneWidget);
    expect(find.text('2027-01-21'), findsOneWidget);
    expect(find.text('≥ 3'), findsOneWidget);
    expect(find.text(l.guestDocumentsCount(13)), findsOneWidget);
  });

  testWidgets('a single-value fee is not rendered as a range', (tester) async {
    await _pump(tester, {
      'a': const ApprovedAdmission(
        intakeYear: 2027,
        tuitionMinKrw: 5124000,
        tuitionMaxKrw: 5124000,
        tuitionAcademicYear: 2027,
      ),
    });

    expect(find.text('5,124,000 ₩'), findsOneWidget);
    expect(find.textContaining('–'), findsNothing);
  });

  testWidgets("a fee from another year says which year it is", (tester) async {
    // The common case: Korean guidelines quote the current year's fees, so
    // every fee in the catalogue today is 2026 while most intakes are 2027.
    // Unlabelled, last year's number passes as the one the student will pay.
    final l = await _pump(tester, {
      'a': const ApprovedAdmission(
        intakeYear: 2027,
        tuitionMinKrw: 5124000,
        tuitionAcademicYear: 2026,
      ),
    });

    expect(
      find.text('5,124,000 ₩ · ${l.guestTuitionYearNote(2026)}'),
      findsOneWidget,
    );
  });

  testWidgets('an apostille requirement rides along with the count', (
    tester,
  ) async {
    // It decides whether assembling the file takes a week or a month.
    final l = await _pump(tester, {
      'a': const ApprovedAdmission(
        intakeYear: 2027,
        requiredDocumentCount: 13,
        apostilleRequired: true,
      ),
    });

    expect(
      find.text('${l.guestDocumentsCount(13)} · ${l.guestApostilleShort}'),
      findsOneWidget,
    );
  });

  testWidgets('no interview is stated; no English test is not', (tester) async {
    // Asymmetric on purpose. The review does say when there is no interview,
    // and for a student weighing two schools that is worth as much as a yes.
    // `englishAccepted: false` only means no English test is NAMED in the
    // requirements — printing "No" under "English" would state a refusal the
    // review never made.
    final l = await _pump(tester, {
      'a': const ApprovedAdmission(
        intakeYear: 2027,
        interviewRequired: false,
        englishAccepted: false,
      ),
    });

    expect(find.text(l.guestRowInterview), findsOneWidget);
    expect(find.text(l.guestValueNo), findsOneWidget);
    expect(find.text(l.guestRowEnglish), findsNothing);
  });

  testWidgets('a half-open application window shows the half we know', (
    tester,
  ) async {
    // An open end is not the same as no window.
    await _pump(tester, {
      'a': const ApprovedAdmission(
        intakeYear: 2027,
        applicationStart: '2026-11-10',
      ),
    });

    expect(find.text('2026-11-10 → —'), findsOneWidget);
  });

  testWidgets('a row neither university has is left out entirely', (
    tester,
  ) async {
    final l = await _pump(tester, {
      'a': const ApprovedAdmission(intakeYear: 2027, topikMinLevel: 3),
      'b': const ApprovedAdmission(intakeYear: 2027, topikMinLevel: 4),
    });

    // Both have TOPIK, so it is drawn once per column…
    expect(find.text(l.guestRowTopik), findsNWidgets(2));
    // …and nobody has a fee or a deadline, so those labels never appear.
    expect(find.text(l.guestRowTuition), findsNothing);
    expect(find.text(l.guestRowDocDeadline), findsNothing);
  });

  testWidgets('one side missing a field still lines the rows up', (
    tester,
  ) async {
    final l = await _pump(tester, {
      'a': const ApprovedAdmission(intakeYear: 2027, topikMinLevel: 3),
      'b': const ApprovedAdmission(intakeYear: 2027, requiredDocumentCount: 5),
    });

    // Each label is drawn in BOTH columns — that is what puts them at the same
    // height — and the column without the value renders an em dash.
    expect(find.text(l.guestRowTopik), findsNWidgets(2));
    expect(find.text(l.guestRowDocuments), findsNWidgets(2));
    expect(find.text('—'), findsNWidgets(2));
  });
}

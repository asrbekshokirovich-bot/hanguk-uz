import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/assessment/data/admission_tests_repository.dart';
import 'package:hanguk_app/features/assessment/domain/admission_tests.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/discover/data/application_windows.dart';
import 'package:hanguk_app/features/discover/data/grant_tiers.dart';
import 'package:hanguk_app/features/discover/presentation/university_assess_screen.dart';
import 'package:hanguk_app/features/discover/presentation/university_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

final _rows = [
  {
    'is_partner': false,
    'guideline_id': 'g1',
    'institution_id': 'u1',
    'name_ko': '선문대학교',
    'name_en': 'Sun Moon University',
    'institution_type': 'private',
    'univ_nomi_en': 'Sun Moon University',
    'shahar': 'Asan',
    'qabul_yili': 2027,
    'semestr': 'bahor',
    'daraja': 'bakalavr',
    'english_track': false,
    'topik_min': 2,
    'narx_valyuta': 'KRW',
    'kontrakt_min': 1900000,
    'kontrakt_max': 1900000,
    'kontrakt_davri': 'semestr',
  },
];

final _grants = {
  'g1': [
    {'mezon': 'TOPIK', 'topik_min': null, 'topik_max': null, 'grant_sum': 1000000},
    {'mezon': 'TOPIK', 'topik_min': 3, 'topik_max': 3, 'grant_pct': 50},
    {'mezon': 'TOPIK', 'topik_min': 4, 'topik_max': null, 'grant_pct': 70},
    {'mezon': 'IELTS yoki TOEFL', 'ielts_min': 5.5, 'toefl_ibt_min': 71, 'grant_pct': 30},
  ],
};

Future<AppLocalizations> _pump(WidgetTester t, Widget home, {AdmissionTests? tests}) async {
  t.view.physicalSize = const Size(390 * 3, 3000 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  await t.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
      overrides: [
        catalogProvider.overrideWith((ref) async => groupCatalogRows(_rows)),
        applicationWindowsProvider.overrideWith((ref) async => const {}),
        admissionTestsProvider.overrideWith((ref) async => tests == null ? const {} : {'u1': tests}),
        universityGrantsProvider.overrideWith(
          (ref, id) async => [for (final r in _grants[id] ?? const <Map<String, dynamic>>[]) GrantTier.fromRow(r)],
        ),
      ],
      child: MaterialApp(
        locale: const Locale('uz'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: home,
      ),
    ),
  );
  await t.pump(const Duration(milliseconds: 300));
  return AppLocalizations.delegate.load(const Locale('uz'));
}

void main() {
  testWidgets('the page as before with its grants, and under it the question that opens the assessment', (t) async {
    final l = await _pump(t, const UniversityScreen(institutionId: 'u1'));
    // No admission / visa percents on the page any more.
    expect(find.text(l.fdUniAdmissionLabel), findsNothing);
    // The grant table: each TOPIK / IELTS result and what it takes off.
    await t.pump();
    expect(find.text(l.ugTitle), findsOneWidget);
    expect(find.text(l.ugNoCertificate), findsOneWidget);
    expect(find.text('TOPIK 3'), findsOneWidget);
    expect(find.text('50%'), findsOneWidget);
    expect(find.text('TOPIK 4+'), findsOneWidget);
    expect(find.text('70%'), findsOneWidget);
    expect(find.text('IELTS 5.5+ / TOEFL 71+'), findsOneWidget);
    expect(find.text(l.fdCellLanguage), findsOneWidget);
    expect(find.text(l.uaAskTitle), findsOneWidget);
    expect(find.text(l.uaAskStart), findsOneWidget);
  });

  testWidgets('each answer says what it does to this university', (t) async {
    final l = await _pump(t, const UniversityAssessScreen(institutionId: 'u1'));
    expect(find.text(l.uaQTopik), findsOneWidget);
    // TOPIK 2 meets the requirement: the answer raises admission.
    await t.tap(find.text('2').first);
    await t.pump();
    expect(find.text(l.uaImpactUp(40)), findsWidgets);
    // An expired certificate counts as no TOPIK.
    await t.tap(find.text(l.uaCertOld));
    await t.pump();
    expect(find.text(l.uaImpactDown(40)), findsOneWidget);
    expect(find.text(l.uaAccuracyLow), findsOneWidget);
  });

  testWidgets('a test taken shows its score instead of Boshlash', (t) async {
    final l = await _pump(
      t,
      const UniversityAssessScreen(institutionId: 'u1'),
      tests: const AdmissionTests(studyPlan: 70, interview: 80, studyPlanAttempts: 1, interviewAttempts: 1),
    );
    expect(find.text(l.uaTestStart), findsNothing);
    expect(find.text(l.uaTestScore(70)), findsOneWidget);
    expect(find.text(l.uaTestScore(80)), findsOneWidget);
    expect(find.text(l.uaAccuracyHigh), findsOneWidget);
  });
}

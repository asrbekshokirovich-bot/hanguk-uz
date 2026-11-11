// Hisobot ekrani testga javob berilmaguncha foiz ko'rsatmaydi (Asrbek,
// 2026-11-11): boshlang'ich qiymatlardan (19 yosh, attestat 4…) chiqqan
// raqamlar mijozning natijasi emas.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/features/assessment/data/assessment_controller.dart';
import 'package:hanguk_app/features/assessment/presentation/report_screen.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

Future<(ProviderContainer, AppLocalizations)> _pump(WidgetTester t) async {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
    (call) async => null,
  );
  final container = ProviderContainer(
    overrides: [
      catalogProvider.overrideWith((ref) async => const []),
      eligibilityRulesProvider.overrideWith((ref) async => const EligibilityRules()),
    ],
  );
  addTearDown(container.dispose);
  await container.read(catalogProvider.future);
  const locale = Locale('uz');
  await t.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.materialTheme,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ReportScreen(),
      ),
    ),
  );
  await t.pump();
  return (container, await AppLocalizations.delegate.load(locale));
}

void main() {
  testWidgets('nothing answered: the report asks for the test, no percentages', (t) async {
    final (_, l) = await _pump(t);
    expect(find.text(l.fdReportFillFirst), findsOneWidget);
    expect(find.text(l.fdReportFillFirstCta), findsOneWidget);
    expect(find.text(l.fdReportCta), findsOneWidget);
    expect(find.text(l.fdReportVisaCard), findsNothing);
    expect(find.text(l.fdReportBestAdmission), findsNothing);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets('once something is answered, the report shows the figures', (t) async {
    final (container, l) = await _pump(t);
    container.read(assessmentTouchedProvider.notifier).mark();
    await t.pump();
    expect(find.text(l.fdReportFillFirst), findsNothing);
    expect(find.text(l.fdReportBestAdmission), findsOneWidget);
    await t.pumpWidget(const SizedBox());
  });
}

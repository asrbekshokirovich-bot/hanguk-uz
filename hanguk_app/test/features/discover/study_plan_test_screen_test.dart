import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/presentation/study_plan_test_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

final _uni = CatalogUniversity(
  institutionId: 'u1',
  guidelines: [
    CatalogGuideline(
      id: 'g-u1',
      institutionId: 'u1',
      univNameEn: 'Sun Moon University',
      nameKoShort: '선문대',
      city: 'Asan',
      degree: 'bakalavr',
    ),
  ],
);

void main() {
  testWidgets('the one try is not spent on an empty form', (t) async {
    var sent = 0;
    await t.pumpWidget(
      MaterialApp(
        locale: const Locale('uz'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: Scaffold(
          body: StudyPlanTestScreen(
            university: _uni,
            send: (answers, seconds) async {
              sent++;
              return StudyPlanTestResult.fromJson(const {'score': 55});
            },
          ),
        ),
      ),
    );
    await t.pump();
    final l = await AppLocalizations.delegate.load(const Locale('uz'));

    HardButton submit() => t.widget<HardButton>(find.widgetWithText(HardButton, l.sptSubmit));

    // Nothing written: the button does nothing.
    expect(submit().onPressed, isNull);

    await t.enterText(find.byType(TextField).first, 'Kompyuter injiniringini o\'rganmoqchiman');
    await t.pump();
    expect(submit().onPressed, isNotNull);

    await t.tap(find.widgetWithText(HardButton, l.sptSubmit));
    await t.pump();
    await t.pump();
    expect(sent, 1);
  });
}

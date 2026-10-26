// Text typed into a field must be visible.
//
// After #432 turned the page dark blue, the Study Plan box kept the page's
// colour as its background and ink as its text — dark on dark, so students
// typed their plan and saw nothing. The "change university" note field had
// the opposite fault: a white fill with no text style, so it took the app
// theme's white body text. These tests pump the real widgets under the real
// app theme and measure the painted colours.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/design_system/seoul_night/widgets/fd_kit.dart';
import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/features/training/presentation/study_plan_builder_screen.dart';
import 'package:hanguk_app/features/university_choices/presentation/university_choices_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

import '../../helpers/contrast.dart';

/// The app's own theme on the app's own page colour, as the screens see them.
Widget _onPage(Widget child) => MaterialApp(
      theme: AppTheme.materialTheme,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: FdColors.page,
        body: SingleChildScrollView(child: child),
      ),
    );

void main() {
  group('palette', () {
    test('ink is readable on a white card', () {
      expect(contrastRatio(FdColors.ink, FdColors.card), greaterThanOrEqualTo(4.5));
      expect(contrastRatio(FdColors.muted, FdColors.card), greaterThanOrEqualTo(4.5));
    });

    test('onPage is readable on the page', () {
      expect(contrastRatio(FdColors.onPage, FdColors.page), greaterThanOrEqualTo(4.5));
    });

    test('ink is NOT readable on the page — never put ink text straight on it', () {
      expect(contrastRatio(FdColors.ink, FdColors.page), lessThan(1.5));
    });
  });

  testWidgets('Study Plan box: typed text and caret are visible', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_onPage(
      StudyPlanField(controller: controller, hint: 'Write your plan', onChanged: () {}),
    ));

    final field = find.byType(TextField);
    await tester.enterText(field, 'I want to study computer science in Seoul.');
    await tester.pump();

    expect(find.text('I want to study computer science in Seoul.'), findsOneWidget);
    expectReadableTextField(tester, field);

    final hint = tester.widget<TextField>(field).decoration!.hintStyle!.color!;
    expect(contrastRatio(hint, backgroundBehind(tester, field)!), greaterThanOrEqualTo(3.0));
  });

  testWidgets('Change-university note: typed text is visible', (tester) async {
    await tester.pumpWidget(_onPage(const ChangeRequestSheet(universityName: 'Hongik University')));
    await tester.pump();

    final field = find.byType(TextField);
    await tester.enterText(field, 'The city is too far from my relatives.');
    await tester.pump();

    expectReadableTextField(tester, field);
  });
}

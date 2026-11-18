import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/features/employer/language.dart';
import 'package:hanguk_ish/features/employer/login/ba0_profile_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

void main() {
  setUpAll(loadHiFonts);

  testWidgets('a first launch asks the language, then opens the sign-in', (tester) async {
    usePhone(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: [employerAskLanguageProvider.overrideWithValue(true)],
      child: const EmployerApp(),
    ));
    await tester.pumpAndSettle();
    for (final label in ["O'zbekcha", 'Русский', 'English', '한국어']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    await tester.tap(find.text("O'zbekcha"));
    await tester.pumpAndSettle();
    expect(find.text('Davom etish'), findsOneWidget);
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();
    // BA0, now in the chosen language.
    expect(find.text('Davom etish'), findsNothing); // not the welcome screen any more
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('the business profile needs a name and hands the choices over', (tester) async {
    usePhone(tester);
    
    (String, BusinessCategory, String, String)? saved;
    await tester.pumpWidget(MaterialApp(
      home: Ba0ProfileScreen(onSave: (n, c, a, d) async => saved = (n, c, a, d)),
    ));
    await tester.tap(find.text(Ba0ProfileScreen.text('save')));
    await tester.pump();
    expect(saved, isNull);
    expect(find.text(Ba0ProfileScreen.text('needName')), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, '달빛카페');
    await tester.tap(find.text(Ba0ProfileScreen.text('restaurant')));
    await tester.tap(find.text(Ba0ProfileScreen.text('save')));
    await tester.pump();
    expect(saved, ('달빛카페', BusinessCategory.restaurant, '', ''));
  });
}

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/design/widgets/controls.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

void main() {
  setUpAll(loadHiFonts);

  Future<ProviderContainer> pumpApp(WidgetTester tester, {TestPhone phone = TestPhone.prototype}) async {
    usePhone(tester, phone);
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const WorkerApp()));
    await tester.pumpAndSettle();
    return container;
  }

  HiButton button(WidgetTester tester, String label) =>
      tester.widget<HiButton>(find.widgetWithText(HiButton, label));

  testWidgets('opens on A01 in Uzbek with the prototype texts', (tester) async {
    await pumpApp(tester);
    expect(find.text('Hanguk Ish'), findsOneWidget);
    expect(find.text('Koreyada kunlik va qisqa smenali ishlar'), findsOneWidget);
    expect(find.text('Ilova tili'), findsOneWidget);
    for (final label in ["O'zbekcha", 'Русский', 'English', '한국어']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('Telefon raqam bilan'), findsOneWidget);
    expect(find.text('Telegram bilan'), findsOneWidget);
    final selected = tester.widgetList<HiOptionTile>(find.byType(HiOptionTile)).where((t) => t.selected);
    expect(selected.map((t) => t.label), ["O'zbekcha"]);
  });

  testWidgets('choosing a language switches the whole screen', (tester) async {
    final container = await pumpApp(tester);
    final expected = {
      'Русский': ('Язык приложения', 'По номеру телефона'),
      'English': ('App language', 'Continue with phone'),
      '한국어': ('앱 언어', '휴대폰 번호로 시작'),
      "O'zbekcha": ('Ilova tili', 'Telefon raqam bilan'),
    };
    for (final MapEntry(key: label, value: texts) in expected.entries) {
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      expect(find.text(texts.$1), findsOneWidget, reason: label);
      expect(find.text(texts.$2), findsOneWidget, reason: label);
      expect(container.read(appLanguageProvider).label, label);
    }
  });

  testWidgets('sign-in buttons work only while the terms box is ticked', (tester) async {
    await pumpApp(tester);
    expect(button(tester, 'Telefon raqam bilan').onPressed, isNotNull);
    expect(tester.widget<HiCheckbox>(find.byType(HiCheckbox)).value, isTrue);

    await tester.tap(find.byType(HiCheckbox));
    await tester.pumpAndSettle();
    expect(tester.widget<HiCheckbox>(find.byType(HiCheckbox)).value, isFalse);
    expect(button(tester, 'Telefon raqam bilan').onPressed, isNull);
    expect(button(tester, 'Telegram bilan').onPressed, isNull);

    await tester.tap(find.byType(HiCheckbox));
    await tester.pumpAndSettle();
    expect(button(tester, 'Telefon raqam bilan').onPressed, isNotNull);
    expect(button(tester, 'Telegram bilan').onPressed, isNotNull);
  });

  for (final phone in [TestPhone.android, TestPhone.small]) {
    testWidgets('fits a ${phone.name} screen without overflow', (tester) async {
      await pumpApp(tester, phone: phone);
      expect(tester.takeException(), isNull);
      // The main action stays reachable (scrolled into view on short screens).
      await tester.ensureVisible(find.text('Telegram bilan'));
      await tester.pumpAndSettle();
      expect(find.text('Telegram bilan').hitTestable(), findsOneWidget);
    });
  }
}

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/design/widgets/forms.dart';
import 'package:hanguk_ish/features/worker/profile/profile_screens.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

/// A tiny valid PNG, for the photo picker.
final _png = <int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0xF0,
  0x1F, 0x00, 0x05, 0x00, 0x01, 0xFF, 0x89, 0x99, 0x3D, 0x1D, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
];

void main() {
  setUpAll(loadHiFonts);

  HiButton action(WidgetTester tester, String label) =>
      tester.widget<HiButton>(find.widgetWithText(HiButton, label));

  testWidgets('A01 → A02 1/3 → 2/3 → 3/3 → saved → home', (tester) async {
    usePhone(tester);
    final repo = InMemoryWorkerProfileRepository();
    final photo = File('${Directory.systemTemp.createTempSync('ish').path}/face.png')..writeAsBytesSync(_png);
    final container = ProviderContainer(overrides: [
      workerProfileRepositoryProvider.overrideWithValue(repo),
      photoPickerProvider.overrideWithValue((source) async => photo.path),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const WorkerApp()));
    await tester.pumpAndSettle();

    // A01 → T1 → T2 (demo: any six digits)
    await tester.tap(find.text('Telefon raqam bilan'));
    await tester.pumpAndSettle();
    expect(find.text('Telefon raqamingiz'), findsOneWidget);
    expect(action(tester, 'Kod olish').onPressed, isNull, reason: 'a whole number first');
    await tester.enterText(find.byType(TextField), '01012345678');
    await tester.pumpAndSettle();
    expect(find.text('010-1234-5678'), findsOneWidget);
    await tester.tap(find.text('Kod olish'));
    await tester.pumpAndSettle();
    expect(find.text('Kodni kiriting'), findsOneWidget);
    expect(find.text('010-1234-5678 raqamiga SMS yuborildi.'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();

    // A02 1/3
    expect(find.text('Profil · 1 / 3'), findsOneWidget);
    expect(find.text('Ism va rasm'), findsOneWidget);
    expect(action(tester, 'Davom etish').onPressed, isNull, reason: 'names are required');
    await tester.tap(find.text('Rasm yuklash'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Galereyadan tanlash'));
    await tester.pumpAndSettle();
    expect(container.read(workerProfileDraftProvider).photoPath, photo.path);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'Aziz');
    await tester.enterText(fields.at(1), 'Karimov');
    await tester.pumpAndSettle();
    expect(action(tester, 'Davom etish').onPressed, isNotNull);
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // A02 2/3
    expect(find.text('Profil · 2 / 3'), findsOneWidget);
    expect(action(tester, 'Davom etish').onPressed, isNull, reason: 'a language and a district are required');
    await tester.tap(find.text("O'zbekcha"));
    await tester.tap(find.text('Koreyscha'));
    await tester.tap(find.text('4'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(HiSelectField).at(1));
    await tester.pumpAndSettle();
    // The list is long; search narrows it.
    await tester.enterText(find.byType(TextField).last, 'Mapo');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mapo-gu, Seul'));
    await tester.pumpAndSettle();
    expect(find.text('Mapo-gu, Seul'), findsOneWidget);
    // University: typed text not in the list can be chosen too.
    await tester.tap(find.byType(HiSelectField).at(0));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Busan University');
    await tester.pumpAndSettle();
    await tester.tap(find.text('«Busan University» ni tanlash'));
    await tester.pumpAndSettle();
    expect(find.text('Busan University'), findsOneWidget);
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();

    // A02 3/3
    expect(find.text('Profil · 3 / 3'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Shanba, Ertalab'));
    await tester.tap(find.text('D-4'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Saqlash va boshlash'));
    await tester.tap(find.text('Saqlash va boshlash'));
    await tester.pumpAndSettle();

    final saved = await repo.load();
    expect(saved, isNotNull);
    expect(saved!.firstName, 'Aziz');
    expect(saved.lastName, 'Karimov');
    expect(saved.languages, {'uz', 'ko'});
    expect(saved.topik, 4);
    expect(saved.district, 'mapo');
    expect(saved.university, 'Busan University');
    expect(saved.isAvailable(5, 0), isTrue);
    expect(saved.availability, WorkerProfileDraft.bit(5, 0));
    expect(saved.visa, 'D-4');
    expect(find.text('Profil · 3 / 3'), findsNothing, reason: 'moved on to the home screen');
  });

  testWidgets('visa is optional: tapping the chosen one clears it', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final c = container.read(workerProfileDraftProvider.notifier);
    c.toggleVisa('D-2');
    expect(container.read(workerProfileDraftProvider).visa, 'D-2');
    c.toggleVisa('D-2');
    expect(container.read(workerProfileDraftProvider).visa, isNull);
  });

  test('availability bits match the database layout (day * 4 + slot)', () {
    expect(WorkerProfileDraft.bit(0, 0), 1);
    expect(WorkerProfileDraft.bit(0, 3), 8);
    expect(WorkerProfileDraft.bit(6, 3), 1 << 27);
    expect(const WorkerProfileDraft(availability: 268435455).isAvailable(6, 3), isTrue);
  });
}

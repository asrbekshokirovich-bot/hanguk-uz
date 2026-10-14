import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/data/application_windows.dart';
import 'package:hanguk_app/features/discover/data/deck_hint.dart';
import 'package:hanguk_app/features/discover/data/saved_universities.dart';
import 'package:hanguk_app/features/discover/presentation/discover_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

CatalogUniversity uni(String id) => CatalogUniversity(
  institutionId: id,
  guidelines: [
    CatalogGuideline(
      id: 'g-$id',
      institutionId: id,
      univNameEn: '$id University',
      nameKoShort: '$id대',
      city: 'Daegu',
      degree: 'bakalavr',
    ),
  ],
);

/// A visitor who has never swiped.
class _Fresh extends DeckHintNotifier {
  @override
  bool? build() => false;
}

/// Someone who already swiped.
class _Seen extends DeckHintNotifier {
  @override
  bool? build() => true;
}

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  Future<ProviderContainer> pump(WidgetTester t, {bool fresh = false}) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final c = ProviderContainer(
      overrides: [
        catalogProvider.overrideWith((ref) async => [uni('Alpha'), uni('Beta'), uni('Gamma')]),
        applicationWindowsProvider.overrideWith((ref) async => const {}),
        deckHintProvider.overrideWith(fresh ? _Fresh.new : _Seen.new),
      ],
    );
    addTearDown(c.dispose);
    await c.read(catalogProvider.future);
    await t.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: const MaterialApp(
          locale: Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(body: DiscoverScreen()),
        ),
      ),
    );
    await t.pump();
    return c;
  }

  testWidgets('the next university waits behind the top card', (t) async {
    await pump(t);
    expect(find.text('Alpha University'), findsOneWidget);
    expect(find.text('Beta University'), findsOneWidget);
    expect(find.text('1 / 3'), findsOneWidget);
  });

  testWidgets('✕ throws the card; the one behind takes its place', (t) async {
    final c = await pump(t);
    await t.tap(find.bySemanticsLabel(RegExp("O'tkazib")).first);
    // Mid-throw nothing has moved on yet.
    await t.pump(const Duration(milliseconds: 150));
    expect(find.text('1 / 3'), findsOneWidget);
    await t.pumpAndSettle();
    expect(find.text('2 / 3'), findsOneWidget);
    expect(find.text('Gamma University'), findsOneWidget, reason: 'the new one behind');
    expect(c.read(savedUniversitiesProvider), isEmpty);
  });

  testWidgets('a swipe right saves', (t) async {
    final c = await pump(t);
    await t.drag(find.text('Alpha University'), const Offset(260, 0));
    await t.pumpAndSettle();
    expect(c.read(savedUniversitiesProvider), ['Alpha']);
    expect(find.text('2 / 3'), findsOneWidget);
  });

  testWidgets('a short drag springs back', (t) async {
    final c = await pump(t);
    await t.drag(find.text('Alpha University'), const Offset(40, 0));
    await t.pumpAndSettle();
    expect(find.text('1 / 3'), findsOneWidget);
    expect(c.read(savedUniversitiesProvider), isEmpty);
  });

  testWidgets('a first-time visitor is shown that the stack swipes', (t) async {
    final c = await pump(t, fresh: true);
    expect(find.text("Surib ko'ring"), findsOneWidget);
    // The card nudges to a side on its own.
    final start = t.getTopLeft(find.text('Alpha University').first).dx;
    await t.pump(const Duration(milliseconds: 1200));
    expect(t.getTopLeft(find.text('Alpha University').first).dx, isNot(closeTo(start, 1)));
    // The first swipe ends the hint for good.
    await t.drag(find.text('Alpha University').first, const Offset(40, 0));
    await t.pumpAndSettle();
    expect(c.read(deckHintProvider), isTrue);
    expect(find.text("Surib ko'ring"), findsNothing);
  });

  testWidgets('no hint for someone who already swiped', (t) async {
    await pump(t);
    expect(find.text("Surib ko'ring"), findsNothing);
  });

  testWidgets('nothing saved: no pull-up sheet', (t) async {
    await pump(t);
    expect(find.textContaining('tepaga torting'), findsNothing);
  });

  testWidgets('saved ones wait in a thin sheet that opens to the full list; the page stays', (t) async {
    final c = await pump(t);
    c.read(savedUniversitiesProvider.notifier).save('Gamma');
    c.read(savedUniversitiesProvider.notifier).save('Beta');
    await t.pump();
    expect(find.text('2 ta saqlangan · tepaga torting'), findsOneWidget);

    await t.tap(find.text('2 ta saqlangan · tepaga torting'));
    await t.pumpAndSettle();
    expect(find.text('2 ta saqlangan · tepaga torting'), findsNothing);
    expect(find.text('Gamma University'), findsWidgets);
    expect(find.bySemanticsLabel('Yopish'), findsOneWidget);

    await t.tap(find.bySemanticsLabel('Yopish'));
    await t.pumpAndSettle();
    expect(find.text('2 ta saqlangan · tepaga torting'), findsOneWidget);
    // The page itself never left.
    expect(find.text('1 / 3'), findsOneWidget);
  });
}

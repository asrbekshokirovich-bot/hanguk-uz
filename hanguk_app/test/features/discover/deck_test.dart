import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/data/application_windows.dart';
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

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  Future<ProviderContainer> pump(WidgetTester t) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final c = ProviderContainer(
      overrides: [
        catalogProvider.overrideWith((ref) async => [uni('Alpha'), uni('Beta'), uni('Gamma')]),
        applicationWindowsProvider.overrideWith((ref) async => const {}),
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
}

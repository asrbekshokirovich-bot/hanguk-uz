import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/features/assessment/data/assessment_controller.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/discover/presentation/visa_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 10; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  final stored = <String, String>{};
  setUp(() {
    stored.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        final args = (call.arguments as Map?) ?? const {};
        final key = args['key'] as String?;
        switch (call.method) {
          case 'read':
            return stored[key];
          case 'write':
            stored[key!] = args['value'] as String;
        }
        return null;
      },
    );
  });

  Future<(AppLocalizations, ProviderContainer)> pump(WidgetTester t) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final c = ProviderContainer(overrides: [catalogProvider.overrideWith((ref) async => const [])]);
    addTearDown(c.dispose);
    await t.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: MaterialApp(
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: const VisaScreen(),
        ),
      ),
    );
    await t.pump();
    await t.pump(const Duration(milliseconds: 100));
    return (await AppLocalizations.delegate.load(const Locale('uz')), c);
  }

  testWidgets('first visit: the tour runs by itself, a tap moves it on, ▷ runs it again', (t) async {
    final (l, _) = await pump(t);
    expect(find.text(l.vzTourGauge), findsOneWidget);
    // Three seconds a step.
    await t.pump(const Duration(seconds: 3));
    await settle(t);
    expect(find.text(l.vzTourEducation), findsOneWidget);
    for (var i = 0; i < 6; i++) {
      await t.tapAt(const Offset(10, 400));
      // A step further down the lazy list scrolls a while before it is lit.
      await settle(t);
      await settle(t);
    }
    expect(find.text(l.vzTourGauge), findsNothing);
    expect(stored['visa_tour_seen_v1'], '1');
    await t.tap(find.bySemanticsLabel(l.vzTourReplay));
    await settle(t);
    expect(find.text(l.vzTourGauge), findsOneWidget);
  });

  testWidgets('answers move the dial; Tozalash puts them back', (t) async {
    stored['visa_tour_seen_v1'] = '1';
    final tracked = <(String, Map<String, Object?>?)>[];
    AppEvents.debugOnTrack = (event, screen, props) => tracked.add((event, props));
    addTearDown(() => AppEvents.debugOnTrack = null);
    final (l, c) = await pump(t);
    expect(find.text(l.vzTourGauge), findsNothing);
    final before = c.read(assessmentProvider);
    await t.scrollUntilVisible(find.text(l.vzSponsorParents), 300);
    await t.ensureVisible(find.text(l.vzSponsorParents));
    await settle(t);
    await t.tap(find.text(l.vzSponsorParents));
    await settle(t);
    expect(c.read(assessmentProvider).sponsor, 1);
    expect(find.text(l.uaVisaUp(4)), findsWidgets);
    // The first answer of the visit starts the assessment, once.
    final starts = tracked.where((e) => e.$1 == 'assessment_start').toList();
    expect(starts, hasLength(1));
    expect(starts.single.$2?['kind'], 'visa');
    await t.tap(find.text(l.catalogFilterClear));
    await settle(t);
    expect(c.read(assessmentProvider).sponsor, before.sponsor);
  });
}

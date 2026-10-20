import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/assessment/data/assessment_controller.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/discover/data/board_tour.dart';
import 'package:hanguk_app/features/discover/presentation/filter_board_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

/// The home board's first-run tour (design 12a–12d).
class _Fresh extends BoardTourNotifier {
  @override
  bool? build() => false;
}

class _Seen extends BoardTourNotifier {
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

  Future<ProviderContainer> pump(WidgetTester t, {required bool fresh}) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final container = ProviderContainer(
      overrides: [
        boardTourProvider.overrideWith(fresh ? _Fresh.new : _Seen.new),
        catalogProvider.overrideWith((ref) async => const []),
      ],
    );
    addTearDown(container.dispose);
    await t.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const Scaffold(body: FilterBoardScreen(showBack: false)),
        ),
      ),
    );
    await t.pumpAndSettle();
    return container;
  }

  testWidgets('a first visit lights the twelve places in turn, three seconds each, then ends', (t) async {
    final c = await pump(t, fresh: true);
    const labels = [
      'Mos universitetlar',
      'Viza imkoningiz',
      'Sizga mos universitetlar',
      "Yo'nalishni tanlang",
      'Qaysi shahar?',
      'Qaysi daraja?',
      'Koreys tili darajangiz',
      'IELTS balingiz',
      'Kontrakt narxi',
      'Davlat yoki xususiy',
      'Grant kerakmi?',
      "Ro'yxatni ko'rish",
    ];
    // No buttons: it moves on by itself.
    expect(find.textContaining('Keyingi'), findsNothing);
    for (var i = 0; i < labels.length; i++) {
      expect(find.text(labels[i]), findsOneWidget, reason: 'step ${i + 1}');
      if (i > 0) expect(find.text(labels[i - 1]), findsNothing);
      await t.pump(const Duration(seconds: 3));
      await t.pumpAndSettle();
    }
    expect(find.text("Ro'yxatni ko'rish"), findsNothing);
    expect(c.read(boardTourProvider), isTrue);
  });

  testWidgets('the lit section stays usable: a field can be picked while it is lit', (t) async {
    final c = await pump(t, fresh: true);
    for (var i = 0; i < 3; i++) {
      await t.pump(const Duration(seconds: 3));
      await t.pumpAndSettle();
    }
    expect(find.text("Yo'nalishni tanlang"), findsOneWidget);
    await t.tap(find.text('Biznes'), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(c.read(catalogFilterProvider).field, 'business');
    // A touch outside the lit section does nothing.
    await t.tap(find.text('Seul'), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(c.read(catalogFilterProvider).regions, isEmpty);
    await t.pump(const Duration(seconds: 30));
    await t.pumpAndSettle();
  });

  testWidgets('once seen, the board opens without it', (t) async {
    await pump(t, fresh: false);
    expect(find.text('Bu yerdan boshlang'), findsNothing);
  });

  testWidgets('the board: my TOPIK sets the level and opens up to it, IELTS and grant filter', (t) async {
    final c = await pump(t, fresh: false);
    await t.scrollUntilVisible(find.text('Koreys tilim (TOPIK)'), 200);
    expect(find.text('Koreys tilim (TOPIK)'), findsOneWidget);
    expect(find.text('Qabul uchun TOPIK talabi'), findsNothing);
    await t.scrollUntilVisible(find.text('6').first, 100);
    await t.tap(find.text('2').first);
    await t.pumpAndSettle();
    expect(c.read(assessmentProvider).topik, 2);
    expect(c.read(catalogFilterProvider).topik, '2');
    expect(find.text('Oddiy gaplar — TOPIK 2+ ochiladi'), findsOneWidget);

    expect(find.text("Ingliz tilida o'qimayman"), findsOneWidget);
    await t.scrollUntilVisible(find.text('6.5'), 200);
    await t.tap(find.text('6.5'));
    await t.pumpAndSettle();
    expect(c.read(catalogFilterProvider).ielts, 6.5);

    await t.scrollUntilVisible(find.text('50%+'), 200);
    expect(find.text('Shart emas'), findsOneWidget);
    expect(find.text('Kontraktdan chegirma'), findsOneWidget);
    await t.tap(find.text('50%+'));
    await t.pumpAndSettle();
    expect(c.read(catalogFilterProvider).grant, 50);
  });
}

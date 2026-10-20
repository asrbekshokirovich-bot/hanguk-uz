import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
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

  testWidgets('a first visit lights the four sections in turn, three seconds each, then ends', (t) async {
    final c = await pump(t, fresh: true);
    expect(find.text('Bu yerdan boshlang'), findsOneWidget);
    // No buttons: it moves on by itself.
    expect(find.text("O'tkazish"), findsNothing);
    expect(find.textContaining('Keyingi'), findsNothing);
    for (final (label, previous) in [
      ('Mos universitetlar', 'Bu yerdan boshlang'),
      ('Viza imkoningiz', 'Mos universitetlar'),
      ("Ro'yxatni ko'rish", 'Viza imkoningiz'),
    ]) {
      await t.pump(const Duration(seconds: 3));
      await t.pumpAndSettle();
      expect(find.text(label), findsOneWidget);
      expect(find.text(previous), findsNothing);
    }
    await t.pump(const Duration(seconds: 3));
    await t.pumpAndSettle();
    expect(find.text("Ro'yxatni ko'rish"), findsNothing);
    expect(c.read(boardTourProvider), isTrue);
  });

  testWidgets('the lit section stays usable: a field can be picked on the first step', (t) async {
    final c = await pump(t, fresh: true);
    await t.tap(find.text('Biznes'), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(c.read(catalogFilterProvider).field, 'business');
    // A touch outside the lit section does nothing.
    await t.tap(find.text('Seul'), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(c.read(catalogFilterProvider).regions, isEmpty);
    await t.pump(const Duration(seconds: 12));
    await t.pumpAndSettle();
  });

  testWidgets('once seen, the board opens without it', (t) async {
    await pump(t, fresh: false);
    expect(find.text('Bu yerdan boshlang'), findsNothing);
  });
}

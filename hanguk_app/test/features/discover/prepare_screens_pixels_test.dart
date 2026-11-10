// «Tayyorgarlik» as a phone shows it, next to the approved mockups (Claude
// Design canvas «Tayyorgarlik», plan item D3): each state is saved to
// build/test_screens/ (CI: test-screens/pr-<N>.zip) and its key line must be
// readable in the painted pixels.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart' show catalogProvider;
import 'package:hanguk_app/features/discover/data/guest_ai_usage.dart';
import 'package:hanguk_app/features/discover/data/prepare_progress.dart';
import 'package:hanguk_app/features/discover/data/slots.dart';
import 'package:hanguk_app/features/discover/presentation/prepare_screen.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

import '../../helpers/screen_pixels.dart';

class _NoSlots extends SlotsNotifier {
  @override
  List<String?> build() => [null, null, null];
}

const Size _std = Size(360, 780);
const Size _small = Size(320, 640);

String _size(Size s) => '${s.width.toInt()}x${s.height.toInt()}';

/// The tab as the home shows it (its page, nav and round button), Uzbek,
/// a 360×780 phone unless [phone] says otherwise, at the phone's font size
/// times [textScale]. The guest has 7 of 10 AI questions left and this week's
/// interview free (the D4 mockup's sample).
Future<AppLocalizations> _pump(
  WidgetTester t, {
  required bool signedIn,
  PrepareProgress? done,
  Size phone = _std,
  Locale locale = const Locale('uz'),
  double textScale = 1,
}) async {
  t.view.physicalSize = phone * 3;
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        signedInProvider.overrideWithValue(signedIn),
        catalogProvider.overrideWith((ref) async => const []),
        slotsProvider.overrideWith(_NoSlots.new),
        guestAiUsageProvider.overrideWith(
          (ref) async => const GuestAiUsage(aiUsed: 3, aiLimit: 10, interviewUsed: 0, interviewLimit: 1),
        ),
        prepareProgressProvider.overrideWith((ref) async => done),
      ],
      child: RepaintBoundary(
        key: shotKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.materialTheme,
          locale: locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          builder: textScale == 1
              ? null
              : (context, child) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
                  child: child!,
                ),
          home: NavScaffold(current: AppTab.prepare, child: PrepareScreen(signedIn: signedIn)),
        ),
      ),
    ),
  );
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
  return AppLocalizations.delegate.load(locale);
}

Finder _inPage(Finder f) => find.descendant(of: find.byType(PrepareScreen), matching: f);

/// The card (or button) a text of the page is on: its nearest Container.
Finder _box(Finder text) => find.ancestor(of: text, matching: find.byType(Container)).first;

/// Whether the round BAHOLASH/QABUL button is drawn over [r].
bool _orbOver(WidgetTester t, Rect r) {
  final orb = t.getRect(find.byType(AppNavOrb));
  return orb.top < r.bottom && orb.left < r.right && orb.right > r.left;
}

ScrollPosition _scroll(WidgetTester t) => t.state<ScrollableState>(_inPage(find.byType(Scrollable)).first).position;

void main() {
  setUpAll(loadAppFonts);

  testWidgets('1 · guest (D4)', (t) async {
    final l = await _pump(t, signedIn: false);
    final shot = await capture(t, 'prepare_1_mehmon');
    // The page's title (the nav's own «Tayyorgarlik» is the same word).
    expectLabelVisible(t, shot, find.descendant(of: find.byType(PrepareScreen), matching: find.text(l.fdNavPrepare)));
    expectLabelVisible(t, shot, find.text(l.prepGuestSignIn));
  });

  testWidgets('2 · guest: the interview being prepared; 3 · it could not be', (t) async {
    final session = prepareGuestSession;
    addTearDown(() => prepareGuestSession = session);
    final pending = Completer<bool>();
    prepareGuestSession = () => pending.future;

    final l = await _pump(t, signedIn: false);
    await t.tap(find.text(l.interviewPracticeTitle));
    await t.pump();
    // The spinner's arc is longest about 0.65 s into its turn (board 2 draws it so).
    await t.pump(const Duration(milliseconds: 650));
    var shot = await capture(t, 'prepare_2_mehmon_tayyorlanmoqda');
    expectLabelVisible(t, shot, find.text(l.interviewSettingUp));

    pending.complete(false);
    await t.pump();
    shot = await capture(t, 'prepare_3_mehmon_xato');
    expectLabelVisible(t, shot, find.text(l.entryErrorNetwork));
    expectLabelVisible(t, shot, find.text(l.commonRetry));
    // Board 3: the button is as wide as «Qayta urinish», at the left, not the whole row.
    final retry = find.ancestor(of: find.text(l.commonRetry), matching: find.byType(Container)).first;
    expect(t.getSize(retry).width, lessThan(180));
    expect(t.getTopLeft(retry).dx, moreOrLessEquals(t.getTopLeft(find.text(l.entryErrorNetwork)).dx, epsilon: 0.5));
  });

  testWidgets('4 · student (variant A): what they have done', (t) async {
    final l = await _pump(t, signedIn: true, done: const PrepareProgress(planParts: 1, interviews: 2));
    final shot = await capture(t, 'prepare_4_talaba');
    expectLabelVisible(t, shot, find.text(l.fdPrepareStudyPlanSteps(1, 4)));
    expectLabelVisible(t, shot, find.text(l.fdPrepareInterviewDone(2)));
  });

  // Board 1 under «Mijoz kodi bilan kirish»: 24px, nothing over the button,
  // and a page that does not scroll when everything fits. It used to scroll
  // by 24px with the round button over the button's bottom 8px (audit D-F1).
  group('board 1: under the sign-in button', () {
    for (final phone in [_std, _small]) {
      testWidgets('guest page ${_size(phone)}: 24px under the sign-in button, the round button clear of it, no scroll', (
        t,
      ) async {
        final l = await _pump(t, signedIn: false, phone: phone);
        if (phone != _std) await capture(t, 'prepare_1_mehmon_${_size(phone)}');
        final body = t.getRect(find.byType(PrepareScreen));
        final button = t.getRect(_box(find.text(l.prepGuestSignIn)));
        expect(_scroll(t).maxScrollExtent, lessThanOrEqualTo(0.5), reason: 'the page scrolls although everything fits');
        expect(body.bottom - button.bottom, greaterThanOrEqualTo(23.5), reason: 'board 1 keeps 24px under the button');
        expect(_orbOver(t, button), isFalse, reason: 'the round button covers the sign-in button $button');
      });
    }

    testWidgets('a short screen (ru, 320x640, text 130%, interview failed): the page scrolls, the button at its end', (
      t,
    ) async {
      final session = prepareGuestSession;
      addTearDown(() => prepareGuestSession = session);
      final pending = Completer<bool>();
      prepareGuestSession = () => pending.future;
      final l = await _pump(t, signedIn: false, phone: _small, locale: const Locale('ru'), textScale: 1.3);
      await t.tap(find.text(l.interviewPracticeTitle));
      await t.pump();
      pending.complete(false);
      await t.pump();
      expect(find.text(l.entryErrorNetwork), findsOneWidget, reason: 'setup: the failed row (board 3)');

      final scroll = _scroll(t);
      expect(scroll.maxScrollExtent, greaterThan(0), reason: 'what does not fit scrolls');
      scroll.jumpTo(scroll.maxScrollExtent);
      await t.pump();
      await capture(t, 'prepare_3_mehmon_xato_320x640_ru_130_end');
      final body = t.getRect(find.byType(PrepareScreen));
      final button = t.getRect(_box(find.text(l.prepGuestSignIn)));
      final lastRow = t.getRect(_box(find.text(l.prepGuestStudyLocked)));
      expect(button.top - lastRow.bottom, moreOrLessEquals(28, epsilon: 0.5), reason: 'right after the rows: 14 + 14');
      expect(body.bottom - button.bottom, moreOrLessEquals(24, epsilon: 0.5), reason: 'board 1: 24px under it');
      expect(_orbOver(t, button), isFalse, reason: 'the round button covers the sign-in button $button');
    });
  });
}

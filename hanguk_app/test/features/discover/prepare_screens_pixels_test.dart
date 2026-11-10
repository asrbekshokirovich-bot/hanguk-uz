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

/// The tab as the home shows it (its page, nav and round button), Uzbek,
/// a 360×780 phone. The guest has 7 of 10 AI questions left and this week's
/// interview free (the D4 mockup's sample).
Future<AppLocalizations> _pump(WidgetTester t, {required bool signedIn, PrepareProgress? done}) async {
  usePhone(t);
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
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: NavScaffold(current: AppTab.prepare, child: PrepareScreen(signedIn: signedIn)),
        ),
      ),
    ),
  );
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
  return AppLocalizations.delegate.load(const Locale('uz'));
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('1 · guest (D4)', (t) async {
    final l = await _pump(t, signedIn: false);
    final shot = await capture(t, 'prepare_1_mehmon');
    expectLabelVisible(t, shot, find.text(l.fdNavPrepare));
    expectLabelVisible(t, shot, find.text(l.prepGuestSignIn));
  });

  testWidgets('2 · guest: the interview being prepared; 3 · it could not be', (t) async {
    final session = prepareGuestSession;
    addTearDown(() => prepareGuestSession = session);
    final pending = Completer<bool>();
    prepareGuestSession = () => pending.future;

    final l = await _pump(t, signedIn: false);
    await t.tap(find.text(l.interviewPracticeTitle));
    await t.pump(const Duration(milliseconds: 100));
    var shot = await capture(t, 'prepare_2_mehmon_tayyorlanmoqda');
    expectLabelVisible(t, shot, find.text(l.interviewSettingUp));

    pending.complete(false);
    await t.pump();
    shot = await capture(t, 'prepare_3_mehmon_xato');
    expectLabelVisible(t, shot, find.text(l.entryErrorNetwork));
    expectLabelVisible(t, shot, find.text(l.commonRetry));
  });

  testWidgets('4 · student (variant A): what they have done', (t) async {
    final l = await _pump(t, signedIn: true, done: const PrepareProgress(planParts: 1, interviews: 2));
    final shot = await capture(t, 'prepare_4_talaba');
    expectLabelVisible(t, shot, find.text(l.fdPrepareStudyPlanSteps(1, 4)));
    expectLabelVisible(t, shot, find.text(l.fdPrepareInterviewDone(2)));
  });
}

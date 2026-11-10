import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hanguk_ish/app/text_scale.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/time/clock.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/theme.dart';
import 'package:hanguk_ish/features/worker/notifications/unread.dart';
import 'package:hanguk_ish/features/worker/work/qr_scanner.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';
import 'package:hanguk_ish/l10n/gen/worker_l10n.dart';

import 'phone.dart';

/// [screen] inside a worker-app MaterialApp (theme, the four languages) that
/// follows [container]'s language, wrapped for screen captures.
Widget workerHarness(ProviderContainer container, Widget screen) {
  return capture(
    UncontrolledProviderScope(
      container: container,
      child: Consumer(
        builder: (context, ref, _) => MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: hiTheme(),
          locale: ref.watch(appLanguageProvider).locale,
          supportedLocales: WorkerL10n.supportedLocales,
          localizationsDelegates: WorkerL10n.localizationsDelegates,
          builder: (context, child) => HiTextScaleCap(child: child ?? const SizedBox.shrink()),
          home: screen,
        ),
      ),
    ),
  );
}

/// The profile the prototype shows on A02 (Aziz Karimov).
WorkerProfileDraft prototypeProfile() {
  var mask = 0;
  const pattern = {
    0: [2],
    1: [1, 2],
    2: [2],
    3: [1, 2],
    4: [2],
    5: [0, 1, 2],
    6: [0, 1],
  };
  pattern.forEach((day, slots) {
    for (final slot in slots) {
      mask |= WorkerProfileDraft.bit(day, slot);
    }
  });
  return WorkerProfileDraft(
    firstName: 'Aziz',
    lastName: 'Karimov',
    languages: const {'uz', 'ru', 'en', 'ko'},
    topik: 4,
    university: 'sogang',
    district: 'mapo',
    availability: mask,
    visa: 'D-2',
  );
}

/// A container in [language] holding [draft].
ProviderContainer workerContainer({
  AppLanguage language = AppLanguage.uz,
  WorkerProfileDraft? draft,
  List<Override> overrides = const [],
}) {
  final container = ProviderContainer(overrides: overrides);
  container.read(appLanguageProvider.notifier).select(language);
  if (draft != null) container.read(workerProfileDraftProvider.notifier).replace(draft);
  return container;
}

/// The whole worker app opened at [location], at the prototype's moment
/// (Tuesday 10 November 2026, 11:20 in Seoul) with its sample shifts.
ProviderContainer appContainer({
  AppLanguage language = AppLanguage.uz,
  String location = WorkerRoutes.feed,
  ShiftRepository? repository,
  int unread = demoUnreadNotifications,
  DateTime Function()? clock,
  List<Override> overrides = const [],
}) {
  final container = ProviderContainer(overrides: [
    workerInitialLocationProvider.overrideWithValue(location),
    clockProvider.overrideWithValue(clock ?? () => prototypeNow),
    liveTimersProvider.overrideWithValue(false),
    qrScanAnimationProvider.overrideWithValue(false),
    shiftRepositoryProvider.overrideWithValue(repository ?? DemoShiftRepository(now: prototypeNow)),
    unreadNotificationsProvider.overrideWithValue(unread),
    ...overrides,
  ]);
  container.read(appLanguageProvider.notifier).select(language);
  container.read(workerProfileDraftProvider.notifier).replace(prototypeProfile());
  return container;
}

/// [WorkerApp] on [container], wrapped for screen captures.
Widget appHarness(ProviderContainer container) =>
    capture(UncontrolledProviderScope(container: container, child: const WorkerApp()));

/// A repository whose feed never answers (the loading state).
class HangingShiftRepository extends DemoShiftRepository {
  HangingShiftRepository() : super(now: prototypeNow);

  @override
  Future<List<ShiftListing>> feed(FeedQuery query) => Completer<List<ShiftListing>>().future;
}

/// A repository that is offline for its first [failures] feed calls.
class FlakyShiftRepository extends DemoShiftRepository {
  FlakyShiftRepository({this.failures = 1 << 30}) : super(now: prototypeNow);

  int failures;

  @override
  Future<List<ShiftListing>> feed(FeedQuery query) async {
    if (failures > 0) {
      failures--;
      throw const OfflineException();
    }
    return super.feed(query);
  }
}

/// A repository that refuses every application with [code].
class RefusingShiftRepository extends DemoShiftRepository {
  RefusingShiftRepository(this.code) : super(now: prototypeNow);

  final String code;

  @override
  Future<ApplyResult> apply(String shiftId) async => throw ShiftActionException(code);
}

/// A clock the test moves (for check-in and check-out times).
class TestClock {
  TestClock(this.now);

  DateTime now;

  DateTime call() => now;

  /// Today (the prototype's date) at [hour]:[minute]:[second] in Seoul.
  void at(int hour, [int minute = 0, int second = 0]) =>
      now = Kst.instantOf(2026, 11, 10, hour, minute).add(Duration(seconds: second));
}

/// The demo repository at the prototype's date, on [clock].
DemoShiftRepository demoRepository(TestClock clock, {bool strict = false, bool history = true}) =>
    DemoShiftRepository(now: prototypeNow, clock: clock.call, strictTimes: strict, history: history);

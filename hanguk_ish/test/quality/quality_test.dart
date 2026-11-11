// Every screen of both apps on a narrow phone (360 dp, the commonest
// Android width), short (640), with the largest text size the apps allow
// (×1.2, HiTextScaleCap): nothing overflows and every tappable thing has a
// name and a usable size.
//
// Size: the design system's minimum is 44 px on the prototype's 390 px
// phone; on 360 dp rows of equal parts shrink with the width (A02 TOPIK:
// 7 × 40.6), so 40 dp is the floor here — above WCAG 2.2 AA's 24 px.
// Text colours are fixed by the prototype; their contrast is checked on the
// palette (test/design/contrast_test.dart), not on screenshots (the
// screenshot check mis-places text inside scroll views).
import 'dart:ui' show Size;

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/features/employer/biz.dart';
import 'package:hanguk_ish/features/employer/language.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../helpers/employer_harness.dart';
import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

/// The largest text the apps let the system set.
const maxTextScale = 1.2;

const tapTargets = MinimumTapTargetGuideline(
  size: Size(40, 40),
  link: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
);

/// Builds a screen while recording every layout error in full (which widget,
/// where), then checks the guidelines.
Future<void> expectAccessible(WidgetTester tester, String name, Future<void> Function() open) async {
  final errors = <FlutterErrorDetails>[];
  final previous = FlutterError.onError;
  FlutterError.onError = errors.add;
  try {
    await open();
  } finally {
    FlutterError.onError = previous;
  }
  final failures = [for (final e in errors) '[layout] ${e.toString()}'];
  for (final (label, guideline) in [
    ('named tap targets', labeledTapTargetGuideline),
    ('tap target size', tapTargets),
  ]) {
    final result = await guideline.evaluate(tester);
    if (!result.passed) failures.add('[$label] ${result.reason}');
  }
  expect(failures, isEmpty, reason: name);
}

void setLargeText(WidgetTester tester) {
  tester.platformDispatcher.textScaleFactorTestValue = maxTextScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

void main() {
  setUpAll(loadHiFonts);

  group('worker app', () {
    Future<void> open(WidgetTester tester, String location, {AppLanguage language = AppLanguage.uz, TestPhone phone = TestPhone.small}) async {
      usePhone(tester, phone);
      setLargeText(tester);
      final clock = TestClock(prototypeNow);
      final repo = demoRepository(clock);
      final container = appContainer(language: language, location: location, repository: repo, clock: clock.call);
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
    }

    final screens = {
      'A01': WorkerRoutes.login,
      'T1': WorkerRoutes.phone,
      'T2': WorkerRoutes.phoneCode('010-1234-5678'),
      'A02-1': WorkerRoutes.profileName,
      'A02-2': WorkerRoutes.profileLanguages,
      'A02-3': WorkerRoutes.profileSchedule,
      'A03': WorkerRoutes.feed,
      'A04': WorkerRoutes.map,
      'A05': WorkerRoutes.shift('demo-1'),
      'A06': WorkerRoutes.myShifts,
      'A09': WorkerRoutes.earnings,
      'A11': WorkerRoutes.me,
      'A12': WorkerRoutes.notifications,
    };
    for (final MapEntry(key: name, value: location) in screens.entries) {
      for (final language in AppLanguage.values) {
        testWidgets('$name ${language.code}', (tester) async {
          final semantics = tester.ensureSemantics();
          try {
            await expectAccessible(tester, '$name ${language.code}', () => open(tester, location, language: language));
          } finally {
            semantics.dispose();
          }
        });
      }
    }
  });

  // In each of its four languages (P43; Korean is the prototype's).
  group('employer app', () {
    Future<void> open(WidgetTester tester, String location, AppLanguage language) async {
      usePhone(tester, TestPhone.small);
      setLargeText(tester);
      final repo = DemoEmployerRepository(now: employerPrototypeNow, clock: () => employerPrototypeNow);
      final container = employerContainer(
        location: location,
        repository: repo,
        overrides: [employerDefaultLanguageProvider.overrideWithValue(language)],
      );
      addTearDown(container.dispose);
      addTearDown(() => Biz.use(AppLanguage.ko));
      await tester.pumpWidget(employerHarness(container));
      await tester.pumpAndSettle();
    }

    final screens = {
      'BA0': EmployerRoutes.login,
      'BA0 code': EmployerRoutes.code('010-1234-5678', '123-45-67891'),
      'BA1': EmployerRoutes.home,
      'BA2': EmployerRoutes.create,
      'BA3': EmployerRoutes.shift('demo-es-close'),
      'BA4': EmployerRoutes.workers,
      'BA5': EmployerRoutes.report,
      'bell': EmployerRoutes.notifications,
    };
    for (final MapEntry(key: name, value: location) in screens.entries) {
      for (final language in AppLanguage.values) {
        testWidgets('$name ${language.code}', (tester) async {
          final semantics = tester.ensureSemantics();
          try {
            await expectAccessible(tester, '$name ${language.code}', () => open(tester, location, language));
          } finally {
            semantics.dispose();
          }
        });
      }
    }
  });
}

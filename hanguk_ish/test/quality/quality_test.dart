// Every screen of both apps on the smallest supported phone, with the
// largest text size the apps allow (×1.2, HiTextScaleCap): nothing
// overflows, every tappable thing has a name and a 44 pt target (the design
// system's minimum, iOS guideline), and text keeps its contrast.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../helpers/employer_harness.dart';
import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

/// The largest text the apps let the system set.
const maxTextScale = 1.2;

Future<void> expectAccessible(WidgetTester tester, String name) async {
  expect(tester.takeException(), isNull, reason: '$name: no layout error');
  final failures = <String>[];
  for (final (label, guideline) in [
    ('named tap targets', labeledTapTargetGuideline),
    ('44 pt tap targets', iOSTapTargetGuideline),
    ('text contrast', textContrastGuideline),
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
          addTearDown(semantics.dispose);
          await open(tester, location, language: language);
          await expectAccessible(tester, '$name ${language.code}');
        });
      }
    }
  });

  group('employer app', () {
    Future<void> open(WidgetTester tester, String location) async {
      usePhone(tester, TestPhone.small);
      setLargeText(tester);
      final repo = DemoEmployerRepository(now: employerPrototypeNow, clock: () => employerPrototypeNow);
      final container = employerContainer(location: location, repository: repo);
      addTearDown(container.dispose);
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
      testWidgets(name, (tester) async {
        final semantics = tester.ensureSemantics();
        addTearDown(semantics.dispose);
        await open(tester, location);
        await expectAccessible(tester, name);
      });
    }
  });
}

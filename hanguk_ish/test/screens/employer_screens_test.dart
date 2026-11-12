@Tags(['screens'])
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/features/employer/biz.dart';
import 'package:hanguk_ish/features/employer/language.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../helpers/employer_harness.dart';
import '../helpers/fonts.dart';
import '../helpers/phone.dart';

/// BA3 is a long page in the prototype (390×1 380).
const _tall = TestPhone('tall', Size(390, 1380), top: 47, bottom: 34);

/// The employer app (BA1–BA5) as the prototype draws it, plus the states
/// it does not show.
void main() {
  setUpAll(loadHiFonts);

  Future<void> open(WidgetTester tester, String location, {DemoEmployerRepository? repository}) async {
    final container = employerContainer(location: location, repository: repository);
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();
  }

  testWidgets('BA1-App-Home', (tester) async {
    usePhone(tester);
    await open(tester, EmployerRoutes.home);
    await expectScreen(tester, 'BA1-App-Home');
  });

  testWidgets('BA2-App-Create', (tester) async {
    usePhone(tester);
    await open(tester, EmployerRoutes.create);
    // The prototype shows the day after tomorrow chosen.
    await tester.tap(find.text('목 11.12', findRichText: true));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'BA2-App-Create');
  });

  testWidgets('BA3-App-Shift', (tester) async {
    usePhone(tester, _tall);
    await open(tester, EmployerRoutes.shift('demo-es-close'));
    await expectScreen(tester, 'BA3-App-Shift');
  });

  testWidgets('BA4-App-Workers', (tester) async {
    usePhone(tester);
    await open(tester, EmployerRoutes.workers);
    await expectScreen(tester, 'BA4-App-Workers');
  });

  testWidgets('BA5-App-Report', (tester) async {
    usePhone(tester);
    await open(tester, EmployerRoutes.report);
    await expectScreen(tester, 'BA5-App-Report');
  });

  for (final phone in [TestPhone.android, TestPhone.small]) {
    for (final (name, location) in [
      ('BA1-App-Home', EmployerRoutes.home),
      ('BA2-App-Create', EmployerRoutes.create),
      ('BA3-App-Shift', EmployerRoutes.shift('demo-es-close')),
      ('BA4-App-Workers', EmployerRoutes.workers),
      ('BA5-App-Report', EmployerRoutes.report),
    ]) {
      testWidgets('$name — ${phone.name}', (tester) async {
        usePhone(tester, phone);
        await open(tester, location);
        expect(tester.takeException(), isNull);
        await expectScreen(tester, '$name.${phone.name}');
      });
    }
  }

  // P43: the same screens in the app's other three languages, for review
  // (Korean above is the prototype's).
  for (final language in [AppLanguage.uz, AppLanguage.ru, AppLanguage.en]) {
    for (final (name, location, phone) in [
      ('BA0-App-Login', EmployerRoutes.login, TestPhone.prototype),
      ('BA1-App-Home', EmployerRoutes.home, TestPhone.prototype),
      ('BA2-App-Create', EmployerRoutes.create, TestPhone.prototype),
      ('BA3-App-Shift', EmployerRoutes.shift('demo-es-close'), _tall),
      ('BA4-App-Workers', EmployerRoutes.workers, TestPhone.prototype),
      ('BA5-App-Report', EmployerRoutes.report, TestPhone.prototype),
      ('BA-Notifications', EmployerRoutes.notifications, TestPhone.prototype),
    ]) {
      testWidgets('$name — ${language.code}', (tester) async {
        usePhone(tester, phone);
        final container = employerContainer(
          location: location,
          overrides: [employerDefaultLanguageProvider.overrideWithValue(language)],
        );
        addTearDown(container.dispose);
        addTearDown(() => Biz.use(AppLanguage.ko));
        await tester.pumpWidget(employerHarness(container));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await expectScreen(tester, '$name.${language.code}');
      });
    }
  }

  testWidgets('BA1 in the morning: nothing to check yet', (tester) async {
    usePhone(tester);
    final morning = Kst.instantOf(2026, 11, 10, 7, 30);
    final container = employerContainer(
      clock: () => morning,
      repository: DemoEmployerRepository(now: morning, clock: () => morning),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'BA1-App-Home.morning');
  });

  testWidgets('BA4 — 최근 근무자', (tester) async {
    usePhone(tester);
    await open(tester, EmployerRoutes.workers);
    await tester.tap(find.text('최근 근무자 18', findRichText: true));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'BA4-App-Workers.recent');
  });

  testWidgets('BA5 — 지난달', (tester) async {
    usePhone(tester);
    await open(tester, EmployerRoutes.report);
    await tester.tap(find.text('지난달'));
    await tester.pumpAndSettle();
    await expectScreen(tester, 'BA5-App-Report.last-month');
  });

  testWidgets('Notifications', (tester) async {
    usePhone(tester);
    await open(tester, EmployerRoutes.notifications);
    await expectScreen(tester, 'BA-Notifications');
  });
}

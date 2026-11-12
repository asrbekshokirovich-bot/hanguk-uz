import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/format/business_number.dart';
import 'package:hanguk_ish/core/format/phone.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/widgets/auth.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';

import '../helpers/employer_harness.dart';
import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

/// Sign-in that answers with [sendError] / [verifyError] when set.
class ScriptedAuth extends DemoAuthRepository {
  ScriptedAuth({super.userId});

  Object? sendError;
  Object? verifyError;
  int sent = 0;
  final codes = <String>[];

  @override
  Future<void> sendCode(String phone) async {
    sent++;
    if (sendError case final error?) throw error;
    return super.sendCode(phone);
  }

  @override
  Future<void> verifyCode(String phone, String code) async {
    codes.add(code);
    if (verifyError case final error?) throw error;
    return super.verifyCode(phone, code);
  }
}

/// An owner without a business yet (P50: «시작하기» opens one), whose
/// connection can drop while it opens.
class NewOwnerRepository extends DemoEmployerRepository {
  NewOwnerRepository() : super(now: employerPrototypeNow, clock: () => employerPrototypeNow);

  bool opened = false;
  int opens = 0;
  Object? openError;

  @override
  Future<List<Business>> businesses() async => opened ? const [demoDalbit] : const [];

  @override
  Future<Business> openBusiness() async {
    opens++;
    if (openError case final error?) throw error;
    opened = true;
    return demoDalbit;
  }
}

const backend = BackendConfig(url: 'https://ish.test', publishableKey: 'key');

void main() {
  setUpAll(loadHiFonts);

  group('numbers', () {
    test('Korean mobile numbers', () {
      expect(KoreanPhone.toE164('010-1234-5678'), '+821012345678');
      expect(KoreanPhone.toE164('01012345678'), '+821012345678');
      expect(KoreanPhone.toE164('+82 10 1234 5678'), '+821012345678');
      expect(KoreanPhone.toE164('011-123-4567'), '+82111234567');
      expect(KoreanPhone.toE164('02-123-4567'), isNull, reason: 'a landline');
      expect(KoreanPhone.toE164('010-1234-567'), isNull);
      expect(KoreanPhone.toE164('+998901234567'), isNull);
      expect(KoreanPhone.display('+821012345678'), '010-1234-5678');
      expect(KoreanPhone.display('01112345678'), '011-1234-5678');
      expect(KoreanPhone.display('0111234567'), '011-123-4567');
    });

    test('사업자등록번호 check digit', () {
      expect(isValidBusinessNumber('124-81-00998'), isTrue);
      expect(isValidBusinessNumber('1234567891'), isTrue);
      expect(isValidBusinessNumber('1234567890'), isFalse);
      expect(isValidBusinessNumber('123-45-6789'), isFalse);
      expect(isValidBusinessNumber(''), isFalse);
    });
  });

  group('worker T1 / T2', () {
    Future<(ProviderContainer, ScriptedAuth)> openPhone(WidgetTester tester, {InMemoryWorkerProfileRepository? profile}) async {
      usePhone(tester);
      final auth = ScriptedAuth();
      final container = appContainer(location: WorkerRoutes.phone, overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        workerProfileRepositoryProvider.overrideWithValue(profile ?? InMemoryWorkerProfileRepository()),
      ]);
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
      return (container, auth);
    }

    testWidgets('a refused SMS is explained on T1', (tester) async {
      final (_, auth) = await openPhone(tester);
      auth.sendError = const ShiftActionException('SMS_FAILED');
      await tester.enterText(find.byType(TextField), '01012345678');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kod olish'));
      await tester.pumpAndSettle();
      expect(find.text("SMS yuborib bo'lmadi. Raqamni tekshirib, qayta urinib ko'ring."), findsOneWidget);
      expect(find.byType(HiFormError), findsOneWidget);
      auth.sendError = const OfflineException();
      await tester.tap(find.text('Kod olish'));
      await tester.pumpAndSettle();
      expect(find.text("Internet aloqasi yo'q. Ulanishni tekshirib, qayta urinib ko'ring."), findsOneWidget);
      await tester.enterText(find.byType(TextField), '0101234');
      await tester.pumpAndSettle();
      expect(find.byType(HiFormError), findsNothing, reason: 'typing clears the message');
      expect(tester.widget<HiButton>(find.widgetWithText(HiButton, 'Kod olish')).onPressed, isNull);
    });

    testWidgets('a wrong code is explained and cleared; a saved profile opens the feed', (tester) async {
      final profile = InMemoryWorkerProfileRepository();
      await profile.save(prototypeProfile());
      final (container, auth) = await openPhone(tester, profile: profile);
      container.read(workerProfileDraftProvider.notifier).replace(const WorkerProfileDraft());
      await tester.enterText(find.byType(TextField), '01012345678');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kod olish'));
      await tester.pumpAndSettle();

      auth.verifyError = const ShiftActionException('CODE_INVALID');
      await tester.enterText(find.byType(TextField), '111111');
      await tester.pumpAndSettle();
      expect(find.text("Kod noto'g'ri yoki eskirgan. Qaytadan kiriting."), findsOneWidget);
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);

      auth.verifyError = null;
      await tester.enterText(find.byType(TextField), '654321');
      await tester.pumpAndSettle();
      expect(auth.codes, ['111111', '654321']);
      expect(find.text('Smenalar'), findsWidgets, reason: 'the feed');
      expect(container.read(workerProfileDraftProvider).firstName, 'Aziz', reason: 'the saved profile is loaded');
    });

    testWidgets('a new code after a minute', (tester) async {
      final (_, auth) = await openPhone(tester);
      await tester.enterText(find.byType(TextField), '01012345678');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kod olish'));
      await tester.pumpAndSettle();
      expect(find.text('Qayta yuborish: 1:00'), findsOneWidget);
      await tester.pump(const Duration(seconds: 15));
      expect(find.text('Qayta yuborish: 0:45'), findsOneWidget);
      expect(find.text('Kodni qayta yuborish'), findsNothing);
      await tester.pump(const Duration(seconds: 45));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kodni qayta yuborish'));
      await tester.pumpAndSettle();
      expect(auth.sent, 2);
      expect(find.text('Yangi kod yuborildi.'), findsOneWidget);
      expect(find.text('Qayta yuborish: 1:00'), findsOneWidget);
    });

    for (final (code, text) in [
      ('TOO_MANY_REQUESTS', "Urinishlar juda ko'p. Birozdan keyin qayta urinib ko'ring."),
      ('PHONE_INVALID', "Raqam noto'g'ri. 010-0000-0000 ko'rinishida kiriting."),
      ('SOMETHING', "Xatolik yuz berdi. Qayta urinib ko'ring."),
    ]) {
      testWidgets('T1 names $code', (tester) async {
        final (_, auth) = await openPhone(tester);
        auth.sendError = ShiftActionException(code);
        await tester.enterText(find.byType(TextField), '01012345678');
        await tester.pumpAndSettle();
        await tester.tap(find.text('Kod olish'));
        await tester.pumpAndSettle();
        expect(find.text(text), findsOneWidget);
      });
    }
  });

  group('worker start gate (with a backend)', () {
    Future<ProviderContainer> launch(WidgetTester tester, {String? user, WorkerProfileDraft? saved}) async {
      usePhone(tester);
      final profile = InMemoryWorkerProfileRepository();
      if (saved != null) await profile.save(saved);
      final container = appContainer(location: WorkerRoutes.start, overrides: [
        backendConfigProvider.overrideWithValue(backend),
        authRepositoryProvider.overrideWithValue(DemoAuthRepository(userId: user)),
        workerProfileRepositoryProvider.overrideWithValue(profile),
      ]);
      container.read(workerProfileDraftProvider.notifier).replace(const WorkerProfileDraft());
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
      return container;
    }

    testWidgets('signed out: A01', (tester) async {
      await launch(tester);
      expect(find.text('Telefon raqam bilan'), findsOneWidget);
    });

    testWidgets('signed in without a profile: A02', (tester) async {
      await launch(tester, user: 'u1');
      expect(find.text('Profil · 1 / 3'), findsOneWidget);
    });

    testWidgets('signed in with a profile: the feed, with the profile loaded', (tester) async {
      final container = await launch(tester, user: 'u1', saved: prototypeProfile());
      expect(find.text('Smenalar'), findsWidgets);
      expect(container.read(workerProfileDraftProvider).lastName, 'Karimov');
    });

    testWidgets('the default start follows the backend setting', (tester) async {
      final demo = ProviderContainer();
      addTearDown(demo.dispose);
      expect(demo.read(workerInitialLocationProvider), WorkerRoutes.login);
      expect(demo.read(employerInitialLocationProvider), EmployerRoutes.login);
      final live = ProviderContainer(overrides: [backendConfigProvider.overrideWithValue(backend)]);
      addTearDown(live.dispose);
      expect(live.read(workerInitialLocationProvider), WorkerRoutes.start);
      expect(live.read(employerInitialLocationProvider), EmployerRoutes.start);
    });

    testWidgets('Telegram says it is coming when a backend is set', (tester) async {
      usePhone(tester);
      final container = appContainer(location: WorkerRoutes.login, overrides: [
        backendConfigProvider.overrideWithValue(backend),
      ]);
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Telegram bilan'));
      await tester.pumpAndSettle();
      expect(find.text('Telegram orqali kirish tez orada. Hozircha telefon raqam bilan kiring.'), findsOneWidget);
      expect(find.text('Telefon raqam bilan'), findsOneWidget, reason: 'still on A01');
    });
  });

  group('owner sign-in (P54: phone + SMS code; P50: no business number)', () {
    Future<(NewOwnerRepository, ScriptedAuth)> openBa0(WidgetTester tester, {String? user}) async {
      usePhone(tester);
      final repo = NewOwnerRepository();
      final auth = ScriptedAuth(userId: user);
      final container = employerContainer(
        location: EmployerRoutes.login,
        repository: repo,
        overrides: [authRepositoryProvider.overrideWithValue(auth)],
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(employerHarness(container));
      await tester.pumpAndSettle();
      return (repo, auth);
    }

    Future<void> start(WidgetTester tester) async {
      await tester.enterText(find.byType(TextField), '01012345678');
      await tester.tap(find.text('시작하기'));
      await tester.pumpAndSettle();
    }

    testWidgets('a new owner: code, then the business opens at once, then BA1', (tester) async {
      final (repo, auth) = await openBa0(tester);
      await start(tester);
      expect(auth.sent, 1);
      expect(repo.opens, 0, reason: 'not before the code');
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pumpAndSettle();
      expect(auth.codes, ['123456']);
      expect(repo.opens, 1);
      expect(find.text('오늘의 근무'), findsOneWidget);
    });

    testWidgets('signed in already (back after a lost connection): no new SMS', (tester) async {
      final (repo, auth) = await openBa0(tester, user: 'u1');
      await start(tester);
      expect(auth.sent, 0);
      expect(repo.opens, 1);
      expect(find.text('오늘의 근무'), findsOneWidget);
    });

    testWidgets('offline while the business opens: back on BA0 with the reason, then again without a new SMS',
        (tester) async {
      final (repo, auth) = await openBa0(tester);
      repo.openError = const OfflineException();
      await start(tester);
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pumpAndSettle();
      expect(find.text('인터넷 연결을 확인해 주세요'), findsOneWidget);
      expect(find.text('시작하기'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      repo.openError = null;
      await start(tester);
      expect(auth.sent, 1, reason: 'signed in already');
      expect(repo.opens, 2);
      expect(find.text('오늘의 근무'), findsOneWidget);
    });

    testWidgets('a wrong code on the owner\'s T2', (tester) async {
      final (_, auth) = await openBa0(tester);
      await start(tester);
      auth.verifyError = const ShiftActionException('CODE_INVALID');
      await tester.enterText(find.byType(TextField), '000000');
      await tester.pumpAndSettle();
      expect(find.text('인증번호가 틀렸거나 만료됐어요. 다시 입력해 주세요'), findsOneWidget);
      expect(find.byType(HiCodeField), findsOneWidget);
    });

    testWidgets('a refused SMS stays on BA0', (tester) async {
      final (repo, auth) = await openBa0(tester);
      auth.sendError = const ShiftActionException('TOO_MANY_REQUESTS');
      await start(tester);
      expect(find.text('시도가 너무 많아요. 잠시 후 다시 시도해 주세요'), findsOneWidget);
      expect(find.text('인증번호 입력'), findsNothing);
      expect(repo.opens, 0);
    });

    testWidgets('no number: says so, no SMS', (tester) async {
      final (_, auth) = await openBa0(tester);
      await tester.tap(find.text('시작하기'));
      await tester.pumpAndSettle();
      expect(find.text('휴대폰 번호를 입력해 주세요'), findsOneWidget);
      expect(auth.sent, 0);
    });
  });
}

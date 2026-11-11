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
import 'package:hanguk_ish/design/widgets/buttons.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';

import '../helpers/employer_harness.dart';
import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

/// Sign-in (P49: an account on this phone, no SMS) that fails with
/// [signInError] when set.
class ScriptedAuth extends DemoAuthRepository {
  ScriptedAuth({super.userId});

  Object? signInError;
  int signIns = 0;

  @override
  Future<void> signIn() async {
    signIns++;
    if (signInError case final error?) throw error;
    return super.signIn();
  }
}

/// An owner without a business yet, whose registration can be refused.
class NewOwnerRepository extends DemoEmployerRepository {
  NewOwnerRepository() : super(now: employerPrototypeNow, clock: () => employerPrototypeNow);

  bool registered = false;
  String? refusal;
  final numbers = <String>[];

  @override
  Future<List<Business>> businesses() async => registered ? const [demoDalbit] : const [];

  @override
  Future<Business> registerBusiness(String businessNumber) async {
    numbers.add(businessNumber);
    if (refusal case final code?) throw ShiftActionException(code);
    registered = true;
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

  group('worker A01 «Boshlash»', () {
    Future<(ProviderContainer, ScriptedAuth)> openA01(
      WidgetTester tester, {
      String? user,
      InMemoryWorkerProfileRepository? profile,
    }) async {
      usePhone(tester);
      final auth = ScriptedAuth(userId: user);
      final container = appContainer(location: WorkerRoutes.login, overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        workerProfileRepositoryProvider.overrideWithValue(profile ?? InMemoryWorkerProfileRepository()),
      ]);
      container.read(workerProfileDraftProvider.notifier).replace(const WorkerProfileDraft());
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
      return (container, auth);
    }

    testWidgets('a new account fills A02', (tester) async {
      final (_, auth) = await openA01(tester);
      await tester.tap(find.text('Boshlash'));
      await tester.pumpAndSettle();
      expect(auth.signIns, 1);
      expect(auth.userId, DemoAuthRepository.demoUser);
      expect(find.text('Profil · 1 / 3'), findsOneWidget);
    });

    testWidgets('a saved profile opens the feed with the profile loaded', (tester) async {
      final profile = InMemoryWorkerProfileRepository();
      await profile.save(prototypeProfile());
      final (container, _) = await openA01(tester, profile: profile);
      await tester.tap(find.text('Boshlash'));
      await tester.pumpAndSettle();
      expect(find.text('Smenalar'), findsWidgets, reason: 'the feed');
      expect(container.read(workerProfileDraftProvider).firstName, 'Aziz');
    });

    testWidgets('signed in already: goes on without a second account', (tester) async {
      final (_, auth) = await openA01(tester, user: 'u1');
      await tester.tap(find.text('Boshlash'));
      await tester.pumpAndSettle();
      expect(auth.signIns, 0);
      expect(find.text('Profil · 1 / 3'), findsOneWidget);
    });

    for (final (error, text) in [
      (const OfflineException(), "Internet aloqasi yo'q. Ulanishni tekshirib, qayta urinib ko'ring."),
      (const ShiftActionException('TOO_MANY_REQUESTS'), "Urinishlar juda ko'p. Birozdan keyin qayta urinib ko'ring."),
      (const ShiftActionException('SIGN_IN_UNAVAILABLE'), "Xatolik yuz berdi. Qayta urinib ko'ring."),
    ]) {
      testWidgets('a failed start stays on A01 and says why: $error', (tester) async {
        final (_, auth) = await openA01(tester);
        auth.signInError = error;
        await tester.tap(find.text('Boshlash'));
        await tester.pumpAndSettle();
        expect(find.text(text), findsOneWidget);
        expect(find.text('Boshlash'), findsOneWidget, reason: 'still on A01');
        expect(auth.userId, isNull);
        expect(tester.widget<HiButton>(find.widgetWithText(HiButton, 'Boshlash')).onPressed, isNotNull,
            reason: 'ready to try again');
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
      expect(find.text('Boshlash'), findsOneWidget);
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
  });

  group('owner sign-in', () {
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

    Future<void> start(WidgetTester tester, {String bizNo = '1234567891'}) async {
      await tester.enterText(find.byType(TextField), bizNo);
      await tester.tap(find.text('시작하기'));
      await tester.pumpAndSettle();
    }

    testWidgets('a new owner: an account, 국세청 registration, BA1', (tester) async {
      final (repo, auth) = await openBa0(tester);
      await start(tester);
      expect(auth.signIns, 1);
      expect(repo.numbers, ['123-45-67891']);
      expect(find.text('오늘의 근무'), findsOneWidget);
    });

    testWidgets('a refused number stays on BA0 with the reason; signed in, no second account', (tester) async {
      final (repo, auth) = await openBa0(tester);
      repo.refusal = 'BIZ_NO_TAKEN';
      await start(tester);
      expect(find.text('이미 다른 계정에 등록된 사업자등록번호예요'), findsOneWidget);
      expect(find.text('시작하기'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      repo.refusal = null;
      await start(tester, bizNo: '1248100998');
      expect(auth.signIns, 1, reason: 'already signed in');
      expect(repo.numbers.last, '124-81-00998');
      expect(find.text('오늘의 근무'), findsOneWidget);
    });

    testWidgets('a failed start stays on BA0 and says why', (tester) async {
      final (repo, auth) = await openBa0(tester);
      auth.signInError = const ShiftActionException('TOO_MANY_REQUESTS');
      await start(tester);
      expect(find.text('시도가 너무 많아요. 잠시 후 다시 시도해 주세요'), findsOneWidget);
      expect(repo.numbers, isEmpty);
      expect(find.text('시작하기'), findsOneWidget);
    });

    testWidgets('a short or wrong number is caught before any account', (tester) async {
      final (repo, auth) = await openBa0(tester);
      await start(tester, bizNo: '12345');
      expect(find.text('사업자등록번호를 입력해 주세요'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      await start(tester, bizNo: '1234567890');
      expect(find.text('사업자등록번호를 확인해 주세요'), findsOneWidget);
      expect(auth.signIns, 0);
      expect(repo.numbers, isEmpty);
    });
  });
}

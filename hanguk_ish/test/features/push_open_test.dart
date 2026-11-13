// P56: a tapped push opens A12 (worker app) or 알림 (사장님 app) — at once
// when the app was in the background; over the home screen once the start
// gate has opened it when the tap launched the app. Never over sign-in or a
// profile still to fill.
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/push_service.dart';
import 'package:hanguk_ish/features/employer/notifications/employer_notifications_screen.dart';
import 'package:hanguk_ish/features/worker/notifications/notifications_screen.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';

import '../helpers/employer_harness.dart';
import '../helpers/fonts.dart';
import '../helpers/phone.dart';
import '../helpers/push.dart';
import '../helpers/worker_harness.dart';

const backend = BackendConfig(url: 'https://ish.test', publishableKey: 'key');

void main() {
  setUpAll(loadHiFonts);

  group('worker app', () {
    Future<void> launch(WidgetTester tester, FakePush push, {String? user, WorkerProfileDraft? saved}) async {
      usePhone(tester);
      final profile = InMemoryWorkerProfileRepository();
      if (saved != null) await profile.save(saved);
      final container = appContainer(location: WorkerRoutes.start, overrides: [
        backendConfigProvider.overrideWithValue(backend),
        authRepositoryProvider.overrideWithValue(DemoAuthRepository(userId: user)),
        workerProfileRepositoryProvider.overrideWithValue(profile),
        pushServiceProvider.overrideWithValue(push),
      ]);
      container.read(workerProfileDraftProvider.notifier).replace(const WorkerProfileDraft());
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
    }

    testWidgets('a tap that launched the app: the feed, then A12 over it', (tester) async {
      await launch(tester, FakePush(launched: true), user: 'u1', saved: prototypeProfile());
      expect(find.byType(NotificationsScreen), findsOneWidget);
    });

    testWidgets('a tap while the app was in the background: A12 at once, not twice', (tester) async {
      final push = FakePush();
      await launch(tester, push, user: 'u1', saved: prototypeProfile());
      expect(find.byType(NotificationsScreen), findsNothing, reason: 'a plain launch opens the feed');
      push.tap();
      await tester.pumpAndSettle();
      expect(find.byType(NotificationsScreen), findsOneWidget);
      push.tap();
      await tester.pumpAndSettle();
      expect(find.byType(NotificationsScreen), findsOneWidget, reason: 'already open');
    });

    testWidgets('signed out: a tap leaves A01 as it is', (tester) async {
      final push = FakePush(launched: true);
      await launch(tester, push);
      push.tap();
      await tester.pumpAndSettle();
      expect(find.byType(NotificationsScreen), findsNothing);
      expect(find.text('Telefon raqam bilan'), findsOneWidget);
    });

    testWidgets('a new account fills A02 first, without A12 over it', (tester) async {
      await launch(tester, FakePush(launched: true), user: 'u1');
      expect(find.text('Profil · 1 / 3'), findsOneWidget);
      expect(find.byType(NotificationsScreen), findsNothing);
    });
  });

  group('사장님 app', () {
    Future<FakePush> open(WidgetTester tester, String location, FakePush push) async {
      usePhone(tester);
      final container = employerContainer(location: location, overrides: [
        backendConfigProvider.overrideWithValue(backend),
        authRepositoryProvider.overrideWithValue(DemoAuthRepository(userId: 'o1')),
        pushServiceProvider.overrideWithValue(push),
      ]);
      addTearDown(container.dispose);
      await tester.pumpWidget(employerHarness(container));
      await tester.pumpAndSettle();
      return push;
    }

    testWidgets('a tap that launched the app: BA1, then 알림 over it', (tester) async {
      await open(tester, EmployerRoutes.start, FakePush(launched: true));
      expect(find.byType(EmployerNotificationsScreen), findsOneWidget);
    });

    testWidgets('a tap while the app was in the background: 알림', (tester) async {
      final push = await open(tester, EmployerRoutes.home, FakePush());
      expect(find.byType(EmployerNotificationsScreen), findsNothing);
      push.tap();
      await tester.pumpAndSettle();
      expect(find.byType(EmployerNotificationsScreen), findsOneWidget);
    });
  });
}

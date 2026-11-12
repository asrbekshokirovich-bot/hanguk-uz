import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/live_updates.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/design/widgets/qr.dart';
import 'package:hanguk_ish/features/employer/biz.dart';
import 'package:hanguk_ish/features/employer/providers.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_repository.dart';
import 'package:hanguk_ish/features/worker/work/work_screens.dart';

import '../helpers/employer_harness.dart';
import '../helpers/fonts.dart';
import '../helpers/live.dart';
import '../helpers/phone.dart';
import '../helpers/worker_harness.dart';

/// The demo business whose calls named in [offline] fail as if offline.
class OfflineEmployer extends DemoEmployerRepository {
  OfflineEmployer({this.none = false}) : super(now: employerPrototypeNow, clock: () => employerPrototypeNow);

  /// No business registered yet.
  final bool none;
  final Set<String> offline = {};

  /// Notifications that arrive during the test, newest first.
  final List<EmployerNotification> arriving = [];
  int marks = 0;

  Future<T> _call<T>(String name, Future<T> Function() call) async {
    if (offline.contains(name)) throw const OfflineException();
    return call();
  }

  @override
  Future<List<Business>> businesses() => _call('businesses', () async => none ? const [] : await super.businesses());

  @override
  Future<List<EmployerShift>> shifts(String businessId, DateTime from, DateTime to) =>
      _call('shifts', () => super.shifts(businessId, from, to));

  @override
  Future<EmployerShift?> shift(String shiftId) => _call('shift', () => super.shift(shiftId));

  @override
  Future<String> shiftQr(String shiftId) => _call('qr', () => super.shiftQr(shiftId));

  @override
  Future<List<ShiftTemplate>> templates(String businessId) => _call('templates', () => super.templates(businessId));

  @override
  Future<int> minimumWage(DateTime at) => _call('minimumWage', () => super.minimumWage(at));

  @override
  Future<List<WorkerCard>> workers(String businessId) => _call('workers', () => super.workers(businessId));

  @override
  Future<BusinessReport> report(String businessId, DateTime from, DateTime to) =>
      _call('report', () => super.report(businessId, from, to));

  @override
  Future<List<EmployerNotification>> notifications() =>
      _call('notifications', () async => [...arriving, ...await super.notifications()]);

  @override
  Future<void> markNotificationsRead() async {
    marks++;
    for (var i = 0; i < arriving.length; i++) {
      arriving[i] = arriving[i].markRead();
    }
    await super.markNotificationsRead();
  }
}

/// The worker's demo shifts with calls named in [offline] failing.
class OfflineShifts extends DemoShiftRepository {
  OfflineShifts(TestClock clock) : super(now: prototypeNow, clock: clock.call);

  final Set<String> offline = {};

  Future<T> _call<T>(String name, Future<T> Function() call) async {
    if (offline.contains(name)) throw const OfflineException();
    return call();
  }

  @override
  Future<List<MyShift>> myShifts() => _call('myShifts', () => super.myShifts());

  @override
  Future<MyShift?> myShift(String applicationId) => _call('myShift', () => super.myShift(applicationId));

  @override
  Future<List<ChatMessage>> messages(String applicationId) => _call('messages', () => super.messages(applicationId));
}

/// The worker's demo account with calls named in [offline] failing.
class OfflineAccount extends DemoAccountRepository {
  OfflineAccount() : super(now: prototypeNow);

  final Set<String> offline = {};
  final List<HiNotification> arriving = [];
  int marks = 0;

  Future<T> _call<T>(String name, Future<T> Function() call) async {
    if (offline.contains(name)) throw const OfflineException();
    return call();
  }

  @override
  Future<WorkerStats> stats() => _call('stats', () => super.stats());

  @override
  Future<List<HiNotification>> notifications() =>
      _call('notifications', () async => [...arriving, ...await super.notifications()]);

  @override
  Future<void> markNotificationsRead() async {
    marks++;
    for (var i = 0; i < arriving.length; i++) {
      arriving[i] = arriving[i].markRead();
    }
    await super.markNotificationsRead();
  }
}

/// A saved profile that cannot be loaded while [offline].
class OfflineProfile extends InMemoryWorkerProfileRepository {
  bool offline = true;

  @override
  Future<WorkerProfileDraft?> load() async {
    if (offline) throw const OfflineException();
    return super.load();
  }
}

const _uzOffline = "Internet aloqasi yo'q";
const _uzRetry = 'Qayta urinish';

void main() {
  setUpAll(loadHiFonts);

  group('owner app', () {
    Future<ProviderContainer> open(
      WidgetTester tester,
      OfflineEmployer repo, {
      String location = EmployerRoutes.home,
      List<Override> overrides = const [],
    }) async {
      usePhone(tester);
      final container = employerContainer(location: location, repository: repo, overrides: overrides);
      addTearDown(container.dispose);
      await tester.pumpWidget(employerHarness(container));
      await tester.pumpAndSettle();
      return container;
    }

    Future<void> retry(WidgetTester tester) async {
      final button = find.text(Biz.retry);
      await tester.ensureVisible(button);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    testWidgets('BA1 offline says so instead of an empty day; 다시 시도 loads it', (tester) async {
      final repo = OfflineEmployer()..offline.add('shifts');
      await open(tester, repo);
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      expect(find.text(Biz.offlineText), findsOneWidget);
      expect(find.text(Biz.noShiftsToday), findsNothing, reason: 'not an empty day');
      expect(find.text('남은 자리'), findsNothing, reason: 'no counts that are not known');
      expect(find.text('오늘의 근무'), findsOneWidget, reason: 'the header stays');

      repo.offline.clear();
      await retry(tester);
      expect(find.text(Biz.offlineTitle), findsNothing);
      expect(find.text('오픈 바리스타 보조'), findsOneWidget);
      expect(find.text('남은 자리'), findsOneWidget);
    });

    testWidgets('a business list that failed at the start loads again on 다시 시도', (tester) async {
      final repo = OfflineEmployer()..offline.add('businesses');
      await open(tester, repo);
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      repo.offline.clear();
      await retry(tester);
      expect(find.text('달빛카페 신촌점'), findsOneWidget);
      expect(find.text('오픈 바리스타 보조'), findsOneWidget);
    });

    testWidgets('a failed pull-to-refresh keeps the day and says why', (tester) async {
      final repo = OfflineEmployer();
      await open(tester, repo);
      repo.offline.add('shifts');
      await tester.fling(find.text('오늘의 근무'), const Offset(0, 400), 1000);
      await tester.pumpAndSettle();
      expect(find.text('오픈 바리스타 보조'), findsOneWidget, reason: 'the last list stays');
      expect(find.text('인터넷 연결을 확인해 주세요'), findsOneWidget);
    });

    testWidgets('BA3 not loaded: the back button stays; then the shift; a missing one says so', (tester) async {
      final repo = OfflineEmployer()..offline.add('shift');
      await open(tester, repo, location: EmployerRoutes.shift('demo-es-close'));
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      expect(find.bySemanticsLabel(Biz.back), findsOneWidget);
      repo.offline.clear();
      await retry(tester);
      expect(find.text('마감 정리 보조'), findsWidgets);
    });

    testWidgets('BA3 of a shift that is gone', (tester) async {
      await open(tester, OfflineEmployer(), location: EmployerRoutes.shift('no-such-shift'));
      expect(find.text(Biz.shiftNotFound), findsOneWidget);
      expect(find.bySemanticsLabel(Biz.back), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('BA3 QR that did not load offers 다시 시도 instead of sharing', (tester) async {
      final repo = OfflineEmployer()..offline.add('qr');
      await open(tester, repo, location: EmployerRoutes.shift('demo-es-close'));
      // The card is at the bottom of a lazy list: scroll it into being.
      await tester.scrollUntilVisible(find.text(Biz.offlineTitle), 300, scrollable: find.byType(Scrollable).first);
      await tester.pumpAndSettle();
      expect(find.text(Biz.qrShare), findsNothing);
      expect(find.byType(HiQrCode), findsNothing);
      repo.offline.clear();
      await retry(tester);
      expect(find.byType(HiQrCode), findsOneWidget);
      expect(find.text(Biz.qrShare), findsOneWidget);
    });

    testWidgets('BA4 offline: no «no workers yet», no counts', (tester) async {
      final repo = OfflineEmployer()..offline.add('workers');
      await open(tester, repo, location: EmployerRoutes.workers);
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      expect(find.text(Biz.noFavorites), findsNothing);
      expect(find.text('0'), findsNothing);
      repo.offline.clear();
      await retry(tester);
      expect(find.text(Biz.offlineTitle), findsNothing);
      expect(find.text(Biz.requestAgain), findsWidgets);
    });

    testWidgets('BA5 offline: an error, not an endless spinner', (tester) async {
      final repo = OfflineEmployer()..offline.add('report');
      await open(tester, repo, location: EmployerRoutes.report);
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      repo.offline.clear();
      await retry(tester);
      expect(find.text(Biz.offlineTitle), findsNothing);
    });

    testWidgets('알림: offline, then the list; one arriving while open shows up and is marked read', (tester) async {
      final live = ManualLive();
      final repo = OfflineEmployer()..offline.add('notifications');
      final container = await open(
        tester,
        repo,
        location: EmployerRoutes.notifications,
        overrides: [liveUpdatesProvider.overrideWithValue(live)],
      );
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      repo.offline.clear();
      await retry(tester);
      expect(find.text(Biz.notifNewApplicantText('Sevara Nazarova', '마감 정리 보조')), findsOneWidget);
      final marksBefore = repo.marks;
      expect(marksBefore, greaterThan(0), reason: 'opening the list marks them read');

      repo.arriving.add(EmployerNotification(
        id: 'arrived-1',
        kind: EmployerNotificationKind.noShow,
        createdAt: employerPrototypeNow,
        shiftId: 'demo-es-close',
        shiftTitle: '마감 정리 보조',
        workerName: 'Malika Yusupova',
      ));
      live.fire();
      await tester.pumpAndSettle();
      expect(find.text(Biz.notifNoShowText('Malika Yusupova', '마감 정리 보조')), findsOneWidget);
      expect(repo.marks, greaterThan(marksBefore), reason: 'the new one is marked read too');
      expect(await container.read(employerNotificationsProvider.future).then((all) => all.where((n) => !n.read)), isEmpty);
    });

    testWidgets('BA2 without templates (offline) opens empty; without the minimum wage it shows no hint', (tester) async {
      final repo = OfflineEmployer()..offline.addAll(['templates', 'minimumWage']);
      await open(tester, repo, location: EmployerRoutes.create);
      expect(find.byType(CircularProgressIndicator), findsNothing, reason: 'not stuck');
      expect(find.text(Biz.post), findsWidgets);
      expect(find.textContaining('최저시급'), findsNothing);
    });

    testWidgets("BA2 without a template starts with the store's address", (tester) async {
      final repo = OfflineEmployer()..offline.add('templates');
      await open(tester, repo, location: EmployerRoutes.create);
      expect(find.text('마포구 신촌로12길 15, 2층'), findsOneWidget);
      expect(find.text('최저시급 10,320원 이상'), findsOneWidget);
    });

    testWidgets('BA2 for a shift that did not load: the close button and 다시 시도', (tester) async {
      final repo = OfflineEmployer()..offline.add('shift');
      await open(tester, repo, location: EmployerRoutes.edit('demo-es-close'));
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      expect(find.bySemanticsLabel(Biz.close), findsOneWidget);
      repo.offline.clear();
      await retry(tester);
      expect(find.text('근무 수정'), findsOneWidget);
    });

    testWidgets('a launch offline waits on the start screen, then opens BA1', (tester) async {
      final repo = OfflineEmployer()..offline.add('businesses');
      await open(
        tester,
        repo,
        location: EmployerRoutes.start,
        overrides: [authRepositoryProvider.overrideWithValue(DemoAuthRepository(userId: 'owner-1'))],
      );
      expect(find.text(Biz.offlineTitle), findsOneWidget);
      expect(find.text('오늘의 근무'), findsNothing);
      repo.offline.clear();
      await retry(tester);
      expect(find.text('오늘의 근무'), findsOneWidget);
    });

    testWidgets('a launch without a business goes to BA0 to register', (tester) async {
      await open(
        tester,
        OfflineEmployer(none: true),
        location: EmployerRoutes.start,
        overrides: [authRepositoryProvider.overrideWithValue(DemoAuthRepository(userId: 'owner-1'))],
      );
      expect(find.text('시작하기'), findsOneWidget);
    });

    testWidgets('a session that ends goes back to BA0', (tester) async {
      final auth = DemoAuthRepository(userId: 'owner-1');
      await open(tester, OfflineEmployer(), overrides: [authRepositoryProvider.overrideWithValue(auth)]);
      expect(find.text('오늘의 근무'), findsOneWidget);
      await auth.signOut();
      await tester.pumpAndSettle();
      expect(find.text('시작하기'), findsOneWidget);
    });
  });

  group('worker app', () {
    Future<ProviderContainer> open(
      WidgetTester tester, {
      required String location,
      ShiftRepository? repository,
      OfflineAccount? account,
      DateTime Function()? clock,
      List<Override> overrides = const [],
    }) async {
      usePhone(tester);
      final container = appContainer(
        location: location,
        repository: repository,
        account: account,
        clock: clock,
        overrides: overrides,
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(appHarness(container));
      await tester.pumpAndSettle();
      return container;
    }

    Future<void> retry(WidgetTester tester) async {
      final button = find.text(_uzRetry);
      await tester.ensureVisible(button);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    testWidgets('a launch offline never starts A02 again: the start screen waits, then the feed', (tester) async {
      final profile = OfflineProfile();
      await profile.save(prototypeProfile());
      final container = await open(tester, location: WorkerRoutes.start, overrides: [
        authRepositoryProvider.overrideWithValue(DemoAuthRepository(userId: 'u1')),
        workerProfileRepositoryProvider.overrideWithValue(profile),
      ]);
      container.read(workerProfileDraftProvider.notifier).replace(const WorkerProfileDraft());
      expect(find.text(_uzOffline), findsOneWidget);
      expect(find.text('Profil · 1 / 3'), findsNothing);
      profile.offline = false;
      await retry(tester);
      expect(find.text('Smenalar'), findsWidgets);
      expect(container.read(workerProfileDraftProvider).firstName, 'Aziz');
    });

    testWidgets('signed in by SMS while the profile does not load: the start screen, not A02', (tester) async {
      final profile = OfflineProfile();
      await profile.save(prototypeProfile());
      await open(tester, location: WorkerRoutes.phone, overrides: [
        workerProfileRepositoryProvider.overrideWithValue(profile),
      ]);
      await tester.enterText(find.byType(TextField), '01012345678');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kod olish'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pumpAndSettle();
      expect(find.text(_uzOffline), findsOneWidget);
      expect(find.text('Profil · 1 / 3'), findsNothing);
      profile.offline = false;
      await retry(tester);
      expect(find.text('Smenalar'), findsWidgets);
    });

    testWidgets('a session that ends goes back to A01', (tester) async {
      final auth = DemoAuthRepository(userId: 'u1');
      await open(tester, location: WorkerRoutes.feed, overrides: [authRepositoryProvider.overrideWithValue(auth)]);
      await auth.signOut();
      await tester.pumpAndSettle();
      expect(find.text('Telefon raqam bilan'), findsOneWidget);
    });

    testWidgets('A12 offline, then the list; one arriving while open shows up and is marked read', (tester) async {
      final live = ManualLive();
      final account = OfflineAccount()..offline.add('notifications');
      await open(
        tester,
        location: WorkerRoutes.notifications,
        account: account,
        overrides: [liveUpdatesProvider.overrideWithValue(live)],
      );
      expect(find.text(_uzOffline), findsOneWidget);
      account.offline.clear();
      await retry(tester);
      expect(find.text(_uzOffline), findsNothing);
      final marksBefore = account.marks;
      expect(marksBefore, greaterThan(0));

      account.arriving.add(HiNotification(
        id: 'arrived-1',
        kind: NotificationKind.paid,
        createdAt: prototypeNow,
        businessNames: const {'uz': 'Dalbit Kafe · Sinchon'},
        startsAt: prototypeNow,
        endsAt: prototypeNow.add(const Duration(hours: 5)),
        amount: 60000,
      ));
      live.fire();
      await tester.pumpAndSettle();
      expect(find.text("Maosh to'landi"), findsOneWidget);
      expect(account.marks, greaterThan(marksBefore));
    });

    testWidgets('A10 chat offline is not «no messages yet»', (tester) async {
      final clock = TestClock(prototypeNow);
      final repo = OfflineShifts(clock);
      final app = await repo.apply('demo-1');
      clock.at(11, 30);
      repo.offline.add('messages');
      await open(tester, location: WorkerRoutes.chat(app.applicationId), repository: repo, clock: clock.call);
      expect(find.text(_uzOffline), findsOneWidget);
      expect(find.text("Hali xabar yo'q. Ish beruvchiga birinchi bo'lib yozing."), findsNothing);
      repo.offline.clear();
      await retry(tester);
      expect(find.text('Qora shim kiyib keling. Fartukni do\'konda beramiz.'), findsOneWidget);
    });

    testWidgets('A07 without its shift: the close button and 다시 시도, not a blank screen', (tester) async {
      final clock = TestClock(prototypeNow);
      final repo = OfflineShifts(clock);
      final app = await repo.apply('demo-1');
      repo.offline.add('myShift');
      await open(tester, location: WorkerRoutes.atWork(app.applicationId), repository: repo, clock: clock.call);
      expect(find.text(_uzOffline), findsOneWidget);
      expect(find.bySemanticsLabel('Yopish'), findsOneWidget);
      repo.offline.clear();
      await retry(tester);
      expect(find.text(_uzOffline), findsNothing);
      expect(find.byType(AtWorkScreen), findsOneWidget);
    });

    testWidgets('A09 offline shows no 0 ₩ month', (tester) async {
      final repo = OfflineShifts(TestClock(prototypeNow))..offline.add('myShifts');
      await open(tester, location: WorkerRoutes.earnings, repository: repo);
      expect(find.text(_uzOffline), findsOneWidget);
      expect(find.text("Bu oyda bajarilgan smena yo'q"), findsNothing);
      repo.offline.clear();
      await retry(tester);
      expect(find.text(_uzOffline), findsNothing);
    });

    testWidgets('A11: numbers that did not load are dashes, not 100 and 0', (tester) async {
      final account = OfflineAccount()..offline.add('stats');
      await open(tester, location: WorkerRoutes.me, account: account);
      expect(find.text('—'), findsNWidgets(3));
      expect(find.text('Baholar'), findsOneWidget);
      expect(find.text('100'), findsNothing);
    });
  });
}

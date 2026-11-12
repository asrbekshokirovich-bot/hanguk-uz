import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/repositories/account_repository.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/employer_repository.dart';
import 'package:hanguk_ish/data/repositories/live_updates.dart';
import 'package:hanguk_ish/features/employer/providers.dart';
import 'package:hanguk_ish/features/worker/notifications/unread.dart';

import '../helpers/live.dart';

class CountingAccount extends DemoAccountRepository {
  int loads = 0;

  @override
  Future<List<HiNotification>> notifications() {
    loads++;
    return super.notifications();
  }
}

class CountingEmployer extends DemoEmployerRepository {
  CountingEmployer() : super(now: employerPrototypeNow, clock: () => employerPrototypeNow);

  int bells = 0;

  @override
  Future<List<EmployerNotification>> notifications() {
    bells++;
    return super.notifications();
  }
}

void main() {
  test('a change on the server reloads A12 and its badge', () async {
    final live = ManualLive();
    final account = CountingAccount();
    final container = ProviderContainer(overrides: [
      liveUpdatesProvider.overrideWithValue(live),
      accountRepositoryProvider.overrideWithValue(account),
    ]);
    addTearDown(container.dispose);
    final subscription = container.listen(unreadNotificationsProvider, (_, _) {});
    addTearDown(subscription.close);
    await container.read(notificationsProvider.future);
    await pumpEventQueue();
    final before = account.loads;
    live.fire();
    await pumpEventQueue();
    await container.read(notificationsProvider.future);
    expect(account.loads, before + 1);
    live.fire();
    live.fire();
    await pumpEventQueue();
    await container.read(notificationsProvider.future);
    expect(account.loads, greaterThanOrEqualTo(before + 2));
  });

  test('the owner\'s bell reloads too', () async {
    final live = ManualLive();
    final employer = CountingEmployer();
    final container = ProviderContainer(overrides: [
      liveUpdatesProvider.overrideWithValue(live),
      employerRepositoryProvider.overrideWithValue(employer),
    ]);
    addTearDown(container.dispose);
    final subscription = container.listen(employerUnreadProvider, (_, _) {});
    addTearDown(subscription.close);
    await container.read(employerNotificationsProvider.future);
    await pumpEventQueue();
    final before = employer.bells;
    live.fire();
    await pumpEventQueue();
    await container.read(employerNotificationsProvider.future);
    expect(employer.bells, before + 1);
  });

  test('coming back to the app reloads too', () async {
    final resumes = StreamController<void>.broadcast();
    addTearDown(resumes.close);
    final account = CountingAccount();
    final container = ProviderContainer(overrides: [
      liveUpdatesProvider.overrideWithValue(ManualLive()),
      appResumesProvider.overrideWithValue(resumes.stream),
      accountRepositoryProvider.overrideWithValue(account),
    ]);
    addTearDown(container.dispose);
    final subscription = container.listen(unreadNotificationsProvider, (_, _) {});
    addTearDown(subscription.close);
    await container.read(notificationsProvider.future);
    await pumpEventQueue();
    final before = account.loads;
    resumes.add(null);
    await pumpEventQueue();
    await container.read(notificationsProvider.future);
    expect(account.loads, before + 1, reason: 'changes made while the phone slept are fetched');
  });

  test('signing in reconnects; the demo has no live updates', () async {
    final live = ManualLive();
    final auth = DemoAuthRepository();
    final container = ProviderContainer(overrides: [
      liveUpdatesProvider.overrideWithValue(live),
      authRepositoryProvider.overrideWithValue(auth),
    ]);
    addTearDown(container.dispose);
    final subscription = container.listen(liveTickProvider, (_, _) {});
    addTearDown(subscription.close);
    await pumpEventQueue();
    final first = live.listens;
    await auth.verifyCode('01012345678', '123456');
    await pumpEventQueue();
    expect(live.listens, first + 1, reason: 'a new subscription for the signed-in person');
    expect(await const NoLiveUpdates().changes().isEmpty, isTrue);
  });
}

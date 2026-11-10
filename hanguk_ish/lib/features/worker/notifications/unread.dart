import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/account.dart';
import '../../../data/repositories/account_repository.dart';
import '../../../data/repositories/live_updates.dart';

/// A12's notifications, newest first.
final notificationsProvider = FutureProvider.autoDispose<List<HiNotification>>(
  (ref) {
    ref.watch(liveTickProvider);
    return ref.watch(accountRepositoryProvider).notifications();
  },
  retry: (count, error) => null,
);

/// Unread notifications: the amber dot on the bell (A03, A04).
final unreadNotificationsProvider = Provider.autoDispose<int>(
  (ref) => ref.watch(notificationsProvider).value?.where((n) => !n.read).length ?? 0,
);

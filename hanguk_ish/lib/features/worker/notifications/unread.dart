import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/demo/demo_shifts.dart';

/// Unread notifications: the amber dot on the bell (A03, A04).
final unreadNotificationsProvider = Provider<int>((ref) => demoUnreadNotifications);

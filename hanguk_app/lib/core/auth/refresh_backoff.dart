import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Offline, the SDK's token refresh fails every tick (10 s) and retries
/// within it — five or six requests every ten seconds while the network is
/// down (auth:token, status 0: 118 reports on one phone in four days, plan
/// R1.3). After a failed refresh this stops the SDK's ticking and starts it
/// again later: 30 s, then 1, 2, 4 … up to 10 minutes; a refresh that
/// succeeds resets the wait. The SDK starts ticking again on its own when the
/// app comes back to the foreground, and a request made meanwhile still
/// refreshes an expired token itself.
class RefreshBackoff {
  RefreshBackoff({
    required Stream<AuthState> changes,
    required VoidCallback stop,
    required VoidCallback start,
    Duration first = const Duration(seconds: 30),
    Duration max = const Duration(minutes: 10),
  }) : _stop = stop,
       _start = start,
       _first = first,
       _max = max {
    _sub = changes.listen(
      (s) {
        if (s.event == AuthChangeEvent.tokenRefreshed || s.event == AuthChangeEvent.signedIn) _wait = null;
      },
      onError: (Object e) {
        if (e is AuthRetryableFetchException) _pause();
      },
    );
  }

  final VoidCallback _stop;
  final VoidCallback _start;
  final Duration _first;
  final Duration _max;
  late final StreamSubscription<AuthState> _sub;
  Timer? _timer;
  Duration? _wait;

  /// How long the ticking stays stopped after the latest failure.
  @visibleForTesting
  Duration? get wait => _wait;

  void _pause() {
    if (_timer?.isActive ?? false) return;
    final next = _wait == null ? _first : _wait! * 2;
    _wait = next > _max ? _max : next;
    _stop();
    _timer = Timer(_wait!, _start);
  }

  void dispose() {
    _timer?.cancel();
    unawaited(_sub.cancel());
  }

  /// For the app: the Supabase client's own auth.
  static RefreshBackoff? attach() {
    try {
      final auth = Supabase.instance.client.auth;
      return RefreshBackoff(changes: auth.onAuthStateChange, stop: auth.stopAutoRefresh, start: auth.startAutoRefresh);
    } catch (e) {
      debugPrint('[RefreshBackoff] $e');
      return null;
    }
  }
}

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/auth/refresh_backoff.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  testWidgets('a failed refresh stops the ticking, then starts it again later and later', (t) async {
    final changes = StreamController<AuthState>.broadcast();
    var stops = 0, starts = 0;
    final b = RefreshBackoff(changes: changes.stream, stop: () => stops++, start: () => starts++);
    addTearDown(() {
      b.dispose();
      changes.close();
    });
    void fail() => changes.addError(AuthRetryableFetchException(message: 'offline', statusCode: '0'));

    fail();
    await t.pump();
    expect(stops, 1);
    expect(b.wait, const Duration(seconds: 30));
    // Further failures while stopped change nothing.
    fail();
    await t.pump();
    expect(stops, 1);

    await t.pump(const Duration(seconds: 30));
    expect(starts, 1);
    fail();
    await t.pump();
    expect(stops, 2);
    expect(b.wait, const Duration(minutes: 1));

    // Back online: a refresh resets the wait.
    await t.pump(const Duration(minutes: 1));
    expect(starts, 2);
    changes.add(AuthState(AuthChangeEvent.tokenRefreshed, null));
    await t.pump();
    expect(b.wait, isNull);

    // Other errors do not stop it.
    changes.addError(StateError('x'));
    await t.pump();
    expect(stops, 2);
  });

  testWidgets('the wait stops growing at ten minutes', (t) async {
    final changes = StreamController<AuthState>.broadcast();
    final b = RefreshBackoff(changes: changes.stream, stop: () {}, start: () {});
    addTearDown(() {
      b.dispose();
      changes.close();
    });
    for (var i = 0; i < 10; i++) {
      changes.addError(AuthRetryableFetchException(message: 'offline'));
      await t.pump();
      await t.pump(b.wait!);
    }
    expect(b.wait, const Duration(minutes: 10));
  });
}

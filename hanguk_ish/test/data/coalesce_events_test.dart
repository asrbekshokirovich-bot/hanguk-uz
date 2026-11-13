import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/backend/supabase_live_updates.dart';

void main() {
  const window = Duration(milliseconds: 40);

  test('a burst of changes (a chat marked read, row by row) is one reload, after the last', () async {
    final source = StreamController<void>();
    final out = <DateTime>[];
    final subscription = coalesceEvents(source.stream, window).listen((_) => out.add(DateTime.now()));
    addTearDown(subscription.cancel);
    final started = DateTime.now();
    for (var i = 0; i < 5; i++) {
      source.add(null);
    }
    await Future<void>.delayed(window * 3);
    expect(out, hasLength(1));
    expect(out.single.difference(started), greaterThanOrEqualTo(window));
  });

  test('changes further apart are each a reload', () async {
    final source = StreamController<void>();
    var count = 0;
    final subscription = coalesceEvents(source.stream, window).listen((_) => count++);
    addTearDown(subscription.cancel);
    source.add(null);
    await Future<void>.delayed(window * 3);
    source.add(null);
    await Future<void>.delayed(window * 3);
    expect(count, 2);
  });

  test('a change still waiting when the source ends comes out; nothing after cancelling', () async {
    final source = StreamController<void>();
    var count = 0;
    var done = false;
    coalesceEvents(source.stream, const Duration(seconds: 5)).listen((_) => count++, onDone: () => done = true);
    source.add(null);
    await source.close();
    await pumpEventQueue();
    expect(count, 1);
    expect(done, isTrue);

    final again = StreamController<void>();
    var afterCancel = 0;
    final subscription = coalesceEvents(again.stream, window).listen((_) => afterCancel++);
    again.add(null);
    await subscription.cancel();
    await Future<void>.delayed(window * 3);
    expect(afterCancel, 0);
    expect(again.hasListener, isFalse, reason: 'the channel is let go');
  });
}

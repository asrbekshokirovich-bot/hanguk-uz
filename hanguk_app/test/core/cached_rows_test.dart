import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/cache/cached_rows.dart';
import 'package:hanguk_app/core/cache/snapshot_queries.dart';

/// A store in memory: [saved] by name, [shipped] by asset.
class _Store {
  final saved = <String, String>{};
  final shipped = <String, String>{};

  CachedRowsStore get store => CachedRowsStore(
    read: (name) async => saved[name],
    write: (name, json) async => saved[name] = json,
    bundled: (asset) async => shipped[asset],
  );
}

void main() {
  late _Store s;
  late DateTime now;
  CachedRows rows({String query = 'q'}) =>
      CachedRows('t', query: query, asset: 'assets/data/t.json', store: s.store, now: () => now);

  setUp(() {
    s = _Store();
    now = DateTime.utc(2026, 11, 5, 12);
  });

  test('nothing kept: waits for the network and saves its rows', () async {
    final c = rows();
    final got = await c.load(() async => [
      {'id': 'a'},
    ]);
    expect(got, [
      {'id': 'a'},
    ]);
    await pumpEventQueue();
    final saved = jsonDecode(s.saved['t']!) as Map;
    expect(saved['q'], 'q');
    expect(saved['rows'], [
      {'id': 'a'},
    ]);
  });

  test('nothing kept and the network fails: the error reaches the screen', () async {
    final c = rows();
    await expectLater(c.load(() async => throw StateError('offline')), throwsStateError);
  });

  test('the shipped copy shows at once, then the network rows', () async {
    s.shipped['assets/data/t.json'] = jsonEncode([
      {'id': 'shipped'},
    ]);
    final c = rows();
    final network = Completer<List<dynamic>>();
    var fresh = 0;
    final got = await c.load(() => network.future, onFresh: () => fresh++);
    expect(got, [
      {'id': 'shipped'},
    ]);
    expect(fresh, 0);

    network.complete([
      {'id': 'net'},
    ]);
    await pumpEventQueue();
    expect(fresh, 1);
    // The provider reads again: the new rows, with no second request.
    var requests = 0;
    expect(
      await c.load(() async {
        requests++;
        return [];
      }),
      [
        {'id': 'net'},
      ],
    );
    expect(requests, 0);
  });

  test('an empty shipped copy (a build without a snapshot) is not used', () async {
    s.shipped['assets/data/t.json'] = '[]';
    final c = rows();
    expect(
      await c.load(() async => [
        {'id': 'net'},
      ]),
      [
        {'id': 'net'},
      ],
    );
  });

  test('a recent saved copy is used without a request', () async {
    s.saved['t'] = jsonEncode({
      'v': 1,
      'q': 'q',
      'at': now.subtract(const Duration(minutes: 2)).toIso8601String(),
      'rows': [
        {'id': 'saved'},
      ],
    });
    var requests = 0;
    final got = await rows().load(() async {
      requests++;
      return [];
    });
    expect(got, [
      {'id': 'saved'},
    ]);
    expect(requests, 0);
  });

  test('an old saved copy shows at once and is refreshed', () async {
    s.saved['t'] = jsonEncode({
      'v': 1,
      'q': 'q',
      'at': now.subtract(const Duration(days: 3)).toIso8601String(),
      'rows': [
        {'id': 'old'},
      ],
    });
    var fresh = 0;
    final got = await rows().load(() async => [
      {'id': 'new'},
    ], onFresh: () => fresh++);
    expect(got, [
      {'id': 'old'},
    ]);
    await pumpEventQueue();
    expect(fresh, 1);
    expect((jsonDecode(s.saved['t']!) as Map)['rows'], [
      {'id': 'new'},
    ]);
  });

  test('a copy saved for another query is not used', () async {
    s.saved['t'] = jsonEncode({
      'v': 1,
      'q': 'old columns',
      'at': now.toIso8601String(),
      'rows': [
        {'id': 'old'},
      ],
    });
    expect(
      await rows().load(() async => [
        {'id': 'net'},
      ]),
      [
        {'id': 'net'},
      ],
    );
  });

  test('a failed refresh keeps the rows shown', () async {
    s.shipped['assets/data/t.json'] = jsonEncode([
      {'id': 'shipped'},
    ]);
    final c = rows();
    var fresh = 0;
    expect(await c.load(() async => throw StateError('offline'), onFresh: () => fresh++), [
      {'id': 'shipped'},
    ]);
    await pumpEventQueue();
    expect(fresh, 0);
    expect(await c.load(() async => throw StateError('offline')), [
      {'id': 'shipped'},
    ]);
  });

  test('loads at the same time share one request', () async {
    final c = rows();
    var requests = 0;
    final network = Completer<List<dynamic>>();
    final a = c.load(() {
      requests++;
      return network.future;
    });
    final b = c.load(() {
      requests++;
      return network.future;
    });
    network.complete([
      {'id': 'net'},
    ]);
    expect(await a, await b);
    expect(requests, 1);
  });

  test('every snapshot read has its asset under assets/data/', () {
    expect(kSnapshotReads.keys, everyElement(startsWith('assets/data/')));
    expect(kSnapshotReads[kMapAsset], contains('is_visible_on_map=eq.true'));
  });
}

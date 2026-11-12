import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/network/fetch_all_rows.dart';

/// An API that, like PostgREST, never returns more than [cap] rows at once.
class _Api {
  _Api(this.total, {this.cap = 1000});
  final int total;
  final int cap;
  final calls = <String>[];

  Future<List<dynamic>> page(int from, int to) async {
    calls.add('$from-$to');
    final end = (to + 1).clamp(0, total);
    final last = end > from + cap ? from + cap : end;
    return [for (var i = from; i < last; i++) i];
  }
}

void main() {
  test('3333 rows come back whole, in order, in four requests', () async {
    final api = _Api(3333);
    final rows = await fetchAllRows(api.page);
    expect(rows.length, 3333);
    expect(rows.first, 0);
    expect(rows.last, 3332);
    expect(rows.toSet().length, 3333);
    expect(api.calls, ['0-999', '1000-1999', '2000-2999', '3000-3999']);
  });

  test('a short list is one request', () async {
    final api = _Api(177);
    expect((await fetchAllRows(api.page)).length, 177);
    expect(api.calls, ['0-999']);
  });

  test('exactly one full page: the next request comes back empty and ends it', () async {
    final api = _Api(1000);
    expect((await fetchAllRows(api.page)).length, 1000);
    expect(api.calls, ['0-999', '1000-1999']);
  });

  test('nothing at all', () async {
    final api = _Api(0);
    expect(await fetchAllRows(api.page), isEmpty);
    expect(api.calls, ['0-999']);
  });

  test('a failed page is not swallowed', () async {
    var n = 0;
    Future<List<dynamic>> page(int from, int to) async {
      if (n++ == 1) throw StateError('network');
      return List.filled(1000, 0);
    }

    await expectLater(fetchAllRows(page), throwsStateError);
  });

  test('a list that never ends is stopped', () async {
    Future<List<dynamic>> page(int from, int to) async => List.filled(10, 0);
    await expectLater(fetchAllRows(page, pageSize: 10, maxPages: 3), throwsStateError);
  });
}

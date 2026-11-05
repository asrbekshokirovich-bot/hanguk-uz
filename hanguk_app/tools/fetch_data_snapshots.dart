// Fills assets/data/*.json with the current rows of the public catalogue
// reads (lib/core/cache/snapshot_queries.dart), so a first launch shows the
// universities at once instead of waiting on the network (CachedRows).
//
//   dart run tools/fetch_data_snapshots.dart
//
// Run from hanguk_app/ before a release build; CI does it in every build
// workflow. Reads with the public (anon) key the app ships — the same rows
// any visitor sees. SUPABASE_URL / SUPABASE_ANON_KEY override the ones in
// lib/main.dart. A read that fails leaves its file as it was, so a build
// never stops on it.
import 'dart:convert';
import 'dart:io';

import 'package:hanguk_app/core/cache/snapshot_queries.dart';

Future<void> main() async {
  final main = File('lib/main.dart').readAsStringSync();
  final url = Platform.environment['SUPABASE_URL'] ?? RegExp(r"url:\s*'([^']+)'").firstMatch(main)?.group(1);
  final key = Platform.environment['SUPABASE_ANON_KEY'] ?? RegExp(r"anonKey:\s*'([^']+)'").firstMatch(main)?.group(1);
  if (url == null || key == null) {
    stderr.writeln('fetch_data_snapshots: no Supabase URL/key found');
    exitCode = 1;
    return;
  }

  final http = HttpClient()..connectionTimeout = const Duration(seconds: 20);
  var failed = 0;
  for (final MapEntry(key: asset, value: path) in kSnapshotReads.entries) {
    try {
      final req = await http.getUrl(Uri.parse('$url/rest/v1/${path.replaceAll(' ', '')}'));
      req.headers
        ..set('apikey', key)
        ..set('Authorization', 'Bearer $key')
        ..set('Accept', 'application/json');
      final res = await req.close().timeout(const Duration(seconds: 60));
      final body = await res.transform(utf8.decoder).join();
      if (res.statusCode != 200) throw HttpException('HTTP ${res.statusCode}: $body');
      final rows = jsonDecode(body);
      if (rows is! List || rows.isEmpty) throw const FormatException('no rows');
      File(asset).writeAsStringSync(jsonEncode(rows));
      stdout.writeln('$asset: ${rows.length} rows');
    } catch (e) {
      failed++;
      stderr.writeln('$asset: kept as it was ($e)');
    }
  }
  http.close();
  if (failed > 0) exitCode = 1;
}

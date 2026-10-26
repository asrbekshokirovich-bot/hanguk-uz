import 'package:http/http.dart' as http;

import 'app_events.dart';

/// The http client Supabase uses: every call to the backend that fails
/// (`rpc_error`, with its status — 0 when the network failed) or takes over
/// three seconds (`rpc_slow`) is recorded under the name of what was called:
/// `rpc:<function>`, `db:<table>`, `fn:<edge function>`, `auth:<step>`,
/// `storage`. Never the query, the body or an id.
class TrackingHttpClient extends http.BaseClient {
  TrackingHttpClient([http.Client? inner]) : _inner = inner ?? http.Client();

  final http.Client _inner;
  int _reported = 0;

  /// The analytics' own calls are not reported (a failing send would report
  /// itself forever).
  static const _quiet = {'rpc:app_events_log', 'rpc:app_events_log_v2'};

  static const _slowMs = 3000;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final watch = Stopwatch()..start();
    try {
      final res = await _inner.send(request);
      _observe(request.url, res.statusCode, watch.elapsedMilliseconds);
      return res;
    } catch (_) {
      _observe(request.url, 0, watch.elapsedMilliseconds);
      rethrow;
    }
  }

  void _observe(Uri url, int status, int ms) {
    final name = callName(url);
    if (name == null || _quiet.contains(name) || _reported >= 30) return;
    if (status == 0 || status >= 400) {
      _reported++;
      AppEvents.track('rpc_error', props: {'name': name, 'status': status});
    } else if (ms > _slowMs) {
      _reported++;
      AppEvents.track('rpc_slow', props: {'name': name, 'ms': ms});
    }
  }

  /// "rpc:app_quiz_submit" for /rest/v1/rpc/app_quiz_submit, and so on; null
  /// for anything that is not the backend.
  static String? callName(Uri url) {
    final s = url.pathSegments;
    String clean(String x) => x.length > 48 ? x.substring(0, 48) : x;
    if (s.length >= 4 && s[0] == 'rest' && s[2] == 'rpc') return 'rpc:${clean(s[3])}';
    if (s.length >= 3 && s[0] == 'rest') return 'db:${clean(s[2])}';
    if (s.length >= 3 && s[0] == 'functions') return 'fn:${clean(s[2])}';
    if (s.length >= 3 && s[0] == 'auth') return 'auth:${clean(s[2])}';
    if (s.isNotEmpty && s[0] == 'storage') return 'storage';
    return null;
  }

  @override
  void close() => _inner.close();
}

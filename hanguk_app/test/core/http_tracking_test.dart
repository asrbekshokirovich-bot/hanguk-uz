import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/http_tracking.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  final seen = <TrackedEvent>[];
  setUp(() {
    seen.clear();
    AppEvents.debugOnTrack = seen.add;
  });
  tearDown(() => AppEvents.debugOnTrack = null);

  test('a call that keeps failing is reported three times, and other failures still are', () async {
    final client = TrackingHttpClient(MockClient((req) async {
      if (req.url.path.contains('/auth/')) throw http.ClientException('offline');
      return http.Response('nope', 500);
    }));
    for (var i = 0; i < 20; i++) {
      await expectLater(client.post(Uri.parse('https://x.supabase.co/auth/v1/token?grant_type=refresh_token')), throwsA(isA<http.ClientException>()));
    }
    await client.get(Uri.parse('https://x.supabase.co/rest/v1/v_app_university_catalog'));
    final errors = seen.where((e) => e.event == 'rpc_error').toList();
    expect(errors.where((e) => e.props!['name'] == 'auth:token'), hasLength(3));
    expect(errors.where((e) => e.props!['name'] == 'db:v_app_university_catalog').single.props!['status'], 500);
  });
}

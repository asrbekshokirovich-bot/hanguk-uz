// ensureTestSession on the real Supabase client (audit P-F4, C-F7, C-F12,
// 2026-11-10). An http MockClient stands in for the network and
// FlutterSecureStorage's test platform for the phone's store, so the request
// and the reading of each answer are the app's own: what is asked for, where,
// and what the client throws — which the fake in guest_test_session_test.dart
// copies.

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthClientOptions, SupabaseClient;

/// Where the phone keeps the test user's credentials.
const _credsKey = 'guest_test_creds_v1';

const _function = '/functions/v1/guest-test-session';
const _token = '/auth/v1/token';

Map<String, Object?> _user(String n) => {
  'id': 'u$n',
  'aud': 'authenticated',
  'email': 'guest-$n@hanguk.local',
  'app_metadata': {'provider': 'email', 'guest': true},
  'user_metadata': {'guest': true},
  'created_at': '2026-11-10T05:16:06Z',
};

/// The auth server's session for guest [n] (as its password sign-in answers).
Map<String, Object?> _session(String n) => {
  'access_token': 'at$n',
  'refresh_token': 'rt$n',
  'expires_in': 3600,
  'token_type': 'bearer',
  'user': _user(n),
};

http.Response _json(Object body, int status, {Map<String, String> headers = const {}}) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json', ...headers});

/// guest-test-session's answer to {"session": true} for guest [n].
http.Response _guest(String n) =>
    _json({'email': 'guest-$n@hanguk.local', 'password': 'pw${n}Aa1', 'session': _session(n)}, 200);

/// The auth server refusing a password (API 2024-01-01, as the client asks).
http.Response _invalidLogin() => _json(
  {'code': 'invalid_credentials', 'msg': 'Invalid login credentials'},
  400,
  headers: {'x-supabase-api-version': '2024-01-01'},
);

void main() {
  late Map<String, String> store;
  late List<http.Request> sent;
  late Future<http.Response> Function(http.Request request) server;
  late SupabaseClient client;
  late List<TrackedEvent> seen;

  /// The paths asked for, in order.
  List<String> paths() => [for (final r in sent) r.url.path];

  /// The `app_error` events' error types.
  List<Object?> errors() => [
    for (final e in seen)
      if (e.event == 'app_error') e.props?['type'],
  ];

  setUp(() {
    store = {};
    FlutterSecureStorage.setMockInitialValues(store);
    sent = [];
    seen = [];
    AppEvents.debugReset();
    AppEvents.debugOnTrack = seen.add;
    client = SupabaseClient(
      'https://stub.supabase.co',
      'sb_publishable_test',
      httpClient: MockClient((request) {
        sent.add(request);
        return server(request);
      }),
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    debugTestSessionBackend = supabaseTestSessionBackend(client);
  });

  tearDown(() async {
    AppEvents.debugOnTrack = null;
    debugTestSessionBackend = null;
    await client.dispose();
  });

  test('the first ask runs in Seoul and asks for the session, which is set as it is', () async {
    server = (_) async => _guest('1');

    expect(await ensureTestSession(), isTrue);
    expect(paths(), [_function], reason: 'no password sign-in');
    final ask = sent.single;
    expect(ask.method, 'POST');
    expect(ask.url.queryParameters, {'forceFunctionRegion': 'ap-northeast-2'});
    expect(ask.headers['x-region'], isNull, reason: 'on the web that header needs a CORS preflight the function does not allow');
    expect(ask.headers['content-type'], startsWith('application/json'));
    expect(jsonDecode(ask.body), {'session': true}, reason: 'the function signs the user in only when asked (audit P-F4)');
    expect(client.auth.currentSession?.accessToken, 'at1');
    expect(client.auth.currentUser?.appMetadata['guest'], isTrue);
    expect(store[_credsKey], 'guest-1@hanguk.local\npw1Aa1');
  });

  test('a failed ask is asked once more, wherever the platform sends it, for the session too', () async {
    var n = 0;
    server = (_) async => n++ == 0 ? _json({'error': 'unavailable'}, 503) : _guest('2');

    expect(await ensureTestSession(), isTrue);
    expect(paths(), [_function, _function]);
    expect(sent.last.url.queryParameters, isEmpty);
    expect(jsonDecode(sent.last.body), {'session': true});
    expect(client.auth.currentSession?.accessToken, 'at2');
    expect(errors(), ['FunctionException']);
  });

  test('a 429 is thrown by the client, not handed back as data: false at once, no second ask', () async {
    server = (_) async => _json({'error': 'rate_limited'}, 429);

    expect(await ensureTestSession(), isFalse);
    expect(paths(), [_function]);
    expect(errors(), ['FunctionException']);
    expect(store, isEmpty);
    expect(client.auth.currentSession, isNull);
  });

  test('saved credentials that still sign in: no ask at all', () async {
    store[_credsKey] = 'guest-0@hanguk.local\nsecret0Aa1';
    server = (_) async => _json(_session('0'), 200);

    expect(await ensureTestSession(), isTrue);
    expect(paths(), [_token]);
    final body = jsonDecode(sent.single.body) as Map;
    expect((body['email'], body['password']), ('guest-0@hanguk.local', 'secret0Aa1'));
    expect(client.auth.currentSession?.accessToken, 'at0');
  });

  test('saved credentials the auth server refuses: dropped, and a fresh account', () async {
    store[_credsKey] = 'guest-0@hanguk.local\nold';
    server = (request) async => request.url.path == _token ? _invalidLogin() : _guest('1');

    expect(await ensureTestSession(), isTrue);
    expect(paths(), [_token, _function]);
    expect(sent.last.url.queryParameters, {'forceFunctionRegion': 'ap-northeast-2'});
    expect(store[_credsKey], 'guest-1@hanguk.local\npw1Aa1');
    expect(client.auth.currentSession?.accessToken, 'at1');
    expect(errors(), ['AuthApiException']);
  });

  test('saved credentials while offline, or with the auth server failing: kept, no new account', () async {
    final failures = <String, Future<http.Response> Function(http.Request request)>{
      'offline': (request) async => throw http.ClientException('Failed host lookup: stub.supabase.co', request.url),
      '503': (_) async => _json({'message': 'upstream connect error'}, 503),
    };
    for (final MapEntry(key: what, value: failing) in failures.entries) {
      store[_credsKey] = 'guest-0@hanguk.local\nsecret0Aa1';
      sent.clear();
      seen.clear();
      server = failing;

      expect(await ensureTestSession(), isFalse, reason: what);
      expect(store[_credsKey], 'guest-0@hanguk.local\nsecret0Aa1', reason: '$what is no answer about the account');
      expect(paths(), [_token], reason: '$what: a new account would replace the saved one');
      expect(errors(), ['AuthRetryableFetchException'], reason: what);
    }
  });
}

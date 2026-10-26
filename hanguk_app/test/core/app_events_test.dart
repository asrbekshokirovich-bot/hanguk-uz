import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/http_tracking.dart';
import 'package:hanguk_app/core/analytics/tracked.dart';

void main() {
  final seen = <TrackedEvent>[];
  setUp(() {
    seen.clear();
    AppEvents.debugReset();
    AppEvents.debugOnTrack = seen.add;
  });
  tearDown(() => AppEvents.debugOnTrack = null);

  Iterable<TrackedEvent> named(String event) => seen.where((e) => e.event == event);

  test('before start, nothing is sent and nothing throws', () {
    AppEvents.track('screen_view', screen: '/guest', props: {'tab': 'map'});
    AppEvents.linkLead('abc');
    AppEvents.flush();
    expect(AppEvents.deviceCode, isNull);
  });

  testWidgets('a shell route and its tab are one screen; switching tabs times the one left', (t) async {
    await t.pumpWidget(const SizedBox());
    AppEvents.routeChanged('/guest');
    AppEvents.tabChanged('/guest', 'home', initial: true);
    await t.pump();
    expect(named('screen_view').map((e) => e.screen), ['/guest#home']);
    expect(named('tab_open'), isEmpty);

    await t.pump(const Duration(seconds: 2));
    AppEvents.tabChanged('/guest', 'universities');
    await t.pump();
    expect(named('tab_open').single.props, {'tab': 'universities'});
    final leave = named('screen_leave').single;
    expect(leave.screen, '/guest#home');
    expect(leave.durationMs, isNotNull);
    expect(named('screen_view').last.screen, '/guest#universities');
    expect(named('screen_view').last.props, {'from': '/guest#home'});

    // A route over the shell, and back: the shell keeps its tab.
    AppEvents.routeChanged('/university/:id');
    await t.pump();
    AppEvents.routeChanged('/guest');
    await t.pump();
    expect(named('screen_view').map((e) => e.screen).toList(),
        ['/guest#home', '/guest#universities', '/university/:id', '/guest#universities']);
  });

  testWidgets('a sheet is a screen of its own while open', (t) async {
    await t.pumpWidget(const SizedBox());
    AppEvents.routeChanged('/guest');
    await t.pump();
    AppEvents.overlayOpened('ai_chat');
    expect(AppEvents.screen, 'ai_chat');
    AppEvents.overlayClosed('ai_chat');
    expect(AppEvents.screen, '/guest');
    expect(named('screen_view').map((e) => e.screen).toList(), ['/guest', 'ai_chat', '/guest']);
  });

  testWidgets('a tap is named by the tracked callback that runs for it, with where it landed', (t) async {
    var pressed = 0;
    await t.pumpWidget(
      MaterialApp(
        builder: (context, child) => AnalyticsRoot(child: child!),
        home: Scaffold(
          body: Center(
            child: GestureDetector(
              onTap: tracked('test.button', () => pressed++, props: {'value': 'x'}),
              child: const SizedBox(width: 100, height: 100, child: Text('press')),
            ),
          ),
        ),
      ),
    );
    await t.tap(find.text('press'));
    await t.pump();
    expect(pressed, 1);
    final tap = named('tap').single;
    expect(tap.element, 'test.button');
    expect(tap.props?['value'], 'x');
    expect(tap.props?['x'], isA<double>());
    expect(tap.props?['y'], isA<double>());

    // A tap on nothing is kept too, unnamed.
    await t.tapAt(const Offset(5, 5));
    await t.pump();
    expect(named('tap').length, 2);
    expect(named('tap').last.element, isNull);
  });

  testWidgets('three quick taps on the same spot are a rage tap', (t) async {
    await t.pumpWidget(MaterialApp(builder: (context, child) => AnalyticsRoot(child: child!), home: const Scaffold()));
    for (var i = 0; i < 3; i++) {
      await t.tapAt(const Offset(200, 300));
      await t.pump(const Duration(milliseconds: 100));
    }
    await t.pump();
    expect(named('rage_tap').single.props?['count'], 3);
    expect(named('tap').length, 3);
  });

  test('a disabled button stays disabled; an enabled one stays non-null', () {
    expect(tracked('x', null), isNull);
    expect(trackedValue<int>('x', null), isNull);
    final VoidCallback required = tracked('x', () {});
    expect(required, isNotNull);
  });

  testWidgets('a wrapped callback calling another names one tap: the outer name', (t) async {
    void inner() {}
    final VoidCallback leaf = tracked('fd_kit.hard_button', tracked('lead.report_send', inner));
    await t.pumpWidget(
      MaterialApp(
        builder: (context, child) => AnalyticsRoot(child: child!),
        home: Scaffold(
          body: Center(
            child: GestureDetector(onTap: leaf, child: const SizedBox(width: 80, height: 80, child: Text('send'))),
          ),
        ),
      ),
    );
    await t.tap(find.text('send'));
    await t.pump();
    final taps = named('tap').toList();
    expect(taps, hasLength(1));
    expect(taps.single.element, 'lead.report_send');
    expect(taps.single.props?['x'], isA<double>());
  });

  test('a tracked callback run without a finger (keyboard, screen reader) is one tap without a position', () async {
    tracked<VoidCallback>('lead.report_send', () {}, props: {'institution_id': 'u1'})();
    await Future<void>.delayed(Duration.zero);
    final tap = named('tap').single;
    expect(tap.element, 'lead.report_send');
    expect(tap.props, {'institution_id': 'u1'});
  });

  test('props are kept as JSON can carry them', () {
    AppEvents.track('tap', props: {'value': AxisDirection.up, 'n': 3, 'ok': true, 'gone': null, 'obj': const Duration(seconds: 1)});
    expect(seen.single.props, {'value': 'up', 'n': 3, 'ok': true, 'obj': '0:00:01.000000'});
  });

  test('backend calls are named without ids or queries', () {
    String? n(String url) => TrackingHttpClient.callName(Uri.parse(url));
    expect(n('https://x.supabase.co/rest/v1/rpc/app_quiz_submit'), 'rpc:app_quiz_submit');
    expect(n('https://x.supabase.co/rest/v1/institutions?select=*&id=eq.5'), 'db:institutions');
    expect(n('https://x.supabase.co/functions/v1/interview-feedback'), 'fn:interview-feedback');
    expect(n('https://x.supabase.co/auth/v1/token?grant_type=password'), 'auth:token');
    expect(n('https://x.supabase.co/storage/v1/object/documents/a/b.pdf'), 'storage');
    expect(n('https://cbu.uz/json'), isNull);
  });

  testWidgets('the navigator observer sees named and unnamed routes without error', (t) async {
    final observer = AppEventsNavigatorObserver();
    final key = GlobalKey<NavigatorState>();
    await t.pumpWidget(MaterialApp(navigatorKey: key, navigatorObservers: [observer], home: const SizedBox()));
    key.currentState!.push(MaterialPageRoute<void>(settings: const RouteSettings(name: 'qr_scan'), builder: (_) => const SizedBox()));
    await t.pumpAndSettle();
    key.currentState!.push(MaterialPageRoute<void>(builder: (_) => const SizedBox()));
    await t.pumpAndSettle();
    key.currentState!.pop();
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    expect(named('screen_view').map((e) => e.screen), contains('qr_scan'));
  });
}

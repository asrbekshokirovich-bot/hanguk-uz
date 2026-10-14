import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';

void main() {
  test('before start, tracking is a no-op', () {
    AppEvents.track('screen_view', screen: '/guest', props: {'tab': 'map'});
    AppEvents.linkLead('abc');
    AppEvents.flush();
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
  });
}

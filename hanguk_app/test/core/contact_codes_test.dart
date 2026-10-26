import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/contact_codes.dart';

void main() {
  test('the message carries the code, as the plan writes it: «Ilovadan · A7K2»', () {
    expect(ContactCodes.textFor((c) => 'Ilovadan · $c', '7Q2MXA'), 'Ilovadan · 7Q2MXA');
    expect(ContactCodes.textFor((c) => 'Ilovadan · $c', null), isNull);
  });

  test("without a code (recording not started) the consultant's chat opens with nothing typed", () async {
    final seen = <TrackedEvent>[];
    AppEvents.debugOnTrack = seen.add;
    addTearDown(() => AppEvents.debugOnTrack = null);
    final uri = await ContactCodes.telegram((c) => 'Ilovadan · $c', screen: 'client_code');
    expect(uri.host, 't.me');
    expect(uri.path, '/hangukuz_consulting');
    expect(uri.queryParameters.containsKey('text'), isFalse);
    final tap = seen.single;
    expect(tap.event, 'contact_tap');
    expect(tap.screen, 'client_code');
    expect(tap.props, {'channel': 'telegram', 'coded': false});
  });
}

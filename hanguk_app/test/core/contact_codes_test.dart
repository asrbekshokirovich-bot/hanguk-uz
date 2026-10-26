import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/contact_codes.dart';

void main() {
  test('the code goes after the message, as the person will send it', () {
    expect(ContactCodes.withCode('Assalomu alaykum!', '7Q2MXA'), 'Assalomu alaykum! (HK-7Q2MXA)');
    expect(ContactCodes.withCode('Assalomu alaykum!', null), 'Assalomu alaykum!');
  });

  test("without a code (recording not started) the consultant's chat opens with the message alone", () async {
    final seen = <TrackedEvent>[];
    AppEvents.debugOnTrack = seen.add;
    addTearDown(() => AppEvents.debugOnTrack = null);
    final uri = await ContactCodes.telegram('Salom!', screen: 'client_code');
    expect(uri.host, 't.me');
    expect(uri.path, '/hangukuz_consulting');
    expect(uri.queryParameters['text'], 'Salom!');
    final tap = seen.single;
    expect(tap.event, 'contact_tap');
    expect(tap.screen, 'client_code');
    expect(tap.props, {'channel': 'telegram', 'coded': false});
  });
}

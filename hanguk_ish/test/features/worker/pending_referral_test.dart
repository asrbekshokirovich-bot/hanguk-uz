import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/features/worker/telegram/pending_referral.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('an invite code from the link is kept until it is used (web / mini app)', () async {
    SharedPreferences.setMockInitialValues({});
    final pending = PendingReferral(await SharedPreferences.getInstance());
    expect(pending.code, isNull);

    await pending.remember('ab12cd');
    expect(pending.code, 'AB12CD');
    await pending.remember('<script>');
    expect(pending.code, 'AB12CD', reason: 'junk does not replace a code');
    await pending.remember(null);
    expect(pending.code, 'AB12CD');

    await pending.clear();
    expect(pending.code, isNull);
    expect(PendingReferral.clean('x1'), isNull);
    expect(PendingReferral.clean(' qw3rty '), 'QW3RTY');
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/identity_links.dart';
import 'package:hanguk_app/core/router/app_router.dart';

void main() {
  test('a link code is 6–32 letters or digits, in lower case', () {
    expect(IdentityLinks.codeOf('ABC1234567'), 'abc1234567');
    expect(IdentityLinks.codeOf(' abc123 '), 'abc123');
    expect(IdentityLinks.codeOf('abc'), isNull);
    expect(IdentityLinks.codeOf('abc-1234567'), isNull);
    expect(IdentityLinks.codeOf(null), isNull);
  });

  test("an operator's link reaches the app as /l/<code>", () {
    expect(IdentityLinks.codeFromPath('/l/abc1234567'), 'abc1234567');
    expect(IdentityLinks.codeFromPath('/l/abc1234567/'), 'abc1234567');
    expect(IdentityLinks.codeFromPath('/l/'), isNull);
    expect(IdentityLinks.codeFromPath('/guest'), isNull);
    expect(IdentityLinks.codeFromPath('/l/abc1234567/x'), isNull);
  });

  test('Google Play hands the code over as the install referrer', () {
    expect(IdentityLinks.codeFromReferrer('l=abc1234567'), 'abc1234567');
    expect(IdentityLinks.codeFromReferrer('utm_source=google-play&utm_medium=organic'), isNull);
    expect(IdentityLinks.codeFromReferrer('utm_source=x&l=abc1234567&utm_medium=y'), 'abc1234567');
    expect(IdentityLinks.codeFromReferrer(''), isNull);
    expect(IdentityLinks.codeFromReferrer(null), isNull);
  });

  test('install_source: where an install came from, from the referrer', () {
    expect(IdentityLinks.installSource('utm_source=google-play&utm_medium=organic'), {
      'source': 'google-play',
      'medium': 'organic',
      'linked': false,
    });
    expect(IdentityLinks.installSource('utm_source=instagram&utm_medium=ad&utm_campaign=gks&l=abc1234567'), {
      'source': 'instagram',
      'medium': 'ad',
      'campaign': 'gks',
      'linked': true,
    });
    expect(IdentityLinks.installSource(null), {'source': 'none', 'linked': false});
    expect(IdentityLinks.installSource('l=abc1234567'), {'source': 'other', 'linked': true});
    expect(IdentityLinks.installSource('utm_source=${'x' * 80}')['source'], hasLength(60));
  });

  test('a claim before recording starts does nothing and does not throw', () async {
    await expectLater(IdentityLinks.claim('abc1234567', 'link'), completes);
  });

  test('the home a link leads to: the guest home, or the language first', () {
    expect(resolveAppRedirect(loc: '/', isLoading: false, isAuthenticated: false, hasLanguage: true), '/guest');
    expect(resolveAppRedirect(loc: '/', isLoading: false, isAuthenticated: false, hasLanguage: false), '/language');
    expect(resolveAppRedirect(loc: '/', isLoading: false, isAuthenticated: true, hasLanguage: true), isNull);
  });
}

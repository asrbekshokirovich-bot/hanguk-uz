// The guest flow is a public surface. Two properties must hold, and a
// redirect is easy to get subtly wrong, so they are pinned here against the
// router's own [resolveAppRedirect]:
//
//   1. A visitor with no session can reach the guest flow and /walkaround.
//   2. Everything else still bounces an unauthenticated visitor to the guest
//      home — guest mode must not become a hole into the student's own data.
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/router/app_router.dart';

String? redirectFor(String loc, {required bool isAuthenticated}) => resolveAppRedirect(
  loc: loc,
  isLoading: false,
  isAuthenticated: isAuthenticated,
  hasLanguage: true,
);

void main() {
  group('no session', () {
    for (final open in [
      '/guest',
      '/guest/search',
      '/university/abc',
      '/assess',
      '/assess/sent',
      '/walkaround/abc',
      '/login',
    ]) {
      test('$open is reachable', () {
        expect(redirectFor(open, isAuthenticated: false), isNull);
      });
    }

    for (final gated in [
      '/',
      '/account',
      '/applications/tracker',
      '/institutions/compare',
      '/institutions/abc',
      '/notifications/settings',
      '/map/abc',
      '/universityx',
      '/assessment-admin',
    ]) {
      test('$gated is NOT reachable', () {
        expect(
          redirectFor(gated, isAuthenticated: false),
          '/guest',
          reason: 'guest mode must not expose $gated',
        );
      });
    }
  });

  group('signed in', () {
    test('guest mode is redundant, so /guest goes home', () {
      expect(redirectFor('/guest', isAuthenticated: true), '/');
      expect(redirectFor('/guest?tab=1', isAuthenticated: true), '/');
    });

    test('but the pages pushed from it stay open', () {
      expect(redirectFor('/guest/results', isAuthenticated: true), isNull);
      expect(redirectFor('/guest/saved', isAuthenticated: true), isNull);
    });

    test('/walkaround still works — it is a normal in-app screen', () {
      expect(redirectFor('/walkaround/abc', isAuthenticated: true), isNull);
    });

    test('/account is untouched', () {
      expect(redirectFor('/account', isAuthenticated: true), isNull);
    });
  });
}

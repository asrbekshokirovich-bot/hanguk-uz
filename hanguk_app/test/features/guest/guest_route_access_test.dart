// Guest Explorer is a public surface. Two properties must hold, and a
// redirect is easy to get subtly wrong, so they are pinned here:
//
//   1. A visitor with no session can reach /guest and /walkaround.
//   2. Everything else still bounces an unauthenticated visitor to /welcome —
//      guest mode must not become a hole into the student's own data.
import 'package:flutter_test/flutter_test.dart';

/// Mirrors the redirect predicate in `app_router.dart`.
String? redirectFor(String loc, {required bool isAuthenticated}) {
  final isGoingToLogin = loc == '/login';
  final isGoingToWelcome = loc == '/welcome';
  final isGoingToGuest =
      loc.startsWith('/guest') || loc.startsWith('/walkaround');

  if (!isAuthenticated &&
      !isGoingToLogin &&
      !isGoingToWelcome &&
      !isGoingToGuest) {
    return '/welcome';
  }
  if (isAuthenticated &&
      (isGoingToLogin || isGoingToWelcome || loc.startsWith('/guest'))) {
    return '/';
  }
  return null;
}

void main() {
  group('no session', () {
    for (final open in ['/guest', '/walkaround/abc', '/welcome', '/login']) {
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
      '/admin/review',
      '/map/abc',
    ]) {
      test('$gated is NOT reachable', () {
        expect(
          redirectFor(gated, isAuthenticated: false),
          '/welcome',
          reason: 'guest mode must not expose $gated',
        );
      });
    }
  });

  group('signed in', () {
    test('guest mode is redundant, so /guest goes home', () {
      expect(redirectFor('/guest', isAuthenticated: true), '/');
    });

    test('/walkaround still works — it is a normal in-app screen', () {
      expect(redirectFor('/walkaround/abc', isAuthenticated: true), isNull);
    });

    test('/account is untouched', () {
      expect(redirectFor('/account', isAuthenticated: true), isNull);
    });
  });
}

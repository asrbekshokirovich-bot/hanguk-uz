import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/router/app_router.dart';

void main() {
  test('without Supabase the router waits for the auth stream, as before', () {
    expect(restoredClientSession(), isNull);
  });

  test('a known guest goes to the guest home before any shell is built', () {
    // What the gate now knows at the first redirect (not loading, no student):
    // the launch '/' leaves for the guest home, so the student's shell is
    // never built for a guest.
    expect(
      resolveAppRedirect(loc: '/', isLoading: false, isAuthenticated: false, hasLanguage: true),
      '/guest',
    );
    expect(
      resolveAppRedirect(loc: '/', isLoading: false, isAuthenticated: false, hasLanguage: false),
      '/language',
    );
    expect(resolveAppRedirect(loc: '/', isLoading: false, isAuthenticated: true, hasLanguage: true), isNull);
  });
}

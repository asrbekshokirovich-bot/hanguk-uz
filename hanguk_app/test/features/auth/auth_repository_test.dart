// Transient-failure classification for the magic-code sign-in.
//
// Guards the fix for the 2026-08-14 App Review rejection (guideline 2.1(a)).
// The reviewer's demo code was correct; the project's REST origin was serving
// Cloudflare 522s, the login call failed on infrastructure, and the app told
// them to contact their counsellor. `isTransientBackendFailure` is the line
// between "the backend did not answer" — retry, then say so — and "the backend
// answered, and the answer is no".
//
// It is a pure function on purpose: no Supabase, no widgets, no network.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Stands in for `dart:io`'s SocketException, which the repository matches by
/// type *name* so the same code compiles for web.
class SocketException implements Exception {
  const SocketException(this.message);
  final String message;
  @override
  String toString() => 'SocketException: $message';
}

void main() {
  group('isTransientBackendFailure — retry', () {
    test('503 from student-login-v2 (SERVICE_UNAVAILABLE)', () {
      expect(
        isTransientBackendFailure(
          const FunctionException(
            status: 503,
            details: {
              'error': 'SERVICE_UNAVAILABLE',
              'detail': 'profiles.lookup: upstream returned HTML',
            },
          ),
        ),
        isTrue,
      );
    });

    test('the exact 2026-08-14 shape: 500 + CODE_LOOKUP_FAILED', () {
      // A server still running the pre-fix build answers this way. It is the
      // response that drew the rejection, so it must read as retryable even
      // before the function is redeployed.
      expect(
        isTransientBackendFailure(
          const FunctionException(
            status: 500,
            details: {'error': 'CODE_LOOKUP_FAILED', 'detail': '522'},
          ),
        ),
        isTrue,
      );
    });

    test('gateway statuses the function never sees itself', () {
      for (final status in [502, 504, 522, 524]) {
        expect(
          isTransientBackendFailure(FunctionException(status: status)),
          isTrue,
          reason: 'HTTP $status should be retryable',
        );
      }
    });

    test('408 and 429 are "ask again"', () {
      expect(isTransientBackendFailure(const FunctionException(status: 408)), isTrue);
      expect(isTransientBackendFailure(const FunctionException(status: 429)), isTrue);
    });

    test('socket and timeout failures', () {
      expect(
        isTransientBackendFailure(const SocketException('Connection reset by peer')),
        isTrue,
      );
      expect(
        isTransientBackendFailure(TimeoutException('no response', const Duration(seconds: 10))),
        isTrue,
      );
      expect(
        isTransientBackendFailure(Exception('Failed host lookup: supabase.co')),
        isTrue,
      );
    });
  });

  group('isTransientBackendFailure — do not retry', () {
    test('a wrong code is an answer, not an outage', () {
      expect(
        isTransientBackendFailure(
          const FunctionException(
            status: 401,
            details: {'error': 'CODE_NOT_FOUND'},
          ),
        ),
        isFalse,
      );
    });

    test('staff using a magic code is an answer', () {
      expect(
        isTransientBackendFailure(
          const FunctionException(
            status: 403,
            details: {'error': 'STAFF_BLOCKED'},
          ),
        ),
        isFalse,
      );
    });

    test('a malformed code is an answer', () {
      expect(
        isTransientBackendFailure(
          const FunctionException(
            status: 400,
            details: {'error': 'CODE_REQUIRED'},
          ),
        ),
        isFalse,
      );
    });

    test('a plain programming error is not retried', () {
      expect(isTransientBackendFailure(ArgumentError('bad state')), isFalse);
    });
  });
}

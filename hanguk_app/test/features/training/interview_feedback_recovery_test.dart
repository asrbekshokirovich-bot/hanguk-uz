import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:hanguk_app/features/training/data/interview_repository.dart';

/// Pins the decision that fixes "suhbatdan so'ng natijani hisoblab bera
/// olmayapdi" — the interview is scored, but the student is told it failed.
///
/// `interview-feedback` writes its row into public.interview_feedback and only
/// then replies. Production logs showed it answering 200 at ~40s while the app
/// had already hung up at 25s: the analysis existed, the app just wasn't
/// listening any more. `endSession` now waits for that row instead of trusting
/// one long HTTP request to survive a mobile connection.
///
/// [InterviewNotifier.mayStillBeRunning] decides when that wait is worth it,
/// and it has to be right in both directions:
///
///  * say "no" to a dropped connection and a scored interview is thrown away —
///    the original bug;
///  * say "yes" to a verdict the function already gave us and a student who
///    genuinely cannot be scored sits through the whole poll window first.
void main() {
  group('waits for the saved result when the verdict never arrived', () {
    test('our own timeout — the function is still working server-side', () {
      // The 90s cutoff in endSession. The worker keeps going (the platform
      // allows it 150s) and will still write its row.
      expect(
        InterviewNotifier.mayStillBeRunning(
          TimeoutException('feedback', const Duration(seconds: 90)),
        ),
        isTrue,
      );
    });

    test('the socket died under us', () {
      // Walking out of the building mid-analysis.
      expect(
        InterviewNotifier.mayStillBeRunning(
          const SocketException('Connection reset by peer'),
        ),
        isTrue,
      );
    });

    test('the http client gave up', () {
      expect(
        InterviewNotifier.mayStillBeRunning(
          http.ClientException('Connection closed before full header'),
        ),
        isTrue,
      );
    });

    test('504 — the gateway stopped waiting, the worker did not', () {
      expect(
        InterviewNotifier.mayStillBeRunning(
          const FunctionException(status: 504),
        ),
        isTrue,
      );
    });

    test('546 — wall-clock kill can land after the insert', () {
      expect(
        InterviewNotifier.mayStillBeRunning(
          const FunctionException(status: 546),
        ),
        isTrue,
      );
    });

    test('an unrecognised failure is worth one lookup', () {
      // A lookup costs a query; a lost result costs the student their
      // interview. Default toward checking.
      expect(
        InterviewNotifier.mayStillBeRunning(Exception('something new')),
        isTrue,
      );
    });
  });

  group('does not stall when the function already answered', () {
    // Each of these is a reply the function completed and returned. No row was
    // written and none is coming, so waiting only delays the bad news.
    const noResultStatuses = <int, String>{
      400: 'Not enough conversation data for feedback',
      401: 'Unauthorized',
      404: 'Session not found',
      429: 'Rate limit exceeded',
      500: 'Failed to save feedback',
      502: 'Could not analyze this interview',
    };

    noResultStatuses.forEach((status, reason) {
      test('$status — $reason', () {
        expect(
          InterviewNotifier.mayStillBeRunning(
            FunctionException(status: status, details: reason),
          ),
          isFalse,
          reason: 'a $status is a finished answer, not a lost one',
        );
      });
    });
  });
}

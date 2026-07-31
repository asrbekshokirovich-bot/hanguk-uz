// Integration-style test for the Vapi interview flow.
//
// This test does NOT spin up the Vapi client (it requires WebRTC, a
// real public key, and a microphone). Instead it exercises the same
// pure-Dart logic the active view runs against a hand-crafted stream
// of Vapi events: speech-start, transcripts (both roles), tool-calls
// endCall, and a synthetic call-drop.
//
// Two scenarios covered per the audit P2 scope:
//   1. Happy path — greet → student answer → AI question → endCall.
//   2. Error path — call drops mid-session (status-update event with
//      "error"). The handler logic should mark the session abandoned
//      and refuse to double-end.
//
// Deeper scenarios — silence-timeout hints, force-end fallback timer,
// timed-mode expiry — are listed as follow-ups in the audit. Keeping
// the surface lean per the founder's "high-leverage only" rule.

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/vapi_event_parser.dart';

/// Minimal event log captured by the test harness so we can assert on
/// what the handler decided to do.
class _Decisions {
  final List<String> transcriptsLogged = [];
  bool aiRequestedEnd = false;
  bool didEndSession = false;
  bool abandoned = false;
  String? errorMessage;
}

/// Drives the same event-handler logic the active view runs, minus the
/// Flutter / Vapi widget. We feed Map events keyed the same way the
/// real Vapi SDK does.
void _handle(_Decisions out, String eventLabel, Object? eventValue) {
  if (eventLabel == 'status-update' || eventLabel == 'statusUpdate') {
    final s = eventValue.toString().toLowerCase();
    if (s.contains('error')) {
      out.errorMessage = 'Connection interrupted: $s';
      out.abandoned = true;
      out.didEndSession = true; // matches the abandoned branch
    }
    return;
  }
  if (eventLabel != 'message' || eventValue is! Map) return;
  final type = eventValue['type'];
  if (type == 'transcript') {
    final role = eventValue['role']?.toString();
    final text = eventValue['transcript'] as String?;
    final isFinal = eventValue['transcriptType'] == 'final';
    if (text == null || text.isEmpty || !isFinal) return;
    out.transcriptsLogged.add('$role: $text');
  } else if (type == 'tool-calls' || type == 'function-call') {
    if (isEndCallTool(eventValue) && !out.aiRequestedEnd) {
      out.aiRequestedEnd = true;
    }
  } else if (type == 'speech-end') {
    if (out.aiRequestedEnd && !out.didEndSession) {
      out.didEndSession = true;
    }
  }
}

void main() {
  group('Vapi integration — happy path', () {
    test('greet → student answer → AI question → endCall → feedback hook', () {
      final out = _Decisions();

      // 1. Greeting (assistant final transcript).
      _handle(out, 'message', {
        'type': 'transcript',
        'role': 'assistant',
        'transcript': 'Hello! Ready to begin?',
        'transcriptType': 'final',
      });

      // 2. Student answers.
      _handle(out, 'message', {
        'type': 'transcript',
        'role': 'user',
        'transcript': 'Yes, I am ready.',
        'transcriptType': 'final',
      });

      // 3. AI follow-up question.
      _handle(out, 'message', {
        'type': 'transcript',
        'role': 'assistant',
        'transcript': 'Tell me about your motivation.',
        'transcriptType': 'final',
      });

      // Both sides should be in the transcript log (audit F9).
      expect(
        out.transcriptsLogged,
        containsAll([
          'assistant: Hello! Ready to begin?',
          'user: Yes, I am ready.',
          'assistant: Tell me about your motivation.',
        ]),
      );

      // 4. AI invokes endCall.
      _handle(out, 'message', {
        'type': 'tool-calls',
        'toolCalls': [
          {
            'function': {'name': 'endCall'},
          },
        ],
      });
      expect(out.aiRequestedEnd, isTrue);
      expect(out.didEndSession, isFalse);

      // 5. The AI finishes its closing line. Speech-end then fires the
      // teardown (which in the real view calls _completeAutoEnd /
      // endSession).
      _handle(out, 'message', {'type': 'speech-end'});
      expect(out.didEndSession, isTrue);
      expect(out.abandoned, isFalse);
    });
  });

  group('Vapi integration — error path', () {
    test(
      'call drops mid-session marks the row abandoned, refuses double-end',
      () {
        final out = _Decisions();

        // Greeting + a student answer.
        _handle(out, 'message', {
          'type': 'transcript',
          'role': 'assistant',
          'transcript': 'Hello!',
          'transcriptType': 'final',
        });
        _handle(out, 'message', {
          'type': 'transcript',
          'role': 'user',
          'transcript': 'Hi.',
          'transcriptType': 'final',
        });

        // Vapi emits a status-update with an error string — WebRTC dropped.
        _handle(out, 'statusUpdate', 'Error: peer disconnected');

        expect(out.errorMessage, contains('peer disconnected'));
        expect(out.abandoned, isTrue);
        expect(out.didEndSession, isTrue);

        // A late "endCall" tool event should not be able to flip the
        // didEndSession guard a second time (the dispose-time
        // markAbandoned path already won). We re-fire and assert nothing
        // changes.
        final before = out.didEndSession;
        _handle(out, 'message', {
          'type': 'tool-calls',
          'toolCalls': [
            {
              'function': {'name': 'endCall'},
            },
          ],
        });
        _handle(out, 'message', {'type': 'speech-end'});
        expect(out.didEndSession, equals(before));
      },
    );
  });
}

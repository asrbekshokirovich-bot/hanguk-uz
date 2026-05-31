// Tests for the Vapi event parser. Vapi has shipped at least four
// event shapes for the `endCall` tool — we assert each is recognized,
// and unrelated events / function names are not.
//
// Audit P1 — tests target (`_isEndCallTool` golden tests).

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/vapi_event_parser.dart';

void main() {
  group('isEndCallTool', () {
    test('detects endCall in modern toolCalls list shape', () {
      final event = {
        'toolCalls': [
          {
            'function': {'name': 'endCall'},
          },
        ],
      };
      expect(isEndCallTool(event), isTrue);
    });

    test('detects endCall in snake_case tool_calls list', () {
      final event = {
        'tool_calls': [
          {
            'function': {'name': 'endCall'},
          },
        ],
      };
      expect(isEndCallTool(event), isTrue);
    });

    test('detects endCall in legacy functionCall single-object shape', () {
      final event = {
        'functionCall': {'name': 'endCall'},
      };
      expect(isEndCallTool(event), isTrue);
    });

    test('detects endCall in snake_case function_call single object', () {
      final event = {
        'function_call': {
          'function': {'name': 'endCall'},
        },
      };
      expect(isEndCallTool(event), isTrue);
    });

    test('returns false for a different function name', () {
      final event = {
        'toolCalls': [
          {
            'function': {'name': 'transferCall'},
          },
        ],
      };
      expect(isEndCallTool(event), isFalse);
    });

    test('returns false for an empty event', () {
      expect(isEndCallTool(const <String, dynamic>{}), isFalse);
    });

    test('returns false when the tool list is empty', () {
      final event = {'toolCalls': const <dynamic>[]};
      expect(isEndCallTool(event), isFalse);
    });

    test('returns false when only a transcript field is present', () {
      final event = {
        'role': 'assistant',
        'transcript': 'Thank you for your time.',
      };
      expect(isEndCallTool(event), isFalse);
    });
  });
}

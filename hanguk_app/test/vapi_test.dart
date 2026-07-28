@Tags(['manual'])
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:vapi/vapi.dart';

void main() {
  test('vapi start', () async {
    try {
      final client = VapiClient('5eb3a0e0-0b4a-4b75-bd3e-18cc95b90b46');
      await client.start(
        assistant: {
          'model': {
            'provider': 'openai',
            'model': 'gpt-4o',
            'messages': [
              {'role': 'system', 'content': 'hi'},
            ],
          },
          'voice': {'provider': '11labs', 'voiceId': 'paula'},
        },
      );
      print("VAPI OK");
    } catch (e) {
      print("VAPI ERROR: $e");
    }
  });
}

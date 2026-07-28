@Tags(['manual'])
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:vapi/vapi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('vapi connection test', () async {
    print('Starting Vapi Test...');
    final client = VapiClient('5eb3a0e0-0b4a-4b75-bd3e-18cc95b90b46');
    print('VapiClient instantiated.');

    try {
      final call = await client.start(
        assistant: {
          'model': {
            'provider': 'openai',
            'model': 'gpt-4o',
            'messages': [
              {
                'role': 'system',
                'content': 'You are a test assistant. Say hello and hang up.',
              },
            ],
          },
          'voice': {'provider': '11labs', 'voiceId': 'XrExE9yKIg1WjnnlVkGX'},
          'firstMessage': 'Hello, testing connection.',
        },
      );
      print('Call started successfully.');

      call.onEvent.listen((event) {
        print('Event received: \${event.label} - \${event.value}');
      });

      await Future.delayed(const Duration(seconds: 5));
      print('Stopping call...');
      call.stop();
      call.dispose();
      client.dispose();
      print('Test complete - SUCCESS');
    } catch (e) {
      print('Test failed with error: $e');
      fail('Vapi connection failed: $e');
    }
  });
}

import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> main() async {
  final publicKey = '5eb3a0e0-0b4a-4b75-bd3e-18cc95b90b46';
  final url = Uri.parse('https://api.vapi.ai/call/web'); // Vapi's web call initialization endpoint
  
  // Also try assistant creation to see if the payload is valid
  final assistUrl = Uri.parse('https://api.vapi.ai/assistant');

  final payload = {
    'assistant': {
      'model': {
        'provider': 'google',
        'model': 'gemini-1.5-flash',
        'messages': [
          {
            'role': 'system',
            'content': 'You are a realistic interview simulator.',
          }
        ],
      },
      'voice': {
        'provider': '11labs',
        'voiceId': 'XrExE9yKIg1WjnnlVkGX', // Arbitrary valid voiceId
      },
      'firstMessage': 'Hello, are you ready to begin our interview?',
    }
  };

  try {
    print('Testing Vapi Connection with payload...');
    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $publicKey',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(payload),
    );
    print('Call Endpoint Status: ${response.statusCode}');
    print('Call Endpoint Response: ${response.body}');
    
    final asstRes = await http.post(
     assistUrl,
     headers: {
        'Authorization': 'Bearer $publicKey',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(payload['assistant']),
    );
    
    print('Assistant Endpoint Status: ${asstRes.statusCode}');
    print('Assistant Endpoint Response: ${asstRes.body}');
    
  } catch (e) {
    print('Error: $e');
  }
}

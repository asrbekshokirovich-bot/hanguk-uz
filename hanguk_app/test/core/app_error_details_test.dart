import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  test('an error is named by its code, never its message', () {
    expect(AppEvents.errorCode(FirebaseException(plugin: 'messaging', code: 'unknown', message: 'secret')), 'messaging/unknown');
    expect(AppEvents.errorCode(AuthRetryableFetchException(message: 'x', statusCode: '0')), '0');
    expect(AppEvents.errorCode(const PostgrestException(message: 'x', code: '42501')), '42501');
    expect(AppEvents.errorCode(StateError('x')), isNull);
  });

  test('where: the app frame first, else the first package frame', () {
    final app = StackTrace.fromString(
      '#0      MethodChannel._invokeMethod (package:flutter/src/services/platform_channel.dart:332:12)\n'
      '#1      FirebaseMessaging.getToken (package:firebase_messaging/src/messaging.dart:120:5)\n'
      '#2      fcmTokenSource (package:hanguk_app/features/uni_db/data/fcm_token_source.dart:50:17)\n',
    );
    expect(AppEvents.errorAt(app), 'lib/features/uni_db/data/fcm_token_source.dart:50');

    final lib = StackTrace.fromString(
      '#0      MethodChannel._invokeMethod (package:flutter/src/services/platform_channel.dart:332:12)\n'
      '#1      FirebaseMessaging.getToken (package:firebase_messaging/src/messaging.dart:120:5)\n',
    );
    expect(AppEvents.errorAt(lib), 'firebase_messaging/src/messaging.dart:120');
    expect(AppEvents.errorAt(StackTrace.fromString('<asynchronous suspension>')), isNull);
  });
}

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/services.dart';
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

  test('a plugin error is named by its code when the code is an identifier', () {
    expect(AppEvents.errorCode(PlatformException(code: 'permission_denied', message: 'Microphone: Ali said no')), 'permission_denied');
    expect(AppEvents.errorCode(PlatformException(code: 'AndroidAudioError', message: 'Failed to set source', details: 'https://x/y.mp3')), 'AndroidAudioError');
    expect(AppEvents.errorCode(PlatformException(code: 'channel-error')), 'channel-error');
    expect(AppEvents.errorCode(PlatformException(code: ' -1004 ')), '-1004');
    // A "code" that is really a sentence could quote what the user typed.
    expect(AppEvents.errorCode(PlatformException(code: 'Could not open file /sdcard/Ali passport.pdf')), isNull);
    expect(AppEvents.errorCode(PlatformException(code: '')), isNull);
    expect(AppEvents.errorCode(PlatformException(code: 'x' * 61)), isNull);
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

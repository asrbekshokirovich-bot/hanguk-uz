// ignore_for_file: undefined_function, undefined_class, undefined_identifier, avoid_web_libraries_in_flutter
// lib/util/web_js_helper_impl.dart
import 'dart:js' as js;
import 'dart:js' show allowInterop;
import 'dart:js' show allowInterop;

/// Calls `js.allowInterop` on web platforms.
dynamic allowInteropIfWeb(dynamic Function() callback) =>
    allowInterop(callback);

void playBrowserTts(String text, String language, void Function() onEnd) {
  try {
    final utterance = js.JsObject(js.context['SpeechSynthesisUtterance'], [
      text,
    ]);
    utterance['lang'] = language == 'ko' ? 'ko-KR' : 'en-US';
    utterance['rate'] = 1.0;

    // Callback to start listening after browser finish speaking
    utterance['onend'] = allowInterop((_) {
      onEnd();
    });

    js.context['speechSynthesis'].callMethod('speak', [utterance]);
  } catch (e) {
    print('Browser TTS Error: $e');
    Future.delayed(const Duration(seconds: 2), () {
      onEnd();
    });
  }
}

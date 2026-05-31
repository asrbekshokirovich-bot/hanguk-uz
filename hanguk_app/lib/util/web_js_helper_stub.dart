// lib/util/web_js_helper_stub.dart

/// Stub for non-web platforms - returns the original callback unchanged.
dynamic allowInteropIfWeb(dynamic Function() callback) => callback;

void playBrowserTts(String text, String language, void Function() onEnd) {
  // On non-web platforms, this should not be called, but we provide a fallback
  onEnd();
}

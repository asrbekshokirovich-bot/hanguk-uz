import 'telegram_web_app_stub.dart' if (dart.library.js_interop) 'telegram_web_app_js.dart' as impl;

/// The Telegram Mini App the app runs in (`window.Telegram.WebApp`,
/// https://core.telegram.org/bots/webapps); null on phones and in a browser
/// opened outside Telegram.
abstract interface class TelegramWebApp {
  /// Telegram's signed data of who opened the app (checked by the server).
  String get initData;

  /// The person's Telegram id (unsigned: for comparing only).
  int? get userId;

  /// The person's Telegram language ('uz', 'ru', …), '' when not known.
  String get languageCode;

  /// `?startapp=…` of the link that opened the app ('' when none).
  String get startParam;

  /// Asks the person to share their phone number; the signed answer, or null
  /// when they did not (or this Telegram cannot ask).
  Future<String?> requestContact();

  /// Tells Telegram the app has drawn (hides its loader) and opens it full height.
  void ready();

  /// Opens a web page in the browser.
  void openLink(String url);
}

/// The running mini app, or null outside Telegram.
TelegramWebApp? telegramWebApp() => impl.telegramWebApp();

import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'telegram_web_app.dart';

/// The web build: `window.Telegram.WebApp` from telegram-web-app.js
/// (web/index.html). Opened outside Telegram, initData is empty: null.
TelegramWebApp? telegramWebApp() {
  final telegram = globalContext.getProperty<JSObject?>('Telegram'.toJS);
  final app = telegram?.getProperty<JSObject?>('WebApp'.toJS);
  if (app == null) return null;
  final initData = app.getProperty<JSString?>('initData'.toJS)?.toDart ?? '';
  if (initData.isEmpty) return null;
  return _JsTelegramWebApp(app, initData);
}

class _JsTelegramWebApp implements TelegramWebApp {
  _JsTelegramWebApp(this._app, this.initData);

  final JSObject _app;

  @override
  final String initData;

  JSObject? get _user =>
      _app.getProperty<JSObject?>('initDataUnsafe'.toJS)?.getProperty<JSObject?>('user'.toJS);

  @override
  int? get userId => _user?.getProperty<JSNumber?>('id'.toJS)?.toDartInt;

  @override
  String get startParam =>
      _app.getProperty<JSObject?>('initDataUnsafe'.toJS)?.getProperty<JSString?>('start_param'.toJS)?.toDart ?? '';

  @override
  String get languageCode => _user?.getProperty<JSString?>('language_code'.toJS)?.toDart ?? '';

  bool _atLeast(String version) =>
      _app.callMethod<JSBoolean?>('isVersionAtLeast'.toJS, version.toJS)?.toDart ?? false;

  @override
  Future<String?> requestContact() {
    if (!_atLeast('6.9')) return Future.value(null);
    final done = Completer<String?>();
    void answer(JSAny? shared, JSAny? result) {
      if (done.isCompleted) return;
      final response = result != null && result.isA<JSObject>()
          ? (result as JSObject).getProperty<JSString?>('response'.toJS)?.toDart
          : null;
      done.complete(response == null || response.isEmpty ? null : response);
    }

    try {
      _app.callMethod<JSAny?>('requestContact'.toJS, answer.toJS);
    } on Object {
      return Future.value(null);
    }
    return done.future;
  }

  @override
  void ready() {
    try {
      _app.callMethod<JSAny?>('ready'.toJS);
      _app.callMethod<JSAny?>('expand'.toJS);
    } on Object {
      // An old Telegram: the app still works.
    }
  }

  @override
  void openLink(String url) {
    try {
      _app.callMethod<JSAny?>('openLink'.toJS, url.toJS);
    } on Object {
      // Ignored: nothing to open with.
    }
  }
}

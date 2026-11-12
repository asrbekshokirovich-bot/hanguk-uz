import 'package:shared_preferences/shared_preferences.dart';

import '../features/worker/settings/app_language.dart';

/// The chosen app language on the device (shared preferences).
class PrefsLanguageStore implements LanguageStore {
  PrefsLanguageStore(this._prefs);

  final SharedPreferences _prefs;

  static const _key = 'hanguk_ish.app_language';

  @override
  AppLanguage? load() {
    final code = _prefs.getString(_key);
    return code == null ? null : AppLanguage.fromCode(code);
  }

  @override
  Future<void> save(AppLanguage language) => _prefs.setString(_key, language.code);
}

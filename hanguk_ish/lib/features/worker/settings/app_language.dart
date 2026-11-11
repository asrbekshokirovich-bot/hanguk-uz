import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The four languages of the worker app (Vietnamese removed 2026-11-09).
///
/// [label] is each language's own name, shown the same in every UI
/// language (A01 "Ilova tili").
enum AppLanguage {
  uz('uz', "O'zbekcha"),
  ru('ru', 'Русский'),
  en('en', 'English'),
  ko('ko', '한국어');

  const AppLanguage(this.code, this.label);

  final String code;
  final String label;

  Locale get locale => Locale(code);

  static AppLanguage fromCode(String? code) =>
      values.firstWhere((l) => l.code == code, orElse: () => uz);
}

/// Where the chosen language is kept between launches: the device
/// (`PrefsLanguageStore`, set up at start) or, in tests and before that, the
/// session.
abstract interface class LanguageStore {
  AppLanguage? load();

  Future<void> save(AppLanguage language);
}

/// Kept for the session only.
class MemoryLanguageStore implements LanguageStore {
  MemoryLanguageStore([this._language]);

  AppLanguage? _language;

  @override
  AppLanguage? load() => _language;

  @override
  Future<void> save(AppLanguage language) async => _language = language;
}

final languageStoreProvider = Provider<LanguageStore>((ref) => MemoryLanguageStore());

/// Told of every choice (with a backend: the profile's `language`, for what
/// the server writes to the worker later).
typedef LanguageSaver = Future<void> Function(AppLanguage language);

final languageSaverProvider = Provider<LanguageSaver?>((ref) => null);

/// The worker app's UI language: the one chosen before (on A01 or A11),
/// else Uzbek, the prototype's default. A choice changes it immediately and
/// is kept for the next launch.
final appLanguageProvider =
    NotifierProvider<AppLanguageController, AppLanguage>(
  AppLanguageController.new,
);

class AppLanguageController extends Notifier<AppLanguage> {
  @override
  AppLanguage build() => ref.read(languageStoreProvider).load() ?? AppLanguage.uz;

  void select(AppLanguage language) {
    state = language;
    // Best effort: a failure keeps the choice for this launch.
    ref.read(languageStoreProvider).save(language).catchError((Object _) {});
    ref.read(languageSaverProvider)?.call(language).catchError((Object _) {});
  }
}

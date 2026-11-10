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

/// The worker app's UI language. Starts in Uzbek, the prototype's default;
/// the choice on A01 changes it immediately.
final appLanguageProvider =
    NotifierProvider<AppLanguageController, AppLanguage>(
  AppLanguageController.new,
);

class AppLanguageController extends Notifier<AppLanguage> {
  @override
  AppLanguage build() => AppLanguage.uz;

  void select(AppLanguage language) => state = language;
}

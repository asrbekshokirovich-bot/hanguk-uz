/// Translations of one piece of survey text, keyed by language code
/// (`en`, `ko`, `ru`). Uzbek is the source text itself and is never a key.
typedef SurveyTextTranslations = Map<String, String>;

/// The survey text to show in [languageCode].
///
/// Staff write surveys (title, description, questions, options) in Uzbek in
/// the CRM; [translations] holds that text in the other app languages when a
/// translation exists. Anything missing or blank falls back to [uzbek], so a
/// survey without translations still reads exactly as it was written.
String surveyText(Map<String, dynamic>? translations, String uzbek, String languageCode) {
  if (languageCode == 'uz') return uzbek;
  final translated = translations?[languageCode];
  if (translated is String && translated.trim().isNotEmpty) return translated;
  return uzbek;
}

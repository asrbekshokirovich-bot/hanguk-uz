import 'package:flutter/material.dart';

import 'seoul_night_tokens.dart';

/// Seoul Night typography (DESIGN_SPEC §1 Type).
///
/// Three families, each with one job:
///  * **Inter** — everything. 400–900, tight tracking on display sizes.
///  * **NotoSansKR** — hangul accents only (nav labels, status words, glyph
///    tiles, watermarks). Never a wall of hangul.
///  * **JetBrainsMono** — the magic code field, 0.3em tracking.
///
/// All three are bundled subsets (see pubspec). `fontFamilyFallback` lets any
/// Korean the subset doesn't cover — AI feedback text, for instance — fall
/// through to the platform's Korean font instead of rendering tofu.
class SeoulType {
  const SeoulType._();

  static const String inter = 'Inter';
  static const String korean = 'NotoSansKR';
  static const String mono = 'JetBrainsMono';

  /// Latin first, Korean second: a mixed "Seoul 서울" string renders correctly
  /// with either family as the primary.
  static const List<String> fallback = <String>[korean, inter];

  // ── Display / headline ───────────────────────────────────────────────────
  static const TextStyle display = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 34,
    height: 1.12,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.68, // -0.02em
    color: SeoulColors.textPrimary,
  );

  static const TextStyle headline = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 26,
    height: 1.18,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.52,
    color: SeoulColors.textPrimary,
  );

  /// Section titles ("Your Journey", "Applications").
  static const TextStyle title = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 19,
    height: 1.25,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.2,
    color: SeoulColors.textPrimary,
  );

  /// Card titles, list row names.
  static const TextStyle subtitle = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 16,
    height: 1.3,
    fontWeight: FontWeight.w700,
    color: SeoulColors.textPrimary,
  );

  // ── Body ─────────────────────────────────────────────────────────────────
  static const TextStyle body = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 15,
    height: 1.45,
    fontWeight: FontWeight.w400,
    color: SeoulColors.textPrimary,
  );

  static const TextStyle bodySecondary = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 14,
    height: 1.45,
    fontWeight: FontWeight.w400,
    color: SeoulColors.textSecondary,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 12,
    height: 1.35,
    fontWeight: FontWeight.w500,
    color: SeoulColors.textFaint,
  );

  /// Uppercase eyebrow above a title.
  static const TextStyle eyebrow = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 11,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
    color: SeoulColors.textFaint,
  );

  /// Label inside a button. Sits on lime, so it defaults to ink.
  static const TextStyle button = TextStyle(
    fontFamily: inter,
    fontFamilyFallback: fallback,
    fontSize: 16,
    height: 1.2,
    fontWeight: FontWeight.w700,
    color: SeoulColors.ink,
  );

  // ── Korean accents ───────────────────────────────────────────────────────
  /// Small lime hangul label beside an English title (지원 현황).
  static const TextStyle hangulLabel = TextStyle(
    fontFamily: korean,
    fontFamilyFallback: <String>[inter],
    fontSize: 12,
    height: 1.2,
    fontWeight: FontWeight.w500,
    color: SeoulColors.lime,
  );

  /// Status words: 완료 · 대기 · 잠김 · 선택.
  static const TextStyle hangulStatus = TextStyle(
    fontFamily: korean,
    fontFamilyFallback: <String>[inter],
    fontSize: 11,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  /// The glyph in a university tile (서 / 연 / 고) and the 한 brand mark.
  static const TextStyle hangulGlyph = TextStyle(
    fontFamily: korean,
    fontFamilyFallback: <String>[inter],
    fontSize: 20,
    height: 1.0,
    fontWeight: FontWeight.w700,
    color: SeoulColors.textPrimary,
  );

  /// 한국 watermark on a hero card.
  static const TextStyle hangulWatermark = TextStyle(
    fontFamily: korean,
    fontFamilyFallback: <String>[inter],
    fontSize: 96,
    height: 1.0,
    fontWeight: FontWeight.w900,
    color: Color(0x0DFFFFFF), // 0.05
  );

  // ── Magic code ───────────────────────────────────────────────────────────
  static const TextStyle codeInput = TextStyle(
    fontFamily: mono,
    fontSize: 22,
    height: 1.2,
    fontWeight: FontWeight.w600,
    letterSpacing: 6.6, // 0.3em
    color: SeoulColors.textPrimary,
  );

  /// Applies the Seoul Night families to a Material [TextTheme] so stock
  /// widgets (dialogs, snackbars, pickers) inherit them too.
  static TextTheme textTheme(TextTheme base) {
    return base
        .apply(
          fontFamily: inter,
          fontFamilyFallback: fallback,
          bodyColor: SeoulColors.textPrimary,
          displayColor: SeoulColors.textPrimary,
        )
        .copyWith(
          displayLarge: display,
          displayMedium: headline,
          headlineSmall: title,
          titleLarge: title,
          titleMedium: subtitle,
          bodyLarge: body,
          bodyMedium: bodySecondary,
          bodySmall: caption,
          labelLarge: button,
        );
  }
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'sn_colors.dart';

/// Seoul Night typography (see `DESIGN_SPEC.md` §1 Type).
///
/// - **Inter** (400–900) is the workhorse for all Latin text, with a
///   tight negative tracking on display sizes.
/// - **Noto Sans KR** (500/700/900) is reserved for the small hangul
///   accents — never walls of hangul.
/// - **JetBrains Mono** (600, 0.3em tracking) is used only for the
///   Magic Code input.
///
/// Fonts are provided by `google_fonts`: fetched once, cached to disk,
/// and gracefully falling back to the platform sans/mono offline.
abstract final class SNTypography {
  // ---- Font families (via google_fonts) ----

  /// Inter with the Seoul Night defaults applied.
  static TextStyle inter({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w400,
    Color color = SNColors.textPrimary,
    double? letterSpacing,
    double? height,
  }) =>
      GoogleFonts.inter(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  /// Noto Sans KR — hangul accents only (weights 500/700/900).
  static TextStyle hangul({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w700,
    Color color = SNColors.lime,
    double? letterSpacing,
    double? height,
  }) =>
      GoogleFonts.notoSansKr(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  /// JetBrains Mono w600 with 0.3em tracking — Magic Code only.
  /// [letterSpacing] defaults to `0.3 * fontSize` per spec.
  static TextStyle mono({
    double fontSize = 18,
    Color color = SNColors.textPrimary,
    double? letterSpacing,
  }) =>
      GoogleFonts.jetBrainsMono(
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
        color: color,
        letterSpacing: letterSpacing ?? fontSize * 0.3,
      );

  // ---- Named roles (Inter) ----

  /// Display — 36 w800, tight tracking. Welcome / big numbers.
  static TextStyle get display => inter(
        fontSize: 36,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.72, // ~ -0.02em at 36px
        height: 1.05,
      );

  /// Headline — 32 w800.
  static TextStyle get headline => inter(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.64,
        height: 1.1,
      );

  /// Section title — 20 w800 (spec band 16–23).
  static TextStyle get sectionTitle => inter(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
        height: 1.2,
      );

  /// Title — 16 w700, e.g. card headings.
  static TextStyle get title => inter(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        height: 1.25,
      );

  /// Body — 15 w400.
  static TextStyle get body => inter(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        color: SNColors.textSecondary,
        height: 1.4,
      );

  /// Body small — 14 w400.
  static TextStyle get bodySmall => inter(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: SNColors.textSecondary,
        height: 1.4,
      );

  /// Label — 13 w600, e.g. button text, pills.
  static TextStyle get label => inter(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        height: 1.2,
      );

  /// Caption — 12 w500.
  static TextStyle get caption => inter(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: SNColors.textFaint,
        height: 1.2,
      );

  /// Caption small — 11 w500.
  static TextStyle get captionSmall => inter(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        color: SNColors.textFaint,
        letterSpacing: 0.2,
        height: 1.2,
      );

  // ---- Material TextTheme ----

  /// Builds the Seoul Night [TextTheme] on top of an Inter base so any
  /// widget reading from `Theme.of(context).textTheme` inherits the
  /// design language. All colours default to [SNColors.textPrimary].
  static TextTheme textTheme(TextTheme base) {
    final inter = GoogleFonts.interTextTheme(base);
    return inter.copyWith(
      displayLarge: display,
      displayMedium: headline,
      displaySmall: sectionTitle,
      headlineLarge: headline,
      headlineMedium: sectionTitle,
      headlineSmall: title,
      titleLarge: sectionTitle,
      titleMedium: title,
      titleSmall: label,
      bodyLarge: body,
      bodyMedium: bodySmall,
      bodySmall: caption,
      labelLarge: label,
      labelMedium: caption,
      labelSmall: captionSmall,
    ).apply(
      bodyColor: SNColors.textPrimary,
      displayColor: SNColors.textPrimary,
    );
  }
}

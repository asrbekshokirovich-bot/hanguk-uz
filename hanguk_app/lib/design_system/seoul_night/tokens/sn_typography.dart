import 'package:flutter/material.dart';

import 'sn_colors.dart';

/// Seoul Night type (DESIGN_SPEC.md §1 "Type").
///
/// Three families, bundled as **variable** fonts under `assets/fonts/`:
///
/// | family        | file                       | axis range | used for |
/// |---------------|----------------------------|-----------|----------|
/// | Inter         | Inter-Variable.ttf         | 100–900   | everything |
/// | Noto Sans KR  | NotoSansKR-Variable.ttf    | 100–900   | hangul accents only |
/// | JetBrains Mono| JetBrainsMono-Variable.ttf | 100–800   | magic codes |
///
/// Because these are single-file variable fonts, a bare [FontWeight] is
/// not enough — the renderer needs the `wght` axis set explicitly via
/// [FontVariation]. Every style below therefore goes through [_inter],
/// [_hangul] or [_mono], which set both. **Never** hand-write a
/// `TextStyle(fontFamily: SnType.inter, fontWeight: ...)` — the weight
/// will silently render at 400. Use [SnType.inter] / [SnType.hangul] /
/// [SnType.mono] instead.
abstract final class SnType {
  static const String interFamily = 'Inter';
  static const String hangulFamily = 'NotoSansKR';
  static const String monoFamily = 'JetBrainsMono';

  /// Latin text falls back to the hangul face so a stray Korean glyph in
  /// an Inter run still renders instead of showing tofu.
  static const List<String> _latinFallback = [hangulFamily];

  /// Inter at an arbitrary weight, with the `wght` axis wired up.
  static TextStyle inter({
    required double size,
    required int weight,
    Color color = SnColors.textPrimary,
    double? letterSpacing,
    double? height,
  }) {
    return TextStyle(
      fontFamily: interFamily,
      fontFamilyFallback: _latinFallback,
      fontSize: size,
      fontWeight: _weightOf(weight),
      fontVariations: [FontVariation('wght', weight.toDouble())],
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  /// Noto Sans KR. Hangul accents only — never a full paragraph
  /// (spec §1 "Korean voice": accents, never walls of hangul).
  static TextStyle hangul({
    required double size,
    int weight = 700,
    Color color = SnColors.lime,
    double? letterSpacing,
    double? height,
  }) {
    return TextStyle(
      fontFamily: hangulFamily,
      fontSize: size,
      fontWeight: _weightOf(weight),
      fontVariations: [FontVariation('wght', weight.toDouble())],
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  /// JetBrains Mono. Magic codes and anything else that must not shift
  /// width as characters change.
  static TextStyle mono({
    required double size,
    int weight = 600,
    Color color = SnColors.textPrimary,
    double letterSpacing = 0.3,
  }) {
    return TextStyle(
      fontFamily: monoFamily,
      fontSize: size,
      fontWeight: _weightOf(weight),
      fontVariations: [FontVariation('wght', weight.toDouble())],
      color: color,
      // Spec calls for 0.3em; TextStyle.letterSpacing is in logical
      // pixels, so callers pass an em multiplier and we scale by size.
      letterSpacing: letterSpacing * size,
    );
  }

  // ------------------------------------------------------------ scale
  // Sizes from DESIGN_SPEC.md §1: headline 32–40 w800, section title
  // 16–23 w800, body 14–15, caption 11–12. Display gets -0.02em tracking.

  /// 40 / w900 — Welcome and Explore headlines.
  static TextStyle get display => inter(
    size: 40,
    weight: 900,
    letterSpacing: -0.02 * 40,
    height: 1.05,
  );

  /// 32 / w800 — screen headlines.
  static TextStyle get headline => inter(
    size: 32,
    weight: 800,
    letterSpacing: -0.02 * 32,
    height: 1.1,
  );

  /// 23 / w800 — hero card titles.
  static TextStyle get titleLarge =>
      inter(size: 23, weight: 800, letterSpacing: -0.01 * 23, height: 1.2);

  /// 18 / w800 — card titles.
  static TextStyle get title => inter(size: 18, weight: 800, height: 1.25);

  /// 16 / w800 — section headers, list-row names.
  static TextStyle get sectionTitle =>
      inter(size: 16, weight: 800, height: 1.3);

  /// 15 / w500 — default body.
  static TextStyle get body => inter(size: 15, weight: 500, height: 1.45);

  /// 14 / w500 — dense body, meta lines.
  static TextStyle get bodySmall => inter(
    size: 14,
    weight: 500,
    color: SnColors.textSecondary,
    height: 1.45,
  );

  /// 14 / w700 — button labels.
  static TextStyle get label => inter(size: 14, weight: 700, height: 1.2);

  /// 12 / w600 — chips, status words, eyebrows.
  static TextStyle get caption => inter(
    size: 12,
    weight: 600,
    color: SnColors.textSecondary,
    height: 1.3,
  );

  /// 11 / w600 — the smallest step. Legend text, counters.
  static TextStyle get captionSmall => inter(
    size: 11,
    weight: 600,
    color: SnColors.textFaint,
    height: 1.3,
  );

  /// 11 / w700 lime — the small hangul label that trails an EN title.
  static TextStyle get hangulLabel => hangul(size: 11, weight: 700);

  /// 22 / w900 — hangul glyph inside a 52px tile (서 / 연 / 고).
  static TextStyle get hangulGlyph =>
      hangul(size: 22, weight: 900, color: SnColors.textPrimary);

  /// 96 / w900 — the 한국 watermark on hero cards.
  static TextStyle get hangulWatermark =>
      hangul(size: 96, weight: 900, color: SnColors.watermark, height: 1.0);

  /// 22 / w600, 0.3em tracking — the Magic Code field.
  static TextStyle get magicCode => mono(size: 22);

  /// Maps an arbitrary axis value onto the nearest [FontWeight] constant.
  ///
  /// [FontVariation] drives the actual rendered weight; this keeps
  /// `fontWeight` consistent so layout, [TextStyle.lerp] and any platform
  /// fallback face agree with what is drawn.
  static FontWeight _weightOf(int wght) {
    final index = ((wght / 100).round() - 1).clamp(0, 8);
    return FontWeight.values[index];
  }

  /// The Material [TextTheme] used by `SeoulNightTheme`. Slots map onto
  /// the spec scale above rather than Material's default sizes.
  static TextTheme get textTheme => TextTheme(
    displayLarge: display,
    displayMedium: headline,
    displaySmall: titleLarge,
    headlineLarge: headline,
    headlineMedium: titleLarge,
    headlineSmall: title,
    titleLarge: title,
    titleMedium: sectionTitle,
    titleSmall: inter(size: 14, weight: 700),
    bodyLarge: body,
    bodyMedium: bodySmall,
    bodySmall: caption,
    labelLarge: label,
    labelMedium: caption,
    labelSmall: captionSmall,
  );
}

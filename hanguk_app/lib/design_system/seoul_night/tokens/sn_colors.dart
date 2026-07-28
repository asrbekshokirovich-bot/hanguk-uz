import 'package:flutter/material.dart';

/// Seoul Night colour tokens (DESIGN_SPEC.md §1 "Color tokens").
///
/// These are the *only* colours the Seoul Night surface should use.
/// The legacy [AppColors] set in `../theme/app_colors.dart` stays in
/// place for screens that have not been migrated yet — do not delete it
/// until the Phase 9 sweep.
///
/// Rule from the spec that the type system cannot enforce: **lime is
/// rare**. One primary action per screen, plus active/selected states
/// and glows. Never body text on lime — only [SnColors.ink].
abstract final class SnColors {
  // ---------------------------------------------------------------- brand
  /// Brand royal blue. Gradient stops and hero fills, never a flat page fill.
  static const Color royalBlue = Color(0xFF1A3A6C);

  /// THE action colour. Active states, glows, one primary CTA per screen.
  static const Color lime = Color(0xFFD4E94C);

  /// Top stop of the lime button gradient.
  static const Color limeBright = Color(0xFFE2F26A);

  /// Bottom stop of the lime button gradient / pressed fill.
  static const Color limePressed = Color(0xFFC7E04A);

  /// Text and glyphs drawn *on* lime. The only legible pairing.
  static const Color ink = Color(0xFF0A1A34);

  // ------------------------------------------------------- app background
  /// 150deg app gradient stops — see [SnGradients.appBackground].
  static const Color bgStop0 = royalBlue;
  static const Color bgStop1 = Color(0xFF132A4D);
  static const Color bgStop2 = Color(0xFF0F213D);

  /// Final stop. Near-black so OLED panels bottom out dark (spec §4).
  static const Color bgStop3 = Color(0xFF0A0A1A);

  // -------------------------------------------------------------- surfaces
  /// Glass card fill — `rgba(255,255,255,0.07)`.
  static const Color glass = Color(0x12FFFFFF);

  /// Glass card hairline border — `rgba(255,255,255,0.12)`.
  static const Color glassBorder = Color(0x1FFFFFFF);

  /// Slightly stronger glass, used for pills sitting on top of glass cards.
  static const Color glassRaised = Color(0x1FFFFFFF);

  /// Hero card border — `rgba(255,255,255,0.16)`.
  static const Color heroBorder = Color(0x29FFFFFF);

  /// Inset top highlight on hero cards — `rgba(255,255,255,0.2)`.
  static const Color heroHighlight = Color(0x33FFFFFF);

  /// Full-screen scrim behind the orb speed-dial — `rgba(4,8,18,0.6)`.
  static const Color scrim = Color(0x99040812);

  /// Dark map canvas (spec §3.5).
  static const Color mapCanvas = Color(0xFF0C1830);

  /// Map landmass fill (spec §3.5).
  static const Color mapLand = Color(0xFF16305A);

  // ------------------------------------------------------------------ text
  static const Color textPrimary = Color(0xFFFFFFFF);

  /// `rgba(255,255,255,0.55)` — labels, meta lines.
  static const Color textSecondary = Color(0x8CFFFFFF);

  /// `rgba(255,255,255,0.40)` — captions, disabled, watermark-adjacent.
  static const Color textFaint = Color(0x66FFFFFF);

  /// Hero-card hangul watermark — `rgba(255,255,255,0.05)`.
  static const Color watermark = Color(0x0DFFFFFF);

  // -------------------------------------------------------------- semantic
  /// "In Review" — chip text [warningText] on [warningFill].
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningText = Color(0xFFFFC966);

  /// `rgba(245,158,11,0.16)`
  static const Color warningFill = Color(0x29F59E0B);

  /// "Docs" stage — chip text [infoText] on [infoFill].
  static const Color info = Color(0xFF7CA3D9);
  static const Color infoText = Color(0xFF9FC0EA);

  /// `rgba(124,163,217,0.18)`
  static const Color infoFill = Color(0x2E7CA3D9);

  /// Lime chip fill — `rgba(212,233,76,0.12)`.
  static const Color limeFill = Color(0x1FD4E94C);

  /// Neutral chip fill (Closed 마감, inactive filters) — same as [glass].
  static const Color neutralFill = glass;

  /// Destructive. Carried over from the legacy palette so error styling
  /// does not shift mid-migration.
  static const Color danger = Color(0xFFDC2626);

  // ------------------------------------------------------------ ambient
  /// Top-left ambient blob — `rgba(64,110,190,0.5)`.
  static const Color ambientBlue = Color(0x80406EBE);

  /// Bottom-right ambient blob — `rgba(212,233,76,0.14)`.
  static const Color ambientLime = Color(0x24D4E94C);
}

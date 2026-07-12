import 'package:flutter/widgets.dart';

/// Seoul Night colour tokens.
///
/// The binding design language for the premium dark redesign (see
/// `DESIGN_SPEC.md` §1). Brand DNA is preserved — Royal Blue [royalBlue]
/// for surfaces/gradients and Vibrant Lime [lime] as the single action
/// colour. Depth comes from layered glass ([glass] over [glassBorder])
/// on top of the app-background gradient, never flat black panels.
///
/// Lime is rare by rule: one primary action per screen plus active /
/// selected states and glows. Never body text on lime except [ink].
abstract final class SNColors {
  // ---- Brand ----
  /// Deep Royal Blue — brand surfaces and gradients.
  static const Color royalBlue = Color(0xFF1A3A6C);

  /// Vibrant Lime — THE action colour, active states, glow.
  static const Color lime = Color(0xFFD4E94C);

  /// Lime gradient top stop (brighter).
  static const Color limeBright = Color(0xFFE2F26A);

  /// Lime gradient bottom / pressed stop.
  static const Color limePressed = Color(0xFFC7E04A);

  /// Ink — the only text colour that sits on [lime].
  static const Color ink = Color(0xFF0A1A34);

  // ---- Glass surfaces ----
  /// Glass card fill — white at 7% opacity.
  static const Color glass = Color(0x12FFFFFF); // rgba(255,255,255,0.07)

  /// Glass hairline border — white at 12% opacity.
  static const Color glassBorder = Color(0x1FFFFFFF); // rgba(255,255,255,0.12)

  // ---- Text ----
  /// Primary text — pure white.
  static const Color textPrimary = Color(0xFFFFFFFF);

  /// Secondary text — white at 55%.
  static const Color textSecondary = Color(0x8CFFFFFF); // 0.55

  /// Faint text — white at 40%.
  static const Color textFaint = Color(0x66FFFFFF); // 0.40

  // ---- Ambient / decoration ----
  /// Blue ambient glow blob source (top-left).
  static const Color ambientBlue = Color(0x80406EBE); // rgba(64,110,190,0.5)

  /// Lime ambient glow blob source (bottom-right).
  static const Color ambientLime = Color(0x24D4E94C); // rgba(212,233,76,0.14)

  /// Scrim laid under the nav speed-dial when the orb is open.
  static const Color scrim = Color(0x99040812); // rgba(4,8,18,0.6)

  // ---- App-background gradient stops (150deg) ----
  static const Color bgStop0 = royalBlue; // 0%
  static const Color bgStop1 = Color(0xFF132A4D); // 38%
  static const Color bgStop2 = Color(0xFF0F213D); // 66%
  static const Color bgStop3 = Color(0xFF0A0A1A); // 100% (OLED near-black)

  // ---- Hero-card gradient stops (140deg) ----
  static const Color heroStop0 = Color(0xFF2A4E8C);
  static const Color heroStop1 = royalBlue;
  static const Color heroStop2 = Color(0xFF142E56);

  /// Hero card hairline border — white at 16%.
  static const Color heroBorder = Color(0x29FFFFFF); // 0.16

  /// Hero inset top-highlight — white at 20%.
  static const Color heroHighlight = Color(0x33FFFFFF); // 0.20

  /// Hero hangul watermark — white at 5%.
  static const Color heroWatermark = Color(0x0DFFFFFF); // 0.05

  // ---- Status semantics ----
  /// Warning accent (e.g. "In Review").
  static const Color warning = Color(0xFFF59E0B);

  /// Warning chip text.
  static const Color warningText = Color(0xFFFFC966);

  /// Warning chip fill — rgba(245,158,11,0.16).
  static const Color warningBg = Color(0x29F59E0B);

  /// Info accent (e.g. "Docs" stage).
  static const Color info = Color(0xFF7CA3D9);

  /// Info chip text.
  static const Color infoText = Color(0xFF9FC0EA);

  /// Info chip fill — rgba(124,163,217,0.18).
  static const Color infoBg = Color(0x2E7CA3D9);

  /// Success accent — reuses [lime] per spec (완료 done).
  static const Color success = lime;

  /// Success chip fill — rgba(212,233,76,0.16).
  static const Color successBg = Color(0x29D4E94C);
}

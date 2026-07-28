import 'package:flutter/widgets.dart';

import 'sn_colors.dart';

/// Seoul Night gradients (DESIGN_SPEC.md §1).
///
/// CSS angles are clockwise from "to top"; Flutter's [Alignment] pairs
/// are cartesian. Each gradient below documents the CSS it reproduces so
/// the mapping stays auditable against the prototype.
abstract final class SnGradients {
  /// `linear-gradient(150deg, #1A3A6C 0%, #132A4D 38%, #0F213D 66%, #0A0A1A 100%)`
  ///
  /// 150deg points down-and-slightly-left, so the axis runs from the
  /// top-right corner to the bottom-left.
  static const LinearGradient appBackground = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [
      SnColors.bgStop0,
      SnColors.bgStop1,
      SnColors.bgStop2,
      SnColors.bgStop3,
    ],
    stops: [0.0, 0.38, 0.66, 1.0],
  );

  /// `linear-gradient(140deg, #2A4E8C 0%, #1A3A6C 55%, #142E56 100%)`
  static const LinearGradient heroCard = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2A4E8C), SnColors.royalBlue, Color(0xFF142E56)],
    stops: [0.0, 0.55, 1.0],
  );

  /// `linear-gradient(145deg, #E2F26A, #C7E04A)` — the primary CTA fill.
  static const LinearGradient limeButton = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [SnColors.limeBright, SnColors.limePressed],
  );

  /// `linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))`
  ///
  /// The fill for hangul glyph tiles and other small glass squares that
  /// need a touch more presence than a flat [SnColors.glass].
  static const LinearGradient glassTile = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0x24FFFFFF), Color(0x0DFFFFFF)],
  );

  /// `linear-gradient(145deg, #2A4E8C, #16305A)` — navy glyph tile,
  /// used for the 한 mark on Welcome.
  static const LinearGradient navyTile = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2A4E8C), Color(0xFF16305A)],
  );

  /// `linear-gradient(90deg, #B4CC19, #D4E94C)` — progress-bar fill.
  /// Darker at the start so the lit end reads as the leading edge.
  static const LinearGradient progressFill = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFB4CC19), SnColors.lime],
  );

  /// Top-left ambient blob —
  /// `radial-gradient(circle, rgba(64,110,190,0.5) 0%, transparent 70%)`.
  static const RadialGradient ambientBlue = RadialGradient(
    colors: [SnColors.ambientBlue, Color(0x00406EBE)],
    stops: [0.0, 0.7],
  );

  /// Bottom-right ambient blob —
  /// `radial-gradient(circle, rgba(212,233,76,0.14) 0%, transparent 70%)`.
  static const RadialGradient ambientLime = RadialGradient(
    colors: [SnColors.ambientLime, Color(0x00D4E94C)],
    stops: [0.0, 0.7],
  );

  /// Brighter lime blob for the top-right corner of a hero card —
  /// `radial-gradient(circle, rgba(212,233,76,0.2) 0%, transparent 70%)`.
  static const RadialGradient heroLimeGlow = RadialGradient(
    colors: [Color(0x33D4E94C), Color(0x00D4E94C)],
    stops: [0.0, 0.7],
  );

  /// The inset top highlight on hero cards. Painted as a thin overlay
  /// because Flutter has no inset shadow — see `SnShadows.hero`.
  static const LinearGradient heroInsetHighlight = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [SnColors.heroHighlight, Color(0x00FFFFFF)],
  );
}

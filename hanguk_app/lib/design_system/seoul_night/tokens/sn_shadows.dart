import 'package:flutter/widgets.dart';

import 'sn_colors.dart';

/// Seoul Night elevation tokens (see `DESIGN_SPEC.md` §1 Surfaces).
///
/// Depth is carried by soft, wide, dark shadows plus — for lime
/// affordances only — a coloured [limeGlow]. Each token is a
/// `List<BoxShadow>` ready to drop into a [BoxDecoration].
abstract final class SNShadows {
  /// Glass card: `0 12px 28px rgba(0,0,0,0.3)`.
  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x4D000000), // black 0.30
      blurRadius: 28,
      offset: Offset(0, 12),
    ),
  ];

  /// Hero card: `0 24px 48px rgba(0,0,0,0.45)`.
  static const List<BoxShadow> hero = [
    BoxShadow(
      color: Color(0x73000000), // black 0.45
      blurRadius: 48,
      offset: Offset(0, 24),
    ),
  ];

  /// Lime button glow: `0 14px 32px rgba(212,233,76,0.28)`.
  static const List<BoxShadow> limeGlow = [
    BoxShadow(
      color: Color(0x47D4E94C), // lime 0.28
      blurRadius: 32,
      offset: Offset(0, 14),
    ),
  ];

  /// Softer lime glow for small active tiles / pins.
  static const List<BoxShadow> limeGlowSoft = [
    BoxShadow(
      color: Color(0x33D4E94C), // lime 0.20
      blurRadius: 20,
      offset: Offset(0, 8),
    ),
  ];

  /// Inset top highlight used on hero cards (drawn separately as a
  /// gradient overlay — Flutter [BoxShadow] cannot be inset, so this is
  /// exposed as the highlight colour for the overlay painter).
  static const Color heroInsetHighlight = SNColors.heroHighlight;
}

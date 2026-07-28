import 'package:flutter/widgets.dart';

import 'sn_colors.dart';

/// Seoul Night elevation (DESIGN_SPEC.md §1 "Surfaces").
///
/// Depth comes from gradient + glow + layered glass — never from a
/// lighter flat panel. Shadows are always pure black at low alpha, or
/// lime for glow; no coloured drop shadows beyond those two.
abstract final class SnShadows {
  /// Glass card — `0 12px 28px rgba(0,0,0,0.3)`.
  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x4D000000),
      blurRadius: 28,
      offset: Offset(0, 12),
    ),
  ];

  /// Smaller variant for rows and inline tiles — `0 6px 16px rgba(0,0,0,0.35)`.
  static const List<BoxShadow> cardTight = [
    BoxShadow(
      color: Color(0x59000000),
      blurRadius: 16,
      offset: Offset(0, 6),
    ),
  ];

  /// Hero card — `0 24px 48px rgba(0,0,0,0.45)`.
  ///
  /// The spec also calls for an *inset* top highlight
  /// (`inset 0 1px 0 rgba(255,255,255,0.2)`). Flutter's [BoxShadow] has no
  /// inset mode, so `HeroCard` paints that highlight as a 1px gradient
  /// overlay instead — see `widgets/hero_card.dart`.
  static const List<BoxShadow> hero = [
    BoxShadow(
      color: Color(0x73000000),
      blurRadius: 48,
      offset: Offset(0, 24),
    ),
  ];

  /// Lime primary button — `0 14px 32px rgba(212,233,76,0.28)`.
  static const List<BoxShadow> limeGlow = [
    BoxShadow(
      color: Color(0x47D4E94C),
      blurRadius: 32,
      offset: Offset(0, 14),
    ),
  ];

  /// Tighter lime glow for chips and small active tiles —
  /// `0 8px 20px rgba(212,233,76,0.3)`.
  static const List<BoxShadow> limeGlowTight = [
    BoxShadow(
      color: Color(0x4DD4E94C),
      blurRadius: 20,
      offset: Offset(0, 8),
    ),
  ];

  /// The 한 orb at rest — `0 8px 32px rgba(212,233,76,0.45)`.
  /// The expanding pulse ring is animated by `HanOrb` in Phase 1.
  static const List<BoxShadow> orb = [
    BoxShadow(
      color: Color(0x73D4E94C),
      blurRadius: 32,
      offset: Offset(0, 8),
    ),
  ];

  /// Conic progress ring halo — `0 0 24px rgba(212,233,76,0.35)`.
  static const List<BoxShadow> ringGlow = [
    BoxShadow(color: Color(0x59D4E94C), blurRadius: 24),
  ];

  /// Status dot / progress-bar cap glow — `0 0 8px rgba(212,233,76,0.6)`.
  static const List<BoxShadow> dotGlow = [
    BoxShadow(color: Color(0x99D4E94C), blurRadius: 8),
  ];

  /// Focus ring for the Magic Code input once the code validates —
  /// `0 0 0 6px rgba(212,233,76,0.12)` approximated as a spread.
  static const List<BoxShadow> limeFocusRing = [
    BoxShadow(
      color: SnColors.limeFill,
      blurRadius: 0,
      spreadRadius: 6,
    ),
  ];
}

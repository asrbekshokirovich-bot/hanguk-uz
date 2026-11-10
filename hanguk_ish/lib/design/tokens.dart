import 'package:flutter/painting.dart';

/// Colours of the Hanguk Ish prototype (Claude Design, 2026-11-10).
///
/// Names describe the role, values are copied from the prototype's inline
/// styles. Translucent whites keep the prototype's `rgba(255,255,255,a)`.
abstract final class HiColors {
  /// Screen background.
  static const navy = Color(0xFF0A1440);

  /// The radial glow in the top-left corner (its alpha varies per screen,
  /// see `HiGlow`).
  static const glow = Color(0xFF1A3FD0);

  /// Text on white, 1.5 px outlines and the hard offset shadows.
  static const ink = Color(0xFF0A1A34);

  static const white = Color(0xFFFFFFFF);

  /// Primary action (lime buttons, active markers).
  static const lime = Color(0xFFCCFF00);

  /// Text on [lime].
  static const onLime = Color(0xFF16203A);

  /// Selected state and accent text.
  static const blue = Color(0xFF2447D6);

  /// Darker blue panels (summary cards on navy).
  static const blueDeep = Color(0xFF0F2690);

  /// Secondary text on navy.
  static const textSoft = Color(0xFFD6DEEC);

  /// Labels and hints on navy.
  static const textMuted = Color(0xFFAEB8D6);

  /// Secondary text on white; input placeholders.
  static const inkMuted = Color(0xFF52627A);

  /// Tinted panels inside white cards.
  static const surface = Color(0xFFE3EAF6);

  static const amber = Color(0xFFF59E0B);
  static const amberSoft = Color(0xFFFFF1CC);
  static const green = Color(0xFF16A34A);
  static const greenSoft = Color(0xFFDCF5E3);
  static const greenInk = Color(0xFF14532D);
  static const red = Color(0xFFDC2626);
  static const redSoft = Color(0xFFFCE9E7);
  static const redInk = Color(0xFFB4271E);

  static const white06 = Color.fromRGBO(255, 255, 255, 0.06);
  static const white07 = Color.fromRGBO(255, 255, 255, 0.07);
  static const white08 = Color.fromRGBO(255, 255, 255, 0.08);
  static const white10 = Color.fromRGBO(255, 255, 255, 0.1);
  static const white12 = Color.fromRGBO(255, 255, 255, 0.12);
  static const white14 = Color.fromRGBO(255, 255, 255, 0.14);
  static const white16 = Color.fromRGBO(255, 255, 255, 0.16);
  static const white18 = Color.fromRGBO(255, 255, 255, 0.18);
  static const white20 = Color.fromRGBO(255, 255, 255, 0.2);
  static const white22 = Color.fromRGBO(255, 255, 255, 0.22);
  static const white30 = Color.fromRGBO(255, 255, 255, 0.3);
  static const white45 = Color.fromRGBO(255, 255, 255, 0.45);
}

/// Corner radii of the prototype.
abstract final class HiRadii {
  /// Buttons.
  static const button = 14.0;

  /// Inputs and option tiles.
  static const field = 16.0;

  /// Cards and the brand tile.
  static const card = 22.0;

  /// Pills and chips (`999px`).
  static const pill = 999.0;
}

/// The prototype's "hard" offset shadows: no blur, solid [HiColors.ink].
abstract final class HiShadows {
  /// `box-shadow: 4px 4px 0 #0A1A34`.
  static const hard = [BoxShadow(color: HiColors.ink, offset: Offset(4, 4))];

  /// `box-shadow: 3px 3px 0 #0A1A34`.
  static const hardSmall = [
    BoxShadow(color: HiColors.ink, offset: Offset(3, 3)),
  ];
}

/// Outlines.
abstract final class HiBorders {
  /// The width the prototype's `1.5px` borders are drawn at. Chrome floors
  /// border widths to whole CSS pixels (getComputedStyle reports 1px at any
  /// device pixel ratio), so every 1.5 px outline in the prototype is 1 px
  /// on screen — and the boxes' contents sit 0.5 px further out per side.
  static const width = 1.0;

  /// `1.5px solid #0A1A34` (drawn 1 px), on every white surface.
  static const ink = BorderSide(color: HiColors.ink, width: width);
}

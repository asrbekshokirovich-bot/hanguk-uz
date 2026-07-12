import 'package:flutter/widgets.dart';

import 'sn_colors.dart';

/// Seoul Night gradients (see `DESIGN_SPEC.md` §1).
///
/// CSS angles are converted to Flutter [Alignment] begin/end pairs. A
/// CSS angle `θ` (clockwise from "up") maps to an end alignment of
/// `(sinθ, -cosθ)` in Flutter's y-down space, with `begin = -end`. This
/// keeps the first stop in the upper-left and the last stop in the
/// lower-right for the 140–150° angles used here.
abstract final class SNGradients {
  /// App background — 150°:
  /// `#1A3A6C 0% → #132A4D 38% → #0F213D 66% → #0A0A1A 100%`.
  /// Bottoms out near black for OLED friendliness.
  static const LinearGradient appBackground = LinearGradient(
    begin: Alignment(-0.5, -0.866),
    end: Alignment(0.5, 0.866),
    colors: [
      SNColors.bgStop0,
      SNColors.bgStop1,
      SNColors.bgStop2,
      SNColors.bgStop3,
    ],
    stops: [0.0, 0.38, 0.66, 1.0],
  );

  /// Hero card — 140°: `#2A4E8C → #1A3A6C (55–60%) → #142E56`.
  static const LinearGradient heroCard = LinearGradient(
    begin: Alignment(-0.643, -0.766),
    end: Alignment(0.643, 0.766),
    colors: [
      SNColors.heroStop0,
      SNColors.heroStop1,
      SNColors.heroStop2,
    ],
    stops: [0.0, 0.57, 1.0],
  );

  /// Lime primary button — 145°: `#E2F26A → #C7E04A`.
  static const LinearGradient limeButton = LinearGradient(
    begin: Alignment(-0.574, -0.819),
    end: Alignment(0.574, 0.819),
    colors: [
      SNColors.limeBright,
      SNColors.limePressed,
    ],
  );

  /// Top-left ambient glow blob (radial, decoration only).
  static const RadialGradient ambientBlueBlob = RadialGradient(
    center: Alignment.center,
    radius: 0.5,
    colors: [SNColors.ambientBlue, Color(0x00406EBE)],
    stops: [0.0, 0.7],
  );

  /// Bottom-right ambient glow blob (radial, decoration only).
  static const RadialGradient ambientLimeBlob = RadialGradient(
    center: Alignment.center,
    radius: 0.5,
    colors: [SNColors.ambientLime, Color(0x00D4E94C)],
    stops: [0.0, 0.7],
  );

  /// Lime radial glow used inside hero cards (top-right).
  static const RadialGradient heroLimeGlow = RadialGradient(
    center: Alignment.center,
    radius: 0.5,
    colors: [Color(0x2ED4E94C), Color(0x00D4E94C)],
    stops: [0.0, 0.75],
  );
}

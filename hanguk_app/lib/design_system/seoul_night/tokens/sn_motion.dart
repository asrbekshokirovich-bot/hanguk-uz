import 'package:flutter/animation.dart';

/// Seoul Night motion (DESIGN_SPEC.md §1 "Motion").
///
/// One duration (300ms) and two curves. The springy curve is reserved
/// for navigation — the orb, the speed-dial, section switches. Anything
/// else uses [ease] and does not bounce.
abstract final class SnMotion {
  /// The default. Fades, chip states, press feedback, progress fills.
  static const Duration base = Duration(milliseconds: 300);

  /// Press-down feedback. Fast enough to feel mechanical.
  static const Duration press = Duration(milliseconds: 120);

  /// Per-item delay when the speed-dial fans out (5 items → 160ms tail).
  static const Duration stagger = Duration(milliseconds: 40);

  /// The orb's continuous glow pulse. Slow on purpose — it should read
  /// as breathing, not as a notification.
  static const Duration pulse = Duration(milliseconds: 2600);

  /// `cubic-bezier(0.2, 0.9, 0.3, 1.2)` — ease-out-back.
  ///
  /// The 1.2 control point overshoots past the end value, which is what
  /// gives the dial its spring. Navigation and the orb only.
  static const Curve springy = Cubic(0.2, 0.9, 0.3, 1.2);

  /// Standard ease-out for fades, opacity, colour and size changes.
  static const Curve ease = Curves.easeOut;

  /// Symmetric curve for the looping orb pulse.
  static const Curve pulseCurve = Curves.easeInOut;

  /// Pressed scale for tappable surfaces (spec: 0.97–0.98).
  static const double pressScale = 0.97;
}

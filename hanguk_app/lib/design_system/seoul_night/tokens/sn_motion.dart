import 'package:flutter/animation.dart';

/// Seoul Night motion tokens (see `DESIGN_SPEC.md` §1 Motion).
///
/// One base duration (300ms). Navigation and dial transitions use a
/// springy overshoot curve; fades use a plain ease-out. No bounce
/// elsewhere.
abstract final class SNMotion {
  /// Base duration for nav, dial, and fades.
  static const Duration base = Duration(milliseconds: 300);

  /// Slower pulse for the nav orb's glow ring.
  static const Duration pulse = Duration(milliseconds: 2600);

  /// Per-item stagger delay for the speed-dial fan.
  static const Duration dialStagger = Duration(milliseconds: 40);

  /// Fast press feedback (button scale down/up).
  static const Duration press = Duration(milliseconds: 120);

  /// Springy ease-out-back — `cubic-bezier(0.2, 0.9, 0.3, 1.2)`. For
  /// nav / dial / orb transitions where a subtle overshoot reads as
  /// premium.
  static const Cubic springOutBack = Cubic(0.2, 0.9, 0.3, 1.2);

  /// Plain ease-out for fades and cross-dissolves.
  static const Cubic easeOut = Curves.easeOut;
}

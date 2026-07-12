import 'package:flutter/widgets.dart';

/// Seoul Night corner radii (see `DESIGN_SPEC.md` §1 Surfaces).
///
/// The scale is intentionally small and tight — glass and hero cards
/// live in the 18–24 band, buttons and tiles in the 14–16 band.
abstract final class SNRadii {
  /// Buttons, mono input, speed-dial tiles.
  static const double sm = 14;

  /// Lime primary button (upper bound), small cards.
  static const double md = 16;

  /// Glass card (lower bound).
  static const double lg = 18;

  /// Hero card (lower bound).
  static const double xl = 22;

  /// Glass / hero card (upper bound).
  static const double xxl = 24;

  static const Radius rSm = Radius.circular(sm);
  static const Radius rMd = Radius.circular(md);
  static const Radius rLg = Radius.circular(lg);
  static const Radius rXl = Radius.circular(xl);
  static const Radius rXxl = Radius.circular(xxl);

  static const BorderRadius brSm = BorderRadius.all(rSm);
  static const BorderRadius brMd = BorderRadius.all(rMd);
  static const BorderRadius brLg = BorderRadius.all(rLg);
  static const BorderRadius brXl = BorderRadius.all(rXl);
  static const BorderRadius brXxl = BorderRadius.all(rXxl);
}

import 'package:flutter/widgets.dart';

/// Seoul Night corner radii (DESIGN_SPEC.md §1 "Surfaces").
///
/// Five steps only. If a value here does not fit, the component is
/// probably wrong — do not introduce a sixth.
abstract final class SnRadii {
  /// 14 — lime buttons, small controls.
  static const double button = 14;

  /// 16 — inputs, medium controls, chips that are not fully rounded.
  static const double control = 16;

  /// 18 — glass cards, 52px hangul tiles.
  static const double card = 18;

  /// 22 — hero cards.
  static const double hero = 22;

  /// 24 — largest surfaces (full-bleed sheets, gallery panels).
  static const double sheet = 24;

  /// Fully rounded pill (chips, status words, orb labels).
  static const double pill = 999;

  static const BorderRadius buttonR = BorderRadius.all(Radius.circular(button));
  static const BorderRadius controlR = BorderRadius.all(
    Radius.circular(control),
  );
  static const BorderRadius cardR = BorderRadius.all(Radius.circular(card));
  static const BorderRadius heroR = BorderRadius.all(Radius.circular(hero));
  static const BorderRadius sheetR = BorderRadius.all(Radius.circular(sheet));
  static const BorderRadius pillR = BorderRadius.all(Radius.circular(pill));
}

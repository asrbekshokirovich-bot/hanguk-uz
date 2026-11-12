import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Maps the prototype's fixed 390×844 frame onto a real phone.
///
/// The prototype is drawn edge to edge for a phone with a 47 px status bar
/// and a 34 px home indicator (iPhone 14 class). A value measured from the
/// top of the frame is shifted by the difference between the real status bar
/// and 47; one measured from the bottom by the difference between the real
/// navigation inset and 34. On that reference phone every position is
/// exactly the prototype's.
abstract final class HiInsets {
  /// Status bar height the prototype was drawn for.
  static const designTop = 47.0;

  /// Bottom inset (home indicator) the prototype was drawn for.
  static const designBottom = 34.0;

  /// Smallest gap kept between content and the bottom edge.
  static const minBottom = 12.0;

  /// Distance from the top edge for a prototype `top:` of [design].
  /// Never above the status bar.
  static double top(BuildContext context, double design) {
    final pad = MediaQuery.viewPaddingOf(context).top;
    return math.max(pad, pad + design - designTop);
  }

  /// How far content measured from the top moves on this phone.
  static double shift(BuildContext context) =>
      MediaQuery.viewPaddingOf(context).top - designTop;

  /// Distance from the bottom edge for a prototype `bottom:`/padding of
  /// [design].
  static double bottom(BuildContext context, double design) {
    final pad = MediaQuery.viewPaddingOf(context).bottom;
    return math.max(minBottom, pad + design - designBottom);
  }
}

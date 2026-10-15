import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';

/// How the prototype colours a chance: lime from 80, amber from 50, red below
/// (`col()` / `tcol()` / `gcol()`).
@immutable
class ChanceLook {
  const ChanceLook({required this.fill, required this.onFill, required this.accent});

  /// The badge's fill.
  final Color fill;

  /// The number on that fill.
  final Color onFill;

  /// The number written straight on a white card (lime would vanish there).
  final Color accent;
}

ChanceLook chanceLook(int percent) => percent >= 80
    ? const ChanceLook(fill: FdColors.lime, onFill: FdColors.onLime, accent: FdColors.good)
    : percent >= 50
    ? const ChanceLook(fill: FdColors.warn, onFill: FdColors.onLime, accent: FdColors.warn)
    : const ChanceLook(fill: FdColors.bad, onFill: Colors.white, accent: FdColors.bad);

/// A chance as a small ink-bordered tag: "86%" on its colour, or a white
/// "?%" while the assessment is unanswered.
class ChanceBadge extends StatelessWidget {
  const ChanceBadge({
    super.key,
    required this.percent,
    this.fontSize = 14,
    this.padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    this.radius = 9,
  });

  final int? percent;
  final double fontSize;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final p = percent;
    final look = p == null ? null : chanceLook(p);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: look?.fill ?? FdColors.card,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Text(
        p == null ? '?%' : '$p%',
        style: fdText(fontSize, FontWeight.w800, look?.onFill ?? FdColors.muted, height: 1.1),
      ),
    );
  }
}

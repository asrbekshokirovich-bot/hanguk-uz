import 'package:flutter/material.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/assessment.dart';

/// The meter's word for [percent] (design `seg()`): Past … Juda yuqori.
String segmentWord(AppLocalizations l, int percent) => switch (segmentsOf(percent)) {
  1 => l.fdSegLow,
  2 => l.fdSegMid,
  3 => l.fdSegGood,
  4 => l.fdSegHigh,
  _ => l.fdSegVeryHigh,
};

/// The lit colour of the meter: red for one segment, amber for two, lime
/// from three.
Color segmentColor(int percent) => switch (segmentsOf(percent)) {
  1 => FdColors.bad,
  2 => FdColors.warn,
  _ => FdColors.lime,
};

/// Five segments, the first [segmentsOf] lit; [dark] for the navy card (the
/// rest are deep navy), otherwise outlined white on a white card.
class SegmentMeter extends StatelessWidget {
  const SegmentMeter({
    super.key,
    required this.percent,
    this.dark = true,
    this.width = 16,
    this.height = 14,
    this.gap = 3,
    this.radius = 3,
    this.expand = false,
  });

  final int percent;
  final bool dark;
  final double width;
  final double height;
  final double gap;
  final double radius;

  /// Fill the row, the segments sharing its width (the report's visa bar).
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final lit = segmentsOf(percent);
    final on = segmentColor(percent);
    Widget seg(int k) => Container(
      width: expand ? null : width,
      height: height,
      decoration: BoxDecoration(
        color: k <= lit ? on : (dark ? FdColors.deep : FdColors.card),
        borderRadius: BorderRadius.circular(radius),
        border: dark ? null : Border.all(color: FdColors.ink, width: 1.5),
      ),
    );
    return Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      children: [
        for (var k = 1; k <= 5; k++) ...[
          if (k > 1) SizedBox(width: gap),
          if (expand) Expanded(child: seg(k)) else seg(k),
        ],
      ],
    );
  }
}

/// "Yuqori 71%" in the meter's colour; on a light card a "Yaxshi" reads green.
class SegmentLabel extends StatelessWidget {
  const SegmentLabel({super.key, required this.percent, this.dark = true, this.fontSize = 11});

  final int percent;
  final bool dark;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final sg = segmentsOf(percent);
    final color = sg <= 2 ? segmentColor(percent) : (dark ? FdColors.lime : FdColors.good);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: segmentWord(l, percent)),
          TextSpan(
            text: ' $percent%',
            style: TextStyle(fontWeight: FontWeight.w600, color: color.withValues(alpha: 0.75)),
          ),
        ],
      ),
      textAlign: TextAlign.right,
      maxLines: 1,
      style: fdText(fontSize, FontWeight.w800, color),
    );
  }
}

/// "Kongju" for "Kongju National University": the name the report's chips
/// fit on one line. A name without such a tail stays as it is.
String shortUniversityName(String name) {
  var n = name.split(' — ').first.trim();
  for (final tail in [' National University', ' University', ' College', ' Institute of Technology']) {
    if (n.endsWith(tail) && n.length > tail.length) n = n.substring(0, n.length - tail.length);
  }
  return n.trim();
}

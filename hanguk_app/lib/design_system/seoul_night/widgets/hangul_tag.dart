import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_typography.dart';

/// Layout for [HangulTag] — the Korean accent inline after the EN
/// title, or stacked beneath it.
enum HangulTagLayout { inline, stacked }

/// An English title paired with a small lime hangul accent (see
/// `DESIGN_SPEC.md` §1 Korean voice).
///
/// e.g. `Applications · 지원 현황`. The hangul is a subtle accent in
/// [SNColors.lime] using Noto Sans KR — never a wall of hangul.
class HangulTag extends StatelessWidget {
  const HangulTag({
    super.key,
    required this.title,
    required this.korean,
    this.layout = HangulTagLayout.inline,
    this.titleStyle,
    this.koreanColor = SNColors.lime,
    this.separator = ' · ',
  });

  /// English title.
  final String title;

  /// Korean accent label.
  final String korean;

  final HangulTagLayout layout;

  /// Override for the EN title style (defaults to a section title).
  final TextStyle? titleStyle;

  final Color koreanColor;

  /// Middot glue used only in [HangulTagLayout.inline].
  final String separator;

  @override
  Widget build(BuildContext context) {
    final tStyle = titleStyle ?? SNTypography.sectionTitle;
    final kStyle = SNTypography.hangul(
      fontSize: (tStyle.fontSize ?? 16) * 0.62,
      fontWeight: FontWeight.w700,
      color: koreanColor,
    );

    if (layout == HangulTagLayout.stacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, style: tStyle),
          const SizedBox(height: 2),
          Text(korean, style: kStyle),
        ],
      );
    }

    // Inline: baseline-aligned EN title + separator + KR accent.
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(child: Text(title, style: tStyle, overflow: TextOverflow.ellipsis)),
        Text(separator,
            style: SNTypography.inter(
              fontSize: kStyle.fontSize,
              color: SNColors.textFaint,
            )),
        Text(korean, style: kStyle),
      ],
    );
  }
}

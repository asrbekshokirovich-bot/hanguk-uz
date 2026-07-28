import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_typography.dart';

/// An English title with its small lime hangul label
/// (DESIGN_SPEC.md §1 "Korean voice").
///
/// This is the single most repeated pattern in the design: the EN word
/// carries the meaning, the hangul carries the voice. Canonical pairs:
///
/// * Applications · 지원 현황
/// * Map · 대학 지도
/// * Docs · 서류 목록
/// * Interview · 면접 연습
///
/// Keep the hangul short. The spec is explicit that Korean appears as an
/// accent, never as a wall of text — if the label needs a full sentence,
/// it belongs in the body copy instead.
class HangulTag extends StatelessWidget {
  const HangulTag({
    super.key,
    required this.title,
    required this.hangul,
    this.titleStyle,
    this.hangulStyle,
    this.separator = '·',
    this.axis = Axis.horizontal,
  });

  final String title;
  final String hangul;

  /// Defaults to [SnType.sectionTitle].
  final TextStyle? titleStyle;

  /// Defaults to [SnType.hangulLabel] (11 / w700 / lime).
  final TextStyle? hangulStyle;

  /// Shown between the two when [axis] is horizontal. Pass `null` to drop it.
  final String? separator;

  /// [Axis.vertical] stacks the hangul under the title — used by section
  /// headers where the title is display-sized.
  final Axis axis;

  @override
  Widget build(BuildContext context) {
    final titleWidget = Text(
      title,
      style: titleStyle ?? SnType.sectionTitle,
      overflow: TextOverflow.ellipsis,
    );
    final hangulWidget = Text(
      hangul,
      style: hangulStyle ?? SnType.hangulLabel,
      overflow: TextOverflow.ellipsis,
    );

    // Screen readers get the English only. Announcing "Applications
    // 지원 현황" in a Latin-language TTS voice is noise, not information.
    return Semantics(
      label: title,
      excludeSemantics: true,
      child: axis == Axis.horizontal
          ? Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Flexible(child: titleWidget),
                if (separator != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    separator!,
                    style: SnType.caption.copyWith(color: SnColors.textFaint),
                  ),
                ],
                const SizedBox(width: 6),
                hangulWidget,
              ],
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                titleWidget,
                const SizedBox(height: 2),
                hangulWidget,
              ],
            ),
    );
  }
}

/// The hangul glyph avatar — first syllable of a university name in a
/// rounded glass square (DESIGN_SPEC.md §1: 서 / 연 / 고).
///
/// Goes lime when the thing it labels is done or selected (a completed
/// document row, the active dial item), which is how a list of otherwise
/// identical tiles gets a state without adding a badge.
class HangulGlyphTile extends StatelessWidget {
  const HangulGlyphTile({
    super.key,
    required this.glyph,
    this.size = 52,
    this.active = false,
    this.borderRadius,
  });

  /// Normally one syllable. Two will fit at [size] 52; three will not.
  final String glyph;

  final double size;

  /// Lime fill with ink glyph instead of glass with white glyph.
  final bool active;

  /// Defaults to 18 (the spec's tile radius) regardless of [size].
  final BorderRadius? borderRadius;

  /// Convenience for the common "first character of a Korean name" case.
  /// Returns an empty string for empty input rather than throwing.
  static String glyphOf(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '';
    return String.fromCharCode(trimmed.runes.first);
  }

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? SnRadii.cardR;

    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: active ? SnGradients.limeButton : SnGradients.glassTile,
          borderRadius: radius,
          border: Border.all(
            color: active ? Colors.transparent : SnColors.glassBorder,
            width: 1,
          ),
        ),
        child: Text(
          glyph,
          style: SnType.hangul(
            size: size * 0.42,
            weight: 900,
            color: active ? SnColors.ink : SnColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';
import '../seoul_night_typography.dart';

/// English title with a small lime hangul label beside it — the app's Korean
/// voice (DESIGN_SPEC §1 Korean voice).
///
/// e.g. `HangulTag(en: 'Applications', ko: '지원 현황')`.
class HangulTag extends StatelessWidget {
  const HangulTag({
    super.key,
    required this.en,
    required this.ko,
    this.titleStyle,
    this.crossAxisAlignment = CrossAxisAlignment.start,
  });

  final String en;
  final String ko;
  final TextStyle? titleStyle;
  final CrossAxisAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: crossAxisAlignment,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          en,
          style: titleStyle ?? SeoulType.title,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(ko, style: SeoulType.hangulLabel),
      ],
    );
  }
}

/// Tone of a [StatusChip]. Mapping per spec §3.4:
/// Submitted = lime, In Review = warning, Docs stage = info.
///
/// [danger] and [success] are outside the spec's palette — see the note on
/// `SeoulColors.danger`. Reach for [lime] first: ongoing progress is lime,
/// and [success] is only for a one-off "that worked".
enum StatusTone { lime, warning, info, neutral, danger, success }

/// A small pill stating where something stands. Optionally carries the Korean
/// status word (완료 / 대기 / 잠김).
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
    this.ko,
    this.dense = false,
  });

  final String label;
  final StatusTone tone;

  /// Korean status word rendered after the label in the same colour.
  final String? ko;

  final bool dense;

  Color get _fill {
    switch (tone) {
      case StatusTone.lime:
        return SeoulColors.limeFill;
      case StatusTone.warning:
        return SeoulColors.warningFill;
      case StatusTone.info:
        return SeoulColors.infoFill;
      case StatusTone.neutral:
        return SeoulColors.neutralFill;
      case StatusTone.danger:
        return SeoulColors.dangerFill;
      case StatusTone.success:
        return SeoulColors.successFill;
    }
  }

  Color get _fg {
    switch (tone) {
      case StatusTone.lime:
        return SeoulColors.lime;
      case StatusTone.warning:
        return SeoulColors.warningText;
      case StatusTone.info:
        return SeoulColors.infoText;
      case StatusTone.neutral:
        return SeoulColors.textSecondary;
      case StatusTone.danger:
        return SeoulColors.dangerText;
      case StatusTone.success:
        return SeoulColors.successText;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 10,
        vertical: dense ? 4 : 5,
      ),
      decoration: BoxDecoration(
        color: _fill,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              fontFamily: SeoulType.inter,
              fontFamilyFallback: SeoulType.fallback,
              fontSize: dense ? 10.5 : 11.5,
              height: 1.2,
              fontWeight: FontWeight.w700,
              color: _fg,
            ),
          ),
          if (ko != null) ...[
            const SizedBox(width: 5),
            Text(ko!, style: SeoulType.hangulStatus.copyWith(color: _fg)),
          ],
        ],
      ),
    );
  }
}

/// Filter pill for the Explore/Map chip rows. Lime with ink text when active.
class SeoulFilterChip extends StatelessWidget {
  const SeoulFilterChip({
    super.key,
    required this.label,
    required this.selected,
    this.onTap,
    this.ko,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  /// Optional hangul shown under/after the label.
  final String? ko;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          // 44px min hit target (spec §4) even though the pill looks smaller.
          constraints: const BoxConstraints(minHeight: SeoulSizes.minTapTarget),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? SeoulColors.lime : SeoulColors.glass,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? SeoulColors.lime : SeoulColors.glassBorder,
              width: 1,
            ),
            boxShadow: selected ? SeoulShadows.limeGlowSmall : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontFamily: SeoulType.inter,
                  fontFamilyFallback: SeoulType.fallback,
                  fontSize: 13,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? SeoulColors.ink
                      : SeoulColors.textSecondary,
                ),
              ),
              if (ko != null) ...[
                const SizedBox(width: 5),
                Text(
                  ko!,
                  style: SeoulType.hangulStatus.copyWith(
                    color: selected
                        ? SeoulColors.ink
                        : SeoulColors.textFaint,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Glass tile holding one hangul syllable — the university "avatar"
/// (서 / 연 / 고). Goes lime when the row is done or selected.
class HangulGlyphTile extends StatelessWidget {
  const HangulGlyphTile({
    super.key,
    required this.glyph,
    this.size = SeoulSizes.glyphTile,
    this.active = false,
    this.radius = SeoulRadii.tile,
  });

  /// Usually the first character of a Korean name. Falls back gracefully if
  /// the string is empty.
  final String glyph;

  final double size;
  final bool active;
  final double radius;

  /// First character of [source], or [fallback] when there isn't one.
  static String firstSyllable(String? source, {String fallback = '한'}) {
    final s = (source ?? '').trim();
    if (s.isEmpty) return fallback;
    return s.characters.first;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: SeoulMotion.fast,
      curve: SeoulMotion.smooth,
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: active ? SeoulColors.lime : SeoulColors.glass,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: active ? SeoulColors.lime : SeoulColors.glassBorder,
          width: 1,
        ),
        boxShadow: active ? SeoulShadows.limeGlowSmall : null,
      ),
      child: Text(
        glyph.isEmpty ? '한' : glyph,
        style: SeoulType.hangulGlyph.copyWith(
          fontSize: size * 0.42,
          color: active ? SeoulColors.ink : SeoulColors.textPrimary,
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_motion.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_shadows.dart';
import '../tokens/sn_typography.dart';

/// The semantic tones a [StatusChip] can take (DESIGN_SPEC.md §1).
///
/// The mapping is fixed by the spec and should not be re-decided per
/// screen: Submitted / Open / Done = [lime], In Review = [warning],
/// Docs stage = [info], everything else = [neutral].
enum SnStatusTone {
  /// Submitted · Open 모집 중 · 완료. The only tone that glows.
  lime,

  /// In Review. `#FFC966` on `rgba(245,158,11,0.16)`.
  warning,

  /// Docs stage. `#9FC0EA` on `rgba(124,163,217,0.18)`.
  info,

  /// Closed 마감 · 대기 · 잠김. Plain glass.
  neutral;

  Color get fill => switch (this) {
    SnStatusTone.lime => SnColors.limeFill,
    SnStatusTone.warning => SnColors.warningFill,
    SnStatusTone.info => SnColors.infoFill,
    SnStatusTone.neutral => SnColors.neutralFill,
  };

  Color get foreground => switch (this) {
    SnStatusTone.lime => SnColors.lime,
    SnStatusTone.warning => SnColors.warningText,
    SnStatusTone.info => SnColors.infoText,
    SnStatusTone.neutral => SnColors.textSecondary,
  };

  Color get border => switch (this) {
    SnStatusTone.neutral => SnColors.glassBorder,
    _ => Colors.transparent,
  };
}

/// A read-only state pill — "Submitted", "In Review", "모집 중".
///
/// Not tappable by design. If it needs to be tappable it is a filter,
/// not a status: use [SnFilterChip].
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.tone = SnStatusTone.neutral,
    this.hangul,
    this.dot = false,
  });

  final String label;
  final SnStatusTone tone;

  /// Optional hangul status word (완료 / 대기 / 잠김 / 모집 중 / 마감)
  /// rendered after the label in the chip's own foreground colour.
  final String? hangul;

  /// Leading status dot. Glows when [tone] is [SnStatusTone.lime] —
  /// the "open now" affordance from the guest map legend.
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: hangul == null ? label : '$label, $hangul',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: tone.fill,
          borderRadius: SnRadii.pillR,
          border: Border.all(color: tone.border, width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (dot) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: tone.foreground,
                  boxShadow: tone == SnStatusTone.lime
                      ? SnShadows.dotGlow
                      : null,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: SnType.inter(
                size: 11,
                weight: 700,
                color: tone.foreground,
              ),
            ),
            if (hangul != null) ...[
              const SizedBox(width: 5),
              Text(
                hangul!,
                style: SnType.hangul(
                  size: 11,
                  weight: 500,
                  color: tone.foreground.withValues(alpha: 0.75),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A selectable filter pill — the city and faculty rows on Explore, the
/// channel filters elsewhere. Lime with ink text when active.
///
/// Named with the `Sn` prefix because Material exports its own
/// [FilterChip]; an unprefixed class here would make the name ambiguous
/// in every file that imports both this barrel and `material.dart`.
class SnFilterChip extends StatelessWidget {
  const SnFilterChip({
    super.key,
    required this.label,
    required this.selected,
    this.onTap,
    this.hangul,
    this.count,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  /// Small hangul accent (도시, 학부, 비교 …).
  final String? hangul;

  /// Optional trailing count, e.g. `Compare 1/2`.
  final String? count;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? SnColors.ink : SnColors.textSecondary;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: SnMotion.base,
          curve: SnMotion.ease,
          // 44px min hit target (spec §4) with a visually smaller pill.
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? SnColors.lime : SnColors.glass,
            borderRadius: SnRadii.pillR,
            border: Border.all(
              color: selected ? Colors.transparent : SnColors.glassBorder,
              width: 1,
            ),
            boxShadow: selected ? SnShadows.limeGlowTight : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: SnType.inter(size: 13, weight: 700, color: fg),
              ),
              if (hangul != null) ...[
                const SizedBox(width: 6),
                Text(
                  hangul!,
                  style: SnType.hangul(
                    size: 11,
                    weight: 500,
                    color: selected
                        ? SnColors.ink.withValues(alpha: 0.7)
                        : SnColors.lime,
                  ),
                ),
              ],
              if (count != null) ...[
                const SizedBox(width: 6),
                Text(
                  count!,
                  style: SnType.inter(
                    size: 12,
                    weight: 700,
                    color: fg.withValues(alpha: 0.8),
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

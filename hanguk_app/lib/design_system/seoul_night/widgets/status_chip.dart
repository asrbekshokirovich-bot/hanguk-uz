import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_typography.dart';

/// Semantic status kinds (see `DESIGN_SPEC.md` §1 status semantics +
/// Korean voice status words).
enum SNStatus {
  /// 완료 — done.
  done,

  /// 대기 — pending.
  pending,

  /// 잠김 — locked.
  locked,

  /// 선택 — selected.
  selected,

  /// 할 일 — to-do.
  todo,

  /// In Review (warning amber).
  inReview,

  /// Docs stage (info blue).
  docs,
}

/// A small pill conveying state — tinted fill, coloured text, optional
/// lime hangul accent (see `DESIGN_SPEC.md` §1).
///
/// Use a named [SNStatus] for the spec presets, or supply [label] /
/// [korean] / [color] / [background] directly for a custom chip.
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.korean,
    required this.color,
    required this.background,
    this.icon,
  });

  /// EN label.
  final String label;

  /// Optional hangul accent shown after [label].
  final String? korean;

  final Color color;
  final Color background;
  final IconData? icon;

  /// Build a chip from a spec preset. [labelOverride] replaces the
  /// default EN word; [showKorean] toggles the hangul accent.
  factory StatusChip.of(
    SNStatus status, {
    String? labelOverride,
    bool showKorean = true,
  }) {
    late final String label;
    late final String korean;
    late final Color color;
    late final Color background;
    IconData? icon;

    switch (status) {
      case SNStatus.done:
        label = labelOverride ?? 'Done';
        korean = '완료';
        color = SNColors.lime;
        background = SNColors.successBg;
        icon = Icons.check_rounded;
      case SNStatus.pending:
        label = labelOverride ?? 'Pending';
        korean = '대기';
        color = SNColors.textSecondary;
        background = const Color(0x14FFFFFF); // white 0.08
      case SNStatus.locked:
        label = labelOverride ?? 'Locked';
        korean = '잠김';
        color = SNColors.textFaint;
        background = const Color(0x0FFFFFFF); // white 0.06
        icon = Icons.lock_outline_rounded;
      case SNStatus.selected:
        label = labelOverride ?? 'Selected';
        korean = '선택';
        color = SNColors.ink;
        background = SNColors.lime;
      case SNStatus.todo:
        label = labelOverride ?? 'To-do';
        korean = '할 일';
        color = SNColors.lime;
        background = SNColors.successBg;
      case SNStatus.inReview:
        label = labelOverride ?? 'In Review';
        korean = '검토';
        color = SNColors.warningText;
        background = SNColors.warningBg;
      case SNStatus.docs:
        label = labelOverride ?? 'Docs';
        korean = '서류';
        color = SNColors.infoText;
        background = SNColors.infoBg;
    }

    return StatusChip(
      label: label,
      korean: showKorean ? korean : null,
      color: color,
      background: background,
      icon: icon,
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasKorean = korean != null && korean!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: SNTypography.inter(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.2,
            ),
          ),
          if (hasKorean) ...[
            const SizedBox(width: 5),
            Text(
              korean!,
              style: SNTypography.hangul(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

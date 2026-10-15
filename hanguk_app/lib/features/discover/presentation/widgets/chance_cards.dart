import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import 'chance_badge.dart';

/// One of the two cards on a university's page — "QABUL 86%" and "VIZA D-2
/// 51%": a label, the figure in its colour, a bar and a note. Without a
/// [percent] (the assessment is unanswered) the figure is a grey "?%" and the
/// whole card asks to be tapped.
class ChanceCard extends StatelessWidget {
  const ChanceCard({super.key, required this.label, required this.percent, required this.note, this.onTap});

  final String label;
  final int? percent;

  /// The line under the bar, in the figure's colour.
  final String note;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = percent;
    final color = p == null ? FdColors.muted : chanceLook(p).accent;
    return Semantics(
      button: onTap != null,
      label: '$label ${p == null ? '?' : '$p%'}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: fdText(10, FontWeight.w800, FdColors.muted)),
              const SizedBox(height: 6),
              Text(p == null ? '?%' : '$p%', style: fdText(36, FontWeight.w800, color, height: 1, letterSpacing: -1.08)),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  height: 8,
                  color: FdColors.tint,
                  alignment: Alignment.centerLeft,
                  child: FractionallySizedBox(
                    widthFactor: ((p ?? 0) / 100).clamp(0.0, 1.0),
                    child: ColoredBox(color: color, child: const SizedBox.expand()),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(note, style: fdText(10, FontWeight.w700, color, height: 1.3)),
            ],
          ),
        ),
      ),
    );
  }
}

/// A row that raises the chances: "TOPIK 4 darajaga chiqish — qabul +6%".
/// Tapping it applies the change to the answers.
class BoostRow extends StatelessWidget {
  const BoostRow({super.key, required this.label, required this.gain, required this.onTap});

  final String label;
  final String gain;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            children: [
              Expanded(child: Text(label, style: fdText(12, FontWeight.w700, FdColors.ink, height: 1.3))),
              const SizedBox(width: 10),
              Text(gain, style: fdText(12, FontWeight.w800, FdColors.good)),
            ],
          ),
        ),
      ),
    );
  }
}

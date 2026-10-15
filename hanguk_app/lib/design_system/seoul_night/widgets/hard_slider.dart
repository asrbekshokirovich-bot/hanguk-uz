import 'package:flutter/material.dart';

import 'fd_kit.dart';

/// The full design's slider: an 8px white track with an ink border, lime up
/// to the thumb, and a 22px lime thumb with a 2px hard shadow. [marker] puts
/// a thin ink tick on the track (the bank slider's "₩16 mln talab").
class HardSlider extends StatelessWidget {
  const HardSlider({
    super.key,
    required this.value,
    required this.onChanged,
    required this.semanticLabel,
    this.marker,
    this.markerLabel,
  });

  /// 0–1.
  final double value;
  final ValueChanged<double> onChanged;
  final String semanticLabel;

  /// 0–1, or null for none.
  final double? marker;
  final String? markerLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      slider: true,
      label: semanticLabel,
      value: '${(value * 100).round()}%',
      increasedValue: '${((value + 0.05).clamp(0, 1) * 100).round()}%',
      decreasedValue: '${((value - 0.05).clamp(0, 1) * 100).round()}%',
      onIncrease: () => onChanged((value + 0.05).clamp(0, 1)),
      onDecrease: () => onChanged((value - 0.05).clamp(0, 1)),
      child: LayoutBuilder(
        builder: (context, box) {
          final w = box.maxWidth;
          void at(double dx) => onChanged((dx / w).clamp(0.0, 1.0));
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => at(d.localPosition.dx),
            onHorizontalDragUpdate: (d) => at(d.localPosition.dx),
            child: SizedBox(
              height: markerLabel == null ? 28 : 44,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 10,
                    child: Container(
                      height: 8,
                      decoration: BoxDecoration(
                        color: FdColors.card,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: FdColors.ink, width: 1.5),
                      ),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: value.clamp(0.0, 1.0),
                          child: Container(
                            decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(3)),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (marker != null) ...[
                    Positioned(
                      left: (w * marker!).clamp(0, w) - 0.75,
                      top: 4,
                      child: const ColoredBox(color: FdColors.ink, child: SizedBox(width: 1.5, height: 20)),
                    ),
                    if (markerLabel != null)
                      Positioned(
                        left: (w * marker!).clamp(0, w) - 60,
                        width: 120,
                        top: 28,
                        child: Text(
                          markerLabel!,
                          textAlign: TextAlign.center,
                          style: fdText(9, FontWeight.w700, FdColors.pageMuted),
                        ),
                      ),
                  ],
                  Positioned(
                    left: (w * value).clamp(0, w) - 11,
                    top: 3,
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: FdColors.lime,
                        shape: BoxShape.circle,
                        border: Border.all(color: FdColors.ink, width: 1.5),
                        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(2, 2))],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

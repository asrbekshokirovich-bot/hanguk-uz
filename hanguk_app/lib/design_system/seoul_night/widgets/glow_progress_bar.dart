import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';
import '../tokens/sn_motion.dart';
import '../tokens/sn_shadows.dart';

/// A thin horizontal progress track with a glowing lime fill
/// (DESIGN_SPEC.md §3.4 — application cards).
///
/// Fill is `linear-gradient(90deg, #B4CC19, #D4E94C)` so the leading
/// edge is the brightest point, with `0 0 8px rgba(212,233,76,0.6)`
/// spilling past it. Animates to a new [value] over [SnMotion.base].
class GlowProgressBar extends StatelessWidget {
  const GlowProgressBar({
    super.key,
    required this.value,
    this.height = 6,
    this.trackColor = const Color(0x1AFFFFFF),
    this.glow = true,
    this.semanticLabel,
  });

  /// 0.0–1.0. Values outside the range are clamped rather than asserted;
  /// these come from `completed / total` counts that can legitimately go
  /// out of range when data is mid-sync.
  final double value;

  final double height;

  /// `rgba(255,255,255,0.1)` by default.
  final Color trackColor;

  /// Drop the glow inside long lists — one saveLayer per row adds up.
  final bool glow;

  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);

    return Semantics(
      label: semanticLabel,
      value: '${(clamped * 100).round()}%',
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: clamped),
        duration: SnMotion.base,
        curve: SnMotion.ease,
        builder: (context, animated, _) {
          return Container(
            height: height,
            decoration: BoxDecoration(
              color: trackColor,
              borderRadius: BorderRadius.circular(height),
            ),
            // FractionallySizedBox rather than a measured width, so the
            // bar works under any bounded constraint without a
            // LayoutBuilder pass.
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: animated,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: SnGradients.progressFill,
                  borderRadius: BorderRadius.circular(height),
                  // A zero-width rounded box still paints a smudge of
                  // glow, so drop the shadow entirely at 0.
                  boxShadow: glow && animated > 0 ? SnShadows.dotGlow : null,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// The multi-step journey bar from Applications (DESIGN_SPEC.md §3.4).
///
/// Completed segments are solid lime with a glow, the current segment is
/// lime at [currentFill] (spec: 35%), upcoming segments are plain track.
/// Kept next to [GlowProgressBar] because it is the same visual idea at
/// a different granularity.
class JourneySegmentBar extends StatelessWidget {
  const JourneySegmentBar({
    super.key,
    required this.total,
    required this.completed,
    this.height = 6,
    this.gap = 6,
    this.currentFill = 0.35,
    this.semanticLabel,
  });

  /// Number of steps in the journey (7 in the prototype).
  final int total;

  /// How many are done. The step at index [completed] is "current".
  final int completed;

  final double height;
  final double gap;

  /// How full the current segment reads. Spec says 35%.
  final double currentFill;

  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    if (total <= 0) return SizedBox(height: height);

    return Semantics(
      label: semanticLabel,
      value: 'Step ${completed + 1} of $total',
      child: Row(
        children: List.generate(total, (i) {
          final isDone = i < completed;
          final isCurrent = i == completed;

          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: i == total - 1 ? 0 : gap),
              child: Container(
                height: height,
                decoration: BoxDecoration(
                  color: const Color(0x1AFFFFFF),
                  borderRadius: BorderRadius.circular(height),
                ),
                child: isDone || isCurrent
                    ? FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: isDone ? 1.0 : currentFill,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: SnGradients.progressFill,
                            borderRadius: BorderRadius.circular(height),
                            boxShadow: isDone ? SnShadows.dotGlow : null,
                          ),
                        ),
                      )
                    : null,
              ),
            ),
          );
        }),
      ),
    );
  }
}

/// Exposed so screens can match the bar's track colour on adjacent
/// dividers without re-deriving the alpha.
const Color kSnProgressTrack = Color(0x1AFFFFFF);

/// Re-exported for callers that only import this file.
const Color kSnProgressGlowSource = SnColors.lime;

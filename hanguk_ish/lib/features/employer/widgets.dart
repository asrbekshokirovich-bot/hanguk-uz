import 'package:flutter/material.dart';

import '../../data/models/employer.dart';
import '../../design/icons.dart';
import '../../design/insets.dart';
import '../../design/tokens.dart';
import '../../design/typography.dart';
import '../../design/widgets/navigation.dart';
import '../../design/widgets/pressable.dart';
import 'biz.dart';

/// The employer app's bottom menu: 홈, 근무자, a raised lime «근무 올리기»
/// button, 리포트.
///
/// Prototype: `height:88px; padding:6px 6px 22px; border-top:1px`, a grid
/// row of 59 px; the lime circle (52 px, `margin-top:-26px`) rises 7.4 px
/// above the bar. The widget includes that strip, so the whole circle can
/// be tapped; the rest of the strip lets taps through to the screen.
class EmployerNav extends StatelessWidget {
  const EmployerNav({super.key, required this.current, required this.onSelect, required this.onCreate});

  /// 0 = 홈, 1 = 근무자, 2 = 리포트.
  final int current;
  final ValueChanged<int> onSelect;
  final VoidCallback onCreate;

  /// How far the lime circle rises above the bar.
  static const rise = 7.4;

  /// The bar's height on a phone, without [rise].
  static double barHeight(BuildContext context) => 1 + 6 + 59 + HiInsets.bottom(context, 22);

  @override
  Widget build(BuildContext context) {
    final bottom = HiInsets.bottom(context, 22);
    return Semantics(
      container: true,
      label: Biz.menuLabel,
      explicitChildNodes: true,
      child: SizedBox(
        height: rise + 1 + 6 + 59 + bottom,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              left: 0,
              right: 0,
              top: rise,
              bottom: 0,
              child: Container(
                padding: EdgeInsets.fromLTRB(6, 6, 6, bottom),
                decoration: const BoxDecoration(
                  color: Color(0xFF060D2B),
                  border: Border(top: BorderSide(color: HiColors.white10)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: _Tab(icon: HiIcons.house, label: Biz.navHome, selected: current == 0, onTap: () => onSelect(0))),
                    Expanded(child: _Tab(icon: HiIcons.users, label: Biz.navWorkers, selected: current == 1, onTap: () => onSelect(1))),
                    Expanded(child: _CreateLabel(onTap: onCreate)),
                    Expanded(child: _Tab(icon: HiIcons.chartColumn, label: Biz.navReport, selected: current == 2, onTap: () => onSelect(2))),
                  ],
                ),
              ),
            ),
            // The lime circle of the third column: its row starts 1 + 6 px
            // below the bar's top, the column packs at the bottom of 59 px.
            Positioned(
              top: 0,
              left: 6,
              right: 6,
              child: Row(
                children: [
                  const Spacer(),
                  const Spacer(),
                  Expanded(
                    child: Center(
                      child: HiPressable(
                        onTap: onCreate,
                        semanticsLabel: Biz.navCreate,
                        builder: (context, pressed) => Transform.translate(
                          offset: pressed ? const Offset(2, 2) : Offset.zero,
                          child: Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: HiColors.lime,
                              shape: BoxShape.circle,
                              border: const Border.fromBorderSide(HiBorders.ink),
                              boxShadow: [
                                BoxShadow(color: HiColors.ink, offset: pressed ? const Offset(1, 1) : const Offset(3, 3)),
                              ],
                            ),
                            alignment: Alignment.center,
                            child: const HiIcon(HiIcons.plus, size: 26, strokeWidth: 3, color: HiColors.onLime),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.icon, required this.label, required this.selected, required this.onTap});

  final HiIconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: selected,
      builder: (context, pressed) => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 52,
            height: 30,
            decoration: selected || pressed
                ? BoxDecoration(color: HiColors.white16, borderRadius: BorderRadius.circular(HiRadii.pill))
                : null,
            alignment: Alignment.center,
            child: HiIcon(icon, size: 20, strokeWidth: 2, color: selected ? HiColors.white : HiColors.textMuted),
          ),
          const SizedBox(height: 4),
          HiText(
            label,
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.visible,
            style: hiStyle(12, selected ? FontWeight.w800 : FontWeight.w600,
                color: selected ? HiColors.white : HiColors.textMuted),
          ),
        ],
      ),
    );
  }
}

/// The label under the lime circle; the circle itself is drawn by
/// [EmployerNav] so it can rise above the bar.
class _CreateLabel extends StatelessWidget {
  const _CreateLabel({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: Biz.navCreate,
      builder: (context, pressed) => Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          // 52 px circle with margin-top:-26px takes 26 px of the column.
          const SizedBox(height: 26 + 4),
          HiText(
            Biz.navCreate,
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.visible,
            style: hiStyle(12, FontWeight.w800, color: HiColors.white),
          ),
        ],
      ),
    );
  }
}

/// A white card with the ink outline and the hard shadow.
class EmployerCard extends StatelessWidget {
  const EmployerCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.radius = HiRadii.card});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(radius),
        border: const Border.fromBorderSide(HiBorders.ink),
        boxShadow: HiShadows.hard,
      ),
      child: child,
    );
  }
}

/// A small status pill: 완료, ● 진행 중, 긴급, 지급 대기 …
class EmployerChip extends StatelessWidget {
  const EmployerChip({
    super.key,
    required this.label,
    required this.background,
    this.foreground = HiColors.ink,
    this.dot,
    this.height = 26,
    this.fontSize = 12,
    this.padding = 9,
    this.dotSize = 7,
    this.gap = 5,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Color? dot;
  final double height;
  final double fontSize;
  final double padding;
  final double dotSize;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final mark = dot;
    return Container(
      height: height,
      padding: EdgeInsets.symmetric(horizontal: padding),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(HiRadii.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (mark != null) ...[
            Container(width: dotSize, height: dotSize, decoration: BoxDecoration(color: mark, shape: BoxShape.circle)),
            SizedBox(width: gap),
          ],
          HiText(label, maxLines: 1, softWrap: false, style: hiStyle(fontSize, FontWeight.w800, color: foreground)),
        ],
      ),
    );
  }

  /// The chip of a shift's state (BA1 rows: 26 px, 12 px text; BA3: 28 px,
  /// 13 px, with the number of free places).
  static EmployerChip forState(EmployerShiftState state, {int open = 0, bool large = false}) {
    final h = large ? 28.0 : 26.0;
    final f = large ? 13.0 : 12.0;
    final p = large ? 10.0 : 9.0;
    final g = large ? 6.0 : 5.0;
    return switch (state) {
      EmployerShiftState.done =>
        EmployerChip(label: Biz.stateDone, background: HiColors.surface, height: h, fontSize: f, padding: p),
      EmployerShiftState.inProgress => EmployerChip(
          label: Biz.stateInProgress,
          background: HiColors.greenSoft,
          dot: HiColors.green,
          height: h,
          fontSize: f,
          padding: p,
          gap: g,
        ),
      EmployerShiftState.urgent => EmployerChip(
          label: large ? Biz.urgentSlots(open) : Biz.stateUrgent,
          background: HiColors.redSoft,
          foreground: HiColors.redInk,
          height: h,
          fontSize: f,
          padding: p,
        ),
      EmployerShiftState.scheduled =>
        EmployerChip(label: Biz.stateScheduled, background: HiColors.surface, height: h, fontSize: f, padding: p),
      EmployerShiftState.recruiting => EmployerChip(
          label: large ? Biz.recruitingSlots(open) : Biz.stateRecruiting,
          background: HiColors.amberSoft,
          height: h,
          fontSize: f,
          padding: p,
        ),
      EmployerShiftState.cancelled => EmployerChip(
          label: Biz.stateCancelled,
          background: HiColors.redSoft,
          foreground: HiColors.redInk,
          height: h,
          fontSize: f,
          padding: p,
        ),
    };
  }
}

/// Colour pairs of the initials avatars: blue, pink, teal, purple, olive.
const workerAvatarTones = [
  (Color(0xFFEEF3FB), Color(0xFF1A3A6C)),
  (Color(0xFFFCE9EF), Color(0xFFC43E69)),
  (Color(0xFFE5F6F2), Color(0xFF0B7A66)),
  (Color(0xFFF0ECFB), Color(0xFF6D4FC4)),
  (Color(0xFFF2F7D6), Color(0xFF4D5A00)),
];

/// «AK» in a tinted circle: 48 (applicants), 44 (BA4), 36 (attendance).
class WorkerAvatar extends StatelessWidget {
  const WorkerAvatar({super.key, required this.worker, this.size = 48});

  final WorkerCard worker;
  final double size;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = workerAvatarTones[worker.tone];
    final font = switch (size) { 36 => 13.0, 44 => 15.0, _ => 16.0 };
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: HiText(
          worker.initials,
          textScaler: TextScaler.noScaling,
          style: hiStyle(font, FontWeight.w800, color: fg),
        ),
      ),
    );
  }
}

/// «★ 4.8» — the filled star of the prototype and the rating.
class RatingMark extends StatelessWidget {
  const RatingMark({super.key, required this.rating, this.starSize = 15, this.fontSize = 14});

  final double? rating;
  final double starSize;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final r = rating;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        HiIcon(HiIcons.star, size: starSize, strokeWidth: 1.5, color: HiColors.ink, fill: HiColors.amber),
        const SizedBox(width: 3),
        HiText(r == null ? '–' : r.toStringAsFixed(1), style: hiStyle(fontSize, FontWeight.w800, color: HiColors.ink)),
      ],
    );
  }
}

/// The workers' languages, in their order, in the app's language:
/// «우즈베크어 · 러시아어 · 영어 · 한국어» / «O'zbekcha · Ruscha · …».
String languageNames(List<String> codes) => codes.map(Biz.spokenLanguage).join(' · ');

/// A screen whose data could not load: no connection, or the server said
/// no. «다시 시도» loads it again. The worker app's A03 «Internet yo'q»
/// message, in Korean.
class EmployerLoadError extends StatelessWidget {
  const EmployerLoadError({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final offline = Biz.isOffline(error);
    return HiStatusMessage(
      icon: offline ? HiIcons.wifiOff : HiIcons.triangleAlert,
      title: offline ? Biz.offlineTitle : Biz.loadFailed,
      text: offline ? Biz.offlineText : Biz.error(error),
      textMaxWidth: 300,
      action: Biz.retry,
      actionIcon: HiIcons.refreshCw,
      onAction: onRetry,
    );
  }
}

/// Pull-to-refresh of [future]. A failure keeps the list as it was and says
/// why in a snack bar; the indicator itself has no error state.
Future<void> refreshOrSay(BuildContext context, Future<Object?> future) async {
  try {
    await future;
  } on Object catch (error) {
    if (!context.mounted) return;
    (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/shift.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/navigation.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../feed/feed_controller.dart';
import '../my_shifts/my_shifts_providers.dart';
import '../settings/app_language.dart';
import 'shift_detail_screen.dart';
import 'shift_widgets.dart';

/// The message for a refused or failed «Tasdiqlash».
String takeShiftError(WorkerL10n l10n, Object error) => switch (error) {
      ShiftActionException(code: 'SHIFT_FULL') => l10n.errShiftFull,
      ShiftActionException(code: 'TIME_CONFLICT') => l10n.errTimeConflict,
      ShiftActionException(code: 'ALREADY_APPLIED') => l10n.errAlreadyApplied,
      ShiftActionException(code: 'SHIFT_CLOSED' || 'SHIFT_STARTED') => l10n.errShiftClosed,
      ShiftActionException(code: 'PROFILE_INCOMPLETE') => l10n.errProfileIncomplete,
      OfflineException() => l10n.errOffline,
      _ => l10n.errorGeneric,
    };

/// A05 «Smenani olasizmi?»: the confirmation sheet. Applies when confirmed
/// and returns the result; null when closed. A refusal closes the sheet and
/// shows its reason.
Future<ApplyResult?> showTakeShiftSheet(BuildContext context, ShiftListing shift) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final l10n = WorkerL10n.of(context);
  final outcome = await showModalBottomSheet<Object>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
    barrierLabel: l10n.closeSheet,
    builder: (context) => _TakeShiftSheet(shift: shift),
  );
  if (outcome is ApplyResult) return outcome;
  if (outcome != null) messenger?.showSnackBar(SnackBar(content: Text(takeShiftError(l10n, outcome))));
  return null;
}

class _TakeShiftSheet extends ConsumerStatefulWidget {
  const _TakeShiftSheet({required this.shift});

  final ShiftListing shift;

  @override
  ConsumerState<_TakeShiftSheet> createState() => _TakeShiftSheetState();
}

class _TakeShiftSheetState extends ConsumerState<_TakeShiftSheet> {
  bool _busy = false;

  Future<void> _confirm() async {
    setState(() => _busy = true);
    final navigator = Navigator.of(context);
    Object outcome;
    try {
      outcome = await ref.read(shiftRepositoryProvider).apply(widget.shift.id);
    } on Object catch (error) {
      outcome = error;
    }
    ref
      ..invalidate(feedProvider)
      ..invalidate(myShiftsProvider)
      ..invalidate(shiftDetailProvider(widget.shift.id));
    if (mounted) navigator.pop(outcome);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final shift = widget.shift;
    final b = shift.business;
    final untilStart = Kst.minutesBetween(now, shift.startsAt);
    final detail = hiStyle(15, FontWeight.w600, color: HiColors.ink);
    final money = hiStyle(15, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono);
    return Semantics(
      scopesRoute: true,
      namesRoute: true,
      explicitChildNodes: true,
      label: l10n.confirmTitle,
      child: Container(
        decoration: const BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(top: HiBorders.ink),
        ),
        padding: EdgeInsets.fromLTRB(18, 10, 22, HiInsets.bottom(context, 30)),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: const Color(0xFFC9D3E6),
                    borderRadius: BorderRadius.circular(HiRadii.pill),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Semantics(
                header: true,
                child: HiText(
                  l10n.confirmTitle,
                  style: hiStyle(24, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02, color: HiColors.ink),
                ),
              ),
              const SizedBox(height: 6),
              HiText(
                shift.autoConfirm ? l10n.confirmText : l10n.confirmTextPending,
                style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(18)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        BusinessAvatar(business: b, size: 44),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              HiText(b.nameWithArea(lang), style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                              const SizedBox(height: 2),
                              HiText(
                                shift.displayTitle(lang),
                                style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _DetailLine(
                      icon: HiIcons.calendar,
                      child: HiText(
                        '${HiDates.dayAndDate(shift.startsAt, now, lang)} · '
                        '${HiDates.timeRange(shift.startsAt, shift.endsAt)}',
                        style: detail,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _DetailLine(
                      icon: HiIcons.mapPin,
                      child: HiText(b.displayAddress(lang), style: detail),
                    ),
                    const SizedBox(height: 8),
                    _DetailLine(
                      icon: HiIcons.wallet,
                      child: HiRichText(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '${HiDates.duration(shift.plannedMinutes, lang)} × '
                                  '${Won.worker(shift.hourlyWage)} = ',
                            ),
                            TextSpan(text: Won.worker(shift.totalPay), style: money),
                          ],
                        ),
                        style: detail,
                        also: [money],
                      ),
                    ),
                  ],
                ),
              ),
              if (untilStart > 0 && untilStart < 24 * 60) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(color: HiColors.amberSoft, borderRadius: BorderRadius.circular(16)),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 1),
                        child: HiIcon(HiIcons.triangleAlert, size: 20, strokeWidth: 2, color: HiColors.ink),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: HiText(
                          l10n.startsIn(HiDates.durationWords(untilStart, lang)),
                          style: hiStyle(15, FontWeight.w600, height: 1.45, color: HiColors.ink),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              HiButton(label: l10n.confirm, onPressed: _busy ? null : _confirm),
              const SizedBox(height: 8),
              HiButton(
                label: l10n.back,
                style: HiButtonStyle.text,
                textColor: HiColors.ink,
                height: 48,
                fontSize: 16,
                onPressed: _busy ? null : () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.icon, required this.child});

  final HiIconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        HiIcon(icon, size: 18, strokeWidth: 2, color: HiColors.inkMuted),
        const SizedBox(width: 10),
        Expanded(child: child),
      ],
    );
  }
}

/// A05 «Smena olindi!» (or «Ariza yuborildi!» when the employer confirms
/// applications by hand).
class ShiftTakenScreen extends ConsumerWidget {
  const ShiftTakenScreen({
    super.key,
    required this.shiftId,
    required this.pending,
    required this.onClose,
    required this.onMyShifts,
  });

  final String shiftId;
  final bool pending;
  final VoidCallback onClose;
  final VoidCallback onMyShifts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final shift = ref.watch(shiftDetailProvider(shiftId)).value;
    final bottom = HiInsets.bottom(context, 30);
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.success,
        watermark: pending ? '신청' : '확정',
        watermarkSize: 140,
        watermarkTop: 150,
        watermarkRight: -30,
        watermarkColor: HiColors.white08,
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: EdgeInsets.only(bottom: 52 + 8 + 48 + bottom + 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 0),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: HiGlassIconButton(
                        icon: HiIcons.x,
                        size: 44,
                        radius: 14,
                        iconSize: 22,
                        semanticsLabel: l10n.close,
                        onTap: onClose,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 20, 22, 0),
                    child: Column(
                      children: [
                        ExcludeSemantics(
                          child: Container(
                            width: 104,
                            height: 104,
                            decoration: const BoxDecoration(
                              color: HiColors.lime,
                              shape: BoxShape.circle,
                              border: Border.fromBorderSide(HiBorders.ink),
                              boxShadow: [
                                BoxShadow(color: HiColors.ink, offset: Offset(4, 4)),
                                BoxShadow(color: Color.fromRGBO(212, 233, 76, 0.35), blurRadius: 16),
                              ],
                            ),
                            alignment: Alignment.center,
                            child: const HiIcon(HiIcons.check, size: 52, strokeWidth: 3, color: HiColors.onLime),
                          ),
                        ),
                        const SizedBox(height: 14 + 10),
                        Semantics(
                          header: true,
                          liveRegion: true,
                          child: HiText(
                            pending ? l10n.pendingTitle : l10n.takenTitle,
                            textAlign: TextAlign.center,
                            style: hiStyle(32, FontWeight.w800, height: 1.15, letterSpacingEm: -0.02),
                          ),
                        ),
                        if (shift != null) ...[
                          const SizedBox(height: 10),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 320),
                            child: HiText(
                              pending
                                  ? l10n.pendingText(shift.business.displayName(lang))
                                  : l10n.takenText(
                                      shift.business.displayName(lang),
                                      HiDates.dayInSentence(shift.startsAt, now, lang),
                                      Kst.hm(shift.startsAt),
                                    ),
                              textAlign: TextAlign.center,
                              style: hiStyle(15, FontWeight.w500, height: 1.5, color: HiColors.textSoft),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (shift != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 24, 22, 0),
                      child: _TakenCard(shift: shift, lang: lang, now: now),
                    ),
                ],
              ),
            ),
            Positioned(
              left: 18,
              right: 22,
              bottom: bottom,
              child: Column(
                children: [
                  HiButton(label: l10n.goToMyShifts, onPressed: onMyShifts),
                  const SizedBox(height: 8),
                  HiButton(
                    label: l10n.backToFeed,
                    style: HiButtonStyle.text,
                    height: 48,
                    fontSize: 16,
                    onPressed: onClose,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TakenCard extends StatelessWidget {
  const _TakenCard({required this.shift, required this.lang, required this.now});

  final ShiftListing shift;
  final String lang;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final b = shift.business;
    final detail = hiStyle(15, FontWeight.w600, color: HiColors.ink);
    return Semantics(
      container: true,
      label: l10n.shiftInfo,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                BusinessAvatar(business: b),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      HiText(b.nameWithArea(lang), style: hiStyle(17, FontWeight.w800, color: HiColors.ink)),
                      const SizedBox(height: 2),
                      HiText(shift.displayTitle(lang), style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const CustomPaint(size: Size(double.infinity, HiBorders.width), painter: _DashedRulePainter()),
            const SizedBox(height: 14),
            _DetailLine(
              icon: HiIcons.calendar,
              child: HiText(
                '${HiDates.dayAndDate(shift.startsAt, now, lang)} · ${HiDates.timeRange(shift.startsAt, shift.endsAt)}',
                style: detail,
              ),
            ),
            const SizedBox(height: 10),
            _DetailLine(icon: HiIcons.mapPin, child: HiText(b.fullAddress(lang), style: detail)),
            const SizedBox(height: 10),
            // A flex row in the prototype: a 10 px gap, not a space, before the total.
            Row(
              children: [
                const HiIcon(HiIcons.wallet, size: 18, strokeWidth: 2, color: HiColors.inkMuted),
                const SizedBox(width: 10),
                Flexible(child: HiText(l10n.perHourTotal(Won.worker(shift.hourlyWage)), style: detail)),
                const SizedBox(width: 10),
                HiText(Won.worker(shift.totalPay), style: detail.copyWith(fontWeight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: HiColors.white,
                      borderRadius: BorderRadius.circular(11),
                      border: Border.fromBorderSide(HiBorders.ink),
                    ),
                    alignment: Alignment.center,
                    child: const HiIcon(HiIcons.scanLine, size: 20, strokeWidth: 2, color: HiColors.ink),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: HiText(
                      l10n.scanQrOnArrival,
                      style: hiStyle(15, FontWeight.w600, height: 1.4, color: HiColors.ink),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// `border-top: 1.5px dashed #C9D3E6`, which Chrome draws 1 px thick with
/// 3 px dashes and gaps stretched so the line starts and ends with a dash.
class _DashedRulePainter extends CustomPainter {
  const _DashedRulePainter();

  @override
  void paint(Canvas canvas, Size size) {
    const dash = 3.0;
    final paint = Paint()..color = const Color(0xFFC9D3E6);
    final count = ((size.width + dash) / (dash * 2)).floor();
    final gap = count > 1 ? (size.width - dash * count) / (count - 1) : 0.0;
    for (var i = 0; i < count; i++) {
      canvas.drawRect(Rect.fromLTWH(i * (dash + gap), 0, dash, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(_DashedRulePainter oldDelegate) => false;
}

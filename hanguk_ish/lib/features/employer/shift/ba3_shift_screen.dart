import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/links/share.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/employer.dart';
import '../../../data/models/shift.dart';
import '../../../data/repositories/employer_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../../../design/widgets/qr.dart';
import '../biz.dart';
import '../providers.dart';
import '../widgets.dart';

/// The QR payload of a shift (`shift_qr`), fetched once per shift.
final shiftQrProvider = FutureProvider.autoDispose.family<String, String>(
  (ref, shiftId) => ref.watch(employerRepositoryProvider).shiftQr(shiftId),
  retry: (count, error) => null,
);

/// BA3: one shift — its applicants to accept or turn down, who has come
/// to work, and the QR code for checking in and out.
class Ba3ShiftScreen extends ConsumerStatefulWidget {
  const Ba3ShiftScreen({super.key, required this.shiftId, required this.onBack, required this.onEdit});

  final String shiftId;
  final VoidCallback onBack;
  final VoidCallback onEdit;

  @override
  ConsumerState<Ba3ShiftScreen> createState() => _Ba3ShiftScreenState();
}

class _Ba3ShiftScreenState extends ConsumerState<Ba3ShiftScreen> {
  final Set<String> _busy = {};

  Future<void> _decide(ShiftApplicant applicant, {required bool accept}) async {
    if (_busy.contains(applicant.applicationId)) return;
    setState(() => _busy.add(applicant.applicationId));
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(employerRepositoryProvider).decide(applicant.applicationId, accept: accept);
      refreshShifts(ref, widget.shiftId);
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(
        content: Text(accept ? Biz.confirmed(applicant.worker.fullName) : Biz.rejected(applicant.worker.fullName)),
      ));
    } on Object catch (error) {
      refreshShifts(ref, widget.shiftId);
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
    } finally {
      if (mounted) setState(() => _busy.remove(applicant.applicationId));
    }
  }

  Future<void> _more(EmployerShift shift) async {
    final choice = await showHiActions(context, actions: [
      (HiIcons.pencil, Biz.editShift),
      (HiIcons.x, Biz.cancelShift),
    ]);
    if (!mounted || choice == null) return;
    if (choice == 0) return widget.onEdit();
    final sure = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
      builder: (context) => const _CancelShiftSheet(),
    );
    if (sure != true || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(employerRepositoryProvider).cancelShift(shift.id);
      refreshShifts(ref, shift.id);
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.shiftCancelled)));
    } on Object catch (error) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
    }
  }

  Future<void> _shareQr(EmployerShift shift, String payload, String business) async {
    final messenger = ScaffoldMessenger.of(context);
    final when = '${Biz.monthDay(shift.startsAt)} ${Kst.hm(shift.startsAt)}–${Kst.hm(shift.endsAt)}';
    try {
      final bytes = await qrCardPng(
        data: payload,
        title: business,
        subtitle: '${shift.title} · $when',
        note: Biz.qrNote,
      );
      await ref.read(fileSharerProvider).share(
            bytes: bytes,
            // «1112»: month and day, in any language.
            fileName: 'hanguk-ish-qr-${Kst.wallClock(shift.startsAt).month.toString().padLeft(2, '0')}'
                '${Kst.wallClock(shift.startsAt).day.toString().padLeft(2, '0')}.png',
            mimeType: 'image/png',
            text: Biz.qrShareText(business, shift.title, when),
          );
    } on Object catch (error) {
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Biz.error(error))));
    }
  }

  /// No shift to show: still loading, not loaded (offline), or not found.
  /// The back button stays where it always is.
  Widget _withoutShift(AsyncValue<EmployerShift?> loaded, double top) {
    final Widget message;
    if (loaded.hasValue && !loaded.hasError) {
      message = HiStatusMessage(icon: HiIcons.info, title: Biz.shiftNotFound, text: '');
    } else if (loaded.isLoading) {
      message = const CircularProgressIndicator(color: HiColors.lime);
    } else {
      message = EmployerLoadError(
        error: loaded.error!,
        onRetry: () => reloadAfterError(ref, employerShiftProvider(widget.shiftId)),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(18, top, 18, 0),
          child: Row(
            children: [
              HiGlassIconButton(
                icon: HiIcons.chevronLeft,
                size: 44,
                radius: 14,
                iconSize: 22,
                semanticsLabel: Biz.back,
                onTap: widget.onBack,
              ),
            ],
          ),
        ),
        Expanded(
          child: Center(
            child: Padding(padding: const EdgeInsets.fromLTRB(24, 0, 24, 44), child: message),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = ref.watch(clockProvider)();
    final loaded = ref.watch(employerShiftProvider(widget.shiftId));
    final shift = loaded.value;
    final business = ref.watch(currentBusinessProvider).value;
    final top = HiInsets.top(context, 56);

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.employerDetail,
        child: shift == null
            ? _withoutShift(loaded, top)
            : ListView(
                padding: EdgeInsets.only(bottom: HiInsets.bottom(context, 28)),
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(18, top, 18, 0),
                    child: Row(
                      children: [
                        HiGlassIconButton(
                          icon: HiIcons.chevronLeft,
                          size: 44,
                          radius: 14,
                          iconSize: 22,
                          semanticsLabel: Biz.back,
                          onTap: widget.onBack,
                        ),
                        const Spacer(),
                        _EditButton(onTap: shift.cancelled ? null : () => _more(shift)),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 14, 22, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: HiText(shift.title, style: hiStyle(26, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
                        ),
                        const SizedBox(height: 8),
                        // Two chips side by side; on a narrow screen in a
                        // longer language the second goes under the first.
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            EmployerChip.forState(
                              shift.state(now) == EmployerShiftState.urgent && !now.isBefore(shift.startsAt)
                                  ? EmployerShiftState.inProgress
                                  : shift.state(now),
                              open: shift.openSlots,
                              large: true,
                            ),
                            if (shift.state(now) == EmployerShiftState.urgent && !now.isBefore(shift.startsAt))
                              EmployerChip.forState(EmployerShiftState.urgent, open: shift.openSlots, large: true),
                          ],
                        ),
                        const SizedBox(height: 8),
                        HiText(
                          '${Biz.shiftWhen(shift.startsAt, shift.endsAt, now)}\n'
                          '${Biz.shiftTerms(shift.hourlyWage, shift.confirmed, shift.slots, shift.autoConfirm)}',
                          style: hiStyle(15, FontWeight.w600, height: 1.55, color: HiColors.textSoft),
                        ),
                      ],
                    ),
                  ),
                  if (shift.waiting.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    _SectionHeader(
                      title: Biz.applicants(shift.waiting.length),
                      note: shift.autoConfirm ? null : Biz.decideYourself,
                    ),
                    for (final a in shift.waiting)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 12, 22, 0),
                        child: _ApplicantCard(
                          applicant: a,
                          busy: _busy.contains(a.applicationId),
                          canAccept: shift.openSlots > 0,
                          onReject: () => _decide(a, accept: false),
                          onAccept: () => _decide(a, accept: true),
                        ),
                      ),
                  ],
                  const SizedBox(height: 24),
                  _SectionHeader(title: Biz.attendance, note: Biz.asOfTime(now)),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                    child: _AttendanceList(shift: shift, now: now),
                  ),
                  if (!shift.cancelled) ...[
                    const SizedBox(height: 24),
                    _SectionHeader(title: Biz.qrTitle),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                      child: _QrCard(
                        shift: shift,
                        business: business?.name ?? '',
                        qr: ref.watch(shiftQrProvider(shift.id)),
                        onShare: (payload) => _shareQr(shift, payload, business?.name ?? ''),
                        onRetry: () => ref.invalidate(shiftQrProvider(shift.id)),
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

/// «✎ 수정» in the header.
class _EditButton extends StatelessWidget {
  const _EditButton({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: pressed ? HiColors.white14 : HiColors.white08,
          borderRadius: BorderRadius.circular(HiRadii.button),
          border: Border.all(color: HiColors.white14),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const HiIcon(HiIcons.pencil, size: 16, strokeWidth: 2, color: HiColors.white),
            const SizedBox(width: 6),
            HiText(Biz.edit, style: hiStyle(15, FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

/// «지원자 2명  직접 확정해 주세요» (baseline-aligned, 8 px apart).
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.note});

  final String title;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final n = note;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Semantics(header: true, child: HiText(title, style: hiStyle(18, FontWeight.w800))),
          if (n != null) ...[
            const SizedBox(width: 8),
            Flexible(child: HiText(n, style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted))),
          ],
        ],
      ),
    );
  }
}

class _ApplicantCard extends StatelessWidget {
  const _ApplicantCard({
    required this.applicant,
    required this.busy,
    required this.canAccept,
    required this.onReject,
    required this.onAccept,
  });

  final ShiftApplicant applicant;
  final bool busy;
  final bool canAccept;
  final VoidCallback onReject;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    final w = applicant.worker;
    return Semantics(
      container: true,
      label: w.fullName,
      child: EmployerCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                WorkerAvatar(worker: w),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      HiText(w.fullName, style: hiStyle(17, FontWeight.w800, color: HiColors.ink)),
                      const SizedBox(height: 4),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          RatingMark(rating: w.rating),
                          HiText(Biz.completedCount(w.completedShifts),
                              style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted)),
                          EmployerChip(label: Biz.topik(w.topik), background: HiColors.surface, height: 24, padding: 8),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            HiText(languageNames(w.languages), style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: HiButton(
                    label: Biz.reject,
                    style: HiButtonStyle.outline,
                    height: 48,
                    fontSize: 16,
                    onPressed: busy ? null : onReject,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: HiButton(
                    label: Biz.confirm,
                    style: HiButtonStyle.ink,
                    height: 48,
                    fontSize: 16,
                    onPressed: busy || !canAccept ? null : onAccept,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 출퇴근 현황: everyone holding a place and where they are.
class _AttendanceList extends StatelessWidget {
  const _AttendanceList({required this.shift, required this.now});

  final EmployerShift shift;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final crew = shift.crew;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(HiRadii.card),
        border: const Border.fromBorderSide(HiBorders.ink),
        boxShadow: HiShadows.hard,
      ),
      child: crew.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
              child: HiText(Biz.noCrew, style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted)),
            )
          : Column(
              children: [
                for (final (i, a) in crew.indexed)
                  Container(
                    constraints: const BoxConstraints(minHeight: 60),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      border: i < crew.length - 1
                          ? const Border(bottom: BorderSide(color: HiColors.surface, width: HiBorders.width))
                          : null,
                    ),
                    child: _AttendanceRow(applicant: a, shift: shift, now: now),
                  ),
              ],
            ),
    );
  }
}

class _AttendanceRow extends StatelessWidget {
  const _AttendanceRow({required this.applicant, required this.shift, required this.now});

  final ShiftApplicant applicant;
  final EmployerShift shift;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final a = applicant;
    final inAt = a.checkInAt;
    final outAt = a.checkOutAt;
    final sub = inAt == null
        ? Biz.notInYet
        : (outAt == null ? Biz.checkedInAt(inAt) : Biz.checkedInOut(inAt, outAt));
    final subStyle = inAt == null
        ? hiStyle(13, FontWeight.w600, color: HiColors.inkMuted)
        : hiStyle(13, FontWeight.w600, color: HiColors.inkMuted, family: HiFamily.mono);
    final late = a.lateMinutes ?? 0;
    final EmployerChip chip;
    if (a.status == ApplicationStatus.noShow) {
      chip = EmployerChip(label: Biz.noShow, background: HiColors.redSoft, foreground: HiColors.redInk);
    } else if (a.status == ApplicationStatus.completed) {
      chip = EmployerChip(label: Biz.leftWork, background: HiColors.surface);
    } else if (a.status == ApplicationStatus.checkedIn) {
      chip = late > 0
          ? EmployerChip(label: Biz.late(late), background: HiColors.amberSoft)
          : EmployerChip(label: Biz.atWork, background: HiColors.greenSoft);
    } else if (now.isBefore(a.dueAt(shift.startsAt))) {
      chip = EmployerChip(label: Biz.beforeStart, background: HiColors.surface);
    } else {
      chip = EmployerChip(
        label: Biz.missing(Kst.minutesBetween(a.dueAt(shift.startsAt), now)),
        background: HiColors.redSoft,
        foreground: HiColors.redInk,
      );
    }
    return Row(
      children: [
        WorkerAvatar(worker: a.worker, size: 36),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HiText(a.worker.fullName, style: hiStyle(15, FontWeight.w800, color: HiColors.ink)),
              const SizedBox(height: 1),
              HiText(sub, style: subStyle),
            ],
          ),
        ),
        const SizedBox(width: 12),
        chip,
      ],
    );
  }
}

/// 출퇴근 QR: the code printed at the door, for this shift only.
class _QrCard extends StatelessWidget {
  const _QrCard({
    required this.shift,
    required this.business,
    required this.qr,
    required this.onShare,
    required this.onRetry,
  });

  final EmployerShift shift;
  final String business;

  /// The payload (`shift_qr`); without it the card says why and offers
  /// «다시 시도» in place of sharing.
  final AsyncValue<String> qr;
  final Future<void> Function(String payload) onShare;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final data = qr.value;
    final failed = data == null && qr.hasError && !qr.isLoading;
    final offline = failed && Biz.isOffline(qr.error!);
    final muted = hiStyle(14, FontWeight.w600, color: HiColors.inkMuted);
    return EmployerCard(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      child: Column(
        children: [
          HiText(business, textAlign: TextAlign.center, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
          const SizedBox(height: 8),
          HiText('${shift.title} · ${Kst.hm(shift.startsAt)}–${Kst.hm(shift.endsAt)}',
              textAlign: TextAlign.center, style: muted),
          const SizedBox(height: 8 + 6),
          SizedBox.square(
            dimension: 180,
            child: data != null
                ? HiQrCode(data: data, semanticsLabel: Biz.qrTitle)
                : failed
                    ? Semantics(
                        liveRegion: true,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            HiIcon(offline ? HiIcons.wifiOff : HiIcons.triangleAlert,
                                size: 36, strokeWidth: 2, color: HiColors.inkMuted),
                            const SizedBox(height: 10),
                            HiText(offline ? Biz.offlineTitle : Biz.loadFailed,
                                textAlign: TextAlign.center, style: hiStyle(15, FontWeight.w700, color: HiColors.ink)),
                          ],
                        ),
                      )
                    : const Center(child: CircularProgressIndicator(color: HiColors.ink)),
          ),
          const SizedBox(height: 6 + 8),
          HiText(Biz.qrNote, textAlign: TextAlign.center, style: muted),
          const SizedBox(height: 8 + 6),
          HiButton(
            label: failed ? Biz.retry : Biz.qrShare,
            icon: failed ? HiIcons.refreshCw : HiIcons.printer,
            iconSize: 19,
            iconStroke: 2.2,
            iconGap: 8,
            height: 52,
            fontSize: 17,
            onPressed: failed ? onRetry : (data == null ? null : () => onShare(data)),
          ),
        ],
      ),
    );
  }
}

class _CancelShiftSheet extends StatelessWidget {
  const _CancelShiftSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 24, 20, HiInsets.bottom(context, 24)),
      decoration: const BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: HiBorders.ink),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: HiText(Biz.cancelShiftTitle, style: hiStyle(22, FontWeight.w800, color: HiColors.ink))),
          const SizedBox(height: 8),
          HiText(Biz.cancelShiftText, style: hiStyle(15, FontWeight.w500, color: HiColors.inkMuted)),
          const SizedBox(height: 20),
          HiButton(
            label: Biz.cancelShift,
            style: HiButtonStyle.danger,
            height: 52,
            fontSize: 17,
            onPressed: () => Navigator.of(context).pop(true),
          ),
          const SizedBox(height: 8),
          HiButton(
            label: Biz.close,
            style: HiButtonStyle.text,
            textColor: HiColors.ink,
            height: 48,
            fontSize: 16,
            onPressed: () => Navigator.of(context).pop(false),
          ),
        ],
      ),
    );
  }
}

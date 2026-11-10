import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/format/dates.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/demo/demo_shifts.dart';
import '../../../data/models/my_shift.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/controls.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../feed/feed_controller.dart';
import '../load_error.dart';
import '../my_shifts/my_shifts_providers.dart';
import '../my_shifts/my_shifts_screen.dart';
import '../profile/worker_profile_draft.dart';
import '../settings/app_language.dart';
import '../shift/shift_widgets.dart';
import 'qr_scanner.dart';

/// Ticks every second while a timer is on screen (A07).
final secondsProvider = StreamProvider.autoDispose<int>(
  (ref) => Stream.periodic(const Duration(seconds: 1), (i) => i),
);

/// Whether the second ticker runs (off in screen tests, which need a still
/// frame).
final liveTimersProvider = Provider<bool>((ref) => true);

/// «now», refreshed every second where [live].
DateTime _now(WidgetRef ref) {
  if (ref.watch(liveTimersProvider)) ref.watch(secondsProvider);
  return ref.watch(clockProvider)();
}

/// A07 entry and exit: the camera, the viewfinder and the shift.
enum QrScanMode { checkIn, checkOut }

class QrScanScreen extends ConsumerStatefulWidget {
  const QrScanScreen({
    super.key,
    required this.applicationId,
    required this.mode,
    required this.onClose,
    required this.onDone,
  });

  final String applicationId;
  final QrScanMode mode;
  final VoidCallback onClose;

  /// After a successful scan (to A07 «Ishdasiz» or «Natija»).
  final void Function(MyShift app) onDone;

  @override
  ConsumerState<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends ConsumerState<QrScanScreen> {
  bool _torch = false;
  bool _busy = false;
  QrCameraProblem? _problem;
  String? _lastFailed;
  DateTime _lastFailedAt = DateTime.fromMillisecondsSinceEpoch(0);

  Future<void> _onCode(String payload) async {
    if (_busy) return;
    // The camera reports a code many times a second; a refused one is not
    // sent again for a few seconds.
    if (payload == _lastFailed && DateTime.now().difference(_lastFailedAt) < const Duration(seconds: 3)) return;
    setState(() => _busy = true);
    final l10n = WorkerL10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final repo = ref.read(shiftRepositoryProvider);
    try {
      final app = widget.mode == QrScanMode.checkIn ? await repo.checkIn(payload) : await repo.checkOut(payload);
      ref
        ..invalidate(myShiftsProvider)
        ..invalidate(myShiftProvider(widget.applicationId))
        ..invalidate(feedProvider);
      if (mounted) widget.onDone(app);
    } on Object catch (error) {
      _lastFailed = payload;
      _lastFailedAt = DateTime.now();
      messenger.showSnackBar(SnackBar(content: Text(myShiftError(l10n, error))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final app = ref.watch(myShiftProvider(widget.applicationId)).value;
    final kind = ref.watch(qrCameraKindProvider);
    final checkIn = widget.mode == QrScanMode.checkIn;
    final size = MediaQuery.sizeOf(context);
    final shift = HiInsets.shift(context);
    final frame = Rect.fromLTWH((size.width - 260) / 2, 220 + shift, 260, 260);

    final camera = switch (kind) {
      QrCameraKind.device => ref.watch(qrCameraBuilderProvider)(
          onCode: _onCode,
          torch: _torch,
          onProblem: (problem) => setState(() => _problem = problem),
        ),
      QrCameraKind.demo => DemoQrScene(
          businessName: app?.shift.business.name ?? '',
          angleDegrees: checkIn ? -4 : 3,
        ),
    };

    return Scaffold(
      backgroundColor: const Color(0xFF070B1E),
      body: Stack(
        children: [
          Positioned.fill(child: camera),
          if (_problem case final problem?)
            Positioned(
              left: 24,
              right: 24,
              top: frame.top,
              child: _CameraProblemMessage(problem: problem),
            )
          else ...[
          Positioned.fill(
            child: IgnorePointer(
              child: QrViewfinder(
                frame: frame,
                lineTop: checkIn ? 150 : 96,
                animate: ref.watch(qrScanAnimationProvider),
              ),
            ),
          ),
          // The frame: in the demo, tapping it reads the printed code.
          Positioned.fromRect(
            rect: frame,
            child: Semantics(
              button: kind == QrCameraKind.demo,
              label: l10n.scanQr,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: kind == QrCameraKind.demo && app != null
                    ? () => _onCode(ShiftQr(app.shift.id, DemoShiftRepository.qrToken).payload)
                    : null,
              ),
            ),
          ),
          ],
          // The header stays, problem or not: the way out.
          Positioned(
            left: 18,
            right: 18,
            top: HiInsets.top(context, 56),
            child: Row(
              children: [
                HiGlassIconButton(
                  icon: HiIcons.x,
                  size: 44,
                  radius: 14,
                  iconSize: 22,
                  light: true,
                  semanticsLabel: l10n.close,
                  onTap: widget.onClose,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: HiText(
                      checkIn ? l10n.checkInTitle : l10n.checkOutTitle,
                      textAlign: TextAlign.center,
                      style: hiStyle(18, FontWeight.w800),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                HiGlassIconButton(
                  icon: HiIcons.flashlight,
                  size: 44,
                  radius: 14,
                  iconSize: 21,
                  light: true,
                  selected: _torch,
                  semanticsLabel: _torch ? l10n.flashlightOff : l10n.flashlightOn,
                  onTap: () => setState(() => _torch = !_torch),
                ),
              ],
            ),
          ),
          if (_problem == null)
          Positioned(
            left: 18,
            right: 18,
            top: 508 + shift,
            child: Column(
              children: [
                HiText(
                  checkIn ? l10n.alignQr : l10n.scanOutTitle,
                  textAlign: TextAlign.center,
                  style: hiStyle(19, FontWeight.w800, height: 1.3),
                ),
                const SizedBox(height: 6),
                HiText(
                  checkIn ? l10n.autoRead : l10n.scanOutText,
                  textAlign: TextAlign.center,
                  style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.textSoft),
                ),
              ],
            ),
          ),
          if (app != null)
            Positioned(
              left: 18,
              right: 22,
              bottom: HiInsets.bottom(context, 30),
              child: Semantics(
                container: true,
                label: checkIn ? l10n.shiftSection : l10n.currentShift,
                child: _ScanShiftCard(app: app, checkIn: checkIn, lang: lang),
              ),
            ),
          if (_busy) const Positioned.fill(child: ColoredBox(color: Color(0x33000000))),
        ],
      ),
    );
  }
}

class _ScanShiftCard extends ConsumerWidget {
  const _ScanShiftCard({required this.app, required this.checkIn, required this.lang});

  final MyShift app;
  final bool checkIn;
  final String lang;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final now = _now(ref);
    final shift = app.shift;
    final Widget pill;
    if (checkIn) {
      final minutes = Kst.minutesBetween(now, shift.startsAt);
      pill = Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(HiRadii.pill)),
        alignment: Alignment.center,
        child: HiText(
          minutes >= 0 ? l10n.timeLeft(HiDates.countdown(minutes, lang)) : l10n.lateBy(HiDates.countdown(-minutes, lang)),
          softWrap: false,
          style: hiStyle(13, FontWeight.w800, color: HiColors.ink),
        ),
      );
    } else {
      final since = app.checkInAt ?? shift.startsAt;
      pill = Semantics(
        liveRegion: false,
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(color: HiColors.greenSoft, borderRadius: BorderRadius.circular(HiRadii.pill)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 8, height: 8, decoration: const BoxDecoration(color: HiColors.green, shape: BoxShape.circle)),
              const SizedBox(width: 6),
              HiText(
                HiDates.clock(now.difference(since)),
                style: hiStyle(14, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono),
              ),
            ],
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(HiRadii.card),
        border: Border.fromBorderSide(HiBorders.ink),
        boxShadow: HiShadows.hard,
      ),
      child: Row(
        children: [
          BusinessAvatar(business: shift.business),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HiText(shift.business.displayName(lang), style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                const SizedBox(height: 2),
                HiText(
                  checkIn
                      ? '${HiDates.dayName(shift.startsAt, now, lang)} · ${HiDates.timeRange(shift.startsAt, shift.endsAt)}'
                      : l10n.planUntil(Kst.hm(shift.endsAt)),
                  style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          pill,
        ],
      ),
    );
  }
}

/// A07 «Ishdasiz»: the running timer of the workday.
class AtWorkScreen extends ConsumerWidget {
  const AtWorkScreen({super.key, required this.applicationId, required this.onClose, required this.onScanOut});

  final String applicationId;
  final VoidCallback onClose;
  final VoidCallback onScanOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final loaded = ref.watch(myShiftProvider(applicationId));
    final app = loaded.value;
    final now = _now(ref);
    final bottom = HiInsets.bottom(context, 30);
    if (app == null) {
      return _NoShift(
        loaded: loaded,
        closeIcon: HiIcons.chevronDown,
        onClose: onClose,
        onRetry: () => ref.invalidate(myShiftProvider(applicationId)),
      );
    }
    final shift = app.shift;
    final since = app.checkInAt ?? shift.startsAt;
    final worked = now.difference(since);
    final progress = (worked.inSeconds / (shift.plannedMinutes * 60)).clamp(0.0, 1.0);
    final s = worked.inSeconds < 0 ? 0 : worked.inSeconds;
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.success,
        watermark: '근무중',
        watermarkSize: 120,
        watermarkTop: 96,
        watermarkRight: -16,
        watermarkColor: HiColors.white08,
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: EdgeInsets.only(bottom: 21.0 + 12 + 56 + bottom + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 0),
                    child: Row(
                      children: [
                        HiGlassIconButton(
                          icon: HiIcons.chevronDown,
                          size: 44,
                          radius: 14,
                          iconSize: 22,
                          semanticsLabel: l10n.close,
                          onTap: onClose,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Semantics(
                            header: true,
                            child: HiText(l10n.atWorkTitle, textAlign: TextAlign.center, style: hiStyle(18, FontWeight.w800)),
                          ),
                        ),
                        const SizedBox(width: 12 + 44),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Center(
                    child: Semantics(
                      liveRegion: true,
                      child: Container(
                        height: 34,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: const Color.fromRGBO(22, 163, 74, 0.2),
                          borderRadius: BorderRadius.circular(HiRadii.pill),
                          border: Border.all(color: const Color.fromRGBO(74, 222, 128, 0.5)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: const BoxDecoration(
                                color: HiColors.green,
                                shape: BoxShape.circle,
                                boxShadow: [BoxShadow(color: Color.fromRGBO(22, 163, 74, 0.28), spreadRadius: 4)],
                              ),
                            ),
                            const SizedBox(width: 8),
                            HiText(l10n.statusAtWork, style: hiStyle(15, FontWeight.w800)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 22, 0),
                    child: _WhiteShiftCard(app: app, lang: lang, subtitle: shift.displayTitle(lang), withArea: true),
                  ),
                  const SizedBox(height: 30),
                  Center(
                    child: Semantics(
                      label: l10n.workedA11y(s ~/ 3600, s % 3600 ~/ 60, s % 60),
                      excludeSemantics: true,
                      child: SizedBox(
                        width: 248,
                        height: 248,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [HiShadows.glow(const Color.fromRGBO(212, 233, 76, 0.16), 40)],
                          ),
                          child: CustomPaint(
                            painter: _RingPainter(progress),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                HiText(l10n.workedTime, style: hiStyle(14, FontWeight.w700, color: HiColors.textMuted)),
                                const SizedBox(height: 4),
                                HiText(
                                  HiDates.clock(worked),
                                  style: hiStyle(44, FontWeight.w800, letterSpacingEm: -0.02, family: HiFamily.mono),
                                ),
                                const SizedBox(height: 4),
                                HiText(
                                  l10n.planDuration(HiDates.duration(shift.plannedMinutes, lang)),
                                  style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 28, 22, 0),
                    child: Row(
                      children: [
                        Expanded(child: _TimeTile(label: l10n.checkInLabel, value: Kst.hm(since))),
                        const SizedBox(width: 12),
                        Expanded(child: _TimeTile(label: l10n.plannedEnd, value: Kst.hm(shift.endsAt))),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 18,
              right: 22,
              bottom: bottom,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  HiText(
                    l10n.scanOutHint,
                    textAlign: TextAlign.center,
                    style: hiStyle(15, FontWeight.w500, height: 1.4, color: HiColors.textMuted),
                  ),
                  const SizedBox(height: 12),
                  HiButton(
                    label: l10n.scanOutButton,
                    icon: HiIcons.scanLine,
                    iconSize: 22,
                    height: 56,
                    onPressed: onScanOut,
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

class _TimeTile extends StatelessWidget {
  const _TimeTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: HiColors.white06,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: HiColors.white14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HiText(label, style: hiStyle(13, FontWeight.w700, color: HiColors.textMuted)),
          const SizedBox(height: 4),
          HiText(value, style: hiStyle(22, FontWeight.w800, family: HiFamily.mono)),
        ],
      ),
    );
  }
}

/// The 248 px ring: a faint track and the lime arc of the time worked.
class _RingPainter extends CustomPainter {
  _RingPainter(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = 112 * size.width / 248;
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = HiColors.white10;
    canvas.drawCircle(center, radius, track);
    if (progress <= 0) return;
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round
      ..color = HiColors.lime;
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -math.pi / 2, 2 * math.pi * progress, false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter oldDelegate) => oldDelegate.progress != progress;
}

/// White card with the business logo, its name and a second line (A07, A08).
class _WhiteShiftCard extends StatelessWidget {
  const _WhiteShiftCard({required this.app, required this.lang, required this.subtitle, this.withArea = false});

  final MyShift app;
  final String lang;
  final String subtitle;
  final bool withArea;

  @override
  Widget build(BuildContext context) {
    final b = app.shift.business;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(HiRadii.card),
        border: Border.fromBorderSide(HiBorders.ink),
        boxShadow: HiShadows.hard,
      ),
      child: Row(
        children: [
          BusinessAvatar(business: b),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HiText(withArea ? b.nameWithArea(lang) : b.displayName(lang), style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                const SizedBox(height: 2),
                HiText(subtitle, style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A07 «Smena yakunlandi».
class ShiftResultScreen extends ConsumerWidget {
  const ShiftResultScreen({super.key, required this.applicationId, required this.onClose, required this.onRate});

  final String applicationId;
  final VoidCallback onClose;
  final VoidCallback onRate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final loaded = ref.watch(myShiftProvider(applicationId));
    final app = loaded.value;
    final name = ref.watch(workerProfileDraftProvider.select((d) => d.firstName.trim()));
    final bottom = HiInsets.bottom(context, 30);
    final rated = app?.myStars != null;
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.success,
        watermark: '수고',
        watermarkSize: 130,
        watermarkTop: 104,
        watermarkRight: -20,
        watermarkColor: HiColors.white08,
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: EdgeInsets.only(bottom: 52 + 8 + 48 + bottom + 16),
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
                    padding: const EdgeInsets.fromLTRB(18, 16, 22, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ExcludeSemantics(
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: const BoxDecoration(
                              color: HiColors.white,
                              shape: BoxShape.circle,
                              border: Border.fromBorderSide(HiBorders.ink),
                              boxShadow: HiShadows.hard,
                            ),
                            alignment: Alignment.center,
                            child: const HiIcon(HiIcons.check, size: 34, strokeWidth: 3, color: HiColors.green),
                          ),
                        ),
                        const SizedBox(height: 8 + 8),
                        Semantics(
                          header: true,
                          liveRegion: true,
                          child: HiText(
                            l10n.resultTitle,
                            style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02),
                          ),
                        ),
                        const SizedBox(height: 8),
                        HiText(
                          name.isEmpty ? l10n.resultThanksNoName : l10n.resultThanks(name),
                          style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.textSoft),
                        ),
                      ],
                    ),
                  ),
                  if (app != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 22, 22, 0),
                      child: _ResultCard(app: app, lang: lang, now: now),
                    )
                  else if (loaded.hasError && !loaded.isLoading)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 32, 22, 0),
                      child: WorkerLoadError(
                        error: loaded.error!,
                        onRetry: () => ref.invalidate(myShiftProvider(applicationId)),
                      ),
                    ),
                ],
              ),
            ),
            Positioned(
              left: 18,
              right: 22,
              bottom: bottom,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!rated) ...[
                    HiButton(label: l10n.rateEmployer, onPressed: app == null ? null : onRate),
                    const SizedBox(height: 8),
                  ],
                  HiButton(
                    label: rated ? l10n.backToFeed : l10n.later,
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

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.app, required this.lang, required this.now});

  final MyShift app;
  final String lang;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final shift = app.shift;
    final b = shift.business;
    final label = hiStyle(15, FontWeight.w600, color: HiColors.inkMuted);
    final mono = hiStyle(15, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono);
    final plain = hiStyle(15, FontWeight.w800, color: HiColors.ink);
    // CSS `display:flex` (stretch): each text keeps its own line box, so the
    // JetBrains Mono values sit 1 px higher than the Inter labels.
    Widget row(String name, String value, TextStyle style) => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: HiText(name, style: label)),
            const SizedBox(width: 12),
            HiText(value, style: style),
          ],
        );
    return Semantics(
      container: true,
      label: l10n.workSummary,
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
                      HiText(b.nameWithArea(lang), style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                      const SizedBox(height: 2),
                      HiText(HiDates.dayAndDate(shift.startsAt, now, lang), style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            row(l10n.checkInLabel, Kst.hm(app.checkInAt ?? shift.startsAt), mono),
            const SizedBox(height: 10),
            row(l10n.checkOutLabel, Kst.hm(app.checkOutAt ?? shift.endsAt), mono),
            const SizedBox(height: 10),
            row(l10n.workedTime, HiDates.durationHm(app.workedMinutes ?? shift.plannedMinutes, lang), plain),
            const SizedBox(height: 10),
            row(l10n.hourlyWage, Won.worker(shift.hourlyWage), mono),
            const SizedBox(height: 14),
            Container(height: 1.5, color: HiColors.surface),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(child: HiText(l10n.total, style: hiStyle(16, FontWeight.w800, color: HiColors.ink))),
                const SizedBox(width: 12),
                HiText(
                  Won.worker(app.pay),
                  style: hiStyle(30, FontWeight.w800, color: HiColors.ink, letterSpacingEm: -0.02, family: HiFamily.mono),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: app.isPaid ? HiColors.greenSoft : HiColors.amberSoft,
                    borderRadius: BorderRadius.circular(HiRadii.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(color: app.isPaid ? HiColors.green : HiColors.amber, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      HiText(
                        app.isPaid ? l10n.paymentPaid : l10n.paymentPending,
                        style: hiStyle(13, FontWeight.w800, color: HiColors.ink),
                      ),
                    ],
                  ),
                ),
                HiText(l10n.employerPays, style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A08 «Ish beruvchini baholang».
class RateBusinessScreen extends ConsumerStatefulWidget {
  const RateBusinessScreen({super.key, required this.applicationId, required this.onClose, required this.onSent});

  final String applicationId;
  final VoidCallback onClose;
  final VoidCallback onSent;

  @override
  ConsumerState<RateBusinessScreen> createState() => _RateBusinessScreenState();
}

class _RateBusinessScreenState extends ConsumerState<RateBusinessScreen> {
  int _stars = 0;
  final Set<RatingTag> _tags = {};
  bool _busy = false;

  Future<void> _send() async {
    setState(() => _busy = true);
    final l10n = WorkerL10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(shiftRepositoryProvider).rateBusiness(widget.applicationId, _stars, _tags);
      ref
        ..invalidate(myShiftsProvider)
        ..invalidate(myShiftProvider(widget.applicationId));
      messenger.showSnackBar(SnackBar(content: Text(l10n.ratingSent)));
      if (mounted) widget.onSent();
    } on Object catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(myShiftError(l10n, error))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final loaded = ref.watch(myShiftProvider(widget.applicationId));
    final app = loaded.value;
    final bottom = HiInsets.bottom(context, 30);
    final words = [l10n.ratingHint, l10n.rating1, l10n.rating2, l10n.rating3, l10n.rating4, l10n.rating5];
    final tagLabels = {
      RatingTag.onTime: l10n.tagOnTime,
      RatingTag.polite: l10n.tagPolite,
      RatingTag.explainedWell: l10n.tagExplainedWell,
      RatingTag.asDescribed: l10n.tagAsDescribed,
      RatingTag.breakGiven: l10n.tagBreakGiven,
      RatingTag.cleanWorkplace: l10n.tagCleanWorkplace,
      RatingTag.wouldReturn: l10n.tagWouldReturn,
    };
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.success,
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: EdgeInsets.only(bottom: 52 + 8 + 48 + bottom + 16),
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
                        onTap: widget.onClose,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 12, 22, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: HiText(l10n.rateTitle, style: hiStyle(26, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
                        ),
                        const SizedBox(height: 6),
                        HiText(l10n.rateText, style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.textSoft)),
                      ],
                    ),
                  ),
                  if (app == null && loaded.hasError && !loaded.isLoading)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 24, 22, 0),
                      child: WorkerLoadError(
                        error: loaded.error!,
                        onRetry: () => ref.invalidate(myShiftProvider(widget.applicationId)),
                      ),
                    ),
                  if (app != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 18, 22, 0),
                      child: _WhiteShiftCard(
                        app: app,
                        lang: lang,
                        withArea: true,
                        subtitle: '${HiDates.dayName(app.shift.startsAt, now, lang)} · '
                            '${HiDates.timeRange(app.shift.startsAt, app.shift.endsAt)}',
                      ),
                    ),
                  const SizedBox(height: 28),
                  Semantics(
                    container: true,
                    label: l10n.ratingGroup,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        for (var n = 1; n <= 5; n++) ...[
                          if (n > 1) const SizedBox(width: 8),
                          HiPressable(
                            onTap: () => setState(() => _stars = n),
                            selected: _stars == n,
                            semanticsLabel: l10n.starLabel(n),
                            builder: (context, pressed) => SizedBox(
                              width: 56,
                              height: 56,
                              child: Center(
                                child: HiIcon(
                                  HiIcons.star,
                                  size: 42,
                                  strokeWidth: 1.4,
                                  color: n <= _stars ? HiColors.ink : HiColors.white45,
                                  fill: n <= _stars ? HiColors.amber : HiColors.white14,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Semantics(
                    liveRegion: true,
                    child: HiText(
                      words[_stars],
                      textAlign: TextAlign.center,
                      style: hiStyle(20, FontWeight.w800, color: _stars == 0 ? HiColors.textMuted : HiColors.white),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 22, 22, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(header: true, child: HiText(l10n.whatLiked, style: hiStyle(16, FontWeight.w800))),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final tag in RatingTag.values)
                              HiToggleChip(
                                label: tagLabels[tag]!,
                                selected: _tags.contains(tag),
                                onTap: () => setState(() {
                                  if (!_tags.remove(tag)) _tags.add(tag);
                                }),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 18,
              right: 22,
              bottom: bottom,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  HiButton(label: l10n.sendRating, onPressed: _stars == 0 || _busy || app == null ? null : _send),
                  const SizedBox(height: 8),
                  HiButton(label: l10n.later, style: HiButtonStyle.text, height: 48, fontSize: 16, onPressed: widget.onClose),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}


/// An A07 screen without its shift: still loading, not loaded (offline), or
/// gone. The close button stays where it always is.
class _NoShift extends StatelessWidget {
  const _NoShift({required this.loaded, required this.closeIcon, required this.onClose, required this.onRetry});

  final AsyncValue<MyShift?> loaded;
  final HiIconData closeIcon;
  final VoidCallback onClose;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final Widget message;
    if (loaded.hasValue && !loaded.hasError) {
      message = HiStatusMessage(icon: HiIcons.info, title: l10n.shiftNotFound, text: '');
    } else if (loaded.isLoading) {
      message = const CircularProgressIndicator(color: HiColors.lime);
    } else {
      message = WorkerLoadError(error: loaded.error!, onRetry: onRetry);
    }
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: HiGlassIconButton(
                  icon: closeIcon,
                  size: 44,
                  radius: 14,
                  iconSize: 22,
                  semanticsLabel: l10n.close,
                  onTap: onClose,
                ),
              ),
            ),
            Expanded(
              child: Center(
                child: Padding(padding: const EdgeInsets.fromLTRB(24, 0, 24, 44), child: message),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A07 when the camera did not start: why, and for a missing permission the
/// way to the phone's settings. Not in the prototype; the A03 «Internet
/// yo'q» message's parts.
class _CameraProblemMessage extends StatelessWidget {
  const _CameraProblemMessage({required this.problem});

  final QrCameraProblem problem;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final denied = problem == QrCameraProblem.denied;
    return HiStatusMessage(
      icon: HiIcons.camera,
      title: denied ? l10n.cameraDeniedTitle : l10n.cameraFailedTitle,
      text: denied ? l10n.cameraDeniedText : l10n.cameraFailedText,
      textMaxWidth: 300,
      action: denied ? l10n.openSettings : null,
      onAction: denied ? Geolocator.openAppSettings : null,
    );
  }
}

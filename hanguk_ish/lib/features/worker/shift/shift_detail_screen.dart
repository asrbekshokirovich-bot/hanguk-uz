import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../data/models/shift.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../settings/app_language.dart';
import 'shift_widgets.dart';

/// One shift, fresh from the repository (A05).
final shiftDetailProvider = FutureProvider.autoDispose.family<ShiftListing?, String>(
  (ref, id) => ref.watch(shiftRepositoryProvider).shift(id),
  retry: (count, error) => null,
);

/// «4,8» / «4.8»: one decimal, with the language's decimal mark.
String formatRating(double rating, String lang) {
  final text = rating.toStringAsFixed(1);
  return lang == 'uz' || lang == 'ru' ? text.replaceAll('.', ',') : text;
}

/// Minutes on foot at 80 m a minute (1,2 km → 15).
int walkingMinutes(double km) => math.max(1, (km * 1000 / 80).round());

/// A05 «Smena tafsiloti».
class ShiftDetailScreen extends ConsumerWidget {
  const ShiftDetailScreen({super.key, required this.shiftId, required this.onBack, required this.onTake});

  final String shiftId;
  final VoidCallback onBack;
  final void Function(ShiftListing shift) onTake;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final async = ref.watch(shiftDetailProvider(shiftId));
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: switch (async) {
        AsyncData(value: final shift?) => _Detail(shift: shift, onBack: onBack, onTake: onTake),
        AsyncData() => _Message(
            icon: HiIcons.info,
            title: l10n.shiftNotFound,
            action: l10n.backToFeed,
            actionIcon: HiIcons.chevronLeft,
            onAction: onBack,
            onBack: onBack,
          ),
        AsyncError(:final error) => _Message(
            icon: error is OfflineException ? HiIcons.wifiOff : HiIcons.triangleAlert,
            title: error is OfflineException ? l10n.offlineTitle : l10n.errorGeneric,
            action: l10n.retry,
            actionIcon: HiIcons.refreshCw,
            onAction: () => ref.invalidate(shiftDetailProvider(shiftId)),
            onBack: onBack,
          ),
        _ => const Center(child: CircularProgressIndicator(color: HiColors.lime)),
      },
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    required this.action,
    required this.actionIcon,
    required this.onAction,
    required this.onBack,
  });

  final HiIconData icon;
  final String title;
  final String action;
  final HiIconData actionIcon;
  final VoidCallback onAction;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return HiBackdrop(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 52), 22, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _WhiteBackButton(onPressed: onBack),
            const SizedBox(height: 120),
            Center(
              child: HiStatusMessage(
                icon: icon,
                title: title,
                text: '',
                action: action,
                actionIcon: actionIcon,
                onAction: onAction,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Detail extends ConsumerWidget {
  const _Detail({required this.shift, required this.onBack, required this.onTake});

  final ShiftListing shift;
  final VoidCallback onBack;
  final void Function(ShiftListing shift) onTake;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final b = shift.business;
    final taken = shift.myStatus == ApplicationStatus.confirmed || shift.myStatus == ApplicationStatus.pending;
    final full = shift.slotsLeft <= 0;
    final duties = shift.displayDuties(lang);
    final dress = shift.displayDress(lang);
    final distance = shift.distanceKm;
    final bottom = HiInsets.bottom(context, 30);

    return Stack(
      children: [
        SingleChildScrollView(
          child: Stack(
            children: [
              const Positioned.fill(child: HiGlowLayer(glow: HiGlow.detail)),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _PhotoHeader(photoUrl: b.photoUrl, label: l10n.workplacePhoto, onBack: onBack),
                  Padding(
                    padding: EdgeInsets.fromLTRB(18, 20, 22, 14 + 56 + bottom + 1 + 19),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            CategoryPill(category: b.category, onNavy: true),
                            const SizedBox(width: 8),
                            SlotsLeftPill(slotsLeft: shift.slotsLeft, height: 30, horizontalPadding: 12),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Semantics(
                          header: true,
                          child: HiText(
                            shift.displayTitle(lang),
                            style: hiStyle(26, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02),
                          ),
                        ),
                        const SizedBox(height: 8),
                        _IconLine(
                          icon: HiIcons.calendar,
                          gap: 8,
                          color: HiColors.textSoft,
                          text: '${HiDates.dayAndDate(shift.startsAt, now, lang)} · '
                              '${HiDates.timeRange(shift.startsAt, shift.endsAt)} · '
                              '${HiDates.duration(shift.plannedMinutes, lang)}',
                          style: hiStyle(15, FontWeight.w600, color: HiColors.textSoft),
                        ),
                        const SizedBox(height: 14),
                        _EmployerCard(shift: shift, lang: lang),
                        const SizedBox(height: 14),
                        _PayCard(shift: shift, lang: lang),
                        if (duties.isNotEmpty || dress.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          _AboutCard(duties: duties, dress: dress),
                        ],
                        const SizedBox(height: 14),
                        _WhiteSection(
                          label: l10n.address,
                          gap: 10,
                          children: [
                            _SectionTitle(icon: HiIcons.mapPin, text: l10n.address),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                HiText(
                                  b.fullAddress(lang),
                                  style: hiStyle(15, FontWeight.w700, height: 1.45, color: HiColors.ink),
                                ),
                                if (distance != null) ...[
                                  const SizedBox(height: 2),
                                  HiText(
                                    '${formatKm(distance, lang)} · ${l10n.walkMinutes(walkingMinutes(distance))}',
                                    style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted),
                                  ),
                                ],
                              ],
                            ),
                            Semantics(
                              image: true,
                              label: l10n.workplaceOnMap,
                              child: const _MiniMap(),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: HiColors.white06,
                            borderRadius: BorderRadius.circular(HiRadii.card),
                            border: Border.all(color: HiColors.white16),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  const HiIcon(HiIcons.info, size: 18, strokeWidth: 2, color: HiColors.white),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Semantics(
                                      header: true,
                                      child: HiText(l10n.cancelPolicyTitle, style: hiStyle(16, FontWeight.w800)),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              HiText(
                                l10n.cancelPolicyText,
                                style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.textSoft),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: EdgeInsets.fromLTRB(18, 14, 22, bottom),
            decoration: const BoxDecoration(
              color: HiColors.navy,
              border: Border(top: BorderSide(color: HiColors.white12)),
            ),
            child: HiButton(
              label: l10n.takeShift,
              height: 56,
              onPressed: taken || full ? null : () => onTake(shift),
            ),
          ),
        ),
      ],
    );
  }
}

/// The 44 px white back button over the photo.
class _WhiteBackButton extends StatelessWidget {
  const _WhiteBackButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onPressed,
      semanticsLabel: WorkerL10n.of(context).back,
      builder: (context, pressed) => Transform.translate(
        offset: pressed ? const Offset(1, 1) : Offset.zero,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: HiColors.white,
            borderRadius: BorderRadius.circular(HiRadii.button),
            border: Border.fromBorderSide(HiBorders.ink),
            boxShadow: [BoxShadow(color: HiColors.ink, offset: pressed ? const Offset(2, 2) : const Offset(3, 3))],
          ),
          alignment: Alignment.center,
          child: const HiIcon(HiIcons.chevronLeft, size: 22, strokeWidth: 2.2, color: HiColors.ink),
        ),
      ),
    );
  }
}

/// The workplace photo, or the striped placeholder with «Ish joyi rasmi».
class _PhotoHeader extends StatelessWidget {
  const _PhotoHeader({required this.photoUrl, required this.label, required this.onBack});

  final String? photoUrl;
  final String label;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final url = photoUrl;
    // Centred in the padding box, above the 1 px bottom border.
    final placeholder = Padding(
      padding: const EdgeInsets.only(bottom: HiBorders.width),
      child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const HiIcon(HiIcons.image, size: 30, strokeWidth: 2, color: HiColors.textMuted),
        const SizedBox(height: 8),
        HiText(label, style: hiStyle(14, FontWeight.w700, color: HiColors.textMuted)),
      ],
      ),
    );
    return SizedBox(
      height: 220,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Semantics(
            image: true,
            label: label,
            child: DecoratedBox(
              position: DecorationPosition.foreground,
              decoration: const BoxDecoration(border: Border(bottom: HiBorders.ink)),
              child: CustomPaint(
                painter: const _StripesPainter(),
                child: url == null
                    ? ExcludeSemantics(child: placeholder)
                    : Image.network(
                        url,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stack) => ExcludeSemantics(child: placeholder),
                      ),
              ),
            ),
          ),
          Positioned(
            left: 18,
            top: HiInsets.top(context, 52),
            child: _WhiteBackButton(onPressed: onBack),
          ),
        ],
      ),
    );
  }
}

/// `repeating-linear-gradient(135deg, #17287F 0 16px, #132270 16px 32px)`
/// over the padding box (the border is inside the 220 px).
class _StripesPainter extends CustomPainter {
  const _StripesPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final box = Size(size.width, size.height - HiBorders.width);
    const dir = Offset(math.sqrt1_2, math.sqrt1_2);
    final length = (box.width + box.height) * math.sqrt1_2;
    final start = box.center(Offset.zero) - dir * (length / 2);
    final paint = Paint()
      ..shader = ui.Gradient.linear(
        start,
        start + dir * 32,
        const [Color(0xFF17287F), Color(0xFF17287F), Color(0xFF132270), Color(0xFF132270)],
        const [0, 0.5, 0.5, 1],
        TileMode.repeated,
      );
    canvas.drawRect(Offset.zero & size, paint);
  }

  @override
  bool shouldRepaint(_StripesPainter oldDelegate) => false;
}

class _IconLine extends StatelessWidget {
  const _IconLine({
    required this.icon,
    required this.text,
    required this.style,
    required this.color,
    this.gap = 10,
  });

  final HiIconData icon;
  final String text;
  final TextStyle style;
  final Color color;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        HiIcon(icon, size: 18, strokeWidth: 2, color: color),
        SizedBox(width: gap),
        Expanded(child: HiText(text, style: style)),
      ],
    );
  }
}

/// White card with the hard shadow.
class _WhiteSection extends StatelessWidget {
  const _WhiteSection({required this.label, required this.children, this.gap = 14});

  final String label;
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: label,
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
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) SizedBox(height: gap),
              children[i],
            ],
          ],
        ),
      ),
    );
  }
}

/// «▣ Vazifalar»: a 32 px grey tile with the icon, then the heading.
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.text});

  final HiIconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(10)),
            alignment: Alignment.center,
            child: HiIcon(icon, size: 18, strokeWidth: 2, color: HiColors.ink),
          ),
          const SizedBox(width: 10),
          Expanded(child: HiText(text, style: hiStyle(16, FontWeight.w800, color: HiColors.ink))),
        ],
      ),
    );
  }
}

class _EmployerCard extends StatelessWidget {
  const _EmployerCard({required this.shift, required this.lang});

  final ShiftListing shift;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final b = shift.business;
    final rating = b.rating;
    final muted = hiStyle(14, FontWeight.w600, color: HiColors.inkMuted);
    return Semantics(
      container: true,
      label: l10n.employerSection,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Row(
          children: [
            BusinessAvatar(business: b, size: 52),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(b.nameWithArea(lang), style: hiStyle(17, FontWeight.w800, height: 1.3, color: HiColors.ink)),
                  if (b.verified) ...[
                    const SizedBox(height: 3),
                    const VerifiedLine(fontSize: 14),
                  ],
                  if (rating != null || b.completedShifts > 0) ...[
                    const SizedBox(height: 3),
                    // A flex row in the prototype: its 6 px gaps, not spaces,
                    // separate the star, the rating and «· 126 ta …».
                    Row(
                      children: [
                        if (rating != null) ...[
                          const HiIcon(HiIcons.star, size: 16, strokeWidth: 1.5, color: HiColors.ink, fill: HiColors.amber),
                          const SizedBox(width: 6),
                          HiText(
                            formatRating(rating, lang),
                            style: muted.copyWith(color: HiColors.ink, fontWeight: FontWeight.w800),
                          ),
                          if (b.completedShifts > 0) const SizedBox(width: 6),
                        ],
                        if (b.completedShifts > 0)
                          Flexible(
                            child: HiText(
                              rating != null
                                  ? '· ${l10n.completedShifts(b.completedShifts)}'
                                  : l10n.completedShifts(b.completedShifts),
                              style: muted,
                            ),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PayCard extends StatelessWidget {
  const _PayCard({required this.shift, required this.lang});

  final ShiftListing shift;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return Semantics(
      container: true,
      label: l10n.payCalc,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: HiColors.blue,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const HiIcon(HiIcons.wallet, size: 18, strokeWidth: 2, color: HiColors.textSoft),
                const SizedBox(width: 8),
                HiText(l10n.payCalc, style: hiStyle(15, FontWeight.w700, color: HiColors.textSoft)),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(
                  child: HiText(
                    '${HiDates.duration(shift.plannedMinutes, lang)} × ${Won.worker(shift.hourlyWage)}',
                    style: hiStyle(16, FontWeight.w700, color: HiColors.textSoft, family: HiFamily.mono),
                  ),
                ),
                const SizedBox(width: 10),
                HiText(
                  Won.worker(shift.totalPay),
                  style: hiStyle(28, FontWeight.w800, letterSpacingEm: -0.02, family: HiFamily.mono),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AboutCard extends StatelessWidget {
  const _AboutCard({required this.duties, required this.dress});

  final List<String> duties;
  final String dress;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final body = hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.ink);
    return _WhiteSection(
      label: l10n.aboutShift,
      children: [
        if (duties.isNotEmpty)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SectionTitle(icon: HiIcons.clipboardList, text: l10n.duties),
              const SizedBox(height: 10),
              for (var i = 0; i < duties.length; i++) ...[
                if (i > 0) const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      margin: const EdgeInsets.only(top: 8),
                      decoration: BoxDecoration(color: HiColors.blue, borderRadius: BorderRadius.circular(2)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: HiText(duties[i], style: body)),
                  ],
                ),
              ],
            ],
          ),
        if (duties.isNotEmpty && dress.isNotEmpty) Container(height: 1.5, color: HiColors.surface),
        if (dress.isNotEmpty)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SectionTitle(icon: HiIcons.shirt, text: l10n.dress),
              const SizedBox(height: 8),
              HiText(dress, style: body),
            ],
          ),
      ],
    );
  }
}

/// The small map of the address card with the blue location pin.
class _MiniMap extends StatelessWidget {
  const _MiniMap();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: HiColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.fromBorderSide(HiBorders.ink),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const CustomPaint(painter: _MiniMapPainter()),
          Center(
            child: Transform.translate(
              offset: const Offset(0, -13),
              child: Transform.rotate(
                angle: -math.pi / 4,
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: const BoxDecoration(
                    color: HiColors.blue,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(17),
                      topRight: Radius.circular(17),
                      bottomRight: Radius.circular(17),
                      bottomLeft: Radius.circular(4),
                    ),
                    border: Border.fromBorderSide(HiBorders.ink),
                    boxShadow: [BoxShadow(color: HiColors.ink, offset: Offset(3, 3))],
                  ),
                  alignment: Alignment.center,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(color: HiColors.white, shape: BoxShape.circle),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The prototype's 315 × 120 street sketch, scaled to cover the box.
class _MiniMapPainter extends CustomPainter {
  const _MiniMapPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.max(size.width / 315, size.height / 120);
    canvas
      ..save()
      ..translate((size.width - 315 * scale) / 2, (size.height - 120 * scale) / 2)
      ..scale(scale);
    canvas.drawRRect(
      RRect.fromLTRBR(240, 74, 320, 124, const Radius.circular(10)),
      Paint()..color = const Color(0xFFD2DDF0),
    );
    final road = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..color = HiColors.white;
    for (final (a, b, w) in const [
      (Offset(-10, 84), Offset(325, 52), 12.0),
      (Offset(120, -10), Offset(150, 130), 12.0),
      (Offset(-10, 22), Offset(325, 4), 6.0),
      (Offset(225, -10), Offset(242, 130), 6.0),
      (Offset(40, -10), Offset(58, 130), 6.0),
    ]) {
      canvas.drawLine(a, b, road..strokeWidth = w);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MiniMapPainter oldDelegate) => false;
}

import 'package:flutter/material.dart';

import '../../../core/format/dates.dart';
import '../../../core/format/text.dart';
import '../../../core/money/won.dart';
import '../../../data/models/business.dart';
import '../../../data/models/shift.dart';
import '../../../design/icons.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';

/// Icon and label of a business category.
(HiIconData, String) categoryLook(WorkerL10n l10n, BusinessCategory c) => switch (c) {
      BusinessCategory.cafe => (HiIcons.coffee, l10n.catCafe),
      BusinessCategory.restaurant => (HiIcons.utensils, l10n.catRestaurant),
      BusinessCategory.retail => (HiIcons.shoppingBag, l10n.catRetail),
      BusinessCategory.logistics => (HiIcons.briefcase, l10n.catLogistics),
      BusinessCategory.event => (HiIcons.calendar, l10n.catEvent),
      BusinessCategory.office => (HiIcons.briefcase, l10n.catOffice),
      BusinessCategory.other => (HiIcons.briefcase, l10n.catOther),
    };

/// Logo colours by category, from the prototype (cafe navy, restaurant
/// orange, shop green; the others reuse its avatar palette).
(Color, Color) _avatarColors(BusinessCategory c) => switch (c) {
      BusinessCategory.cafe => (HiColors.blueDeep, HiColors.white),
      BusinessCategory.restaurant => (const Color(0xFFFFE1CC), const Color(0xFF9A3412)),
      BusinessCategory.retail => (const Color(0xFFD9F2E1), const Color(0xFF15803D)),
      BusinessCategory.logistics => (const Color(0xFFE5F6F2), const Color(0xFF0B7A66)),
      BusinessCategory.event => (const Color(0xFFFCE9EF), const Color(0xFFC43E69)),
      BusinessCategory.office || BusinessCategory.other => (const Color(0xFFEEF3FB), const Color(0xFF1A3A6C)),
    };

HiIconData? _logoIcon(String? name) => switch (name) {
      'moon' => HiIcons.moon,
      'coffee' => HiIcons.coffee,
      'utensils' => HiIcons.utensils,
      'shoppingBag' => HiIcons.shoppingBag,
      _ => null,
    };

/// The square business logo: an icon, or the first Korean syllable.
class BusinessAvatar extends StatelessWidget {
  const BusinessAvatar({super.key, required this.business, this.size = 48});

  final Business business;

  /// 48 (cards), 52 (A05), 44 (confirm sheet).
  final double size;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _avatarColors(business.category);
    final icon = _logoIcon(business.logoIcon);
    // The prototype's corner radii per size (A05 52, cards 48, sheet 44,
    // chat 40, employer header 36).
    final radius = switch (size) { 52 => 15.0, 48 => 14.0, 44 => 13.0, 40 => 12.0, 36 => 11.0, _ => size * 0.29 };
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: icon != null ? HiColors.blueDeep : bg,
          borderRadius: BorderRadius.circular(radius),
          border: Border.fromBorderSide(HiBorders.ink),
        ),
        alignment: Alignment.center,
        child: icon != null
            ? HiIcon(icon, size: size / 2, strokeWidth: 2, color: HiColors.white)
            : HiText(
                business.initial,
                textScaler: TextScaler.noScaling,
                style: hiStyle(22, FontWeight.w900, color: fg, family: HiFamily.korean),
              ),
      ),
    );
  }
}

/// «Kafe» pill (grey on cards, translucent on navy).
class CategoryPill extends StatelessWidget {
  const CategoryPill({super.key, required this.category, this.onNavy = false});

  final BusinessCategory category;
  final bool onNavy;

  @override
  Widget build(BuildContext context) {
    final (icon, label) = categoryLook(WorkerL10n.of(context), category);
    final fg = onNavy ? HiColors.white : HiColors.ink;
    return Container(
      height: 30,
      padding: EdgeInsets.symmetric(horizontal: onNavy ? 12 : 10),
      decoration: BoxDecoration(
        color: onNavy ? HiColors.white10 : HiColors.surface,
        borderRadius: BorderRadius.circular(HiRadii.pill),
        border: onNavy ? Border.all(color: HiColors.white18) : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HiIcon(icon, size: 16, strokeWidth: 2, color: fg),
          const SizedBox(width: 6),
          HiText(label, style: hiStyle(13, FontWeight.w800, color: fg)),
        ],
      ),
    );
  }
}

/// Amber «2 joy qoldi» pill.
class SlotsLeftPill extends StatelessWidget {
  const SlotsLeftPill({super.key, required this.slotsLeft, this.height = 28, this.horizontalPadding = 10});

  final int slotsLeft;
  final double height;
  final double horizontalPadding;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
      decoration: BoxDecoration(
        color: HiColors.amberSoft,
        borderRadius: BorderRadius.circular(HiRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(color: HiColors.amber, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          HiText(
            WorkerL10n.of(context).slotsLeft(slotsLeft),
            style: hiStyle(13, FontWeight.w800, color: HiColors.ink),
          ),
        ],
      ),
    );
  }
}

/// Blue «✓ Tasdiqlangan».
class VerifiedLine extends StatelessWidget {
  const VerifiedLine({super.key, this.fontSize = 13});

  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const HiIcon(HiIcons.badgeCheck, size: 16, strokeWidth: 2, color: HiColors.blue),
        const SizedBox(width: 5),
        // Shortened rather than spilling out of a narrow card (360 dp phone,
        // large text); the prototype's sizes always fit.
        Flexible(
          child: HiText(
            WorkerL10n.of(context).verified,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: hiStyle(fontSize, FontWeight.w700, color: HiColors.blue),
          ),
        ),
      ],
    );
  }
}

/// «10 500 ₩ / soat» over «Jami 52 500 ₩».
class ShiftPay extends StatelessWidget {
  const ShiftPay({super.key, required this.shift});

  final ShiftListing shift;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final muted = hiStyle(15, FontWeight.w600, color: HiColors.inkMuted);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            HiText(
              Won.worker(shift.hourlyWage),
              style: hiStyle(20, FontWeight.w800, color: HiColors.ink, letterSpacingEm: -0.02, family: HiFamily.mono),
            ),
            const SizedBox(width: 5),
            HiText(l10n.perHour, style: muted),
          ],
        ),
        const SizedBox(height: 2),
        HiRichText(
          TextSpan(
            children: [
              TextSpan(text: '${l10n.total} '),
              TextSpan(
                text: Won.worker(shift.totalPay),
                style: muted.copyWith(color: HiColors.ink, fontWeight: FontWeight.w800),
              ),
            ],
          ),
          style: muted,
        ),
      ],
    );
  }
}

/// The white shift card of the feed and the map (A03, A04).
class ShiftCard extends StatelessWidget {
  const ShiftCard({
    super.key,
    required this.shift,
    required this.lang,
    required this.now,
    required this.onOpen,
    required this.onTake,
    this.divider = true,
  });

  final ShiftListing shift;
  final String lang;
  final DateTime now;
  final VoidCallback onOpen;
  final VoidCallback? onTake;

  /// The feed card has a rule above the pay; the map card does not.
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final b = shift.business;
    final when = '${HiDates.dayName(shift.startsAt, now, lang)} · '
        '${HiDates.timeRange(shift.startsAt, shift.endsAt)} · '
        '${HiDates.duration(shift.plannedMinutes, lang)}';
    final distance = shift.distanceKm;
    final where = dotJoin([b.displayArea(lang), if (distance != null) formatKm(distance, lang)]);
    final taken = shift.holdsMyPlace;
    return HiPressable(
      onTap: onOpen,
      semanticsLabel: '${b.displayName(lang)}, ${shift.displayTitle(lang)}, $when',
      button: false,
      builder: (context, pressed) => Container(
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                BusinessAvatar(business: b),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Wraps like the prototype («Ttukbaegi / Sikdang» next to
                      // the wide «Restoran» pill).
                      HiText(
                        b.displayName(lang),
                        style: hiStyle(17, FontWeight.w800, height: 1.3, color: HiColors.ink),
                      ),
                      const SizedBox(height: 3),
                      if (b.verified) const VerifiedLine(),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                CategoryPill(category: b.category),
              ],
            ),
            SizedBox(height: divider ? 12 : 10),
            _InfoLine(
              icon: HiIcons.clock,
              text: when,
              style: hiStyle(15, FontWeight.w700, color: HiColors.ink),
            ),
            SizedBox(height: divider ? 8 : 10),
            Row(
              children: [
                Expanded(
                  child: _InfoLine(
                    icon: HiIcons.mapPin,
                    text: where,
                    style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted),
                  ),
                ),
                const SizedBox(width: 8),
                SlotsLeftPill(slotsLeft: shift.slotsLeft),
              ],
            ),
            if (divider) ...[
              const SizedBox(height: 12),
              Container(height: 1.5, color: HiColors.surface),
              const SizedBox(height: 12),
            ] else
              const SizedBox(height: 10 + 2),
            Row(
              children: [
                Expanded(child: ShiftPay(shift: shift)),
                const SizedBox(width: 12),
                HiButton(
                  label: l10n.take,
                  style: HiButtonStyle.ink,
                  height: 44,
                  fontSize: 15,
                  horizontalPadding: 22,
                  onPressed: taken ? null : onTake,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.text, required this.style});

  final HiIconData icon;
  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        HiIcon(icon, size: 18, strokeWidth: 2, color: HiColors.inkMuted),
        const SizedBox(width: 8),
        Flexible(
          child: HiText(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: style),
        ),
      ],
    );
  }
}

/// The grey placeholder card shown while shifts load (A03 Yuklanish).
class ShiftCardSkeleton extends StatelessWidget {
  const ShiftCardSkeleton({super.key, this.variant = 0, this.compact = false});

  /// 0, 1, 2: the bar widths of the prototype's three skeletons.
  final int variant;

  /// Only the top row (the third, cut-off skeleton).
  final bool compact;

  static const _widths = [
    (0.62, 0.38, 64.0, 0.78, 0.52, 0.46, 0.30),
    (0.54, 0.34, 72.0, 0.72, 0.48, 0.42, 0.28),
    (0.58, 0.36, 60.0, 0.78, 0.52, 0.46, 0.30),
  ];

  @override
  Widget build(BuildContext context) {
    final w = _widths[variant % 3];
    Widget bar(double factor, double height, Color color) => FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: factor,
          child: Container(
            height: height,
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(height / 2)),
          ),
        );
    return ExcludeSemantics(
      child: Container(
        height: 210,
        decoration: BoxDecoration(
          color: HiColors.white07,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.all(color: HiColors.white10),
        ),
        // The prototype's bars total 1 px more than its 210 px card leaves
        // inside; CSS lets the last row run into the bottom padding.
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(color: HiColors.white12, borderRadius: BorderRadius.circular(14)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Column(
                      children: [
                        bar(w.$1, 16, HiColors.white14),
                        const SizedBox(height: 8),
                        bar(w.$2, 12, HiColors.white10),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: w.$3,
                  height: 28,
                  decoration: BoxDecoration(color: HiColors.white10, borderRadius: BorderRadius.circular(HiRadii.pill)),
                ),
              ],
            ),
            if (!compact) ...[
              const SizedBox(height: 14),
              bar(w.$4, 14, HiColors.white12),
              const SizedBox(height: 14),
              bar(w.$5, 14, HiColors.white10),
              const SizedBox(height: 14),
              Container(height: 1, color: HiColors.white08),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        bar(w.$6, 18, HiColors.white14),
                        const SizedBox(height: 8),
                        bar(w.$7, 12, HiColors.white10),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    width: 78,
                    height: 44,
                    decoration: BoxDecoration(color: HiColors.white12, borderRadius: BorderRadius.circular(14)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/my_shift.dart';
import '../../../data/models/shift.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../load_error.dart';
import '../my_shifts/my_shifts_providers.dart';
import '../settings/app_language.dart';

/// Months back from the current one shown on A09 (0 = this month).
final earningsMonthProvider = NotifierProvider<EarningsMonth, int>(EarningsMonth.new);

class EarningsMonth extends Notifier<int> {
  @override
  int build() => 0;

  void previous() => state = state + 1;

  void next() => state = state > 0 ? state - 1 : 0;
}

/// A09 «Daromad»: the month's finished shifts and what they paid.
class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key, required this.onOpen});

  final void Function(MyShift app) onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = Kst.wallClock(ref.watch(clockProvider)());
    final back = ref.watch(earningsMonthProvider);
    final month = DateTime.utc(now.year, now.month - back);
    final monthStart = Kst.instantOf(month.year, month.month, 1);
    final monthEnd = Kst.instantOf(month.year, month.month + 1, 1);
    final loaded = ref.watch(myShiftsProvider);
    final all = loaded.value ?? const <MyShift>[];
    final done = all
        .where((a) =>
            a.status == ApplicationStatus.completed &&
            !a.shift.startsAt.isBefore(monthStart) &&
            a.shift.startsAt.isBefore(monthEnd))
        .toList()
      ..sort((a, b) => b.shift.startsAt.compareTo(a.shift.startsAt));
    final total = done.fold<int>(0, (sum, a) => sum + a.pay);
    final paid = done.where((a) => a.isPaid).fold<int>(0, (sum, a) => sum + a.pay);
    final minutes = done.fold<int>(0, (sum, a) => sum + (a.workedMinutes ?? a.shift.plannedMinutes));
    final monthInstant = Kst.instantOf(month.year, month.month, 15);

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: ListView(
          padding: EdgeInsets.only(bottom: 24, top: HiInsets.top(context, 56)),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    header: true,
                    child: HiText(l10n.navEarnings, style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _MonthButton(
                        icon: HiIcons.chevronLeft,
                        label: l10n.prevMonth,
                        onTap: ref.read(earningsMonthProvider.notifier).previous,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: HiText(
                          HiDates.monthYear(monthInstant, lang),
                          textAlign: TextAlign.center,
                          style: hiStyle(17, FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _MonthButton(
                        icon: HiIcons.chevronRight,
                        label: l10n.nextMonth,
                        onTap: back == 0 ? null : ref.read(earningsMonthProvider.notifier).next,
                      ),
                    ],
                  ),
                  // Not an empty month: the earnings are unknown.
                  if (!loaded.hasValue && loaded.hasError && !loaded.isLoading)
                    Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: WorkerLoadError(error: loaded.error!, onRetry: () => ref.invalidate(myShiftsProvider)),
                    )
                  else if (!loaded.hasValue)
                    const Padding(
                      padding: EdgeInsets.only(top: 60),
                      child: Center(child: CircularProgressIndicator(color: HiColors.lime)),
                    )
                  else ...[
                    const SizedBox(height: 14),
                    Semantics(
                      container: true,
                      label: l10n.monthTotalSection,
                      child: Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: HiColors.blue,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.fromBorderSide(HiBorders.ink),
                          boxShadow: HiShadows.hard,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            HiText(
                              l10n.monthTotal(HiDates.monthName(monthInstant, lang)),
                              style: hiStyle(15, FontWeight.w700, color: HiColors.textSoft),
                            ),
                            const SizedBox(height: 6),
                            HiText(
                              Won.worker(total),
                              style: hiStyle(38, FontWeight.w800, height: 1.15, letterSpacingEm: -0.02, family: HiFamily.mono),
                            ),
                            const SizedBox(height: 6),
                            HiText(
                              l10n.shiftsHours(done.length, minutes ~/ 60),
                              style: hiStyle(15, FontWeight.w600, color: HiColors.textSoft),
                            ),
                            const SizedBox(height: 6 + 10),
                            Row(
                              children: [
                                Expanded(child: _SumTile(dot: const Color(0xFF4ADE80), label: l10n.paymentPaid, amount: paid)),
                                const SizedBox(width: 10),
                                Expanded(child: _SumTile(dot: HiColors.amber, label: l10n.paymentPending, amount: total - paid)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Semantics(
                      container: true,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: HiColors.white06,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: HiColors.white14),
                        ),
                        child: Row(
                          children: [
                            const HiIcon(HiIcons.info, size: 20, strokeWidth: 2, color: HiColors.white),
                            const SizedBox(width: 10),
                            Expanded(child: HiText(l10n.employerPays, style: hiStyle(15, FontWeight.w600))),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Semantics(header: true, child: HiText(l10n.shiftsList, style: hiStyle(17, FontWeight.w800))),
                    if (done.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 24),
                        child: HiText(
                          l10n.emptyMonth,
                          textAlign: TextAlign.center,
                          style: hiStyle(15, FontWeight.w600, color: HiColors.textMuted),
                        ),
                      )
                    else
                      // The prototype pins the list at 480 px, 2.7 px into the
                      // heading's line box rather than 10 px below it.
                      Transform.translate(
                        offset: const Offset(0, -2.7),
                        child: Container(
                        decoration: BoxDecoration(
                          color: HiColors.white,
                          borderRadius: BorderRadius.circular(HiRadii.card),
                          border: Border.fromBorderSide(HiBorders.ink),
                          boxShadow: HiShadows.hard,
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          children: [
                            for (final app in done)
                              _EarningRow(app: app, lang: lang, onTap: () => onOpen(app)),
                          ],
                        ),
                      ),
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

class _MonthButton extends StatelessWidget {
  const _MonthButton({required this.icon, required this.label, required this.onTap});

  final HiIconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final on = onTap != null;
    return HiPressable(
      onTap: onTap,
      semanticsLabel: label,
      builder: (context, pressed) => Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: on ? (pressed ? HiColors.white14 : HiColors.white08) : const Color.fromRGBO(255, 255, 255, 0.04),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: on ? HiColors.white14 : HiColors.white08),
        ),
        alignment: Alignment.center,
        child: HiIcon(icon, size: 20, strokeWidth: 2.2, color: on ? HiColors.white : const Color.fromRGBO(255, 255, 255, 0.35)),
      ),
    );
  }
}

class _SumTile extends StatelessWidget {
  const _SumTile({required this.dot, required this.label, required this.amount});

  final Color dot;
  final String label;
  final int amount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: HiColors.white12, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
              const SizedBox(width: 6),
              Flexible(child: HiText(label, style: hiStyle(13, FontWeight.w700, color: HiColors.textSoft))),
            ],
          ),
          const SizedBox(height: 2),
          HiText(Won.worker(amount), style: hiStyle(17, FontWeight.w800, family: HiFamily.mono)),
        ],
      ),
    );
  }
}

class _EarningRow extends StatelessWidget {
  const _EarningRow({required this.app, required this.lang, required this.onTap});

  final MyShift app;
  final String lang;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final shift = app.shift;
    final minutes = app.workedMinutes ?? shift.plannedMinutes;
    return HiPressable(
      onTap: onTap,
      button: false,
      builder: (context, pressed) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: pressed ? HiColors.surface.withValues(alpha: 0.4) : null,
          border: const Border(bottom: BorderSide(color: HiColors.surface, width: HiBorders.width)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 46,
              decoration: BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(12)),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  HiText(
                    '${Kst.wallClock(shift.startsAt).day}',
                    style: hiStyle(16, FontWeight.w800, height: 1.1, color: HiColors.ink, family: HiFamily.mono),
                  ),
                  HiText(
                    HiDates.monthShort(shift.startsAt, lang),
                    style: hiStyle(12, FontWeight.w700, height: 1.1, color: HiColors.inkMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(shift.business.displayName(lang), style: hiStyle(15, FontWeight.w800, color: HiColors.ink)),
                  const SizedBox(height: 2),
                  HiText(
                    l10n.payLine(HiDates.duration(minutes, lang), Won.worker(shift.hourlyWage)),
                    style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                HiText(Won.worker(app.pay), style: hiStyle(15, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono)),
                const SizedBox(height: 4),
                Container(
                  height: 24,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: app.isPaid ? HiColors.greenSoft : HiColors.amberSoft,
                    borderRadius: BorderRadius.circular(HiRadii.pill),
                  ),
                  alignment: Alignment.center,
                  child: HiText(
                    app.isPaid ? l10n.paymentPaid : l10n.paymentPending,
                    style: hiStyle(12, FontWeight.w800, color: app.isPaid ? HiColors.greenInk : HiColors.ink),
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

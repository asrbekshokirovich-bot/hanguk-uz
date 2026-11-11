import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/business.dart';
import '../../../data/models/employer.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../../worker/shift/shift_widgets.dart';
import '../biz.dart';
import '../language.dart';
import '../providers.dart';
import '../widgets.dart';

/// What BA1 opens.
class HomeActions {
  const HomeActions({required this.openShift, required this.create, required this.notifications});

  final void Function(String shiftId) openShift;
  final VoidCallback create;
  final VoidCallback notifications;
}

/// BA1 «오늘의 근무»: what needs the owner now, today in numbers, today's
/// shifts.
class Ba1HomeScreen extends ConsumerWidget {
  const Ba1HomeScreen({super.key, required this.actions});

  final HomeActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(clockProvider)();
    final business = ref.watch(currentBusinessProvider).value;
    // A business still waiting is checked with 국세청 again, once a session.
    ref.watch(businessRecheckProvider);
    final shifts = ref.watch(homeShiftsProvider);
    final unread = ref.watch(employerUnreadProvider);
    final all = shifts.value ?? const <EmployerShift>[];
    final tomorrow = kstDayStart(now, 1);
    final today = all.where((s) => s.startsAt.isBefore(tomorrow)).toList();
    final upcoming = all.where((s) => !s.startsAt.isBefore(tomorrow) && !s.cancelled).toList();
    final live = today.where((s) => !s.cancelled).toList();
    final attention = live.where((s) => s.needsAttention(now)).firstOrNull;
    final navSpace = MediaQuery.paddingOf(context).bottom;

    return HiBackdrop(
      child: RefreshIndicator(
        onRefresh: () async {
          refreshShifts(ref);
          ref.invalidate(employerNotificationsProvider);
          await refreshOrSay(context, ref.read(homeShiftsProvider.future));
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.only(bottom: navSpace + 24),
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: _StoreButton(business: business)),
                      const SizedBox(width: 8),
                      // P43: the app's language.
                      const EmployerLanguageButton(),
                      const SizedBox(width: 8),
                      HiGlassIconButton(
                        icon: HiIcons.bell,
                        size: 48,
                        radius: 16,
                        iconSize: 21,
                        badge: unread > 0,
                        semanticsLabel: Biz.bell(unread),
                        onTap: actions.notifications,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Semantics(
                    header: true,
                    child: HiText(
                      Biz.todayTitle,
                      style: hiStyle(26, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02),
                    ),
                  ),
                  const SizedBox(height: 4),
                  HiText(Biz.asOf(now), style: hiStyle(15, FontWeight.w600, color: HiColors.textMuted)),
                ],
              ),
            ),
            if (business != null && business.review != BusinessReview.verified) ...[
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                child: _ReviewNotice(rejected: business.review == BusinessReview.rejected),
              ),
            ],
            if (shifts.isLoading && !shifts.hasValue)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator(color: HiColors.lime)),
              )
            else if (shifts.hasError && !shifts.hasValue)
              // Not an empty day: the counts and the list are unknown.
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 48, 22, 0),
                child: Center(
                  child: EmployerLoadError(
                    error: shifts.error!,
                    onRetry: () => reloadAfterError(ref, homeShiftsProvider),
                  ),
                ),
              )
            else ...[
              if (attention != null) ...[
                const SizedBox(height: 14),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                  child: _AttentionCard(shift: attention, now: now, onOpen: () => actions.openShift(attention.id)),
                ),
              ],
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                child: _SummaryBand(shifts: live, now: now),
              ),
              const SizedBox(height: 18),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                child: Semantics(header: true, child: HiText(Biz.today, style: hiStyle(17, FontWeight.w800))),
              ),
              const SizedBox(height: 10),
              if (today.isEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 22, 0),
                  child: _EmptyToday(onCreate: actions.create),
                )
              else
                for (final (i, s) in today.indexed)
                  Padding(
                    padding: EdgeInsets.fromLTRB(18, i == 0 ? 0 : 10, 22, 0),
                    child: ShiftRow(shift: s, now: now, onTap: () => actions.openShift(s.id)),
                  ),
              if (upcoming.isNotEmpty) ...[
                const SizedBox(height: 18),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 22, 10),
                  child: Semantics(header: true, child: HiText(Biz.upcoming, style: hiStyle(17, FontWeight.w800))),
                ),
                for (final (i, s) in upcoming.indexed)
                  Padding(
                    padding: EdgeInsets.fromLTRB(18, i == 0 ? 0 : 10, 22, 0),
                    child: ShiftRow(shift: s, now: now, showDay: true, onTap: () => actions.openShift(s.id)),
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

/// A business 국세청 has not confirmed: its shifts do not reach workers yet
/// (pending) or at all (rejected), so the owner is told why nobody applies.
class _ReviewNotice extends StatelessWidget {
  const _ReviewNotice({required this.rejected});

  final bool rejected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      liveRegion: true,
      child: EmployerCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: rejected ? HiColors.redSoft : HiColors.amberSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: HiIcon(
                rejected ? HiIcons.triangleAlert : HiIcons.clock,
                size: 20,
                strokeWidth: 2,
                color: rejected ? HiColors.redInk : HiColors.ink,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(
                    rejected ? Biz.reviewRejectedTitle : Biz.reviewPendingTitle,
                    style: hiStyle(16, FontWeight.w800, color: HiColors.ink),
                  ),
                  const SizedBox(height: 3),
                  HiText(
                    rejected ? Biz.reviewRejectedText : Biz.reviewPendingText,
                    style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted),
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

/// «🌙 달빛카페 신촌점 ⌄»: opens the list of the owner's stores.
class _StoreButton extends ConsumerWidget {
  const _StoreButton({required this.business});

  final Business? business;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = business;
    return HiPressable(
      onTap: b == null
          ? null
          : () async {
              final all = await ref.read(businessesProvider.future);
              if (!context.mounted) return;
              final picked = await showHiPicker(
                context,
                title: Biz.storeSwitch,
                options: [for (final x in all) HiPickerOption(x.id, x.name)],
                searchHint: '',
                searchable: false,
                selected: b.id,
              );
              if (picked != null && picked != b.id) {
                ref.read(selectedBusinessIdProvider.notifier).select(picked);
              }
            },
      semanticsLabel: b == null ? null : '${b.name}, ${Biz.storeSwitch}',
      builder: (context, pressed) => SizedBox(
        height: 44,
        child: Row(
          children: [
            if (b != null) BusinessAvatar(business: b, size: 36),
            const SizedBox(width: 10),
            Flexible(
              child: HiText(
                b?.name ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: hiStyle(16, FontWeight.w800),
              ),
            ),
            const SizedBox(width: 10),
            const HiIcon(HiIcons.chevronDown, size: 18, strokeWidth: 2, color: HiColors.white),
            const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }
}

class _AttentionCard extends StatelessWidget {
  const _AttentionCard({required this.shift, required this.now, required this.onOpen});

  final EmployerShift shift;
  final DateTime now;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final waiting = shift.waiting.length;
    return Semantics(
      container: true,
      label: Biz.attentionLabel,
      child: EmployerCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: HiColors.redSoft, borderRadius: BorderRadius.circular(12)),
                  alignment: Alignment.center,
                  child: const HiIcon(HiIcons.userX, size: 20, strokeWidth: 2, color: HiColors.redInk),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      HiText(Biz.attentionTitle, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                      const SizedBox(height: 3),
                      HiText(
                        Biz.attention(shift.title, noShows: shift.noShows(now), open: shift.openSlots, waiting: waiting),
                        style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            HiButton(
              label: waiting > 0 ? Biz.checkApplicants : Biz.checkShift,
              style: HiButtonStyle.ink,
              height: 44,
              fontSize: 15,
              onPressed: onOpen,
            ),
          ],
        ),
      ),
    );
  }
}

/// «오늘 근무 3건 · 확정 8/9 · 남은 자리 1 · 미출근 1명» on blue.
class _SummaryBand extends StatelessWidget {
  const _SummaryBand({required this.shifts, required this.now});

  final List<EmployerShift> shifts;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final confirmed = shifts.fold(0, (sum, s) => sum + s.confirmed);
    final slots = shifts.fold(0, (sum, s) => sum + s.slots);
    final open = shifts.where((s) => now.isBefore(s.endsAt)).fold(0, (sum, s) => sum + s.openSlots);
    final missing = shifts.where((s) => now.isBefore(s.endsAt)).fold(0, (sum, s) => sum + s.noShows(now));
    final value = hiStyle(22, FontWeight.w800, family: HiFamily.mono);
    final unit = hiStyle(13, FontWeight.w700, family: HiFamily.korean);
    Widget stat(String label, String number, [String? suffix]) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HiText(label, maxLines: 1, softWrap: false, style: hiStyle(12, FontWeight.w700, color: HiColors.textSoft)),
              const SizedBox(height: 4),
              suffix == null
                  ? HiText(number, style: value)
                  : HiRichText(
                      TextSpan(text: number, children: [TextSpan(text: suffix, style: unit)]),
                      style: value,
                      also: [unit],
                    ),
            ],
          ),
        );
    return Semantics(
      container: true,
      label: Biz.todaySummary,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: HiColors.blue,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            stat(Biz.statShifts, '${shifts.length}', Biz.unitCount),
            const SizedBox(width: 8),
            stat(Biz.statConfirmed, '$confirmed/$slots'),
            const SizedBox(width: 8),
            stat(Biz.statOpen, '$open'),
            const SizedBox(width: 8),
            stat(Biz.statNoShow, '$missing', Biz.unitPeople),
          ],
        ),
      ),
    );
  }
}

/// One shift in the BA1 list: times, title, crew, status.
class ShiftRow extends StatelessWidget {
  const ShiftRow({super.key, required this.shift, required this.now, required this.onTap, this.showDay = false});

  final EmployerShift shift;
  final DateTime now;
  final VoidCallback onTap;

  /// Upcoming days: «내일 · 확정 0/3명».
  final bool showDay;

  @override
  Widget build(BuildContext context) {
    final crew = Biz.crewLine(shift.confirmed, shift.slots, shift.waiting.length);
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Container(
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: pressed ? const Color(0xFFF4F7FC) : HiColors.white,
          borderRadius: BorderRadius.circular(18),
          border: const Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Row(
          children: [
            SizedBox(
              width: 56,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(Kst.hm(shift.startsAt),
                      style: hiStyle(15, FontWeight.w800, height: 1.3, color: HiColors.ink, family: HiFamily.mono)),
                  HiText(Kst.hm(shift.endsAt),
                      style: hiStyle(13, FontWeight.w600, height: 1.3, color: HiColors.inkMuted, family: HiFamily.mono)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(shift.title, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                  const SizedBox(height: 2),
                  HiText(
                    showDay ? '${Biz.dayWord(shift.startsAt, now)} · $crew' : crew,
                    style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            EmployerChip.forState(shift.state(now)),
          ],
        ),
      ),
    );
  }
}

class _EmptyToday extends StatelessWidget {
  const _EmptyToday({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return EmployerCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HiText(Biz.noShiftsToday, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
          const SizedBox(height: 3),
          HiText(Biz.noShiftsTodayHint, style: hiStyle(15, FontWeight.w500, color: HiColors.inkMuted)),
          const SizedBox(height: 12),
          HiButton(label: Biz.post, height: 44, fontSize: 15, icon: HiIcons.plus, iconSize: 18, iconGap: 6, onPressed: onCreate),
        ],
      ),
    );
  }
}

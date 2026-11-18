import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/monthly_job.dart';
import '../../../data/repositories/monthly_job_repository.dart';
import '../../../data/repositories/shift_repository.dart' show OfflineException;
import '../../../design/icons.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../feed/feed_area.dart';
import '../feed/feed_controller.dart';

/// The open monthly jobs, as the server has them. Reloaded by pull-to-refresh
/// and by [ref.invalidate].
final monthlyJobsProvider = FutureProvider.autoDispose<List<MonthlyJob>>(
  (ref) => ref.watch(monthlyJobRepositoryProvider).list(),
  retry: (count, error) => null,
);

/// The monthly jobs the feed's filters let through (the same chips as the
/// day shifts: pay, distance, field, time of day).
final visibleMonthlyJobsProvider = Provider.autoDispose<AsyncValue<List<MonthlyJob>>>((ref) {
  final filter = ref.watch(feedFilterProvider);
  final area = ref.watch(feedAreaProvider).value;
  return ref.watch(monthlyJobsProvider).whenData(
        (jobs) => [for (final j in jobs) if (monthlyJobMatches(j, filter, area)) j],
      );
});

/// Whether [job] passes [filter]. A job that does not say where it is, or when
/// (day or night), is not shut out by a distance or time filter; a field
/// filter needs the job's field.
bool monthlyJobMatches(MonthlyJob job, FeedFilter filter, FeedArea? area) {
  final minWage = filter.monthlyMinWage;
  if (minWage != null && job.monthlyWage < minWage) return false;
  if (filter.categories.isNotEmpty && !filter.categories.any((c) => c.name == job.category)) return false;
  if (filter.dayParts.isNotEmpty && job.workTime != null) {
    final day = filter.dayParts.contains(0) || filter.dayParts.contains(1);
    final night = filter.dayParts.contains(2) || filter.dayParts.contains(3);
    if (job.workTime == 'day' && !day) return false;
    if (job.workTime == 'night' && !night) return false;
  }
  final radius = filter.radiusKm;
  final lat = area?.lat;
  final lng = area?.lng;
  if (radius != null && lat != null && lng != null && job.lat != null && job.lng != null) {
    if (_distanceKm(lat, lng, job.lat!, job.lng!) > radius) return false;
  }
  return true;
}

double _distanceKm(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371.0;
  double rad(double d) => d * math.pi / 180;
  final dLat = rad(lat2 - lat1);
  final dLng = rad(lng2 - lng1);
  final a = math.pow(math.sin(dLat / 2), 2) + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * r * math.asin(math.sqrt(a));
}

/// One monthly job: title, company, monthly pay, days a week, place, and
/// «Qiziqaman» (the staff then call both sides).
class MonthlyJobCard extends ConsumerStatefulWidget {
  const MonthlyJobCard({super.key, required this.job, required this.lang});

  final MonthlyJob job;
  final String lang;

  @override
  ConsumerState<MonthlyJobCard> createState() => _MonthlyJobCardState();
}

class _MonthlyJobCardState extends ConsumerState<MonthlyJobCard> {
  bool _busy = false;

  Future<void> _toggle(bool apply) async {
    setState(() => _busy = true);
    final repo = ref.read(monthlyJobRepositoryProvider);
    try {
      apply ? await repo.apply(widget.job.id) : await repo.withdraw(widget.job.id);
      ref.invalidate(monthlyJobsProvider);
    } on Object catch (error) {
      if (!mounted) return;
      final l10n = WorkerL10n.of(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error is OfflineException ? l10n.offlineTitle : l10n.errorGeneric)),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final job = widget.job;
    final lang = widget.lang;
    final days = job.daysPerWeek;
    final hours = job.hoursPerDay;
    final schedule = days == null
        ? null
        : hours == null
            ? l10n.monthlyDaysOnly(days)
            : l10n.monthlyDaysHours(days, hours);
    final area = job.displayArea(lang);
    final description = job.displayDescription(lang);
    return Semantics(
      container: true,
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
            HiText(job.displayTitle(lang), style: hiStyle(18, FontWeight.w800, height: 1.25, color: HiColors.ink)),
            const SizedBox(height: 4),
            HiText(job.displayCompany(lang), style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted)),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Flexible(
                  child: HiText(job.wageText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: hiStyle(24, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono)),
                ),
                const SizedBox(width: 6),
                HiText(l10n.monthlyPerMonth, style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted)),
              ],
            ),
            const SizedBox(height: 10),
            if (schedule != null) _InfoLine(icon: HiIcons.calendarCheck, text: schedule),
            if (area.isNotEmpty) _InfoLine(icon: HiIcons.mapPin, text: area),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 8),
              HiText(description, style: hiStyle(14, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
            ],
            const SizedBox(height: 14),
            if (job.applied) ...[
              _InfoLine(icon: HiIcons.check, text: '${l10n.monthlyInterestSent}. ${l10n.monthlyInterestNote}'),
              const SizedBox(height: 8),
              HiButton(
                label: l10n.monthlyWithdraw,
                style: HiButtonStyle.outline,
                height: 44,
                fontSize: 15,
                onPressed: _busy ? null : () => _toggle(false),
              ),
            ] else
              HiButton(
                label: l10n.monthlyInterested,
                style: HiButtonStyle.ink,
                height: 48,
                fontSize: 16,
                onPressed: _busy ? null : () => _toggle(true),
              ),
          ],
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.text});

  final HiIconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: HiIcon(icon, size: 16, strokeWidth: 2, color: HiColors.inkMuted),
          ),
          const SizedBox(width: 8),
          Expanded(child: HiText(text, style: hiStyle(14, FontWeight.w600, height: 1.35, color: HiColors.ink))),
        ],
      ),
    );
  }
}

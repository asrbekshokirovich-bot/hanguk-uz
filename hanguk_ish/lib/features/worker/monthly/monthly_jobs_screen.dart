import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/monthly_job.dart';
import '../../../data/repositories/monthly_job_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/forms.dart' show HiTopBar;
import '../../../design/widgets/navigation.dart' show HiStatusMessage;
import '../../../l10n/gen/worker_l10n.dart';
import '../load_error.dart';
import '../settings/app_language.dart';

/// The open monthly jobs. Reloaded by pull-to-refresh and by [ref.invalidate].
final monthlyJobsProvider = FutureProvider.autoDispose<List<MonthlyJob>>(
  (ref) => ref.watch(monthlyJobRepositoryProvider).list(),
  retry: (count, error) => null,
);

/// «Oylik ishlar»: jobs paid by the month. No day tabs — a monthly job has no
/// day — only the pay, the days a week and the place, and «Qiziqaman».
class MonthlyJobsScreen extends ConsumerWidget {
  const MonthlyJobsScreen({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final jobs = ref.watch(monthlyJobsProvider);
    final Widget body = jobs.when(
      loading: () => const Center(child: CircularProgressIndicator(color: HiColors.lime)),
      error: (error, _) => WorkerLoadError(error: error, onRetry: () => ref.invalidate(monthlyJobsProvider)),
      data: (list) => list.isEmpty
          ? HiStatusMessage(
              icon: HiIcons.briefcase,
              title: l10n.monthlyJobsEmpty,
              text: l10n.monthlyJobsEmptyText,
              textMaxWidth: 300,
            )
          : RefreshIndicator(
              color: HiColors.ink,
              onRefresh: () async => refreshOrSay(context, ref.refresh(monthlyJobsProvider.future)),
              child: ListView.separated(
                padding: EdgeInsets.fromLTRB(18, 8, 22, HiInsets.bottom(context, 24)),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 14),
                itemBuilder: (context, i) => _MonthlyJobCard(job: list[i], lang: lang),
              ),
            ),
    );
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 22, 0),
              child: HiTopBar(title: l10n.monthlyJobsTitle, onBack: onBack),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 22, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    header: true,
                    child: HiText(l10n.monthlyJobsTitle, style: hiStyle(28, FontWeight.w800, height: 1.15, letterSpacingEm: -0.02)),
                  ),
                  const SizedBox(height: 6),
                  HiText(l10n.monthlyJobsSubtitle, style: hiStyle(14, FontWeight.w500, height: 1.4, color: HiColors.textSoft)),
                ],
              ),
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

class _MonthlyJobCard extends ConsumerStatefulWidget {
  const _MonthlyJobCard({required this.job, required this.lang});

  final MonthlyJob job;
  final String lang;

  @override
  ConsumerState<_MonthlyJobCard> createState() => _MonthlyJobCardState();
}

class _MonthlyJobCardState extends ConsumerState<_MonthlyJobCard> {
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../core/links/directions.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/job_offer.dart';
import '../../../data/repositories/offer_repository.dart';
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
import '../coins/coins.dart';
import '../load_error.dart';
import '../profile/worker_profile_draft.dart';
import '../settings/app_language.dart';
import '../work/work_screens.dart' show liveTimersProvider, secondsProvider;

/// «Ishlar»: the offers sent to this worker (`my_offers`).
final offersProvider = FutureProvider.autoDispose<List<JobOffer>>(
  (ref) => ref.watch(offerRepositoryProvider).offers(),
  retry: (count, error) => null,
);

/// «Mening ishlarim»: the jobs this worker opened (`my_jobs`).
final openedJobsProvider = FutureProvider.autoDispose<List<OpenedJob>>(
  (ref) => ref.watch(offerRepositoryProvider).jobs(),
  retry: (count, error) => null,
);

/// «now», again every second while timers run.
DateTime _now(WidgetRef ref) {
  if (ref.watch(liveTimersProvider)) ref.watch(secondsProvider);
  return ref.watch(clockProvider)();
}

/// Whether the job's hours (in Seoul) are all in the worker's «Qachon
/// ishlay olaman». No schedule at all counts as any time, as the database does.
bool fitsSchedule(int availability, DateTime start, DateTime end) {
  if (availability == 0) return true;
  var t = Kst.wallClock(start);
  final e = Kst.wallClock(end);
  while (t.isBefore(e)) {
    final h = t.hour;
    // Kunduzi: before 18:00; Kechqurun: from 18:00.
    final slot = t.hour >= 18 ? 2 : 1;
    if (availability & WorkerProfileDraft.bit(t.weekday - 1, slot) == 0) return false;
    t = t.add(const Duration(hours: 1));
  }
  return true;
}

/// «mm:ss».
String _mmss(Duration d) {
  final s = d.inSeconds < 0 ? 0 : d.inSeconds;
  return '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
}

/// What to tell the worker when opening fails.
String offerError(WorkerL10n l10n, Object error) => switch (error) {
      ShiftActionException(code: 'NO_COINS') => l10n.errNoCoins,
      ShiftActionException(code: 'OFFER_EXPIRED' || 'NOT_FOUND') => l10n.errOfferExpired,
      ShiftActionException(code: 'SHIFT_FULL') => l10n.errShiftFull,
      ShiftActionException(code: 'SHIFT_CLOSED' || 'SHIFT_STARTED') => l10n.errShiftClosed,
      ShiftActionException(code: 'TIME_CONFLICT') => l10n.errTimeConflict,
      OfflineException() => l10n.errOffline,
      _ => l10n.errorGeneric,
    };

void _say(BuildContext context, String text) =>
    (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(text)));

const _card = BoxDecoration(
  color: HiColors.white07,
  borderRadius: BorderRadius.all(Radius.circular(HiRadii.card)),
  border: Border.fromBorderSide(BorderSide(color: HiColors.white14)),
);

/// The header of the three tabs: the title, a line under it, the puyl.
class _Header extends ConsumerWidget {
  const _Header({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final balance = ref.watch(coinsProvider).value?.balance;
    return Padding(
      padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  header: true,
                  child: HiText(title, style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  HiText(subtitle!, style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted)),
                ],
              ],
            ),
          ),
          Semantics(
            label: l10n.coinsTitle,
            child: Container(
              padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
              decoration: BoxDecoration(
                color: HiColors.white10,
                borderRadius: BorderRadius.circular(HiRadii.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(color: HiColors.lime, shape: BoxShape.circle),
                    child: HiText('P', style: hiStyle(13, FontWeight.w800, color: HiColors.onLime)),
                  ),
                  const SizedBox(width: 8),
                  HiText(balance == null ? '—' : '$balance',
                      style: hiStyle(16, FontWeight.w800, family: HiFamily.mono)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// «Ishlar»: each job sent to only a few people for 30 minutes; the phone
/// and the address open with puyl.
class OffersScreen extends ConsumerWidget {
  const OffersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final now = _now(ref);
    final async = ref.watch(offersProvider);
    final offers = async.value ?? const <JobOffer>[];
    final availability = ref.watch(workerProfileDraftProvider).availability;
    final live = [for (final o in offers) if (o.liveAt(now) || o.status == JobOfferStatus.applied) o];
    final ended = [for (final o in offers) if (!o.liveAt(now) && o.status != JobOfferStatus.applied) o];

    final Widget body;
    if (async.isLoading && !async.hasValue) {
      body = const SizedBox.shrink();
    } else if (async.hasError && !async.hasValue) {
      body = _centered(WorkerLoadError(error: async.error!, onRetry: () => ref.invalidate(offersProvider)));
    } else if (offers.isEmpty) {
      body = _centered(HiStatusMessage(
        icon: HiIcons.briefcase,
        title: l10n.offersEmptyTitle,
        text: l10n.offersEmptyText,
        textMaxWidth: 300,
      ));
    } else {
      body = RefreshIndicator(
        color: HiColors.ink,
        backgroundColor: HiColors.lime,
        onRefresh: () => refreshOrSay(context, ref.refresh(offersProvider.future)),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
          children: [
            if (ended.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: HiColors.white06, borderRadius: BorderRadius.circular(14)),
                child: HiText(l10n.offersGone(ended.length),
                    style: hiStyle(13, FontWeight.w600, height: 1.4, color: HiColors.textMuted)),
              ),
              const SizedBox(height: 14),
            ],
            for (final o in [...live, ...ended]) ...[
              OfferCard(
                offer: o,
                now: now,
                fits: fitsSchedule(availability, o.startsAt, o.endsAt),
                onOpen: () => openOffer(context, ref, o),
              ),
              const SizedBox(height: 14),
            ],
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(title: l10n.offersTitle),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

Widget _centered(Widget child) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 80, 18, 24),
      child: Center(child: child),
    );

/// «Telefon va manzilni ochish»: the sheet, then the database.
Future<void> openOffer(BuildContext context, WidgetRef ref, JobOffer offer) async {
  final l10n = WorkerL10n.of(context);
  final balance = ref.read(coinsProvider).value?.balance;
  final ok = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (context) => UnlockSheet(offer: offer, balance: balance),
  );
  if (ok != true || !context.mounted) return;
  try {
    await ref.read(offerRepositoryProvider).unlock(offer.shiftId);
  } on Object catch (error) {
    if (context.mounted) _say(context, offerError(l10n, error));
    ref.invalidate(offersProvider);
    ref.invalidate(coinsProvider);
    return;
  }
  ref
    ..invalidate(offersProvider)
    ..invalidate(openedJobsProvider)
    ..invalidate(coinsProvider);
}

/// One offer: the timer, to how many it went, the pay, when, the hidden
/// phone and address, and the button.
class OfferCard extends ConsumerWidget {
  const OfferCard({super.key, required this.offer, required this.now, required this.fits, required this.onOpen});

  final JobOffer offer;
  final DateTime now;
  final bool fits;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final opened = offer.status == JobOfferStatus.applied;
    final left = offer.leftAt(now);
    final dead = !opened && !offer.liveAt(now);
    final warn = !opened && !dead && left <= const Duration(minutes: 5);
    final (Color timerBg, Color timerFg, String timerText) = opened
        ? (HiColors.greenSoft, HiColors.greenInk, l10n.offerTimerTaken)
        : dead
            ? (HiColors.white10, HiColors.textMuted,
                offer.status == JobOfferStatus.closed ? l10n.offerTimerClosed : l10n.offerTimerGone)
            : warn
                ? (HiColors.redSoft, HiColors.redInk, l10n.offerTimerHurry)
                : (HiColors.lime, HiColors.onLime, l10n.offerTimerLive);
    final fraction = opened ? 1.0 : (left.inSeconds / offerLifetime.inSeconds).clamp(0.0, 1.0);
    final hours = (offer.endsAt.difference(offer.startsAt).inMinutes / 60).round();
    final checked = offer.checkedAt;
    final muted = hiStyle(14, FontWeight.w600, height: 1.4, color: HiColors.textMuted);

    return Opacity(
      opacity: dead ? 0.5 : 1,
      child: Container(
        decoration: _card,
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The timer strip.
            Container(
              color: timerBg,
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: HiText(timerText, style: hiStyle(13, FontWeight.w800, color: timerFg))),
                      HiText(opened ? '✓' : _mmss(left),
                          style: hiStyle(17, FontWeight.w800, color: timerFg, family: HiFamily.mono)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: fraction,
                      minHeight: 4,
                      color: timerFg,
                      backgroundColor: timerFg.withValues(alpha: 0.18),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      for (var i = 0; i < offer.sentCount.clamp(1, 6); i++)
                        Container(
                          width: 10,
                          height: 10,
                          margin: const EdgeInsets.only(right: 4),
                          decoration: BoxDecoration(
                            color: i == 0 ? HiColors.lime : HiColors.white30,
                            shape: BoxShape.circle,
                          ),
                        ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: HiText(l10n.offerSentTo(offer.sentCount, offer.placesLeft),
                            style: hiStyle(13, FontWeight.w700, color: HiColors.textSoft)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  HiText(offer.displayTitle(lang), style: hiStyle(19, FontWeight.w800, height: 1.25)),
                  const SizedBox(height: 10),
                  HiText(l10n.offerPayLabel, style: hiStyle(13, FontWeight.w600, color: HiColors.textMuted)),
                  HiText(l10n.offerPay(Won.group(offer.pay, ',')),
                      style: hiStyle(26, FontWeight.w800, color: HiColors.lime, family: HiFamily.mono)),
                  const SizedBox(height: 6),
                  HiText(
                    '${HiDates.dayName(offer.startsAt, now, lang)} ${HiDates.timeRange(offer.startsAt, offer.endsAt)}'
                    ' · ${l10n.offerHours(hours)}'
                    '${offer.distanceKm == null ? '' : ' · ${formatKm(offer.distanceKm!, lang)}'}',
                    style: hiStyle(15, FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  HiText(fits ? l10n.offerFits : l10n.offerNoFit,
                      style: hiStyle(13, FontWeight.w700, color: fits ? HiColors.lime : HiColors.amber)),
                  if (checked != null) ...[
                    const SizedBox(height: 4),
                    HiText(l10n.offerChecked(HiDates.dayName(checked, now, lang), Kst.hm(checked)), style: muted),
                  ],
                  if (offer.note.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    HiText(offer.note, style: muted),
                  ],
                  const SizedBox(height: 12),
                  _HiddenRow(icon: HiIcons.smartphone, label: l10n.offerPhone, value: offer.maskedPhone),
                  const SizedBox(height: 6),
                  _HiddenRow(
                    icon: HiIcons.mapPin,
                    label: l10n.offerAddress,
                    value: offer.maskedAddress.isEmpty ? '—' : offer.maskedAddress,
                  ),
                  if (!dead) ...[
                    const SizedBox(height: 14),
                    HiButton(
                      label: opened ? l10n.offerOpened : l10n.offerOpen(offer.price),
                      style: opened ? HiButtonStyle.ghost : HiButtonStyle.lime,
                      onPressed: opened ? null : onOpen,
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

class _HiddenRow extends StatelessWidget {
  const _HiddenRow({required this.icon, required this.label, required this.value});

  final HiIconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: HiColors.white06, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          HiIcon(icon, size: 18, strokeWidth: 2, color: HiColors.textMuted),
          const SizedBox(width: 10),
          HiText(label, style: hiStyle(13, FontWeight.w600, color: HiColors.textMuted)),
          const SizedBox(width: 10),
          Expanded(
            child: HiText(value,
                textAlign: TextAlign.end,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: hiStyle(15, FontWeight.w700, family: HiFamily.mono)),
          ),
        ],
      ),
    );
  }
}

/// What opening gives, the balance and what stays, and the button
/// (or «Puyl yetmaydi»). Pops true to open.
class UnlockSheet extends ConsumerWidget {
  const UnlockSheet({super.key, required this.offer, required this.balance});

  final JobOffer offer;

  /// Null when it did not load: the database decides.
  final int? balance;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final short = balance != null && balance! < offer.price;
    final gets = [l10n.unlockGetAssigned, l10n.unlockGetPhone, l10n.unlockGetAddress, l10n.unlockGetSaved];
    return Container(
      decoration: const BoxDecoration(
        color: HiColors.navy,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.paddingOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: HiColors.white30, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 16),
          HiText(offer.displayTitle(lang), style: hiStyle(20, FontWeight.w800, height: 1.25)),
          const SizedBox(height: 12),
          for (final g in gets)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const HiIcon(HiIcons.check, size: 18, strokeWidth: 2.4, color: HiColors.lime),
                  const SizedBox(width: 10),
                  Expanded(child: HiText(g, style: hiStyle(15, FontWeight.w600, height: 1.35))),
                ],
              ),
            ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: HiText(balance == null ? l10n.unlockBalance(0).replaceAll('0', '—') : l10n.unlockBalance(balance!),
                    style: hiStyle(15, FontWeight.w700, color: HiColors.textSoft)),
              ),
              if (balance != null)
                HiText(l10n.unlockAfter(balance! - offer.price),
                    style: hiStyle(15, FontWeight.w800, color: short ? HiColors.red : HiColors.lime)),
            ],
          ),
          const SizedBox(height: 16),
          HiButton(
            label: short ? l10n.unlockShort : l10n.unlockCta(offer.price),
            onPressed: short ? null : () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );
  }
}

/// «Mening ishlarim»: the jobs opened with puyl — call, the way there, the
/// steps, then the employer's stars.
class OpenedJobsScreen extends ConsumerWidget {
  const OpenedJobsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final async = ref.watch(openedJobsProvider);
    final jobs = async.value ?? const <OpenedJob>[];
    final done = jobs.where((j) => j.step == JobStep.wentToWork).length;

    final Widget body;
    if (async.isLoading && !async.hasValue) {
      body = const SizedBox.shrink();
    } else if (async.hasError && !async.hasValue) {
      body = _centered(WorkerLoadError(error: async.error!, onRetry: () => ref.invalidate(openedJobsProvider)));
    } else if (jobs.isEmpty) {
      body = _centered(HiStatusMessage(
        icon: HiIcons.calendarCheck,
        title: l10n.myJobsEmptyTitle,
        text: l10n.myJobsEmptyText,
        textMaxWidth: 300,
      ));
    } else {
      body = RefreshIndicator(
        color: HiColors.ink,
        backgroundColor: HiColors.lime,
        onRefresh: () => refreshOrSay(context, ref.refresh(openedJobsProvider.future)),
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
          itemCount: jobs.length,
          separatorBuilder: (context, i) => const SizedBox(height: 14),
          itemBuilder: (context, i) => OpenedJobCard(job: jobs[i]),
        ),
      );
    }

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(
              title: l10n.navMyJobs,
              subtitle: async.hasValue ? l10n.myJobsSummary(jobs.length, done) : null,
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

class OpenedJobCard extends ConsumerWidget {
  const OpenedJobCard({super.key, required this.job});

  final OpenedJob job;

  Future<void> _run(BuildContext context, WidgetRef ref, Future<void> Function() call) async {
    final l10n = WorkerL10n.of(context);
    try {
      await call();
    } on Object catch (error) {
      if (context.mounted) _say(context, offerError(l10n, error));
    }
    ref.invalidate(openedJobsProvider);
  }

  Future<void> _open(BuildContext context, WidgetRef ref, Uri uri) async {
    final l10n = WorkerL10n.of(context);
    final opened = await ref.read(linkOpenerProvider)(uri);
    if (!opened && context.mounted) _say(context, l10n.errorGeneric);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final repo = ref.read(offerRepositoryProvider);
    final steps = [l10n.stepOpened, l10n.stepCalled, l10n.stepWent];
    final phone = job.phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final route = job.lat != null && job.lng != null
        ? directionsUriTo(job.displayTitle(lang), job.lat!, job.lng!)
        : Uri.https('map.kakao.com', '/', {'q': job.address});

    return Container(
      decoration: _card,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: HiText(job.displayTitle(lang), style: hiStyle(18, FontWeight.w800, height: 1.25))),
              const SizedBox(width: 10),
              HiText(Won.worker(job.pay), style: hiStyle(17, FontWeight.w800, color: HiColors.lime, family: HiFamily.mono)),
            ],
          ),
          const SizedBox(height: 4),
          HiText('${HiDates.dayName(job.startsAt, now, lang)} ${HiDates.timeRange(job.startsAt, job.endsAt)}',
              style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _ActionTile(
                  icon: HiIcons.smartphone,
                  title: l10n.jobCall,
                  value: job.phone.isEmpty ? '—' : job.phone,
                  onTap: phone.isEmpty ? null : () => _open(context, ref, Uri(scheme: 'tel', path: phone)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ActionTile(
                  icon: HiIcons.navigation,
                  title: job.distanceKm == null ? l10n.jobRoute : l10n.jobRouteKm(formatKm(job.distanceKm!, lang)),
                  value: job.address.isEmpty ? '—' : job.address,
                  onTap: job.address.isEmpty && job.lat == null ? null : () => _open(context, ref, route),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (var i = 0; i < steps.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: HiPressable(
                    semanticsLabel: steps[i],
                    selected: i <= job.step.index,
                    onTap: () => _run(context, ref, () => repo.setStep(job.applicationId, JobStep.values[i])),
                    builder: (context, pressed) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          height: 5,
                          decoration: BoxDecoration(
                            color: i <= job.step.index ? HiColors.lime : HiColors.white14,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                        const SizedBox(height: 6),
                        HiText(steps[i],
                            style: hiStyle(12, FontWeight.w700,
                                color: i <= job.step.index ? HiColors.white : HiColors.textMuted)),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (job.step == JobStep.wentToWork) ...[
            const SizedBox(height: 14),
            HiText(l10n.jobRateEmployer, style: hiStyle(15, FontWeight.w800)),
            const SizedBox(height: 6),
            Row(
              children: [
                for (var n = 1; n <= 5; n++)
                  HiPressable(
                    semanticsLabel: l10n.rateStar(n),
                    selected: (job.stars ?? 0) >= n,
                    onTap: () => _run(context, ref, () => repo.rate(job.applicationId, n)),
                    builder: (context, pressed) => Padding(
                      padding: const EdgeInsets.all(6),
                      child: HiText('★',
                          style: hiStyle(30, FontWeight.w800,
                              color: (job.stars ?? 0) >= n ? HiColors.amber : HiColors.white30)),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.title, required this.value, required this.onTap});

  final HiIconData icon;
  final String title;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: '$title, $value',
      builder: (context, pressed) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: pressed ? HiColors.white14 : HiColors.white06,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                HiIcon(icon, size: 16, strokeWidth: 2.2, color: HiColors.lime),
                const SizedBox(width: 6),
                Expanded(
                  child: HiText(title,
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: hiStyle(13, FontWeight.w800, color: HiColors.lime)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            HiText(value, maxLines: 2, overflow: TextOverflow.ellipsis, style: hiStyle(14, FontWeight.w700, height: 1.3)),
          ],
        ),
      ),
    );
  }
}

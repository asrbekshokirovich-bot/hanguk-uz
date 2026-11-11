import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../core/format/text.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/account.dart';
import '../../../data/models/business.dart';
import '../../../data/repositories/account_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/forms.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../settings/app_language.dart';
import '../load_error.dart';
import '../shift/shift_widgets.dart';
import 'unread.dart';

/// Where A12's links lead (wired by the router).
class NotificationActions {
  const NotificationActions({
    required this.directions,
    required this.myShifts,
    required this.shift,
    required this.feed,
    required this.chat,
    required this.earnings,
  });

  final void Function(HiNotification n) directions;
  final VoidCallback myShifts;
  final void Function(String shiftId) shift;
  final VoidCallback feed;
  final void Function(String applicationId) chat;
  final VoidCallback earnings;
}

/// A12 «Bildirishnomalar». Unread ones keep the unread look while the screen
/// is open and are marked read (the bell's dot goes away); new ones appear
/// as they arrive.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key, required this.onBack, required this.actions});

  final VoidCallback onBack;
  final NotificationActions actions;

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  /// Unread when they reached this screen: they keep the unread look while
  /// it is open, though the server has them read by then.
  final Set<String> _fresh = {};
  bool _marking = false;

  /// Marked read on the server already: not asked again, even if a reload
  /// still shows them unread (no endless mark-and-reload).
  final Set<String> _marked = {};

  // Unread ones (when the screen opens, and any arriving while it is open)
  // are marked read on the server. A failure leaves them unread for next
  // time: the bell keeps its dot.
  void _markRead(List<HiNotification> items) {
    final unread = [for (final n in items) if (!n.read) n.id];
    _fresh.addAll(unread);
    final news = unread.where((id) => !_marked.contains(id)).toList();
    if (news.isEmpty || _marking) return;
    _marking = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        if (!mounted) return;
        await ref.read(accountRepositoryProvider).markNotificationsRead();
        _marked.addAll(news);
        if (mounted) ref.invalidate(notificationsProvider);
      } on Object {
        // Retried when the list next changes.
      } finally {
        _marking = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final loaded = ref.watch(notificationsProvider);
    final items = loaded.value;
    if (items != null) _markRead(items);

    final children = <Widget>[];
    if (items != null && items.isNotEmpty) {
      int? lastDay;
      for (final n in items) {
        final offset = HiDates.dayOffset(n.createdAt, now);
        if (offset != lastDay) {
          final label = switch (offset) {
            0 => l10n.today,
            -1 => l10n.yesterday,
            _ => HiDates.dayMonth(n.createdAt, lang),
          };
          children.add(Padding(
            padding: EdgeInsets.only(top: lastDay == null ? 0 : 12 + 6, bottom: 12),
            child: Semantics(header: true, child: HiText(label, style: hiStyle(14, FontWeight.w700, color: HiColors.textMuted))),
          ));
          lastDay = offset;
        } else {
          children.add(const SizedBox(height: 12));
        }
        children.add(_NotificationCard(
          n: n,
          fresh: !n.read || _fresh.contains(n.id),
          lang: lang,
          now: now,
          actions: widget.actions,
        ));
      }
    }

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: ListView(
          padding: EdgeInsets.only(top: HiInsets.top(context, 56), bottom: 24),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                children: [
                  HiBackButton(onPressed: widget.onBack),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: HiText(
                        l10n.notifications,
                        style: hiStyle(24, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 22, 0),
              child: items == null
                  ? (loaded.hasError && !loaded.isLoading
                      ? Padding(
                          padding: const EdgeInsets.only(top: 80),
                          child: WorkerLoadError(
                            error: loaded.error!,
                            onRetry: () => ref.invalidate(notificationsProvider),
                          ),
                        )
                      : const SizedBox(height: 200))
                  : items.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.only(top: 80),
                          child: HiStatusMessage(icon: HiIcons.bell, title: l10n.emptyNotifications, text: ''),
                        )
                      : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.n,
    required this.fresh,
    required this.lang,
    required this.now,
    required this.actions,
  });

  final HiNotification n;

  /// Unread when it reached the screen.
  final bool fresh;
  final String lang;
  final DateTime now;
  final NotificationActions actions;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final range = n.startsAt != null && n.endsAt != null ? HiDates.timeRange(n.startsAt!, n.endsAt!) : '';
    final business = n.businessName(lang);
    final (HiIconData icon, Color tile, Color iconColor, double stroke) = switch (n.kind) {
      NotificationKind.shiftReminder => (HiIcons.timer, HiColors.surface, HiColors.ink, 2.0),
      NotificationKind.confirmed => (HiIcons.check, HiColors.greenSoft, const Color(0xFF15803D), 2.6),
      NotificationKind.rejected || NotificationKind.expired || NotificationKind.cancelled =>
        (HiIcons.x, HiColors.redSoft, HiColors.redInk, 2.4),
      NotificationKind.paid => (HiIcons.wallet, HiColors.greenSoft, const Color(0xFF15803D), 2.0),
      NotificationKind.message => (HiIcons.messageCircle, HiColors.surface, HiColors.ink, 2.0),
      NotificationKind.newShift => (HiIcons.briefcase, HiColors.surface, HiColors.ink, 2.0),
      NotificationKind.nearbyShifts => (HiIcons.mapPin, HiColors.surface, HiColors.ink, 2.0),
    };
    final title = switch (n.kind) {
      NotificationKind.shiftReminder => l10n.notifReminderTitle(HiDates.countdown(n.minutesBefore ?? 0, lang)),
      NotificationKind.confirmed => l10n.notifConfirmedTitle,
      NotificationKind.rejected || NotificationKind.expired => l10n.notifRejectedTitle,
      NotificationKind.cancelled => l10n.notifCancelledTitle,
      NotificationKind.paid => l10n.notifPaidTitle,
      NotificationKind.message => l10n.notifMessageTitle,
      NotificationKind.newShift => l10n.notifNewShiftTitle,
      NotificationKind.nearbyShifts => l10n.notifNearbyTitle(n.areaName(lang), n.count ?? 0),
    };
    final day = n.startsAt == null ? '' : HiDates.weekdayAndDate(n.startsAt!, lang);
    // «12 000 ₩/soat» stays together, as in the prototype.
    final text = keepSlashTogether(switch (n.kind) {
      NotificationKind.shiftReminder => l10n.notifReminderText(business, range),
      NotificationKind.confirmed => l10n.notifConfirmedText(business, day, range),
      NotificationKind.rejected => l10n.notifRejectedText(business, day, range),
      NotificationKind.expired => l10n.notifExpiredText(business, day, range),
      NotificationKind.cancelled => l10n.notifCancelledText(business, day, range),
      NotificationKind.paid => l10n.notifPaidText(business, day, Won.worker(n.amount ?? 0)),
      NotificationKind.message => business,
      // With no distance (a business with no point yet, or no saved
      // position) the line ends at the wage, not in « · ».
      NotificationKind.newShift => withoutTrailingDot(l10n.notifNewShiftText(
          business,
          n.startsAt == null ? '' : HiDates.weekdayInSentence(n.startsAt!, lang),
          range,
          Won.worker(n.wage ?? 0),
          n.distanceKm == null ? '' : formatKm(n.distanceKm!, lang),
        )),
      NotificationKind.nearbyShifts => l10n.notifNearbyText(_categories(l10n), _wageRange()),
    });
    final time = HiDates.dayOffset(n.createdAt, now) >= -1 ? Kst.hm(n.createdAt) : HiDates.dayMonth(n.createdAt, lang);

    final Widget? action = switch (n.kind) {
      NotificationKind.shiftReminder => _LimeAction(label: l10n.directions, onTap: () => actions.directions(n)),
      NotificationKind.confirmed || NotificationKind.rejected || NotificationKind.expired || NotificationKind.cancelled =>
        _LinkAction(label: l10n.viewShift, fresh: fresh, onTap: actions.myShifts),
      NotificationKind.paid => _LinkAction(label: l10n.view, fresh: fresh, onTap: actions.earnings),
      NotificationKind.message => n.applicationId == null
          ? null
          : _LinkAction(label: l10n.view, fresh: fresh, onTap: () => actions.chat(n.applicationId!)),
      NotificationKind.newShift => _LinkAction(
          label: l10n.view,
          fresh: fresh,
          onTap: n.shiftId == null ? actions.feed : () => actions.shift(n.shiftId!),
        ),
      NotificationKind.nearbyShifts => _LinkAction(label: l10n.view, fresh: fresh, onTap: actions.feed),
    };

    return Semantics(
      container: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: fresh
            ? BoxDecoration(
                color: HiColors.white,
                borderRadius: BorderRadius.circular(HiRadii.card),
                border: Border.fromBorderSide(HiBorders.ink),
                boxShadow: HiShadows.hard,
              )
            : BoxDecoration(
                color: HiColors.white06,
                borderRadius: BorderRadius.circular(HiRadii.card),
                border: Border.all(color: HiColors.white14),
              ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: fresh ? tile : HiColors.white10, borderRadius: BorderRadius.circular(12)),
                alignment: Alignment.center,
                child: HiIcon(icon, size: 20, strokeWidth: stroke, color: fresh ? iconColor : HiColors.white),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: HiText(
                          title,
                          style: hiStyle(16, FontWeight.w800, height: 1.3, color: fresh ? HiColors.ink : HiColors.white),
                        ),
                      ),
                      const SizedBox(width: 8),
                      HiText(time, style: hiStyle(13, FontWeight.w600, color: fresh ? HiColors.inkMuted : HiColors.textMuted)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  HiText(
                    text,
                    style: hiStyle(15, FontWeight.w500, height: 1.45, color: fresh ? HiColors.inkMuted : HiColors.textSoft),
                  ),
                  if (action != null) ...[
                    SizedBox(height: action is _LimeAction ? 6 + 6 : 6),
                    action,
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _categories(WorkerL10n l10n) {
    final names = [for (final c in n.categories) categoryLook(l10n, businessCategoryFrom(c)).$2];
    if (names.isEmpty) return '';
    if (names.length == 1) return names.first;
    final rest = lang == 'ko' ? names.last : names.last.toLowerCase();
    return l10n.andJoin(names.sublist(0, names.length - 1).join(', '), rest);
  }

  String _wageRange() {
    final low = n.wage ?? 0;
    final high = n.wageMax;
    if (high == null || high == low) return Won.worker(low);
    return '${Won.workerDigits(low)}–${Won.worker(high)}';
  }
}

class _LimeAction extends StatelessWidget {
  const _LimeAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Transform.translate(
        offset: pressed ? const Offset(1, 1) : Offset.zero,
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            color: HiColors.lime,
            borderRadius: BorderRadius.circular(HiRadii.button),
            border: Border.fromBorderSide(HiBorders.ink),
            boxShadow: [BoxShadow(color: HiColors.ink, offset: pressed ? const Offset(2, 2) : const Offset(3, 3))],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const HiIcon(HiIcons.navigation, size: 17, strokeWidth: 2.2, color: HiColors.onLime),
              const SizedBox(width: 8),
              HiText(label, style: hiStyle(15, FontWeight.w800, color: HiColors.onLime)),
            ],
          ),
        ),
      ),
    );
  }
}

class _LinkAction extends StatelessWidget {
  const _LinkAction({required this.label, required this.fresh, required this.onTap});

  final String label;
  final bool fresh;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = fresh ? HiColors.ink : HiColors.white;
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Opacity(
        opacity: pressed ? 0.7 : 1,
        child: SizedBox(
          height: 44,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              HiText(label, style: hiStyle(15, FontWeight.w800, color: color)),
              const SizedBox(width: 4),
              HiIcon(HiIcons.chevronRight, size: 17, strokeWidth: 2.4, color: color),
            ],
          ),
        ),
      ),
    );
  }
}

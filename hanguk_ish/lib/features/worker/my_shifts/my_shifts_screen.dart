import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/my_shift.dart';
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
import '../feed/feed_controller.dart';
import '../settings/app_language.dart';
import '../shift/shift_detail_screen.dart';
import '../shift/shift_widgets.dart';
import 'my_shifts_providers.dart';

/// Where A06's actions lead (wired by the router).
class MyShiftsActions {
  const MyShiftsActions({
    required this.openShift,
    required this.openCheckIn,
    required this.openAtWork,
    required this.openResult,
    required this.openRate,
    required this.openChat,
    required this.openDirections,
    required this.openFeed,
  });

  final void Function(MyShift app) openShift;
  final void Function(MyShift app) openCheckIn;
  final void Function(MyShift app) openAtWork;
  final void Function(MyShift app) openResult;
  final void Function(MyShift app) openRate;
  final void Function(MyShift app) openChat;
  final void Function(MyShift app) openDirections;
  final VoidCallback openFeed;
}

/// Which A06 tab is open.
final myShiftsTabProvider = NotifierProvider<MyShiftsTab, int>(MyShiftsTab.new);

class MyShiftsTab extends Notifier<int> {
  @override
  int build() => 0;

  void select(int tab) => state = tab;
}

/// A06 «Mening smenalarim».
class MyShiftsScreen extends ConsumerWidget {
  const MyShiftsScreen({super.key, required this.actions});

  final MyShiftsActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final tab = ref.watch(myShiftsTabProvider);
    final async = ref.watch(myShiftsProvider);
    final all = async.value ?? const <MyShift>[];
    final shown = switch (tab) {
      0 => all.where((a) => a.isUpcoming).toList(),
      1 => all.where((a) => a.isDone).toList().reversed.toList(),
      _ => all.where((a) => a.isCancelled).toList().reversed.toList(),
    };

    final Widget body;
    if (async.isLoading && !async.hasValue) {
      body = const SizedBox.shrink();
    } else if (async.hasError && !async.hasValue) {
      final offline = async.error is OfflineException;
      body = _Centered(
        child: HiStatusMessage(
          icon: offline ? HiIcons.wifiOff : HiIcons.triangleAlert,
          title: offline ? l10n.offlineTitle : l10n.errorGeneric,
          text: offline ? l10n.offlineText : '',
          textMaxWidth: 300,
          action: l10n.retry,
          actionIcon: HiIcons.refreshCw,
          onAction: () => ref.invalidate(myShiftsProvider),
        ),
      );
    } else if (shown.isEmpty) {
      body = _Centered(
        child: switch (tab) {
          0 => HiStatusMessage(
              icon: HiIcons.calendarCheck,
              title: l10n.emptyUpcomingTitle,
              text: l10n.emptyUpcomingText,
              textMaxWidth: 300,
              action: l10n.findShifts,
              actionIcon: HiIcons.briefcase,
              onAction: actions.openFeed,
            ),
          1 => HiStatusMessage(
              icon: HiIcons.clipboardList,
              title: l10n.emptyDoneTitle,
              text: l10n.emptyDoneText,
              textMaxWidth: 300,
            ),
          _ => HiStatusMessage(icon: HiIcons.calendar, title: l10n.emptyCancelledTitle, text: ''),
        },
      );
    } else {
      body = RefreshIndicator(
        color: HiColors.ink,
        backgroundColor: HiColors.lime,
        onRefresh: () => ref.refresh(myShiftsProvider.future),
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(18, 0, 22, 24),
          itemCount: shown.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, i) => _MyShiftCard(app: shown[i], actions: actions),
        ),
      );
    }

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    header: true,
                    child: HiText(
                      l10n.navMyShifts,
                      style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02),
                    ),
                  ),
                  const SizedBox(height: 14),
                  HiSegmentedTabs(
                    labels: [l10n.tabUpcoming, l10n.tabDone, l10n.tabCancelled],
                    flex: const [85, 100, 125],
                    current: tab,
                    semanticsLabel: l10n.myShiftsTabs,
                    onSelect: ref.read(myShiftsTabProvider.notifier).select,
                  ),
                ],
              ),
            ),
            // The list starts 174 px from the top of the prototype frame.
            const SizedBox(height: 174 - 56 - 33.6 - 14 - 54),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 100, 22, 24),
      child: Center(child: child),
    );
  }
}

/// A06 card: countdown and status, the workplace, when and where, actions.
class _MyShiftCard extends ConsumerWidget {
  const _MyShiftCard({required this.app, required this.actions});

  final MyShift app;
  final MyShiftsActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final shift = app.shift;
    final b = shift.business;
    final detail = hiStyle(15, FontWeight.w600, color: HiColors.ink);
    final distance = shift.distanceKm;
    final where = distance == null ? b.displayAddress(lang) : '${b.displayAddress(lang)} · ${formatKm(distance, lang)}';

    final (Widget left, Widget right) = _pills(l10n, lang, now);
    final rows = <Widget>[
      Row(children: [left, const Spacer(), right]),
      HiPressable(
        onTap: () => _openFromCard(),
        button: false,
        builder: (context, pressed) => Row(
          children: [
            BusinessAvatar(business: b),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HiText(b.nameWithArea(lang), style: hiStyle(17, FontWeight.w800, color: HiColors.ink)),
                  const SizedBox(height: 2),
                  HiText(shift.displayTitle(lang), style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Line(
            icon: HiIcons.calendar,
            text: '${HiDates.dayAndDate(shift.startsAt, now, lang)} · ${HiDates.timeRange(shift.startsAt, shift.endsAt)}',
            style: detail,
          ),
          const SizedBox(height: 8),
          if (app.isDone && app.status == ApplicationStatus.completed)
            _Line(
              icon: HiIcons.wallet,
              text: l10n.workedPay(HiDates.durationHm(app.workedMinutes ?? shift.plannedMinutes, lang), Won.worker(app.pay)),
              style: detail,
            )
          else
            _Line(icon: HiIcons.mapPin, text: where, style: detail),
        ],
      ),
    ];

    if (app.isUpcoming) {
      rows.add(Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Row(
          children: [
            Expanded(
              child: HiButton(
                label: l10n.directions,
                style: HiButtonStyle.ink,
                icon: HiIcons.navigation,
                iconSize: 18,
                iconStroke: 2,
                iconGap: 8,
                height: 44,
                fontSize: 15,
                onPressed: () => actions.openDirections(app),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: HiButton(
                label: l10n.chat,
                style: HiButtonStyle.outline,
                icon: HiIcons.messageCircle,
                iconSize: 18,
                iconStroke: 2,
                iconGap: 8,
                height: 44,
                fontSize: 15,
                onPressed: () => actions.openChat(app),
              ),
            ),
          ],
        ),
      ));
      if (app.status != ApplicationStatus.checkedIn) {
        rows.add(HiButton(
          label: l10n.cancelShift,
          style: HiButtonStyle.text,
          textColor: HiColors.red,
          height: 44,
          fontSize: 15,
          onPressed: () => _cancel(context, ref),
        ));
      }
    } else if (app.status == ApplicationStatus.completed) {
      final stars = app.myStars;
      rows.add(stars == null
          ? HiButton(
              label: l10n.rateShort,
              style: HiButtonStyle.ink,
              icon: HiIcons.star,
              iconSize: 18,
              iconStroke: 2,
              iconGap: 8,
              height: 44,
              fontSize: 15,
              onPressed: () => actions.openRate(app),
            )
          : HiText(l10n.ratedStars(stars), style: hiStyle(14, FontWeight.w700, color: HiColors.inkMuted)));
    }

    return Container(
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
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            rows[i],
          ],
        ],
      ),
    );
  }

  void _openFromCard() {
    switch (app.status) {
      case ApplicationStatus.confirmed:
        actions.openCheckIn(app);
      case ApplicationStatus.checkedIn:
        actions.openAtWork(app);
      case ApplicationStatus.completed:
        actions.openResult(app);
      default:
        actions.openShift(app);
    }
  }

  (Widget, Widget) _pills(WorkerL10n l10n, String lang, DateTime now) {
    final shift = app.shift;
    switch (app.status) {
      case ApplicationStatus.pending || ApplicationStatus.confirmed:
        final minutes = Kst.minutesBetween(now, shift.startsAt);
        final soon = minutes < 24 * 60;
        final left = _Pill.big(
          icon: HiIcons.timer,
          text: minutes >= 0 ? l10n.timeLeft(HiDates.countdown(minutes, lang)) : l10n.lateBy(HiDates.countdown(-minutes, lang)),
          background: soon ? HiColors.blue : HiColors.surface,
          foreground: soon ? HiColors.white : HiColors.ink,
        );
        final right = app.status == ApplicationStatus.confirmed
            ? _Pill.status(text: l10n.statusConfirmed, background: HiColors.greenSoft, dot: HiColors.green)
            : _Pill.status(text: l10n.statusPending, background: HiColors.amberSoft, dot: HiColors.amber);
        return (left, right);
      case ApplicationStatus.checkedIn:
        return (
          _Pill.big(icon: HiIcons.timer, text: l10n.statusAtWork, background: HiColors.blue, foreground: HiColors.white),
          _Pill.status(text: l10n.statusConfirmed, background: HiColors.greenSoft, dot: HiColors.green),
        );
      case ApplicationStatus.completed:
        return (
          _Pill.big(icon: HiIcons.check, text: l10n.statusDone, background: HiColors.surface, foreground: HiColors.ink),
          app.isPaid
              ? _Pill.status(text: l10n.paymentPaid, background: HiColors.greenSoft, dot: HiColors.green)
              : _Pill.status(text: l10n.paymentPending, background: HiColors.amberSoft, dot: HiColors.amber),
        );
      case ApplicationStatus.noShow:
        return (
          _Pill.big(icon: HiIcons.userX, text: l10n.statusNoShow, background: HiColors.redSoft, foreground: HiColors.redInk),
          const SizedBox.shrink(),
        );
      case ApplicationStatus.rejected:
        return (
          _Pill.big(icon: HiIcons.x, text: l10n.statusRejected, background: HiColors.surface, foreground: HiColors.ink),
          const SizedBox.shrink(),
        );
      case ApplicationStatus.cancelled:
        return (
          _Pill.big(icon: HiIcons.x, text: l10n.statusCancelled, background: HiColors.redSoft, foreground: HiColors.redInk),
          const SizedBox.shrink(),
        );
    }
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final l10n = WorkerL10n.of(context);
    final messenger = ScaffoldMessenger.maybeOf(context);
    final now = ref.read(clockProvider)();
    final late = app.status == ApplicationStatus.confirmed &&
        app.shift.startsAt.difference(now) < const Duration(hours: 24);
    final text = app.status == ApplicationStatus.pending
        ? l10n.cancelTextPending
        : (late ? l10n.cancelTextLate : l10n.cancelTextFree);
    final sure = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
      builder: (context) => _CancelSheet(text: text, warn: late),
    );
    if (sure != true) return;
    try {
      await ref.read(shiftRepositoryProvider).cancelApplication(app.applicationId);
      messenger?.showSnackBar(SnackBar(content: Text(l10n.cancelDone)));
    } on Object catch (error) {
      messenger?.showSnackBar(SnackBar(content: Text(myShiftError(l10n, error))));
    }
    ref
      ..invalidate(myShiftsProvider)
      ..invalidate(feedProvider)
      ..invalidate(shiftDetailProvider(app.shift.id));
  }
}

/// The message for a refused A06–A08 action.
String myShiftError(WorkerL10n l10n, Object error) => switch (error) {
      ShiftActionException(code: 'CANNOT_CANCEL' || 'NOT_FOUND') => l10n.errCannotCancel,
      ShiftActionException(code: 'SHIFT_STARTED') => l10n.errShiftStarted,
      ShiftActionException(code: 'QR_INVALID') => l10n.errQrInvalid,
      ShiftActionException(code: 'NOT_CONFIRMED') => l10n.errNotConfirmed,
      ShiftActionException(code: 'ALREADY_CHECKED_IN') => l10n.errAlreadyCheckedIn,
      ShiftActionException(code: 'TOO_EARLY') => l10n.errTooEarly,
      ShiftActionException(code: 'TOO_LATE') => l10n.errTooLate,
      ShiftActionException(code: 'NOT_CHECKED_IN') => l10n.errNotCheckedIn,
      ShiftActionException(code: 'ALREADY_CHECKED_OUT') => l10n.errAlreadyCheckedOut,
      OfflineException() => l10n.errOffline,
      _ => l10n.errorGeneric,
    };

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.text, required this.style});

  final HiIconData icon;
  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        HiIcon(icon, size: 18, strokeWidth: 2, color: HiColors.inkMuted),
        const SizedBox(width: 10),
        Expanded(child: HiText(text, style: style)),
      ],
    );
  }
}

/// The two pills on top of an A06 card.
class _Pill extends StatelessWidget {
  const _Pill._({
    required this.text,
    required this.background,
    required this.foreground,
    this.icon,
    this.dot,
    required this.big,
  });

  /// «⏱ 2 soat 40 daq qoldi»: 32 px, 14 px text.
  factory _Pill.big({
    required HiIconData icon,
    required String text,
    required Color background,
    required Color foreground,
  }) =>
      _Pill._(text: text, background: background, foreground: foreground, icon: icon, big: true);

  /// «● Tasdiqlangan»: 28 px, 13 px text.
  factory _Pill.status({required String text, required Color background, required Color dot}) =>
      _Pill._(text: text, background: background, foreground: HiColors.ink, dot: dot, big: false);

  final String text;
  final Color background;
  final Color foreground;
  final HiIconData? icon;
  final Color? dot;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final glyph = icon;
    final mark = dot;
    return Container(
      height: big ? 32 : 28,
      padding: EdgeInsets.symmetric(horizontal: big ? 12 : 10),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(HiRadii.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (glyph != null) HiIcon(glyph, size: 16, strokeWidth: 2.2, color: foreground),
          if (mark != null)
            Container(width: 8, height: 8, decoration: BoxDecoration(color: mark, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          HiText(
            text,
            softWrap: false,
            style: hiStyle(big ? 14 : 13, FontWeight.w800, color: foreground),
          ),
        ],
      ),
    );
  }
}

/// «Smenani bekor qilasizmi?» — like the A05 confirmation sheet.
class _CancelSheet extends StatelessWidget {
  const _CancelSheet({required this.text, required this.warn});

  final String text;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return Container(
      decoration: const BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: HiBorders.ink),
      ),
      padding: EdgeInsets.fromLTRB(18, 10, 22, HiInsets.bottom(context, 30)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(color: const Color(0xFFC9D3E6), borderRadius: BorderRadius.circular(HiRadii.pill)),
            ),
          ),
          const SizedBox(height: 16),
          Semantics(
            header: true,
            child: HiText(
              l10n.cancelTitle,
              style: hiStyle(24, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02, color: HiColors.ink),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: warn ? HiColors.amberSoft : HiColors.surface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: HiIcon(warn ? HiIcons.triangleAlert : HiIcons.info, size: 20, strokeWidth: 2, color: HiColors.ink),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: HiText(text, style: hiStyle(15, FontWeight.w600, height: 1.45, color: HiColors.ink)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          HiButton(label: l10n.cancelConfirm, style: HiButtonStyle.danger, onPressed: () => Navigator.of(context).pop(true)),
          const SizedBox(height: 8),
          HiButton(
            label: l10n.back,
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

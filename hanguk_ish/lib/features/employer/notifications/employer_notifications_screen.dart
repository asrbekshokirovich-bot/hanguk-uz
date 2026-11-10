import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/employer.dart';
import '../../../data/repositories/employer_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/pressable.dart';
import '../ko.dart';
import '../providers.dart';

/// The bell on BA1: new applicants, cancellations, missing workers and
/// messages, newest first; opening the list marks them read.
class EmployerNotificationsScreen extends ConsumerStatefulWidget {
  const EmployerNotificationsScreen({super.key, required this.onBack, required this.openShift});

  final VoidCallback onBack;
  final void Function(String shiftId) openShift;

  @override
  ConsumerState<EmployerNotificationsScreen> createState() => _EmployerNotificationsScreenState();
}

class _EmployerNotificationsScreenState extends ConsumerState<EmployerNotificationsScreen> {
  /// The list as it was when the screen opened (unread marks included).
  List<EmployerNotification>? _shown;
  bool _marked = false;

  void _markRead() {
    if (_marked) return;
    _marked = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(employerRepositoryProvider).markNotificationsRead();
      if (mounted) ref.invalidate(employerNotificationsProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final now = ref.watch(clockProvider)();
    final loaded = ref.watch(employerNotificationsProvider).value;
    if (_shown == null && loaded != null) {
      _shown = loaded;
      _markRead();
    }
    final list = _shown;
    final today = kstDayStart(now);
    final yesterday = kstDayStart(now, -1);
    String group(EmployerNotification n) => !n.createdAt.isBefore(today)
        ? Ko.today
        : (!n.createdAt.isBefore(yesterday) ? Ko.yesterday : Ko.monthDay(n.createdAt));
    final children = <Widget>[];
    String? last;
    for (final n in list ?? const <EmployerNotification>[]) {
      final g = group(n);
      if (g != last) {
        children.add(Padding(
          padding: EdgeInsets.fromLTRB(18, last == null ? 0 : 20, 22, 10),
          child: Semantics(header: true, child: HiText(g, style: hiStyle(15, FontWeight.w700, color: HiColors.textMuted))),
        ));
        last = g;
      }
      children.add(Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 22, 10),
        child: _NotificationCard(notification: n, now: now, onTap: () => widget.openShift(n.shiftId)),
      ));
    }

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 18),
              child: Row(
                children: [
                  HiGlassIconButton(
                    icon: HiIcons.chevronLeft,
                    size: 44,
                    radius: 14,
                    iconSize: 22,
                    semanticsLabel: Ko.back,
                    onTap: widget.onBack,
                  ),
                  const SizedBox(width: 12),
                  Semantics(
                    header: true,
                    child: HiText(Ko.notificationsTitle,
                        style: hiStyle(26, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: list == null
                  ? const Center(child: CircularProgressIndicator(color: HiColors.lime))
                  : list.isEmpty
                      ? Center(
                          child: HiText(Ko.noNotifications, style: hiStyle(15, FontWeight.w600, color: HiColors.textSoft)),
                        )
                      : ListView(
                          padding: EdgeInsets.only(bottom: HiInsets.bottom(context, 24)),
                          children: children,
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.now, required this.onTap});

  final EmployerNotification notification;
  final DateTime now;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final (icon, title, text, tint, ink) = switch (n.kind) {
      EmployerNotificationKind.newApplicant => (
          HiIcons.users,
          Ko.notifNewApplicant,
          Ko.notifNewApplicantText(n.workerName, n.shiftTitle),
          HiColors.surface,
          HiColors.ink,
        ),
      EmployerNotificationKind.workerCancelled => (
          HiIcons.userX,
          Ko.notifCancelled,
          Ko.notifCancelledText(n.workerName, n.shiftTitle),
          HiColors.redSoft,
          HiColors.redInk,
        ),
      EmployerNotificationKind.noShow => (
          HiIcons.triangleAlert,
          Ko.notifNoShow,
          Ko.notifNoShowText(n.workerName, n.shiftTitle),
          HiColors.amberSoft,
          HiColors.ink,
        ),
      EmployerNotificationKind.chatMessage => (
          HiIcons.messageCircle,
          Ko.notifMessage,
          Ko.notifMessageText(n.workerName, n.shiftTitle),
          HiColors.surface,
          HiColors.ink,
        ),
    };
    final fresh = !n.read;
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: fresh ? (pressed ? const Color(0xFFF4F7FC) : HiColors.white) : (pressed ? HiColors.white12 : HiColors.white08),
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: fresh ? const Border.fromBorderSide(HiBorders.ink) : Border.all(color: HiColors.white14),
          boxShadow: fresh ? HiShadows.hard : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: fresh ? tint : HiColors.white10,
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: HiIcon(icon, size: 20, strokeWidth: 2, color: fresh ? ink : HiColors.white),
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
                        child: HiText(title,
                            style: hiStyle(16, FontWeight.w800, color: fresh ? HiColors.ink : HiColors.white)),
                      ),
                      HiText(Kst.hm(n.createdAt),
                          style: hiStyle(13, FontWeight.w600, color: fresh ? HiColors.inkMuted : HiColors.textMuted)),
                    ],
                  ),
                  const SizedBox(height: 3),
                  HiText(text,
                      style: hiStyle(15, FontWeight.w500, color: fresh ? HiColors.inkMuted : HiColors.textSoft)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

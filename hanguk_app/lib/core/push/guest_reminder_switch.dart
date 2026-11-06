import 'package:flutter/material.dart';

import '../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../l10n/app_localizations.dart';
import '../analytics/tracked.dart';
import 'guest_push.dart';

/// «Muddat eslatmalari» (ushlab qolish P10, Claude Design D2): a guest whose
/// phone takes pushes turns the deadline reminders on or off. Nothing shows
/// for a student or a phone without push.
class GuestReminderSwitch extends StatefulWidget {
  const GuestReminderSwitch({super.key});

  @override
  State<GuestReminderSwitch> createState() => _GuestReminderSwitchState();
}

class _GuestReminderSwitchState extends State<GuestReminderSwitch> {
  bool _visible = false;
  bool _on = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final visible = await GuestPush.remindersVisible();
    final on = await GuestPush.remindersOn();
    if (mounted) setState(() {
      _visible = visible;
      _on = on;
    });
  }

  Future<void> _toggle() async {
    if (_busy) return;
    final next = !_on;
    setState(() {
      _busy = true;
      _on = next;
    });
    final ok = await GuestPush.setReminders(next);
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (!ok) _on = !next;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible) return const SizedBox.shrink();
    final l = AppLocalizations.of(context)!;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(14)),
                child: const Icon(Icons.notifications_none_rounded, color: FdColors.blueDeep, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.guestRemindersTitle, style: fdText(16, FontWeight.w800, FdColors.ink)),
                    const SizedBox(height: 2),
                    Text(_on ? l.guestRemindersOn : l.guestRemindersOff,
                        style: fdText(13, FontWeight.w500, FdColors.muted)),
                  ],
                ),
              ),
              Semantics(
                toggled: _on,
                label: l.guestRemindersTitle,
                child: GestureDetector(
                  onTap: tracked('guest_reminders.toggle', () => _toggle(), props: {'on': !_on}),
                  behavior: HitTestBehavior.opaque,
                  child: SizedBox(
                    width: 56,
                    height: 44,
                    child: Center(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        width: 56,
                        height: 32,
                        decoration: BoxDecoration(
                          color: _on ? FdColors.lime : FdColors.pageMuted,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: FdColors.ink, width: 1.5),
                        ),
                        alignment: _on ? Alignment.centerRight : Alignment.centerLeft,
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: Container(
                          width: 23,
                          height: 23,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: FdColors.ink, width: 1.5),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(l.guestRemindersBody, style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
        ],
      ),
    );
  }
}

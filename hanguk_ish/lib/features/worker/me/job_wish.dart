import 'package:flutter/material.dart';

import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../l10n/gen/worker_l10n.dart';

/// What a worker wants for a free day: the time ('day' 주간 / 'night' 야간 /
/// 'any') and what matters most ('pay' / 'easy' / 'near' / 'any'), so the team
/// searches the right kind of job (2026-11-26).
@immutable
class JobWish {
  const JobWish({this.part = 'any', this.priority = 'any'});

  final String part;
  final String priority;
}

/// The time of day, as the worker reads it.
String jobPartText(WorkerL10n l10n, String part) => switch (part) {
      'day' => l10n.wishPartDay,
      'night' => l10n.wishPartNight,
      _ => l10n.wishAny,
    };

/// What matters most, as the worker reads it.
String jobPriorityText(WorkerL10n l10n, String priority) => switch (priority) {
      'pay' => l10n.wishPay,
      'easy' => l10n.wishEasy,
      'near' => l10n.wishNear,
      _ => l10n.wishAny,
    };

/// Asks for the free day [when] (e.g. «Pay 28»); null when closed without
/// «Tayyor». [initial] is the earlier answer when it is changed.
Future<JobWish?> askJobWish(BuildContext context, String when, {JobWish initial = const JobWish()}) =>
    showModalBottomSheet<JobWish>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: HiColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _JobWishSheet(when: when, initial: initial),
    );

class _JobWishSheet extends StatefulWidget {
  const _JobWishSheet({required this.when, required this.initial});

  final String when;
  final JobWish initial;

  @override
  State<_JobWishSheet> createState() => _JobWishSheetState();
}

class _JobWishSheetState extends State<_JobWishSheet> {
  late String _part = widget.initial.part;
  late String _priority = widget.initial.priority;

  Widget _choices(List<(String, String, String?)> options, String value, ValueChanged<String> onPick) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (key, label, hint) in options)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: value == key ? HiColors.lime : HiColors.surface,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => onPick(key),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    child: Row(
                      children: [
                        Icon(value == key ? Icons.radio_button_checked : Icons.radio_button_off,
                            size: 20, color: HiColors.ink),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              HiText(label, style: hiStyle(15, FontWeight.w700, color: HiColors.ink)),
                              if (hint != null)
                                HiText(hint, style: hiStyle(12.5, FontWeight.w500, height: 1.35, color: HiColors.inkMuted)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      );

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final label = hiStyle(14, FontWeight.w800, color: HiColors.ink);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            HiText(l10n.wishTitle(widget.when), style: hiStyle(18, FontWeight.w800, color: HiColors.ink)),
            const SizedBox(height: 16),
            HiText(l10n.wishPartQuestion, style: label),
            const SizedBox(height: 8),
            _choices([
              ('day', l10n.wishPartDay, null),
              ('night', l10n.wishPartNight, l10n.wishPartNightHint),
              ('any', l10n.wishAny, null),
            ], _part, (v) => setState(() => _part = v)),
            const SizedBox(height: 8),
            HiText(l10n.wishPriorityQuestion, style: label),
            const SizedBox(height: 8),
            _choices([
              ('pay', l10n.wishPay, l10n.wishPayHint),
              ('easy', l10n.wishEasy, l10n.wishEasyHint),
              ('near', l10n.wishNear, l10n.wishNearHint),
              ('any', l10n.wishAny, null),
            ], _priority, (v) => setState(() => _priority = v)),
            const SizedBox(height: 8),
            HiButton(
              label: l10n.wishDone,
              height: 50,
              fontSize: 16,
              onPressed: () => Navigator.of(context).pop(JobWish(part: _part, priority: _priority)),
            ),
          ],
        ),
      ),
    );
  }
}

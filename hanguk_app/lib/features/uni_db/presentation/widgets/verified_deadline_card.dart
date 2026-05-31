import 'package:flutter/material.dart';

import '../../domain/upcoming_deadline.dart';

/// Read-only card surfacing one verified upcoming deadline.
///
/// Plan §H.5. The "verified" badge differentiates these from the
/// user-typed free-text application entries.
class VerifiedDeadlineCard extends StatelessWidget {
  const VerifiedDeadlineCard({super.key, required this.deadline, this.onTap});

  final UpcomingDeadline deadline;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final countdown = _countdown(deadline.startsAt);
    final eventLabel = _formatEventType(deadline.eventType);
    final cycleLabel = _cycleLabel(deadline.cycleTrack);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      deadline.nameKo,
                      style: theme.textTheme.titleMedium,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const _VerifiedBadge(),
                ],
              ),
              if (deadline.nameEn != null && deadline.nameEn!.isNotEmpty)
                Text(
                  deadline.nameEn!,
                  style: theme.textTheme.bodySmall,
                  overflow: TextOverflow.ellipsis,
                ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  if (cycleLabel != null) _Pill(text: cycleLabel),
                  _Pill(text: eventLabel),
                  if (deadline.applicantCategory != null)
                    _Pill(text: deadline.applicantCategory!),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.event, size: 16),
                  const SizedBox(width: 4),
                  Text(_formatDate(deadline.startsAt)),
                  const Spacer(),
                  Text(countdown, style: theme.textTheme.labelMedium),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _countdown(DateTime when) {
    final delta = when.difference(DateTime.now());
    if (delta.isNegative) return 'closed';
    if (delta.inDays >= 1) return 'in ${delta.inDays}d';
    if (delta.inHours >= 1) return 'in ${delta.inHours}h';
    return 'in ${delta.inMinutes}m';
  }

  static String _formatDate(DateTime when) {
    final local = when.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  static String _formatEventType(String raw) {
    return switch (raw) {
      'apply_open' => 'Application opens',
      'apply_close' => 'Application closes',
      'document_submission_deadline' => 'Documents due',
      'first_stage_results' => '1st stage results',
      'interview' => 'Interview',
      'practical_exam' => 'Practical exam',
      'final_results' => 'Final results',
      'additional_admit' => 'Additional admit',
      'registration_open' => 'Registration opens',
      'registration_close' => 'Registration closes',
      _ => raw,
    };
  }

  static String? _cycleLabel(String? track) {
    if (track == null) return null;
    return switch (track) {
      'foreign' => 'Foreign track',
      'overseas_korean_full' => 'Overseas Korean (full)',
      'overseas_korean_partial' => 'Overseas Korean (partial)',
      'susi' => 'Susi',
      'jeongsi' => 'Jeongsi',
      'transfer' => 'Transfer',
      'grad_general' => 'Graduate',
      'grad_foreign' => 'Graduate (foreign)',
      _ => track,
    };
  }
}

class _VerifiedBadge extends StatelessWidget {
  const _VerifiedBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(Icons.verified, size: 12),
          SizedBox(width: 4),
          Text('verified', style: TextStyle(fontSize: 11)),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, style: const TextStyle(fontSize: 11)),
    );
  }
}

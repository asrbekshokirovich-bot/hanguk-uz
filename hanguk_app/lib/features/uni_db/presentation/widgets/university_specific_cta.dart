import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/feature_flags/uni_db_flag.dart';
import '../../data/uni_db_providers.dart';
import '../../domain/recruitment_target.dart';

/// Helper widget shown inside the Interview Setup view when the user
/// picks `university_specific` (plan §H.4).
///
/// Behaviour:
///   * Flag off  → render nothing (existing behaviour preserved).
///   * No data   → empty-state CTA explaining the flow plus
///                 "Try a general interview instead" button.
///   * Has data  → recruitment summary (institution + cycle + next event)
///                 used to seed the interviewer prompt downstream.
class UniversitySpecificSetupAddon extends ConsumerWidget {
  const UniversitySpecificSetupAddon({
    super.key,
    required this.institutionId,
    required this.onFallbackToGeneral,
  });

  final String? institutionId;
  final VoidCallback onFallbackToGeneral;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!kUniDbEnabled) return const SizedBox.shrink();
    final id = institutionId;
    if (id == null || id.isEmpty) {
      return _EmptyState(
        message:
            'Pick a university above to seed the interviewer with its '
            'recruitment unit, requirements, and key deadlines.',
        onFallbackToGeneral: onFallbackToGeneral,
      );
    }
    final asyncTarget = ref.watch(recruitmentForInterviewProvider(id));
    return asyncTarget.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => _EmptyState(
        message:
            'Could not load recruitment data: $e\n'
            'You can still run a general interview.',
        onFallbackToGeneral: onFallbackToGeneral,
      ),
      data: (target) {
        if (target == null) {
          return _EmptyState(
            message:
                'No verified recruitment data for this university yet. '
                'The interviewer will fall back to general questions until '
                'we ingest its 모집요강.',
            onFallbackToGeneral: onFallbackToGeneral,
          );
        }
        return _RecruitmentSummary(target: target);
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onFallbackToGeneral});

  final String message;
  final VoidCallback onFallbackToGeneral;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Row(
                children: [
                  Icon(Icons.info_outline, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'University-specific interview',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(message, style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onFallbackToGeneral,
                icon: const Icon(Icons.swap_horiz, size: 16),
                label: const Text('Try a general interview instead'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecruitmentSummary extends StatelessWidget {
  const _RecruitmentSummary({required this.target});

  final RecruitmentTarget target;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                target.nameKo,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              if (target.nameEn != null) Text(target.nameEn!),
              const SizedBox(height: 8),
              Text(_cycleLine(target), style: const TextStyle(fontSize: 13)),
              if (target.applicantCategory != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Track: ${target.applicantCategory}',
                  style: const TextStyle(fontSize: 12),
                ),
              ],
              const SizedBox(height: 4),
              const Text(
                'The interviewer will draw on this recruitment data when '
                'asking questions.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _cycleLine(RecruitmentTarget t) {
    final dept = t.departmentKo ?? t.facultyKo ?? 'recruitment unit';
    return '$dept · ${t.intakeYear} ${t.intakeTerm} · ${t.cycleTrack}';
  }
}

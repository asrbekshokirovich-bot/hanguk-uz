import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/feature_flags/uni_db_flag.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
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
///
/// Seoul Night pass: it lives inside one of the setup view's glass section
/// cards, so it uses the same nested sub-surface as the university picker
/// beside it (neutral fill, hairline border) rather than stacking a second
/// glass card. The fallback action is an outline button — the screen's one
/// lime action is Start Practice (spec §4).
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
    final l10n = AppLocalizations.of(context)!;
    final id = institutionId;
    if (id == null || id.isEmpty) {
      return _EmptyState(
        message: l10n.uniSpecificPickPrompt,
        onFallbackToGeneral: onFallbackToGeneral,
      );
    }
    final asyncTarget = ref.watch(recruitmentForInterviewProvider(id));
    return asyncTarget.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(16),
        child: Center(
          child: CircularProgressIndicator(color: SeoulColors.lime),
        ),
      ),
      error: (e, _) => _EmptyState(
        message: l10n.uniSpecificLoadError(e),
        onFallbackToGeneral: onFallbackToGeneral,
      ),
      data: (target) {
        if (target == null) {
          return _EmptyState(
            message: l10n.uniSpecificNoData,
            onFallbackToGeneral: onFallbackToGeneral,
          );
        }
        return _RecruitmentSummary(target: target);
      },
    );
  }
}

/// Nested sub-surface shared by both states below — the same idiom as the
/// university picker's list container in the host section card.
class _AddonSurface extends StatelessWidget {
  const _AddonSurface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      width: double.infinity,
      decoration: BoxDecoration(
        color: SeoulColors.neutralFill,
        borderRadius: SeoulRadii.tileR,
        border: Border.all(color: SeoulColors.glassBorder),
      ),
      child: child,
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onFallbackToGeneral});

  final String message;
  final VoidCallback onFallbackToGeneral;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return _AddonSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(
                Icons.info_outline,
                size: 16,
                color: SeoulColors.textSecondary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(l10n.uniSpecificHeader, style: SeoulType.subtitle),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(message, style: SeoulType.bodySecondary),
          const SizedBox(height: 12),
          SeoulOutlineButton(
            label: l10n.uniSpecificFallbackButton,
            icon: Icons.swap_horiz,
            height: SeoulSizes.minTapTarget,
            onPressed: onFallbackToGeneral,
          ),
        ],
      ),
    );
  }
}

class _RecruitmentSummary extends StatelessWidget {
  const _RecruitmentSummary({required this.target});

  final RecruitmentTarget target;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final nameEn = target.nameEn;
    return _AddonSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HangulGlyphTile(
                glyph: HangulGlyphTile.firstSyllable(target.nameKo),
                size: 32,
                radius: SeoulRadii.button,
                active: true,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      target.nameKo,
                      style: SeoulType.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (nameEn != null && nameEn.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        nameEn,
                        style: SeoulType.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(_cycleLine(l10n, target), style: SeoulType.bodySecondary),
          if (target.applicantCategory != null) ...[
            const SizedBox(height: 4),
            Text(
              l10n.uniSpecificTrackLabel(target.applicantCategory!),
              style: SeoulType.caption,
            ),
          ],
          const SizedBox(height: 4),
          Text(l10n.uniSpecificSeedNote, style: SeoulType.caption),
        ],
      ),
    );
  }

  static String _cycleLine(AppLocalizations l10n, RecruitmentTarget target) {
    final dept =
        target.departmentKo ??
        target.facultyKo ??
        l10n.uniSpecificRecruitmentUnitFallback;
    return '$dept · ${target.intakeYear} ${target.intakeTerm} · '
        '${target.cycleTrack}';
  }
}

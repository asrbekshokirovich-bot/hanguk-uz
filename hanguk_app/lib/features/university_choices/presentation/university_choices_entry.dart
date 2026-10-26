import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../data/university_choices_repository.dart';
import 'university_choices_screen.dart';

/// The way into "Universitet tanlovi" from the journey screen. Hidden until
/// the consultant has offered a university; amber while any offer waits for
/// the student's answer.
class UniversityChoicesEntry extends ConsumerWidget {
  const UniversityChoicesEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final choices = ref.watch(myUniversityChoicesProvider).value ?? const [];
    if (choices.isEmpty) return const SizedBox.shrink();
    final l = AppLocalizations.of(context)!;
    final waiting = choices.where((c) => c.canAnswer || c.needsFinalConfirm).length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Semantics(
        button: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: tracked('university_choices_entry.to_university_choices', () => context.push(kUniversityChoicesPath)),
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            decoration: BoxDecoration(
              color: waiting > 0 ? const Color(0xFFFFF7E8) : FdColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: waiting > 0 ? FdColors.warn : FdColors.ink, width: 1.5),
            ),
            child: Row(
              children: [
                const Lucide(LucideIcons.graduationCap, size: 20, color: FdColors.navy),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.ucTitle, style: fdText(14, FontWeight.w800, FdColors.ink)),
                      Text(
                        waiting > 0 ? l.ucBannerPending(waiting) : l.ucSubtitle,
                        style: fdText(12, FontWeight.w400, waiting > 0 ? FdColors.ink : FdColors.muted),
                      ),
                    ],
                  ),
                ),
                const Lucide(LucideIcons.chevronRight, size: 18, color: FdColors.muted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

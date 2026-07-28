import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';

/// Home section of the Seoul Night shell.
///
/// Phase 1 scope is the navigation shell, so this is deliberately the hub and
/// nothing more: a greeting and a card per section. Phase 3 replaces the body
/// with the real dashboard (journey hero card + conic progress ring, next-step
/// to-do card, application previews) wired to Riverpod providers.
class SeoulHomeTab extends ConsumerWidget {
  const SeoulHomeTab({super.key, required this.onOpenSection});

  /// Jump to a section of the shell by its [SeoulSection] index.
  final void Function(int index) onOpenSection;

  String _greeting(AppLocalizations l) {
    final hour = DateTime.now().hour;
    if (hour < 12) return l.greetingMorning;
    if (hour < 18) return l.greetingAfternoon;
    return l.greetingEvening;
  }

  /// Matching hangul for the greeting — decorative, so it stays Korean in
  /// every locale (spec §1 Korean voice).
  String _greetingKo() {
    final hour = DateTime.now().hour;
    if (hour < 12) return '좋은 아침';
    if (hour < 18) return '좋은 오후';
    return '좋은 저녁';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        24,
        SeoulSizes.screenPadding,
        // Clear of the orb.
        SeoulSizes.orbBottom + SeoulSizes.orbSize + 32,
      ),
      children: [
        Text(_greetingKo(), style: SeoulType.hangulLabel),
        const SizedBox(height: 4),
        Text(_greeting(l), style: SeoulType.display),
        const SizedBox(height: 24),

        _SectionCard(
          glyph: '지',
          title: l.navApplications,
          ko: '지원 현황',
          onTap: () => onOpenSection(1),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          glyph: '지',
          title: l.navMap,
          ko: '대학 지도',
          onTap: () => onOpenSection(2),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          glyph: '서',
          title: l.navDocs,
          ko: '서류 목록',
          onTap: () => onOpenSection(3),
        ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.glyph,
    required this.title,
    required this.ko,
    required this.onTap,
  });

  final String glyph;
  final String title;
  final String ko;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      child: Row(
        children: [
          HangulGlyphTile(glyph: glyph),
          const SizedBox(width: 14),
          Expanded(child: HangulTag(en: title, ko: ko, titleStyle: SeoulType.subtitle)),
          const Icon(
            Icons.arrow_forward_ios_rounded,
            size: 15,
            color: SeoulColors.textFaint,
          ),
        ],
      ),
    );
  }
}

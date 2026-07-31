import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';

/// Phase 0 placeholder shown by every uni_db screen until Phase 2 wires
/// real content. Single widget so flipping the flag becomes trivial.
///
/// Seoul Night pass: a quiet glass card — secondary text, no lime. A
/// placeholder must never out-shout the real content around it (spec §4).
class ComingSoonCard extends StatelessWidget {
  const ComingSoonCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.icon = Icons.school_outlined,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    // Scrollable so the card never stripes on a small screen at the OS's
    // largest font setting — the empty-state bodies run long in ru/vi.
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: GlassCard(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The icon sits in a glass tile like the hangul avatars do, so
              // the placeholder reads as part of the same family of surfaces.
              Container(
                width: SeoulSizes.glyphTile,
                height: SeoulSizes.glyphTile,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: SeoulColors.glass,
                  borderRadius: SeoulRadii.tileR,
                  border: Border.all(color: SeoulColors.glassBorder),
                ),
                child: Icon(icon, size: 24, color: SeoulColors.textSecondary),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: SeoulType.subtitle,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                style: SeoulType.bodySecondary,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              StatusChip(label: l10n.uniDbPhaseBadge, dense: true),
            ],
          ),
        ),
      ),
    );
  }
}

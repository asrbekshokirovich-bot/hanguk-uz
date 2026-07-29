import 'package:flutter/material.dart';

import '../seoul_night/seoul_night.dart';

/// Shared empty-state widget for "no rows / no data yet" surfaces.
///
/// Replaces bare placeholder strings with a consistent (icon + headline
/// + subhead + optional CTA) layout. Used by the Applications, Study
/// Plan drafts, and Interview-history screens (P1 #25).
///
/// Seoul Night pass: token-styled icon disc (the API takes an [IconData],
/// so a hangul glyph tile is not an option here), [SeoulType] headline and
/// body, and a [LimeButton] CTA when one is supplied. Public API unchanged.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.headline,
    required this.subhead,
    this.ctaLabel,
    this.onCta,
  });

  final IconData icon;
  final String headline;
  final String subhead;
  final String? ctaLabel;
  final VoidCallback? onCta;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: SeoulColors.limeFill,
              shape: BoxShape.circle,
              border: Border.all(
                color: SeoulColors.lime.withValues(alpha: 0.3),
              ),
            ),
            child: Icon(icon, size: 40, color: SeoulColors.lime),
          ),
          const SizedBox(height: 20),
          Text(headline, textAlign: TextAlign.center, style: SeoulType.title),
          const SizedBox(height: 8),
          Text(
            subhead,
            textAlign: TextAlign.center,
            style: SeoulType.bodySecondary.copyWith(fontSize: 13),
          ),
          if (ctaLabel != null && onCta != null) ...[
            const SizedBox(height: 20),
            LimeButton(label: ctaLabel!, onPressed: onCta, expand: false),
          ],
        ],
      ),
    );
  }
}

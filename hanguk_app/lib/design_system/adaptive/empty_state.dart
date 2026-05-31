import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Shared empty-state widget for "no rows / no data yet" surfaces.
///
/// Replaces bare placeholder strings with a consistent (icon + headline
/// + subhead + optional CTA) layout. Used by the Applications, Study
/// Plan drafts, and Interview-history screens (P1 #25).
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
              color: AppColors.vibrantLime.withValues(alpha: 0.08),
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.vibrantLime.withValues(alpha: 0.3),
              ),
            ),
            child: Icon(icon, size: 40, color: AppColors.vibrantLime),
          ),
          const SizedBox(height: 20),
          Text(
            headline,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subhead,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          if (ctaLabel != null && onCta != null) ...[
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: onCta,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.vibrantLime,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                ctaLabel!,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../../../design_system/adaptive/hanguk_card.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../domain/university.dart';

class UniversityCard extends StatelessWidget {
  final University university;
  final VoidCallback? onTap;

  const UniversityCard({super.key, required this.university, this.onTap});

  @override
  Widget build(BuildContext context) {
    return HangukCard(
      onTap: onTap,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _buildLogo(),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  university.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: Colors.white,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  university.location,
                  style: const TextStyle(color: Colors.white54, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _buildTierBadge(),
          if (university.isPartner) ...[
            const SizedBox(width: 6),
            _buildPartnerChip(),
          ],
          const SizedBox(width: 4),
          const Icon(
            Icons.chevron_right_rounded,
            color: Colors.white24,
            size: 20,
          ),
        ],
      ),
    );
  }

  Widget _buildLogo() {
    if (university.logoUrl != null && university.logoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        // Decorative — the university name sits next to this logo.
        child: Image.network(
          university.logoUrl!,
          width: 48,
          height: 48,
          fit: BoxFit.contain,
          excludeFromSemantics: true,
          errorBuilder: (_, __, ___) => _fallbackIcon(),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return _loadingBox();
          },
        ),
      );
    }
    return _fallbackIcon();
  }

  Widget _fallbackIcon() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: AppColors.vibrantLime.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.vibrantLime.withValues(alpha: 0.15),
        ),
      ),
      child: const Icon(
        Icons.school_outlined,
        color: AppColors.vibrantLime,
        size: 24,
      ),
    );
  }

  // Low-contrast placeholder shown during slow logo loads (audit P1).
  Widget _loadingBox() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Center(
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: Colors.white24,
          ),
        ),
      ),
    );
  }

  /// Audit M3 (2026-05-11): the legacy `_buildRankBadge` rendered
  /// `#${ranking}` from a column that no longer exists. Replaced with
  /// a tier-based "Top" pill: tier 0 (flagship) and tier 1 (top-ranked)
  /// get highlighted treatment; tier 2–4 show a dimmer "Tier N" label.
  /// Unclassified institutions (tier == null) render no badge.
  Widget _buildTierBadge() {
    final tier = university.tier;
    if (tier == null) return const SizedBox.shrink();

    final isTop = tier <= 1;
    final label = isTop ? 'Top' : 'Tier $tier';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: isTop
            ? AppColors.vibrantLime.withValues(alpha: 0.15)
            : Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isTop
              ? AppColors.vibrantLime.withValues(alpha: 0.4)
              : Colors.white.withValues(alpha: 0.08),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: isTop ? AppColors.vibrantLime : Colors.white70,
        ),
      ),
    );
  }

  Widget _buildPartnerChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.vibrantLime.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Text(
        'Partner',
        style: TextStyle(
          fontSize: 10,
          color: AppColors.vibrantLime,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

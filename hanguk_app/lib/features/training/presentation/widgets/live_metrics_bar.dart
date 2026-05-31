import 'package:flutter/material.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';

/// Status tags consumed by [LiveMetricsBar]. `error` was added 2026-05-10
/// (audit U1/A5) so save failures surface to the user instead of silently
/// flipping to `saved`.
enum SaveStatus { unsaved, saving, saved, error }

class LiveMetricsBar extends StatelessWidget {
  final int wordCount;
  final int charCount;
  final SaveStatus saveStatus;

  final String? track;

  const LiveMetricsBar({
    super.key,
    required this.wordCount,
    required this.charCount,
    required this.saveStatus,
    this.track,
  });

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              _buildMetric(l.metricWords, wordCount.toString()),
              const SizedBox(width: 16),
              _buildMetric(l.metricCharacters, charCount.toString()),
              if (track != null) ...[
                const SizedBox(width: 16),
                _buildTrackIndicator(track!),
              ],
            ],
          ),
          _buildSaveStatus(l),
        ],
      ),
    );
  }

  Widget _buildMetric(String label, String value) {
    return Row(
      children: [
        Text(
          '$label: ',
          style: const TextStyle(color: Colors.white54, fontSize: 12),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildSaveStatus(AppLocalizations l) {
    IconData icon;
    Color color;
    String text;

    switch (saveStatus) {
      case SaveStatus.unsaved:
        icon = Icons.edit_outlined;
        color = Colors.white54;
        text = l.saveStatusUnsaved;
        break;
      case SaveStatus.saving:
        icon = Icons.cloud_upload_outlined;
        color = Colors.orangeAccent;
        text = l.saveStatusSaving;
        break;
      case SaveStatus.saved:
        icon = Icons.cloud_done_outlined;
        color = AppColors.vibrantLime;
        text = l.saveStatusSaved;
        break;
      case SaveStatus.error:
        icon = Icons.cloud_off_outlined;
        color = Colors.redAccent;
        text = l.saveStatusError;
        break;
    }

    return Row(
      children: [
        if (saveStatus == SaveStatus.saving)
          const SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Colors.orangeAccent,
            ),
          )
        else
          Icon(icon, color: color, size: 14),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(color: color, fontSize: 12)),
      ],
    );
  }

  Widget _buildTrackIndicator(String track) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.vibrantLime.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: AppColors.vibrantLime.withValues(alpha: 0.3)),
      ),
      child: Text(
        track.toUpperCase(),
        style: const TextStyle(
          color: AppColors.vibrantLime,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

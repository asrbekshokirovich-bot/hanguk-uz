import 'package:flutter/material.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: const BoxDecoration(
        color: SeoulColors.neutralFill,
        borderRadius: SeoulRadii.buttonR,
      ),
      // Both sides are intrinsically sized, so a plain spaceBetween Row has
      // nowhere to give: in Uzbek ("So'zlar" / "Belgilar" / "Saqlash xatosi")
      // it striped the drafting workspace at 1.15 text scale. The metrics
      // group yields first, since the save status is the part you must be
      // able to read.
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: _buildMetric(l.metricWords, wordCount.toString()),
                ),
                const SizedBox(width: 16),
                Flexible(
                  child: _buildMetric(l.metricCharacters, charCount.toString()),
                ),
                if (track != null) ...[
                  const SizedBox(width: 16),
                  _buildTrackIndicator(track!),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          _buildSaveStatus(l),
        ],
      ),
    );
  }

  Widget _buildMetric(String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: Text(
            '$label: ',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: SeoulType.caption,
          ),
        ),
        Text(
          value,
          style: SeoulType.caption.copyWith(
            color: SeoulColors.textPrimary,
            fontWeight: FontWeight.w700,
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
        color = SeoulColors.textSecondary;
        text = l.saveStatusUnsaved;
        break;
      case SaveStatus.saving:
        icon = Icons.cloud_upload_outlined;
        color = SeoulColors.infoText;
        text = l.saveStatusSaving;
        break;
      case SaveStatus.saved:
        icon = Icons.cloud_done_outlined;
        color = SeoulColors.lime;
        text = l.saveStatusSaved;
        break;
      case SaveStatus.error:
        icon = Icons.cloud_off_outlined;
        color = SeoulColors.dangerText;
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
              color: SeoulColors.infoText,
            ),
          )
        else
          Icon(icon, color: color, size: 14),
        const SizedBox(width: 6),
        Text(text, style: SeoulType.caption.copyWith(color: color)),
      ],
    );
  }

  Widget _buildTrackIndicator(String track) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: SeoulColors.limeFill,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: SeoulColors.lime.withValues(alpha: 0.3)),
      ),
      child: Text(
        track.toUpperCase(),
        style: SeoulType.eyebrow.copyWith(color: SeoulColors.lime),
      ),
    );
  }
}

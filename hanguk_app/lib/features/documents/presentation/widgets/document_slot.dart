import 'package:flutter/material.dart';
import '../../domain/document_type.dart';
import '../../domain/document.dart';
import '../../../../design_system/adaptive/hanguk_card.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';

class DocumentSlot extends StatelessWidget {
  final int index;
  final DocumentType type;
  final AppDocument? uploadedDoc;
  final bool isUploading;
  final VoidCallback onUploadTap;
  final VoidCallback? onPreviewTap;
  final VoidCallback? onDeleteTap;

  const DocumentSlot({
    super.key,
    required this.index,
    required this.type,
    this.uploadedDoc,
    required this.isUploading,
    required this.onUploadTap,
    this.onPreviewTap,
    this.onDeleteTap,
  });

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final bool isApproved = uploadedDoc?.status == 'approved';
    final bool isUploaded = uploadedDoc != null;

    final Color bgColor = isApproved
        ? Colors.green.withValues(alpha: 0.1)
        : isUploaded
        ? Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.3)
        : Theme.of(
            context,
          ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3);

    final Color borderColor = isApproved
        ? Colors.green.withValues(alpha: 0.3)
        : isUploaded
        ? Theme.of(context).colorScheme.primaryContainer
        : Theme.of(context).dividerColor;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          // Index or Checkmark
          SizedBox(
            width: 32,
            child: isApproved
                ? const Icon(Icons.check_circle, color: Colors.green)
                : isUploaded
                ? const Icon(
                    Icons.check_circle_outline,
                    color: AppColors.vibrantLime,
                  )
                : Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.grey.shade400),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '${index + 1}',
                      style: const TextStyle(
                        fontSize: 10,
                        color: Colors.white70,
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 8),

          // Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type.nameEn,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isApproved ? Colors.green : Colors.white,
                  ),
                ),
                if (isUploaded && !isApproved)
                  Text(
                    'Pending Review',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                if (isApproved)
                  const Text(
                    'Approved',
                    style: TextStyle(fontSize: 12, color: Colors.green),
                  ),
              ],
            ),
          ),

          // Actions
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isUploaded || isApproved) ...[
                IconButton(
                  icon: const Icon(Icons.visibility_outlined, size: 20),
                  color: AppColors.vibrantLime,
                  tooltip: l.a11yTooltipPreviewDocument,
                  onPressed: onPreviewTap,
                ),
                if (!isApproved)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    color: Colors.redAccent,
                    tooltip: l.a11yTooltipDeleteDocument,
                    onPressed: isUploading ? null : onDeleteTap,
                  ),
              ] else
                ElevatedButton.icon(
                  onPressed: isUploading ? null : onUploadTap,
                  icon: isUploading
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.pureBlack,
                          ),
                        )
                      : const Icon(Icons.cloud_upload_outlined, size: 14),
                  label: const Text('Upload'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    textStyle: const TextStyle(fontSize: 12),
                    // WCAG 2.2 target-size minimum is 48dp on the height
                    // axis; previous 36dp height failed AA.
                    minimumSize: const Size(80, 48),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

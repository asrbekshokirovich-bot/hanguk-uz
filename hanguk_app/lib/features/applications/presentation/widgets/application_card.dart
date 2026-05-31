import 'package:flutter/material.dart';
import '../../domain/application.dart';
import '../../../../design_system/adaptive/hanguk_card.dart';
import '../../../../design_system/theme/app_colors.dart';
import 'process_tracker.dart';
import 'university_room_modal.dart';

class ApplicationCard extends StatefulWidget {
  final StudentApplication application;
  final VoidCallback? onDiscussionTap;

  const ApplicationCard({
    super.key,
    required this.application,
    this.onDiscussionTap,
  });

  @override
  State<ApplicationCard> createState() => _ApplicationCardState();
}

class _ApplicationCardState extends State<ApplicationCard> {
  bool _isExpanded = false;

  void _toggleExpanded() {
    setState(() {
      _isExpanded = !_isExpanded;
    });
  }

  @override
  Widget build(BuildContext context) {
    final application = widget.application;
    final university = application.university;

    return HangukCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: EdgeInsets
          .zero, // We remove padding from HangukCard internally if supported, but typically we handle it in children.
      // Actually HangukCard usually takes `child` directly without overriding internal paddings unless we use it. We'll wrap in Material to give InkWell effect properly.
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: _toggleExpanded,
          child: Padding(
            padding: const EdgeInsets.all(
              16.0,
            ), // Standard padding for the card contents
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Logo + Title + Expand Icon
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    if (university?.logoUrl != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        // University name appears beside the logo, so the
                        // logo image is decorative for screen readers.
                        child: Image.network(
                          university!.logoUrl!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          excludeFromSemantics: true,
                          errorBuilder: (context, error, stackTrace) =>
                              _fallbackLogo(),
                          loadingBuilder: (context, child, progress) {
                            if (progress == null) return child;
                            return _loadingLogo();
                          },
                        ),
                      )
                    else
                      _fallbackLogo(),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            university?.name ?? 'Unknown University',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Text(
                                university?.location ?? '',
                                style: const TextStyle(
                                  color: Colors.white54,
                                  fontSize: 13,
                                ),
                              ),
                              if (university?.isPartner ?? false) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.vibrantLime.withValues(
                                      alpha: 0.1,
                                    ),
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
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      _isExpanded ? Icons.expand_less : Icons.expand_more,
                      color: Colors.white54,
                    ),
                  ],
                ),

                // Expandable Body
                AnimatedSize(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                  alignment: Alignment.topCenter,
                  child: _isExpanded
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 16),

                            // Status Tracker or Pending Banner
                            if (application.status == 'pending_approval')
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.vibrantLime.withValues(
                                    alpha: 0.1,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: AppColors.vibrantLime.withValues(
                                      alpha: 0.3,
                                    ),
                                  ),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(
                                      Icons.hourglass_empty_rounded,
                                      color: AppColors.vibrantLime,
                                      size: 20,
                                    ),
                                    SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        'Awaiting Counselor Approval.\nWe will notify you once reviewed.',
                                        style: TextStyle(
                                          color: AppColors.vibrantLime,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              ProcessTracker(status: application.status),

                            const SizedBox(height: 16),
                            const Divider(color: AppColors.borderGlass),

                            // Actions
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => UniversityRoomModal.show(
                                      context,
                                      application,
                                      initialTabIndex: 1,
                                    ),
                                    icon: const Icon(
                                      Icons.forum_outlined,
                                      size: 16,
                                      color: AppColors.vibrantLime,
                                    ),
                                    label: const Text('Discussion'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => UniversityRoomModal.show(
                                      context,
                                      application,
                                      initialTabIndex: 3,
                                    ),
                                    icon: const Icon(
                                      Icons.event_note_outlined,
                                      size: 16,
                                      color: AppColors.vibrantLime,
                                    ),
                                    label: const Text('Calendar'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _fallbackLogo() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: AppColors.vibrantLime.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Icon(Icons.school_outlined, color: AppColors.vibrantLime),
    );
  }

  // Low-contrast placeholder shown while the logo is still loading so users
  // see something on slow networks (audit P1).
  Widget _loadingLogo() {
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
}

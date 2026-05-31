import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../map/domain/university.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../design_system/adaptive/hanguk_card.dart';
import '../../data/applications_repository.dart';
import '../../../chat/presentation/chat_tab.dart';
import '../applications_view_model.dart';

class UniversitySelectionView extends ConsumerStatefulWidget {
  final List<University> suggestions;
  final VoidCallback onSubmitted;

  const UniversitySelectionView({
    super.key,
    required this.suggestions,
    required this.onSubmitted,
  });

  @override
  ConsumerState<UniversitySelectionView> createState() =>
      _UniversitySelectionViewState();
}

class _UniversitySelectionViewState
    extends ConsumerState<UniversitySelectionView> {
  final Set<String> _selectedIds = {};
  bool _isSubmitting = false;

  void _toggleSelection(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        if (_selectedIds.length < 3) {
          _selectedIds.add(id);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('You can only apply to up to 3 universities.'),
            ),
          );
        }
      }
    });
  }

  void _openAICompare() {
    // Generate an automatic prompt based on the suggestions for the AI
    final uniNames = widget.suggestions.map((u) => u.name).join(', ');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: const BoxDecoration(
          color: Color(0xFF071221),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: const ChatTab(), // The Chat tab handles its own input/output
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_selectedIds.isEmpty) return;
    setState(() {
      _isSubmitting = true;
    });
    try {
      await submitSelectedUniversities(_selectedIds.toList());
      // Refresh the view model provider instead of individual data providers
      ref.invalidate(applicationsTabProvider);
      widget.onSubmitted();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to submit: $e')));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Suggested For You',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      'Select up to 3 universities to begin.',
                      style: TextStyle(fontSize: 14, color: Colors.white70),
                    ),
                  ],
                ),
              ),
              ElevatedButton.icon(
                onPressed: _openAICompare,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.vibrantLime.withValues(alpha: 0.2),
                  foregroundColor: AppColors.vibrantLime,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
                icon: const Icon(Icons.compare_arrows_rounded, size: 18),
                label: const Text('AI Compare'),
              ),
            ],
          ),
        ),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.only(top: 8, bottom: 16),
          itemCount: widget.suggestions.length,
          itemBuilder: (context, index) {
            final uni = widget.suggestions[index];
            final isSelected = _selectedIds.contains(uni.id);

            return GestureDetector(
              onTap: () => _toggleSelection(uni.id),
              child: HangukCard(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: isSelected
                          ? AppColors.vibrantLime
                          : Colors.transparent,
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      if (uni.logoUrl != null)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          // Decorative — university name follows.
                          child: Image.network(
                            uni.logoUrl!,
                            width: 56,
                            height: 56,
                            fit: BoxFit.cover,
                            excludeFromSemantics: true,
                            // Graceful fallback on 404 / decode error so the
                            // row keeps its visual layout (audit P1).
                            errorBuilder: (_, __, ___) => _logoFallback(),
                            // Low-key placeholder during slow networks.
                            loadingBuilder: (context, child, progress) {
                              if (progress == null) return child;
                              return _logoLoading();
                            },
                          ),
                        )
                      else
                        _logoFallback(),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              uni.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              uni.location,
                              style: const TextStyle(
                                color: Colors.white54,
                                fontSize: 14,
                              ),
                            ),
                            if (uni.acceptanceRate != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Acceptance Rate: ${uni.acceptanceRate!.toStringAsFixed(1)}%',
                                style: const TextStyle(
                                  color: AppColors.vibrantLime,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Checkbox(
                        value: isSelected,
                        onChanged: (val) => _toggleSelection(uni.id),
                        activeColor: AppColors.vibrantLime,
                        checkColor: Colors.black,
                        side: const BorderSide(color: Colors.white54),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        if (_selectedIds.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0F213D),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.5),
                  blurRadius: 10,
                  offset: const Offset(0, -5),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.vibrantLime,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.black,
                          ),
                        )
                      : Text(
                          'Submit ${_selectedIds.length} Selection${_selectedIds.length > 1 ? 's' : ''} for Approval',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // Shared 56dp fallback box matching the logo footprint — used for missing
  // logoUrl, 404s, and decode errors so the row layout stays stable.
  Widget _logoFallback() {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: AppColors.vibrantLime.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Icon(Icons.school_outlined, color: AppColors.vibrantLime),
    );
  }

  // Low-contrast placeholder shown while the logo is still loading so users
  // see something on slow networks.
  Widget _logoLoading() {
    return Container(
      width: 56,
      height: 56,
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

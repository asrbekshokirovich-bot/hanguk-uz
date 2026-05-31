import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../applications/data/applications_repository.dart';
import '../../../uni_db/presentation/widgets/university_specific_cta.dart';
import '../../data/interview_repository.dart';

class InterviewSetupView extends ConsumerStatefulWidget {
  final VoidCallback onHistoryTapped;
  const InterviewSetupView({super.key, required this.onHistoryTapped});

  @override
  ConsumerState<InterviewSetupView> createState() => _InterviewSetupViewState();
}

class _InterviewSetupViewState extends ConsumerState<InterviewSetupView> {
  String _sessionType = 'general';
  String _language = 'ko';
  // Audit U11: controller-backed so the field re-renders on edit and
  // the cursor doesn't jump.
  final TextEditingController _focusTopicCtrl = TextEditingController();
  String _persona = 'friendly';
  bool _timedMode = false;
  // Audit U10: when sessionType == 'university_specific', this view
  // used to have no way to pick a target university. Now we surface a
  // picker from the user's applications list.
  String? _targetUniversityId;
  String? _targetUniversityName;

  bool get _isUniSpecific => _sessionType == 'university_specific';

  @override
  void dispose() {
    _focusTopicCtrl.dispose();
    super.dispose();
  }

  void _start() {
    if (_isUniSpecific && _targetUniversityId == null) return;
    final topic = _focusTopicCtrl.text.trim();
    ref
        .read(interviewProvider.notifier)
        .startSession(
          sessionType: _sessionType,
          targetUniversityId: _targetUniversityId,
          targetUniversityName: _targetUniversityName,
          language: _language,
          focusTopic: topic.isNotEmpty ? topic : null,
          persona: _persona,
          timedMode: _timedMode,
          timeLimitSeconds: _timedMode ? 300 : null, // 5 min default
        );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(interviewProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                l.interviewSetupTitle,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.history, color: AppColors.royalBlue),
                tooltip: l.a11yTooltipInterviewHistory,
                onPressed: widget.onHistoryTapped,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            l.interviewSetupSubtitle,
            style: const TextStyle(color: Colors.white70, fontSize: 16),
          ),
          const SizedBox(height: 32),

          _buildLabel(l.interviewTypeLabel),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white10),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _sessionType,
                dropdownColor: AppColors.backgroundNavy,
                isExpanded: true,
                style: const TextStyle(color: Colors.white, fontSize: 16),
                items: [
                  DropdownMenuItem(
                    value: 'general',
                    child: Text(l.interviewTypeGeneral),
                  ),
                  DropdownMenuItem(
                    value: 'university_specific',
                    child: Text(l.interviewTypeUniversitySpecific),
                  ),
                  DropdownMenuItem(
                    value: 'visa',
                    child: Text(l.interviewTypeVisa),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _sessionType = val);
                },
              ),
            ),
          ),

          // Audit U10: real uni-picker for university_specific sessions.
          // Previously this view had no way to set targetUniversityId and
          // the addon below fell back to general.
          if (_isUniSpecific) ...[
            const SizedBox(height: 16),
            _buildLabel(l.targetUniversityFieldLabel),
            const SizedBox(height: 8),
            _UniversityPicker(
              selectedId: _targetUniversityId,
              onPick: (id, name) => setState(() {
                _targetUniversityId = id;
                _targetUniversityName = name;
              }),
            ),
            // University-specific addon (gated behind UNI_DB_ENABLED).
            // Reads v_recruitment_for_interview for the chosen
            // institution; falls back to general if no verified
            // recruitment data is available.
            UniversitySpecificSetupAddon(
              institutionId: _targetUniversityId,
              onFallbackToGeneral: () =>
                  setState(() => _sessionType = 'general'),
            ),
          ],

          const SizedBox(height: 24),

          _buildLabel(l.languageLabel),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _LanguageOption(
                  title: l.trackKorean,
                  isSelected: _language == 'ko',
                  onTap: () => setState(() => _language = 'ko'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _LanguageOption(
                  title: l.trackEnglish,
                  isSelected: _language == 'en',
                  onTap: () => setState(() => _language = 'en'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          _buildLabel(l.interviewerPersonaLabel),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white10),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _persona,
                dropdownColor: AppColors.backgroundNavy,
                isExpanded: true,
                style: const TextStyle(color: Colors.white, fontSize: 16),
                items: [
                  DropdownMenuItem(
                    value: 'friendly',
                    child: Text(l.personaFriendlyCaps),
                  ),
                  DropdownMenuItem(
                    value: 'strict',
                    child: Text(l.personaStrictCaps),
                  ),
                  DropdownMenuItem(
                    value: 'impatient',
                    child: Text(l.personaImpatientCaps),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _persona = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 24),

          _buildLabel(l.focusTopicLabel),
          const SizedBox(height: 8),
          TextField(
            controller: _focusTopicCtrl,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: l.focusTopicHint,
              hintStyle: const TextStyle(color: Colors.white30),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.05),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 24),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.royalBlue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.royalBlue.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.timer, color: AppColors.royalBlue),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l.timedModeTitle,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        l.timedModeSubtitle,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _timedMode,
                  activeColor: AppColors.royalBlue,
                  onChanged: (val) => setState(() => _timedMode = val),
                ),
              ],
            ),
          ),
          const SizedBox(height: 48),

          if (state.isLoading)
            const Center(
              child: CircularProgressIndicator(color: AppColors.vibrantLime),
            )
          else
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.vibrantLime,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(30),
                ),
              ),
              icon: const Icon(Icons.play_arrow),
              label: Text(
                l.startPracticeButton,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              onPressed: (_isUniSpecific && _targetUniversityId == null)
                  ? null
                  : _start,
            ),
          if (_isUniSpecific && _targetUniversityId == null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                l.pickUniversityFirstHint,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: Colors.white70,
        fontSize: 14,
        fontWeight: FontWeight.bold,
      ),
    );
  }
}

/// Picks a target university from the user's applications. Mirrors the
/// list in `training_tab.dart`'s interview-setup dialog so the two
/// entry paths share behavior.
class _UniversityPicker extends ConsumerWidget {
  const _UniversityPicker({required this.selectedId, required this.onPick});

  final String? selectedId;
  final void Function(String id, String name) onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final applications = ref.watch(applicationsProvider);
    return applications.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: CircularProgressIndicator(color: AppColors.vibrantLime),
        ),
      ),
      error: (e, _) => Text(
        l.errorLoadingApplications(e),
        style: const TextStyle(color: Colors.redAccent, fontSize: 12),
      ),
      data: (apps) {
        if (apps.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              l.noAppsInlineHint,
              style: const TextStyle(color: Colors.white54, fontSize: 12),
            ),
          );
        }
        return Container(
          height: 150,
          width: double.maxFinite,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white10),
            borderRadius: BorderRadius.circular(12),
          ),
          child: ListView.builder(
            itemCount: apps.length,
            itemBuilder: (context, i) {
              final uni = apps[i].university;
              if (uni == null) return const SizedBox.shrink();
              final isSelected = selectedId == uni.id;
              return ListTile(
                dense: true,
                leading: Icon(
                  Icons.school,
                  color: isSelected ? AppColors.vibrantLime : Colors.white24,
                ),
                title: Text(
                  uni.name,
                  style: TextStyle(
                    color: isSelected ? AppColors.vibrantLime : Colors.white,
                  ),
                ),
                trailing: isSelected
                    ? const Icon(
                        Icons.check_circle,
                        color: AppColors.vibrantLime,
                      )
                    : null,
                onTap: () => onPick(uni.id, uni.name),
              );
            },
          ),
        );
      },
    );
  }
}

class _LanguageOption extends StatelessWidget {
  final String title;
  final bool isSelected;
  final VoidCallback onTap;

  const _LanguageOption({
    required this.title,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.royalBlue.withValues(alpha: 0.2)
              : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.royalBlue : Colors.white10,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? AppColors.royalBlue : Colors.white70,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../uni_db/presentation/widgets/university_specific_cta.dart';
import '../../data/interview_repository.dart';
import 'target_university_picker.dart';

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
    final canStart = !(_isUniSpecific && _targetUniversityId == null);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        4,
        SeoulSizes.screenPadding,
        40,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Intro hero (spec §3.7) ──────────────────────────────────────
          HeroCard(
            watermark: '면접',
            margin: const EdgeInsets.only(bottom: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const HangulGlyphTile(
                      glyph: '한',
                      active: true,
                      radius: SeoulRadii.control,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: HangulTag(
                        en: l.interviewSetupTitle,
                        ko: '면접 연습',
                        titleStyle: SeoulType.title,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(l.interviewSetupSubtitle, style: SeoulType.bodySecondary),
              ],
            ),
          ),

          // ── Session type ────────────────────────────────────────────────
          _SectionCard(
            title: l.interviewTypeLabel,
            ko: '유형',
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SeoulFilterChip(
                  label: l.interviewTypeGeneral,
                  ko: '일반',
                  selected: _sessionType == 'general',
                  onTap: () => setState(() => _sessionType = 'general'),
                ),
                SeoulFilterChip(
                  label: l.interviewTypeUniversitySpecific,
                  ko: '대학',
                  selected: _isUniSpecific,
                  onTap: () =>
                      setState(() => _sessionType = 'university_specific'),
                ),
                SeoulFilterChip(
                  label: l.interviewTypeVisa,
                  ko: '비자',
                  selected: _sessionType == 'visa',
                  onTap: () => setState(() => _sessionType = 'visa'),
                ),
              ],
            ),
          ),

          // Audit U10: real uni-picker for university_specific sessions.
          // Previously this view had no way to set targetUniversityId and
          // the addon below fell back to general.
          if (_isUniSpecific)
            _SectionCard(
              title: l.targetUniversityFieldLabel,
              ko: '대학 선택',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TargetUniversityPicker(
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
              ),
            ),

          // ── Language ────────────────────────────────────────────────────
          _SectionCard(
            title: l.languageLabel,
            ko: '언어',
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SeoulFilterChip(
                  label: l.trackKorean,
                  ko: '한국어',
                  selected: _language == 'ko',
                  onTap: () => setState(() => _language = 'ko'),
                ),
                SeoulFilterChip(
                  label: l.trackEnglish,
                  ko: '영어',
                  selected: _language == 'en',
                  onTap: () => setState(() => _language = 'en'),
                ),
              ],
            ),
          ),

          // ── Interviewer persona ─────────────────────────────────────────
          _SectionCard(
            title: l.interviewerPersonaLabel,
            ko: '면접관',
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SeoulFilterChip(
                  label: l.personaFriendlyCaps,
                  selected: _persona == 'friendly',
                  onTap: () => setState(() => _persona = 'friendly'),
                ),
                SeoulFilterChip(
                  label: l.personaStrictCaps,
                  selected: _persona == 'strict',
                  onTap: () => setState(() => _persona = 'strict'),
                ),
                SeoulFilterChip(
                  label: l.personaImpatientCaps,
                  selected: _persona == 'impatient',
                  onTap: () => setState(() => _persona = 'impatient'),
                ),
              ],
            ),
          ),

          // ── Focus topic ─────────────────────────────────────────────────
          _SectionCard(
            title: l.focusTopicLabel,
            ko: '주제',
            child: TextField(
              controller: _focusTopicCtrl,
              style: SeoulType.body,
              cursorColor: SeoulColors.lime,
              decoration: InputDecoration(
                hintText: l.focusTopicHint,
                hintStyle: SeoulType.bodySecondary.copyWith(
                  color: SeoulColors.textFaint,
                ),
                filled: true,
                fillColor: SeoulColors.neutralFill,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 14,
                ),
                border: const OutlineInputBorder(
                  borderRadius: SeoulRadii.controlR,
                  borderSide: BorderSide(color: SeoulColors.glassBorder),
                ),
                enabledBorder: const OutlineInputBorder(
                  borderRadius: SeoulRadii.controlR,
                  borderSide: BorderSide(color: SeoulColors.glassBorder),
                ),
                focusedBorder: const OutlineInputBorder(
                  borderRadius: SeoulRadii.controlR,
                  borderSide: BorderSide(color: SeoulColors.lime),
                ),
              ),
            ),
          ),

          // ── Timed mode ──────────────────────────────────────────────────
          GlassCard(
            margin: const EdgeInsets.only(bottom: 18),
            padding: const EdgeInsets.fromLTRB(16, 10, 10, 10),
            borderColor: _timedMode ? SeoulColors.lime : null,
            child: Row(
              children: [
                Icon(
                  Icons.timer,
                  size: 20,
                  color: _timedMode ? SeoulColors.lime : SeoulColors.textFaint,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.timedModeTitle, style: SeoulType.subtitle),
                      const SizedBox(height: 2),
                      Text(l.timedModeSubtitle, style: SeoulType.caption),
                    ],
                  ),
                ),
                _SeoulToggle(
                  value: _timedMode,
                  semanticLabel: l.timedModeTitle,
                  onChanged: (val) => setState(() => _timedMode = val),
                ),
              ],
            ),
          ),

          // Audit G3·5: startSession() sets state.error on failure but this
          // view never surfaced it, so a failed start looked like a silent
          // freeze. Show a localized banner; it clears automatically because
          // startSession() runs copyWith(clearError: true) on the next try.
          if (state.error != null && !state.isLoading) ...[
            GlassCard(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(14),
              fillColor: SeoulColors.dangerFill,
              borderColor: SeoulColors.warning.withValues(alpha: 0.45),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline,
                    color: SeoulColors.dangerText,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l.interviewStartError,
                      style: SeoulType.bodySecondary.copyWith(
                        color: SeoulColors.dangerText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // The one lime action on this screen (spec §4).
          LimeButton(
            label: l.startPracticeButton,
            icon: Icons.play_arrow,
            loading: state.isLoading,
            onPressed: canStart ? _start : null,
          ),
          if (!canStart)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                l.pickUniversityFirstHint,
                textAlign: TextAlign.center,
                style: SeoulType.caption,
              ),
            ),

          const SizedBox(height: 12),
          SeoulOutlineButton(
            label: l.interviewHistoryTitle,
            icon: Icons.history,
            onPressed: widget.onHistoryTapped,
            trailing: Text('기록', style: SeoulType.hangulLabel),
          ),
        ],
      ),
    );
  }
}

// The target-university picker now lives in `target_university_picker.dart`
// (shared with the personal-statement / study-plan setup dialogs) and falls
// back to the full university list when the student has no applications.

/// Seoul Night on/off switch: a lime pill with an ink thumb when on, glass
/// with a faint thumb when off. Hand-rolled rather than a Material [Switch] so
/// every colour resolves to a token and the control matches the chips beside
/// it. The 44px outer box is the tap target (spec §4); the pill is smaller.
class _SeoulToggle extends StatelessWidget {
  const _SeoulToggle({
    required this.value,
    required this.onChanged,
    required this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool> onChanged;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: value,
      label: semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onChanged(!value),
        child: SizedBox(
          width: 64,
          height: SeoulSizes.minTapTarget,
          child: Center(
            child: AnimatedContainer(
              duration: SeoulMotion.fast,
              curve: SeoulMotion.smooth,
              width: 52,
              height: 30,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: value ? SeoulColors.lime : SeoulColors.neutralFill,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: value ? SeoulColors.lime : SeoulColors.glassBorder,
                ),
                boxShadow: value ? SeoulShadows.limeGlowSmall : null,
              ),
              child: AnimatedAlign(
                duration: SeoulMotion.fast,
                curve: SeoulMotion.smooth,
                alignment: value ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: value ? SeoulColors.ink : SeoulColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One configuration group: a glass surface with an English title, its small
/// lime hangul label, and the control below (spec §1 Surfaces / Korean voice).
class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.ko,
    required this.child,
  });

  final String title;
  final String ko;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  title,
                  style: SeoulType.subtitle,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // Padding rather than a SizedBox spacer: it forwards the child's
              // baseline, which the Row needs for baseline alignment.
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Text(ko, style: SeoulType.hangulLabel),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

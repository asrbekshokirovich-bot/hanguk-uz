import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/grammar_issue_resolver.dart' as resolver;
import '../../data/study_plan_repository.dart';
import 'ai_highlighting_text_controller.dart';
import 'live_metrics_bar.dart';

/// Sentinel tags for the AI workspace status indicator. We store a tag
/// (not a translated string) so the on-screen status follows the current
/// locale across rebuilds — i18n phase 3.
enum _AiStatus {
  waiting,
  coolingDown,
  analyzing,
  ready,
  predicting,
  supervisionActive,
}

class AdvancedDraftingWorkspace extends ConsumerStatefulWidget {
  final String initialText;
  final String documentTitle;
  final String documentType; // 'study_plan' or 'personal_statement'

  const AdvancedDraftingWorkspace({
    super.key,
    required this.initialText,
    required this.documentTitle,
    required this.documentType,
  });

  @override
  ConsumerState<AdvancedDraftingWorkspace> createState() =>
      _AdvancedDraftingWorkspaceState();
}

class _AdvancedDraftingWorkspaceState
    extends ConsumerState<AdvancedDraftingWorkspace> {
  late AiHighlightingTextController _controller;
  final FocusNode _focusNode = FocusNode();
  // Reused FocusNode for the KeyboardListener that captures Tab presses.
  // Previously a fresh `FocusNode()` was constructed inline on every
  // build, leaking one node per rebuild — see audit A4.
  final FocusNode _keyboardListenerFocus = FocusNode();

  Timer? _saveDebounceTimer;
  Timer? _aiSuggestionTimer;
  // Audit A10: rate-cap the AI supervise calls to once every
  // _aiMinInterval. Without it, long sessions of intermittent typing
  // pauses can fire dozens of paid Edge Function calls per minute.
  DateTime? _lastAiCallAt;
  static const Duration _aiMinInterval = Duration(seconds: 6);

  /// Audit A7: hard cap on the draft length. Also drives the completeness
  /// meter above the metrics bar, so the student can see how much of the
  /// allowance is left.
  static const int _maxChars = 12000;

  SaveStatus _saveStatus = SaveStatus.saved;

  int _wordCount = 0;
  int _charCount = 0;

  _AiStatus _aiContextStatus = _AiStatus.waiting;
  List<GrammarIssue> _activeIssues = [];

  @override
  void initState() {
    super.initState();
    _controller = AiHighlightingTextController(text: widget.initialText);
    _updateMetrics(widget.initialText);

    _controller.addListener(_onTextChanged);
  }

  @override
  void didUpdateWidget(AdvancedDraftingWorkspace oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialText != widget.initialText &&
        _controller.text != widget.initialText &&
        _saveStatus != SaveStatus.unsaved) {
      _controller.text = widget.initialText;
    }
  }

  @override
  void dispose() {
    _saveDebounceTimer?.cancel();
    _aiSuggestionTimer?.cancel();
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    _focusNode.dispose();
    _keyboardListenerFocus.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final text = _controller.text;
    _updateMetrics(text);

    // Clear ghost text immediately when the user starts typing
    if (_controller.ghostText != null) {
      _controller.setGhostText(null);
    }

    // Update local state
    setState(() {
      _saveStatus = SaveStatus.unsaved;
    });

    // Notify provider of local draft change immediately
    ref
        .read(studyPlanSessionProvider.notifier)
        .setDraftContent(widget.documentType, text);

    // AI Ghost Text Debounce (1 second)
    _aiSuggestionTimer?.cancel();
    _aiSuggestionTimer = Timer(const Duration(milliseconds: 1000), () {
      _generateAiSuggestion(text);
    });

    // Auto-save Debounce (2 seconds)
    _saveDebounceTimer?.cancel();
    _saveDebounceTimer = Timer(const Duration(milliseconds: 2000), () {
      _saveDraft(text);
    });
  }

  void _updateMetrics(String text) {
    if (!mounted) return;

    final trimmed = text.trim();
    final wordCount = trimmed.isEmpty
        ? 0
        : trimmed.split(RegExp(r'\s+')).length;

    setState(() {
      _wordCount = wordCount;
      _charCount = text.length;
    });
  }

  Future<bool> _saveDraft(String text) async {
    if (!mounted) return false;

    setState(() {
      _saveStatus = SaveStatus.saving;
    });

    final ok = await ref
        .read(studyPlanSessionProvider.notifier)
        .saveDraft(widget.documentType, text);

    if (mounted) {
      setState(() {
        _saveStatus = ok ? SaveStatus.saved : SaveStatus.error;
      });
    }
    return ok;
  }

  Future<void> _generateAiSuggestion(String text) async {
    if (text.trim().isEmpty) {
      if (mounted) {
        setState(() {
          _aiContextStatus = _AiStatus.waiting;
          _activeIssues = [];
          _controller.setIssues([]);
          _controller.setGhostText(null);
        });
      }
      return;
    }

    // Audit A10 — rate cap. Skip the call if we just made one;
    // _onTextChanged keeps the debounce timer running so we'll
    // re-attempt automatically.
    final now = DateTime.now();
    if (_lastAiCallAt != null &&
        now.difference(_lastAiCallAt!) < _aiMinInterval) {
      if (mounted) {
        setState(() {
          _aiContextStatus = _AiStatus.coolingDown;
        });
      }
      return;
    }
    _lastAiCallAt = now;

    if (mounted) {
      setState(() {
        _aiContextStatus = _AiStatus.analyzing;
      });
    }

    final result = await ref
        .read(studyPlanSessionProvider.notifier)
        .superviseDraft(widget.documentType, text);

    if (!mounted) return;

    if (result == null || result.isEmpty) {
      setState(() {
        _aiContextStatus = _AiStatus.ready;
      });
      return;
    }

    final ghostText = result['ghostText'] as String? ?? '';
    final issuesList = result['issues'] as List<dynamic>? ?? [];

    // Audit A1: delegate to the pure-Dart resolver so the matching
    // behavior is unit-testable.
    final detectedIssues = resolver
        .resolveIssues(draftText: text, rawIssues: issuesList.whereType<Map>())
        .map(
          (r) => GrammarIssue(
            start: r.start,
            end: r.end,
            originalText: r.originalText,
            suggestion: r.suggestion,
          ),
        )
        .toList(growable: false);

    setState(() {
      _aiContextStatus = ghostText.isNotEmpty
          ? _AiStatus.predicting
          : _AiStatus.supervisionActive;
      _activeIssues = detectedIssues;
    });

    _controller.setIssues(detectedIssues);
    _controller.setGhostText(ghostText.isEmpty ? null : ghostText);
  }

  String _aiStatusText(AppLocalizations l) {
    return switch (_aiContextStatus) {
      _AiStatus.waiting => l.aiStatusWaiting,
      _AiStatus.coolingDown => l.aiStatusCoolingDown,
      _AiStatus.analyzing => l.aiStatusAnalyzing,
      _AiStatus.ready => l.aiStatusReady,
      _AiStatus.predicting => l.aiStatusPredicting,
      _AiStatus.supervisionActive => l.aiStatusSupervisionActive,
    };
  }

  void _acceptSuggestion() {
    final ghost = _controller.ghostText;
    if (ghost == null || ghost.isEmpty) return;
    // Audit A2/A3: insert at the cursor instead of appending to the
    // end. If the cursor is unknown (selection.isValid == false), fall
    // back to appending (preserves the prior behaviour).
    final current = _controller.text;
    final sel = _controller.selection;
    if (!sel.isValid || sel.start < 0 || sel.start > current.length) {
      final newText = current + ghost;
      _controller.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: newText.length),
      );
    } else {
      final insertAt = sel.end >= 0 ? sel.end : sel.start;
      final newText =
          current.substring(0, insertAt) + ghost + current.substring(insertAt);
      _controller.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: insertAt + ghost.length),
      );
    }
    _controller.setGhostText(null);
  }

  void _applyGrammarFix(GrammarIssue issue) {
    String currentText = _controller.text;
    String newText =
        currentText.substring(0, issue.start) +
        issue.suggestion +
        currentText.substring(issue.end);

    _controller.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(
        offset: issue.start + issue.suggestion.length,
      ),
    );
    _onTextChanged();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(documentSessionProvider(widget.documentType));
    final currentTrack = state.currentSession?.selectedTrack;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: HangulTag(
                en: l.workspaceTitle,
                ko: '작성 공간',
                titleStyle: SeoulType.subtitle,
              ),
            ),
            const SizedBox(width: 12),
            // The AI's live state. Scaled down rather than clipped so a
            // long localized status never overflows the row.
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 150),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerRight,
                child: StatusChip(
                  label: _aiStatusText(l),
                  tone: StatusTone.lime,
                  dense: true,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_activeIssues.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: SeoulColors.warningFill,
              borderRadius: SeoulRadii.tileR,
              border: Border.all(
                color: SeoulColors.warning.withValues(alpha: 0.45),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: SeoulColors.warningText,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        l.aiSupervisionWarningsTitle,
                        style: SeoulType.subtitle.copyWith(
                          fontSize: 14,
                          color: SeoulColors.warningText,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Capped and scrollable: a long supervision pass can return
                // a dozen issues, and an unbounded Wrap would squeeze the
                // editor off the screen when the keyboard is up.
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 132),
                  child: SingleChildScrollView(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _activeIssues.map((issue) {
                        return _FixChip(
                          label: l.grammarReplaceWith(
                            issue.originalText,
                            issue.suggestion,
                          ),
                          onTap: () => _applyGrammarFix(issue),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: GlassCard(
            padding: const EdgeInsets.all(16),
            // No backdrop blur: this surface is full-height and repaints on
            // every keystroke, and the gradient behind it has nothing worth
            // blurring anyway.
            blur: false,
            child: KeyboardListener(
              focusNode: _keyboardListenerFocus,
              onKeyEvent: (KeyEvent event) {
                if (event is KeyDownEvent &&
                    event.logicalKey == LogicalKeyboardKey.tab &&
                    _controller.ghostText != null) {
                  _acceptSuggestion();
                }
              },
              child: CallbackShortcuts(
                bindings: {
                  const SingleActivator(LogicalKeyboardKey.tab):
                      _acceptSuggestion,
                },
                child: TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  maxLines: null,
                  expands: true,
                  // Audit A7: cap at 12 000 characters. Covers a long
                  // Personal Statement (~5 000) and a maxed-out Study
                  // Plan (~8 000) with headroom, while keeping AI
                  // supervision token cost bounded.
                  maxLength: _maxChars,
                  // Hide the maxLength counter on the field itself; the
                  // LiveMetricsBar already shows word/char counts.
                  maxLengthEnforcement: MaxLengthEnforcement.enforced,
                  buildCounter:
                      (
                        BuildContext context, {
                        required int currentLength,
                        required bool isFocused,
                        required int? maxLength,
                      }) => null,
                  cursorColor: SeoulColors.lime,
                  style: SeoulType.body.copyWith(fontSize: 16, height: 1.5),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    hintText: l.draftingHint(
                      widget.documentTitle.toLowerCase(),
                    ),
                    hintStyle: SeoulType.body.copyWith(
                      fontSize: 16,
                      height: 1.5,
                      color: SeoulColors.textFaint,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        // UI/UX audit P0 K5 (2026-05-12): visible mobile-accessible
        // accept affordance for the AI ghost-text suggestion. The Tab
        // keyboard shortcut above is desktop/web only — phone soft
        // keyboards have no Tab key, so before this bar users could
        // see suggestions but had no way to insert them without
        // retyping. Now the suggestion preview, the entire row, and
        // the explicit "Accept" button are all tap targets that call
        // `_acceptSuggestion`. A dismiss "✕" clears the ghost so the
        // user can keep typing without inserting.
        _GhostSuggestionBar(
          controller: _controller,
          onAccept: _acceptSuggestion,
        ),
        // How much of the 12 000-character allowance is used. The exact
        // counts sit right below in the metrics bar.
        const SizedBox(height: 12),
        GlowProgressBar(value: _charCount / _maxChars),
        const SizedBox(height: 8),
        LiveMetricsBar(
          wordCount: _wordCount,
          charCount: _charCount,
          saveStatus: _saveStatus,
          track: currentTrack,
        ),
        const SizedBox(height: 12),
        // The primary AI action of the whole wizard — kept at the bottom
        // of the column so it stays thumb-reachable above the keyboard.
        LimeButton(
          icon: Icons.auto_awesome,
          label: l.workspaceAnalyzeButton,
          onPressed: () async {
            // Audit A6: previously this fire-and-forgot. If save
            // failed the analyzer ran on a stale draft. Now we wait
            // for the save and bail on failure (the SaveStatus error
            // tag is shown in the LiveMetricsBar).
            final saved = await _saveDraft(_controller.text);
            if (!saved || !mounted) return;
            ref
                .read(studyPlanSessionProvider.notifier)
                .analyzeCurrentDraft(widget.documentType);
            ref
                .read(studyPlanSessionProvider.notifier)
                .updateSessionStep(widget.documentType, 4);
          },
        ),
      ],
    );
  }
}

/// One tappable "replace X with Y" fix from the AI supervision pass.
/// Sized to the 44px minimum even though the pill looks smaller.
class _FixChip extends StatelessWidget {
  const _FixChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: SeoulSizes.minTapTarget),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: SeoulColors.glass,
            // 999 is the design system's pill idiom (see StatusChip).
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: SeoulColors.warning.withValues(alpha: 0.45),
            ),
          ),
          child: Text(
            label,
            style: SeoulType.bodySecondary.copyWith(
              fontSize: 13,
              color: SeoulColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

/// UI/UX audit P0 K5 (2026-05-12): a thin bar that surfaces the
/// currently-pending ghost-text suggestion with a mobile-tappable
/// accept affordance.
///
/// Why this widget exists separately:
///   - Subscribes to the controller via `AnimatedBuilder` so it
///     rebuilds when the ghost text changes, without forcing the
///     surrounding `_AdvancedDraftingWorkspaceState` to rebuild on
///     every keystroke.
///   - Hides itself (renders `SizedBox.shrink()`) when there is no
///     active suggestion, so it takes zero vertical space in the
///     common case.
///   - All three regions (preview text, "Accept" button, dismiss "✕")
///     have ≥ 48 dp tap targets, satisfying M3 / iOS HIG minimums.
///   - Keeps the Tab-key path in `_AdvancedDraftingWorkspaceState`
///     intact for physical-keyboard users on desktop and web; this
///     bar is the mobile path, not a replacement.
class _GhostSuggestionBar extends StatelessWidget {
  const _GhostSuggestionBar({required this.controller, required this.onAccept});

  final AiHighlightingTextController controller;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final ghost = controller.ghostText;
        final hasGhost = ghost != null && ghost.isNotEmpty;
        return AnimatedSize(
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          alignment: Alignment.topCenter,
          child: hasGhost
              ? Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: GestureDetector(
                    onTap: onAccept,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
                      decoration: BoxDecoration(
                        // Lime-tinted glass: this is the AI offering
                        // something, not a warning.
                        color: SeoulColors.limeFill,
                        borderRadius: SeoulRadii.tileR,
                        border: Border.all(
                          color: SeoulColors.lime.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.auto_awesome,
                            size: 16,
                            color: SeoulColors.lime,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Semantics(
                              button: true,
                              label: l.ghostSuggestionSemantics,
                              child: Text(
                                ghost,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: SeoulType.bodySecondary.copyWith(
                                  fontSize: 13,
                                  height: 1.3,
                                  fontStyle: FontStyle.italic,
                                  color: SeoulColors.textPrimary,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Explicit Accept affordance — lime-toned but not
                          // a full LimeButton, so it never competes with the
                          // Analyze action at the bottom of the workspace.
                          _GhostAcceptButton(
                            label: l.ghostAccept,
                            onTap: onAccept,
                          ),
                          // Dismiss — clears the ghost without
                          // inserting, so the user can keep typing.
                          IconButton(
                            onPressed: () => controller.setGhostText(null),
                            icon: const Icon(Icons.close, size: 18),
                            color: SeoulColors.textSecondary,
                            tooltip: l.ghostDismiss,
                            constraints: const BoxConstraints(
                              minWidth: SeoulSizes.minTapTarget,
                              minHeight: SeoulSizes.minTapTarget,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              : const SizedBox.shrink(),
        );
      },
    );
  }
}

/// Compact lime affordance inside the ghost-suggestion bar. 44px minimum
/// so the mobile path stays tappable (audit P0 K5).
class _GhostAcceptButton extends StatelessWidget {
  const _GhostAcceptButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(
            minWidth: 72,
            minHeight: SeoulSizes.minTapTarget,
          ),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: SeoulColors.limeFill,
            borderRadius: SeoulRadii.buttonR,
            border: Border.all(color: SeoulColors.lime),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check, size: 16, color: SeoulColors.lime),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.button.copyWith(
                    fontSize: 13,
                    color: SeoulColors.lime,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

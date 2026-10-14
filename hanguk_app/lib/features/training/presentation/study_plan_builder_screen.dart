import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart' show HardButton, HardShadowBox;
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../assessment/presentation/assessment_widgets.dart' show shortUniversityName;
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../discover/data/slots.dart';
import '../../discover/presentation/filter_board_screen.dart' show fieldLabel;
import '../data/plan_sections.dart';
import '../data/study_plan_repository.dart';
import 'study_plan_screen.dart' show studyPlanErrorMessage;

const String _type = 'study_plan';

/// Design screen 19, "Study Plan — 2-bosqich": the plan written in four parts,
/// one at a time. It runs on the same sessions, drafts and trainer as the
/// older step-by-step screen ([StudyPlanScreen], still used for the personal
/// statement); the four parts are saved as one draft (see [serializePlan]).
class StudyPlanBuilderScreen extends ConsumerStatefulWidget {
  const StudyPlanBuilderScreen({super.key});

  @override
  ConsumerState<StudyPlanBuilderScreen> createState() => _StudyPlanBuilderScreenState();
}

class _StudyPlanBuilderScreenState extends ConsumerState<StudyPlanBuilderScreen> {
  final _controller = TextEditingController();
  final _parts = List<String>.filled(kPlanStepCount, '');
  int _step = 0;
  bool _opening = true;
  bool _failed = false;
  bool _busy = false;
  String? _savedContent;

  // The mic button: the device's own speech recognizer, writing into the box.
  final _speech = SpeechToText();
  bool _listening = false;
  String _dictationBase = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _open());
  }

  @override
  void dispose() {
    if (_listening) _speech.cancel();
    _controller.dispose();
    super.dispose();
  }

  StudyPlanSessionNotifier get _notifier => ref.read(studyPlanSessionProvider.notifier);

  String? get _targetId => ref.read(slotsProvider).firstWhere((id) => id != null, orElse: () => null);

  /// Picks up the student's unfinished plan for the first chosen university,
  /// or starts one.
  Future<void> _open() async {
    final target = _targetId;
    await _notifier.fetchSessions(_type);
    if (!mounted) return;
    final sessions = ref.read(documentSessionProvider(_type)).sessions;
    final mine = sessions.where((s) => s.status != 'completed' && (target == null || s.targetUniversityId == target));
    final existing = mine.isEmpty ? null : mine.first;
    if (existing != null) {
      await _notifier.loadSession(_type, existing.id);
    } else {
      await _notifier.createSession(_type, targetUniversityId: target);
    }
    if (!mounted) return;
    final state = ref.read(documentSessionProvider(_type));
    if (state.currentSession == null) {
      setState(() {
        _opening = false;
        _failed = true;
      });
      return;
    }
    final loaded = parsePlan(state.drafts.isEmpty ? '' : state.drafts.first.content);
    for (var i = 0; i < kPlanStepCount; i++) {
      _parts[i] = loaded[i].length > kPlanMaxChars ? loaded[i].substring(0, kPlanMaxChars) : loaded[i];
    }
    _savedContent = serializePlan(_parts);
    _controller.text = _parts[_step];
    setState(() => _opening = false);
  }

  void _go(int step) {
    _stopDictation();
    _parts[_step] = _controller.text;
    _controller.text = _parts[step];
    _controller.selection = TextSelection.collapsed(offset: _controller.text.length);
    setState(() => _step = step);
  }

  /// Saves the plan as a new draft when it changed since the last save.
  Future<bool> _save() async {
    _parts[_step] = _controller.text;
    final content = serializePlan(_parts);
    if (content == _savedContent) return true;
    if (content.isEmpty) return true;
    final ok = await _notifier.saveDraft(_type, content);
    if (ok) _savedContent = content;
    return ok;
  }

  void _stopDictation() {
    if (!_listening) return;
    _speech.stop();
    setState(() => _listening = false);
  }

  /// Starts or stops dictation into the current part, in the app's language
  /// when the phone's recognizer has it.
  Future<void> _toggleDictation() async {
    if (_listening) {
      _stopDictation();
      return;
    }
    final l = AppLocalizations.of(context)!;
    final messenger = ScaffoldMessenger.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    var ready = false;
    try {
      ready = await _speech.initialize(
        onStatus: (status) {
          if ((status == SpeechToText.doneStatus || status == SpeechToText.notListeningStatus) && mounted) {
            setState(() => _listening = false);
          }
        },
        onError: (_) {
          if (mounted) setState(() => _listening = false);
        },
      );
    } catch (e) {
      debugPrint('speech init failed: $e');
    }
    if (!mounted) return;
    if (!ready) {
      messenger.showSnackBar(SnackBar(content: Text(l.fdPlanDictateUnavailable)));
      return;
    }
    String? localeId;
    try {
      final locales = await _speech.locales();
      localeId = locales.where((x) => x.localeId.toLowerCase().startsWith(lang)).firstOrNull?.localeId;
    } catch (_) {}
    if (!mounted) return;
    AppEvents.track('dictation_start', props: {'step': _step + 1, 'locale': localeId ?? 'device'});
    _dictationBase = _controller.text;
    setState(() => _listening = true);
    await _speech.listen(
      onResult: (r) {
        if (!mounted) return;
        final text = appendDictation(_dictationBase, r.recognizedWords, kPlanMaxChars);
        _controller.value = TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
        setState(() {});
      },
      listenOptions: SpeechListenOptions(
        listenMode: ListenMode.dictation,
        partialResults: true,
        localeId: localeId,
        pauseFor: const Duration(seconds: 5),
        listenFor: const Duration(minutes: 2),
      ),
    );
  }

  Future<void> _feedback() async {
    AppEvents.track('study_plan_feedback', props: {'step': _step + 1});
    _stopDictation();
    final l = AppLocalizations.of(context)!;
    final messenger = ScaffoldMessenger.of(context);
    _parts[_step] = _controller.text;
    if (serializePlan(_parts).isEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(l.fdPlanWriteFirst)));
      return;
    }
    setState(() => _busy = true);
    final saved = await _save();
    StudyPlanAnalysis? analysis;
    if (saved) analysis = await _notifier.analyzeCurrentDraft(_type);
    if (!mounted) return;
    setState(() => _busy = false);
    if (analysis == null) {
      final code = ref.read(documentSessionProvider(_type)).error;
      messenger.showSnackBar(SnackBar(content: Text(studyPlanErrorMessage(l, code ?? ''))));
      _notifier.clearError(_type);
      return;
    }
    final next = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FeedbackSheet(analysis: analysis!, last: _step == kPlanStepCount - 1),
    );
    if (next == true && mounted && _step < kPlanStepCount - 1) _go(_step + 1);
  }

  Future<void> _leave() async {
    _stopDictation();
    final navigator = Navigator.of(context);
    await _save();
    if (navigator.mounted) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final catalog = ref.watch(catalogProvider).value;
    final firstId = ref.watch(slotsProvider).firstWhere((id) => id != null, orElse: () => null);
    final uni = catalog == null || firstId == null
        ? null
        : catalog.where((u) => u.institutionId == firstId).firstOrNull;
    final field = ref.watch(catalogFilterProvider).field;
    final subtitle = [
      if (uni != null) shortUniversityName(uni.displayName),
      if (field != null) fieldLabel(l, field),
    ].join(' · ');

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: true,
        body: FdPage(
          child: SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 14),
                  child: Row(
                    children: [
                      HardIconButton(
                        glyph: LucideIcons.chevronLeft,
                        semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                        onTap: _leave,
                      ),
                      const SizedBox(width: 10),
                      Text(l.fdPlanTitle, style: fdText(18, FontWeight.w800, FdColors.ink, letterSpacing: -0.36)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          subtitle,
                          maxLines: 1,
                          textAlign: TextAlign.right,
                          overflow: TextOverflow.ellipsis,
                          style: fdText(11, FontWeight.w700, FdColors.muted),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _opening
                      ? const Center(child: CircularProgressIndicator(color: FdColors.navy))
                      : _failed
                      ? _Failed(
                          onRetry: () {
                            setState(() {
                              _opening = true;
                              _failed = false;
                            });
                            _open();
                          },
                        )
                      : _body(l),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(AppLocalizations l) {
    final heads = [l.fdPlanQ1Head, l.fdPlanQ2Head, l.fdPlanQ3Head, l.fdPlanQ4Head];
    final marks = [l.fdPlanQ1Mark, l.fdPlanQ2Mark, l.fdPlanQ3Mark, l.fdPlanQ4Mark];
    final hints = [l.fdPlanQ1Hint, l.fdPlanQ2Hint, l.fdPlanQ3Hint, l.fdPlanQ4Hint];
    final labels = [l.fdPlanStepGoal, l.fdPlanStepKorea, l.fdPlanStepUni, l.fdPlanStepFuture];
    final title = fdText(20, FontWeight.w800, FdColors.ink, height: 1.15, letterSpacing: -0.4);

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Row(
                  children: [
                    for (var i = 0; i < kPlanStepCount; i++) ...[
                      if (i > 0) const SizedBox(width: 6),
                      Expanded(
                        child: _StepChip(
                          number: i + 1,
                          label: labels[i],
                          state: i == _step
                              ? _ChipState.active
                              : (i == _step ? _controller.text : _parts[i]).trim().length >= kPlanMinChars
                              ? _ChipState.done
                              : _ChipState.ahead,
                          onTap: () => _go(i),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                child: HardShadowBox(
                  fill: FdColors.card,
                  radius: 18,
                  offset: 4,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l.fdPlanStepOf(_step + 1, kPlanStepCount),
                          style: fdText(11, FontWeight.w700, FdColors.muted),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.end,
                          children: [
                            if (heads[_step].isNotEmpty) Text('${heads[_step]} ', style: title),
                            LimeMark(marks[_step], style: title),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(hints[_step], style: fdText(12, FontWeight.w400, FdColors.muted, height: 1.45)),
                        const SizedBox(height: 10),
                        _Field(controller: _controller, hint: l.fdPlanHintField, onChanged: () => setState(() {})),
                        if (_listening) ...[
                          const SizedBox(height: 8),
                          Semantics(
                            liveRegion: true,
                            child: Text(l.fdPlanListening, style: fdText(11, FontWeight.w700, FdColors.good)),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7E6),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: FdColors.ink, width: 1.5),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('⚠️', style: TextStyle(fontSize: 16, height: 1.2)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l.fdPlanWarnTitle, style: fdText(12, FontWeight.w800, FdColors.ink)),
                            const SizedBox(height: 2),
                            Text(l.fdPlanWarnBody, style: fdText(11, FontWeight.w400, FdColors.muted, height: 1.45)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        FdBottomBar(
          child: Row(
            children: [
              _MicButton(
                listening: _listening,
                label: _listening ? l.fdPlanDictateStop : l.fdPlanDictate,
                onTap: _busy ? null : _toggleDictation,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: HardButton(
                  label: _busy ? l.fdPlanFeedbackBusy : l.fdPlanFeedback,
                  loading: _busy,
                  onPressed: _busy ? null : _feedback,
                  leading: const Lucide(LucideIcons.sparkles, size: 16, color: FdColors.onLime),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The 52px mic square left of the main button; lime while it listens.
class _MicButton extends StatelessWidget {
  const _MicButton({required this.listening, required this.label, required this.onTap});

  final bool listening;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    toggled: listening,
    label: label,
    excludeSemantics: true,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 52,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: listening ? FdColors.lime : FdColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
        child: Lucide(listening ? LucideIcons.micOff : LucideIcons.mic, size: 20, color: FdColors.ink),
      ),
    ),
  );
}

enum _ChipState { done, active, ahead }

class _StepChip extends StatelessWidget {
  const _StepChip({required this.number, required this.label, required this.state, required this.onTap});

  final int number;
  final String label;
  final _ChipState state;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (state) {
      _ChipState.done => (FdColors.ink, FdColors.lime),
      _ChipState.active => (FdColors.lime, FdColors.onLime),
      _ChipState.ahead => (FdColors.card, FdColors.muted),
    };
    return Semantics(
      button: true,
      selected: state == _ChipState.active,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(state == _ChipState.done ? '✓' : '$number', style: fdText(12, FontWeight.w800, fg, height: 1.1)),
              const SizedBox(height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(label, maxLines: 1, style: fdText(8, FontWeight.w700, fg, height: 1.1)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The text box: a 132px-high panel on the page's colour with the count in
/// its corner.
class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.hint, required this.onChanged});

  final TextEditingController controller;
  final String hint;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 132),
      decoration: BoxDecoration(
        color: FdColors.page,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Stack(
        children: [
          TextField(
            controller: controller,
            onChanged: (_) => onChanged(),
            minLines: 5,
            maxLines: null,
            maxLength: kPlanMaxChars,
            inputFormatters: [LengthLimitingTextInputFormatter(kPlanMaxChars)],
            keyboardType: TextInputType.multiline,
            textCapitalization: TextCapitalization.sentences,
            cursorColor: FdColors.ink,
            style: fdText(13, FontWeight.w400, FdColors.ink, height: 1.5),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: fdText(13, FontWeight.w400, FdColors.muted, height: 1.5),
              counterText: '',
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              filled: false,
              contentPadding: const EdgeInsets.fromLTRB(12, 10, 12, 26),
            ),
          ),
          Positioned(
            right: 10,
            bottom: 8,
            child: IgnorePointer(
              child: Text(
                '${controller.text.length} / $kPlanMaxChars',
                style: fdText(10, FontWeight.w700, FdColors.muted),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l.fdPlanLoadFailed,
              textAlign: TextAlign.center,
              style: fdText(13, FontWeight.w700, FdColors.ink, height: 1.4),
            ),
            const SizedBox(height: 14),
            HardChoice(
              label: l.commonRetry,
              selected: false,
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 24),
              onTap: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}

/// What the trainer said about the plan, on a white sheet over the page.
class _FeedbackSheet extends StatelessWidget {
  const _FeedbackSheet({required this.analysis, required this.last});

  final StudyPlanAnalysis analysis;
  final bool last;

  static List<String> _lines(List<dynamic>? items) => [
    for (final i in items ?? const [])
      if (i is String && i.trim().isNotEmpty) i.trim(),
  ];

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final strengths = _lines(analysis.strengths);
    final improvements = _lines(analysis.improvements);
    final summary = (analysis.contentFeedback ?? '').trim();
    final prose = strengths.isEmpty && improvements.isEmpty && summary.isEmpty
        ? (analysis.aiResponse ?? '').trim()
        : '';
    final body = fdText(13, FontWeight.w400, FdColors.ink, height: 1.5);

    Widget block(String title, List<String> lines) => Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: fdText(12, FontWeight.w800, FdColors.muted)),
          const SizedBox(height: 4),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: body),
                  Expanded(child: Text(line, style: body)),
                ],
              ),
            ),
        ],
      ),
    );

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (context, scroll) => Container(
        decoration: const BoxDecoration(
          color: FdColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
            top: BorderSide(color: FdColors.ink, width: 1.5),
            left: BorderSide(color: FdColors.ink, width: 1.5),
            right: BorderSide(color: FdColors.ink, width: 1.5),
          ),
        ),
        child: Column(
          children: [
            Expanded(
              child: ListView(
                controller: scroll,
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
                children: [
                  Text(l.fdPlanSheetTitle, style: fdText(20, FontWeight.w800, FdColors.ink, letterSpacing: -0.4)),
                  if (summary.isNotEmpty) ...[const SizedBox(height: 10), Text(summary, style: body)],
                  if (strengths.isNotEmpty) block(l.fdPlanStrengths, strengths),
                  if (improvements.isNotEmpty) block(l.fdPlanImprove, improvements),
                  if (prose.isNotEmpty) ...[const SizedBox(height: 10), Text(prose, style: body)],
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, MediaQuery.paddingOf(context).bottom + 16),
              child: HardButton(
                label: last ? l.fdPlanClose : l.fdPlanNext,
                onPressed: () => Navigator.of(context).pop(!last),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/tracked.dart';
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
import '../data/study_plan_cache.dart';
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

  /// Until [StudyPlanSessionNotifier.openLatest] answers the plan has no
  /// session: the box is read-only, the mic and the feedback are off and
  /// nothing is saved — nothing can be typed that would then be lost.
  bool _opening = true;
  bool _failed = false;

  /// The phone's copy of the plan is on screen while it opens.
  bool _fromCopy = false;
  bool _busy = false;
  String? _savedContent;

  /// Where this plan's phone copy is kept; null when no one is signed in.
  String? _copyKey;

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
  /// or starts one — in one request ([StudyPlanSessionNotifier.openLatest]).
  /// Meanwhile the phone's copy of its text (kept on every open and save) is
  /// shown at once, read-only, instead of the skeleton; the server's newest
  /// draft then takes its place.
  Future<void> _open() async {
    // `data_ready` prepare.study_plan: the open to the plan's text — the
    // phone's copy ('saved', when it is shown) and the server's ('network',
    // or 'failed'). Tayyorgarlik T3: it took up to five requests one after
    // another.
    final clock = Stopwatch()..start();
    final target = _targetId;
    final user = _notifier.userId;
    final key = _copyKey = user == null
        ? null
        : studyPlanCopyKey(userId: user, type: _type, targetUniversityId: target);
    var answered = false;
    final opened = _notifier.openLatest(_type, targetUniversityId: target).whenComplete(() {
      answered = true;
    });
    if (key != null) {
      unawaited(
        ref.read(studyPlanCacheProvider).read(key).then((copy) {
          // Only while it spares a wait: before the server has answered.
          if (copy == null || copy.content.trim().isEmpty || answered || !mounted) return;
          _fill(copy.content);
          setState(() => _fromCopy = true);
          AppEvents.track(
            'data_ready',
            props: {
              'name': 'prepare.study_plan',
              'source': 'saved',
              'ms': clock.elapsedMilliseconds,
              'age_h': DateTime.now().difference(copy.savedAt).inHours,
            },
          );
        }),
      );
    }
    final session = await opened;
    AppEvents.track(
      'data_ready',
      props: {'name': 'prepare.study_plan', 'source': session == null ? 'failed' : 'network', 'ms': clock.elapsedMilliseconds},
    );
    if (!mounted) return;
    if (session == null) {
      setState(() {
        _opening = false;
        _failed = true;
        _fromCopy = false;
      });
      return;
    }
    // The server is the source of truth: its newest draft replaces the copy.
    final newest = ref.read(documentSessionProvider(_type)).drafts.firstOrNull;
    final content = newest?.content ?? '';
    _fill(content);
    _savedContent = serializePlan(_parts);
    setState(() {
      _opening = false;
      _fromCopy = false;
    });
    _keepCopy(session.id, newest?.version ?? 0, content);
  }

  /// [content] (a draft) into the four parts, each cut to what a part may
  /// hold, and the part on screen into the box.
  void _fill(String content) {
    final loaded = parsePlan(content);
    for (var i = 0; i < kPlanStepCount; i++) {
      _parts[i] = loaded[i].length > kPlanMaxChars ? loaded[i].substring(0, kPlanMaxChars) : loaded[i];
    }
    _controller.text = _parts[_step];
  }

  /// Keeps [content] — the server's newest draft, [version] of [sessionId] —
  /// as the phone's copy for the next open.
  void _keepCopy(String sessionId, int version, String content) {
    final key = _copyKey;
    if (key == null) return;
    final copy = StudyPlanCopy(sessionId: sessionId, version: version, content: content, savedAt: DateTime.now());
    unawaited(ref.read(studyPlanCacheProvider).write(key, copy));
  }

  void _go(int step) {
    _stopDictation();
    _parts[_step] = _controller.text;
    _controller.text = _parts[step];
    _controller.selection = TextSelection.collapsed(offset: _controller.text.length);
    setState(() => _step = step);
  }

  /// Saves the plan as a new draft when it changed since the last save, and
  /// keeps it as the phone's copy. Nothing is saved before the plan's session
  /// is open: the copy on screen meanwhile is read-only.
  Future<bool> _save() async {
    if (_opening || _failed) return true;
    _parts[_step] = _controller.text;
    final content = serializePlan(_parts);
    if (content == _savedContent) return true;
    if (content.isEmpty) return true;
    final ok = await _notifier.saveDraft(_type, content);
    if (ok) {
      _savedContent = content;
      if (mounted) {
        // The version just saved: saveDraft puts the new draft in the state.
        final plan = ref.read(documentSessionProvider(_type));
        final session = plan.currentSession;
        final version = plan.drafts.fold<int>(0, (v, d) => d.version > v ? d.version : v);
        if (session != null) _keepCopy(session.id, version, content);
      }
    }
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
                        onTap: tracked('study_plan_builder.leave', _leave),
                      ),
                      const SizedBox(width: 10),
                      Text(l.fdPlanTitle, style: fdText(18, FontWeight.w800, FdColors.onPage, letterSpacing: -0.36)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          subtitle,
                          maxLines: 1,
                          textAlign: TextAlign.right,
                          overflow: TextOverflow.ellipsis,
                          style: fdText(11, FontWeight.w700, FdColors.pageMuted),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _failed
                      ? _Failed(
                          onRetry: tracked('study_plan_builder.failed_retry', () {
                            setState(() {
                              _opening = true;
                              _failed = false;
                            });
                            _open();
                          }),
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

  /// Everything under the header — the step chips, the part's card, the
  /// warning and the bottom bar — for the plan and its skeleton alike. While
  /// the plan opens with no copy on the phone the box is a skeleton (canvas
  /// board 6: grey bars where the text will be, not a spinner); until it is
  /// open the box is read-only and the bar is dimmed and off.
  Widget _body(AppLocalizations l) {
    final skeleton = _opening && !_fromCopy;
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
                              : !skeleton && (i == _step ? _controller.text : _parts[i]).trim().length >= kPlanMinChars
                              ? _ChipState.done
                              : _ChipState.ahead,
                          onTap: tracked('study_plan_builder.step_chip', skeleton ? null : () => _go(i)),
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
                        if (skeleton)
                          StudyPlanFieldSkeleton(label: l.loadingLabel)
                        else
                          StudyPlanField(
                            controller: _controller,
                            hint: l.fdPlanHintField,
                            readOnly: _opening,
                            onChanged: () => setState(() {}),
                          ),
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
        Opacity(
          opacity: _opening ? 0.5 : 1,
          child: FdBottomBar(
            child: Row(
              children: [
                _MicButton(
                  listening: _listening,
                  label: _listening ? l.fdPlanDictateStop : l.fdPlanDictate,
                  onTap: tracked('study_plan_builder.mic_button', _busy || _opening ? null : _toggleDictation),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: HardButton(
                    label: _busy ? l.fdPlanFeedbackBusy : l.fdPlanFeedback,
                    loading: _busy,
                    onPressed: tracked('study_plan_builder.plan_feedback_busy', _busy || _opening ? null : _feedback),
                    leading: const Lucide(LucideIcons.sparkles, size: 16, color: FdColors.onLime),
                  ),
                ),
              ],
            ),
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
    enabled: onTap != null,
    toggled: listening,
    label: label,
    excludeSemantics: true,
    child: GestureDetector(
      onTap: tracked('study_plan_builder.mic_button', onTap),
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

  /// Null while the plan's skeleton is shown: there is no part to go to yet.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (state) {
      _ChipState.done => (FdColors.ink, FdColors.lime),
      _ChipState.active => (FdColors.lime, FdColors.onLime),
      _ChipState.ahead => (FdColors.card, FdColors.muted),
    };
    return Semantics(
      button: true,
      enabled: onTap != null,
      selected: state == _ChipState.active,
      child: GestureDetector(
        onTap: tracked('study_plan_builder.step_chip', onTap),
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

/// The text box: a 132px-high white card with the count in its corner.
///
/// White, not the page's colour: the text is [FdColors.ink], and since the
/// page went dark blue (#432) ink on the page was dark-on-dark — students
/// typed their plan and saw nothing. The field must stay a light surface for
/// as long as its text is ink (guarded by `text_contrast_test.dart`).
/// Public only so that test can pump it on its own.
class StudyPlanField extends StatelessWidget {
  const StudyPlanField({
    super.key,
    required this.controller,
    required this.hint,
    required this.onChanged,
    this.readOnly = false,
  });

  final TextEditingController controller;
  final String hint;
  final VoidCallback onChanged;

  /// While the plan opens from the phone's copy: shown, not yet typed in.
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 132),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Stack(
        children: [
          TextSelectionTheme(
            data: kLightFieldSelection,
            child: TextField(
            controller: controller,
            readOnly: readOnly,
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

/// The text box while the plan opens with no copy on the phone (canvas board
/// 6, "Study Plan ochilmoqda"): white with an ink border, and three grey bars
/// where the text will be — the screen keeps its shape instead of a spinner.
/// Public only so the tests can find it.
class StudyPlanFieldSkeleton extends StatelessWidget {
  const StudyPlanFieldSkeleton({super.key, required this.label});

  /// What a screen reader says for it.
  final String label;

  /// The bars' widths, as fractions of the box's inside.
  static const List<double> bars = [0.92, 0.78, 0.55];

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(minHeight: 150),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: FdColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < bars.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              FractionallySizedBox(
                widthFactor: bars[i],
                child: Container(
                  height: 10,
                  decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(5)),
                ),
              ),
            ],
          ],
        ),
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
            // On the page, not on a card: white (canvas board 7). It was ink,
            // dark on the dark-blue page — the message could not be read.
            Text(
              l.fdPlanLoadFailed,
              textAlign: TextAlign.center,
              style: fdText(13, FontWeight.w700, FdColors.onPage, height: 1.4),
            ),
            const SizedBox(height: 14),
            // Board 7's button: as wide as its label, centred by the column,
            // with a 3px hard shadow (no `alignment`: that would fill the row).
            Semantics(
              button: true,
              label: l.commonRetry,
              excludeSemantics: true,
              child: GestureDetector(
                onTap: tracked('study_plan_builder.failed_retry', onRetry),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  decoration: BoxDecoration(
                    color: FdColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: FdColors.ink, width: 1.5),
                    boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
                  ),
                  child: Center(
                    widthFactor: 1,
                    child: Text(l.commonRetry, style: fdText(14, FontWeight.w800, FdColors.ink)),
                  ),
                ),
              ),
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
                onPressed: tracked('study_plan_builder.plan_close', () => Navigator.of(context).pop(!last)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

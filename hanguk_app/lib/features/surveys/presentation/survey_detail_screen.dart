import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/survey_repository.dart';
import '../domain/survey_text.dart';

/// True when an answer actually carries a value. A field the student typed
/// into and then cleared leaves an empty string behind, which must not pass
/// as an answer to a required question.
bool _hasValue(dynamic answer) {
  if (answer == null) return false;
  if (answer is String) return answer.trim().isNotEmpty;
  if (answer is List) return answer.isNotEmpty;
  return true;
}

/* There is deliberately no format check here.
 *
 * A typed field exists to raise the right keyboard, not to police what the
 * student writes. The first real survey asked "write 2 phone numbers" in one
 * phone field; a one-number rule rejected the answer the question asked for
 * and there was no way past it. Staff read these answers themselves, so a
 * wrong-looking phone number costs a glance — a blocked submit costs the
 * whole response. Required-ness is still enforced in _submit. */

class SurveyDetailScreen extends ConsumerStatefulWidget {
  const SurveyDetailScreen({
    super.key,
    required this.surveyId,
    this.surveyTitle,
  });

  final String surveyId;
  final String? surveyTitle;

  @override
  ConsumerState<SurveyDetailScreen> createState() =>
      _SurveyDetailScreenState();
}

class _SurveyDetailScreenState extends ConsumerState<SurveyDetailScreen> {
  final Map<String, dynamic> _answers = {};
  bool _submitting = false;
  bool _submitted = false;

  bool _isAnswered(SurveyQuestion q) =>
      _answers.containsKey(q.id) ? _hasValue(_answers[q.id]) : q.hasAnswer;

  void _warn(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: SeoulType.body.copyWith(color: SeoulColors.ink),
        ),
        backgroundColor: SeoulColors.lime,
      ),
    );
  }

  Future<void> _submit(List<SurveyQuestion> questions) async {
    if (questions.any((q) => q.isRequired && !_isAnswered(q))) {
      _warn(AppLocalizations.of(context)!.surveyAnswerAllRequired);
      return;
    }

    setState(() => _submitting = true);

    try {
      for (final entry in _answers.entries) {
        // An optional field the student opened and left blank has nothing to
        // store; writing "" would just look like a real answer in the CRM.
        if (!_hasValue(entry.value)) continue;
        await submitSurveyResponse(
          surveyId: widget.surveyId,
          questionId: entry.key,
          answer: entry.value,
        );
      }
      ref.invalidate(activeSurveysProvider);
      ref.invalidate(surveyQuestionsProvider(widget.surveyId));
      if (mounted) {
        setState(() {
          _submitted = true;
          _submitting = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context)!.surveySubmitError,
              style: SeoulType.body.copyWith(color: SeoulColors.textPrimary),
            ),
            backgroundColor: SeoulColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final questionsAsync =
        ref.watch(surveyQuestionsProvider(widget.surveyId));

    return SeoulNightScaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: SeoulColors.textPrimary),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/surveys');
            }
          },
        ),
        title: Text(
          widget.surveyTitle ?? l.surveyTitleFallback,
          style: SeoulType.subtitle,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: _submitted ? _buildSuccess(l) : _buildQuestions(l, questionsAsync),
    );
  }

  Widget _buildSuccess(AppLocalizations l) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const HangulGlyphTile(glyph: '감', size: 56),
            const SizedBox(height: 18),
            Text(l.surveyThanksTitle, style: SeoulType.title),
            const SizedBox(height: 8),
            Text(
              l.surveyThanksBody,
              style: SeoulType.bodySecondary,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SeoulOutlineButton(
              label: l.a11yTooltipBack,
              expand: false,
              onPressed: () {
                if (Navigator.of(context).canPop()) {
                  Navigator.of(context).pop();
                } else {
                  context.go('/surveys');
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestions(
    AppLocalizations l,
    AsyncValue<List<SurveyQuestion>> questionsAsync,
  ) {
    return questionsAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: SeoulColors.lime),
      ),
      error: (_, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(SeoulSizes.screenPadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l.surveyQuestionsLoadError,
                style: SeoulType.body,
              ),
              const SizedBox(height: 16),
              SeoulOutlineButton(
                label: l.commonRetry,
                expand: false,
                onPressed: () => ref.invalidate(
                  surveyQuestionsProvider(widget.surveyId),
                ),
              ),
            ],
          ),
        ),
      ),
      data: (questions) {
        if (questions.isEmpty) {
          return Center(
            child: Text(l.surveyNoQuestions, style: SeoulType.bodySecondary),
          );
        }

        final allAnswered = questions.every(
          (q) => !q.isRequired || _isAnswered(q),
        );

        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(
            SeoulSizes.screenPadding,
            16,
            SeoulSizes.screenPadding,
            SeoulSizes.orbClearance,
          ),
          itemCount: questions.length + 1,
          itemBuilder: (context, index) {
            if (index == questions.length) {
              if (questions.every((q) => q.hasAnswer) && _answers.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Center(
                    child: Column(
                      children: [
                        StatusChip(
                          label: l.surveyCompletedChip,
                          tone: StatusTone.success,
                          ko: '완료',
                        ),
                        const SizedBox(height: 12),
                        Text(
                          l.surveyAlreadyCompleted,
                          style: SeoulType.bodySecondary,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                );
              }
              return Padding(
                padding: const EdgeInsets.only(top: 24),
                child: LimeButton(
                  label: l.surveySubmit,
                  loading: _submitting,
                  onPressed:
                      allAnswered ? () => _submit(questions) : null,
                ),
              );
            }

            final question = questions[index];
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: _QuestionCard(
                index: index + 1,
                question: question,
                currentAnswer: _answers[question.id] ?? question.existingAnswer,
                onChanged: (value) {
                  setState(() => _answers[question.id] = value);
                },
              ),
            );
          },
        );
      },
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.index,
    required this.question,
    this.currentAnswer,
    required this.onChanged,
  });

  final int index;
  final SurveyQuestion question;
  final dynamic currentAnswer;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final lang = Localizations.localeOf(context).languageCode;
    return GlassCard(
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HangulGlyphTile(
                glyph: index.toString(),
                size: 32,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      surveyText(
                        question.questionTextTranslations,
                        question.questionText,
                        lang,
                      ),
                      style: SeoulType.subtitle,
                    ),
                    if (question.isRequired)
                      Text(l.surveyRequired, style: SeoulType.caption.copyWith(
                        color: SeoulColors.lime,
                      )),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInput(l, lang),
        ],
      ),
    );
  }

  /// Label for an option; the Uzbek [option] itself stays the stored value.
  String _optionLabel(String option, String lang) =>
      surveyText(question.optionTranslations[option], option, lang);

  Widget _buildInput(AppLocalizations l, String lang) {
    switch (question.questionType) {
      case 'single_choice':
        return _buildSingleChoice(lang);
      case 'multiple_choice':
        return _buildMultipleChoice(lang);
      case 'rating':
        return _buildRating();
      case 'date':
        return _DateAnswerField(
          value: currentAnswer is String ? currentAnswer as String : null,
          placeholder: l.surveyPickDate,
          onChanged: onChanged,
        );
      case 'email':
        return _buildTextInput(
          hint: l.surveyEmailHint,
          keyboardType: TextInputType.emailAddress,
          maxLines: 1,
        );
      case 'phone':
        return _buildTextInput(
          hint: '+998 90 123 45 67',
          keyboardType: TextInputType.phone,
          maxLines: 1,
        );
      case 'number':
        return _buildTextInput(
          hint: l.surveyNumberHint,
          keyboardType: TextInputType.number,
          maxLines: 1,
        );
      case 'long_text':
        return _buildTextInput(hint: l.surveyLongTextHint, maxLines: 6);
      case 'text':
      default:
        return _buildTextInput(hint: l.surveyTextHint, maxLines: 3);
    }
  }

  Widget _buildSingleChoice(String lang) {
    final options = question.options ?? [];
    final selected = currentAnswer is String ? currentAnswer as String : null;

    return Column(
      children: options.map((option) {
        final isSelected = selected == option;
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            borderColor:
                isSelected ? SeoulColors.lime.withValues(alpha: 0.5) : null,
            fillColor: isSelected
                ? SeoulColors.lime.withValues(alpha: 0.08)
                : null,
            onTap: () => onChanged(option),
            child: Row(
              children: [
                Icon(
                  isSelected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  size: 20,
                  color: isSelected ? SeoulColors.lime : SeoulColors.textFaint,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(_optionLabel(option, lang), style: SeoulType.body),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildMultipleChoice(String lang) {
    final options = question.options ?? [];
    List<String> selected = [];
    if (currentAnswer is List) {
      selected = (currentAnswer as List).cast<String>();
    }

    return Column(
      children: options.map((option) {
        final isSelected = selected.contains(option);
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            borderColor:
                isSelected ? SeoulColors.lime.withValues(alpha: 0.5) : null,
            fillColor: isSelected
                ? SeoulColors.lime.withValues(alpha: 0.08)
                : null,
            onTap: () {
              final next = List<String>.from(selected);
              if (isSelected) {
                next.remove(option);
              } else {
                next.add(option);
              }
              onChanged(next);
            },
            child: Row(
              children: [
                Icon(
                  isSelected
                      ? Icons.check_box
                      : Icons.check_box_outline_blank,
                  size: 20,
                  color: isSelected ? SeoulColors.lime : SeoulColors.textFaint,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(_optionLabel(option, lang), style: SeoulType.body),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRating() {
    final value = currentAnswer is int
        ? currentAnswer as int
        : currentAnswer is double
            ? (currentAnswer as double).round()
            : 0;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(5, (i) {
        final star = i + 1;
        final isActive = star <= value;
        return GestureDetector(
          onTap: () => onChanged(star),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Icon(
              isActive ? Icons.star_rounded : Icons.star_outline_rounded,
              size: 40,
              color: isActive ? SeoulColors.lime : SeoulColors.textFaint,
            ),
          ),
        );
      }),
    );
  }

  Widget _buildTextInput({
    required String hint,
    required int maxLines,
    TextInputType? keyboardType,
  }) {
    return _TextAnswerField(
      key: ValueKey(question.id),
      initialValue: currentAnswer is String ? currentAnswer as String : '',
      onChanged: onChanged,
      hint: hint,
      maxLines: maxLines,
      keyboardType: keyboardType,
    );
  }
}

class _TextAnswerField extends StatefulWidget {
  const _TextAnswerField({
    super.key,
    required this.initialValue,
    required this.onChanged,
    required this.hint,
    required this.maxLines,
    this.keyboardType,
  });

  final String initialValue;
  final ValueChanged<dynamic> onChanged;
  final String hint;
  final int maxLines;
  final TextInputType? keyboardType;

  @override
  State<_TextAnswerField> createState() => _TextAnswerFieldState();
}

class _TextAnswerFieldState extends State<_TextAnswerField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: (value) => widget.onChanged(value),
      maxLines: widget.maxLines,
      keyboardType: widget.keyboardType,
      style: SeoulType.body,
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: SeoulType.bodySecondary,
        filled: true,
        fillColor: SeoulColors.glass,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SeoulRadii.control),
          borderSide: BorderSide(color: SeoulColors.glassBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SeoulRadii.control),
          borderSide: BorderSide(color: SeoulColors.glassBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SeoulRadii.control),
          borderSide: const BorderSide(color: SeoulColors.lime),
        ),
      ),
    );
  }
}

class _DateAnswerField extends StatelessWidget {
  const _DateAnswerField({
    required this.value,
    required this.placeholder,
    required this.onChanged,
  });

  final String? value;
  final String placeholder;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    final parsed = value != null && value!.isNotEmpty
        ? DateTime.tryParse(value!)
        : null;

    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      onTap: () async {
        final now = DateTime.now();
        final picked = await showDatePicker(
          context: context,
          initialDate: parsed ?? DateTime(now.year - 18),
          firstDate: DateTime(1940),
          lastDate: DateTime(now.year + 10),
        );
        if (picked != null) {
          onChanged(
            '${picked.year.toString().padLeft(4, '0')}-'
            '${picked.month.toString().padLeft(2, '0')}-'
            '${picked.day.toString().padLeft(2, '0')}',
          );
        }
      },
      child: Row(
        children: [
          const Icon(
            Icons.calendar_today_rounded,
            size: 18,
            color: SeoulColors.textFaint,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              parsed != null ? value! : placeholder,
              style: parsed != null ? SeoulType.body : SeoulType.bodySecondary,
            ),
          ),
        ],
      ),
    );
  }
}

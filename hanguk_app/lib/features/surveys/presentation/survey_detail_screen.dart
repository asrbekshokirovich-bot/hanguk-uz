import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../data/survey_repository.dart';

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

  Future<void> _submit(List<SurveyQuestion> questions) async {
    final unanswered = questions.where(
      (q) => q.isRequired && !q.hasAnswer && !_answers.containsKey(q.id),
    );
    if (unanswered.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Barcha majburiy savollarga javob bering",
            style: SeoulType.body.copyWith(color: SeoulColors.ink),
          ),
          backgroundColor: SeoulColors.lime,
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      for (final entry in _answers.entries) {
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
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Xatolik yuz berdi: $e',
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
          widget.surveyTitle ?? "So'rovnoma",
          style: SeoulType.subtitle,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: _submitted ? _buildSuccess() : _buildQuestions(questionsAsync),
    );
  }

  Widget _buildSuccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const HangulGlyphTile(glyph: '감', size: 56),
            const SizedBox(height: 18),
            Text('Rahmat!', style: SeoulType.title),
            const SizedBox(height: 8),
            Text(
              "Javoblaringiz qabul qilindi",
              style: SeoulType.bodySecondary,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SeoulOutlineButton(
              label: 'Orqaga',
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

  Widget _buildQuestions(AsyncValue<List<SurveyQuestion>> questionsAsync) {
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
                'Savollarni yuklashda xatolik',
                style: SeoulType.body,
              ),
              const SizedBox(height: 16),
              SeoulOutlineButton(
                label: 'Qayta urinish',
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
            child: Text('Savollar topilmadi', style: SeoulType.bodySecondary),
          );
        }

        final allAnswered = questions.every(
          (q) => !q.isRequired || q.hasAnswer || _answers.containsKey(q.id),
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
                        const StatusChip(
                          label: 'Bajarilgan',
                          tone: StatusTone.success,
                          ko: '완료',
                        ),
                        const SizedBox(height: 12),
                        Text(
                          "Siz bu so'rovnomani allaqachon to'ldirdingiz",
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
                  label: 'Yuborish',
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
                    Text(question.questionText, style: SeoulType.subtitle),
                    if (question.isRequired)
                      Text('Majburiy', style: SeoulType.caption.copyWith(
                        color: SeoulColors.lime,
                      )),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildInput() {
    switch (question.questionType) {
      case 'single_choice':
        return _buildSingleChoice();
      case 'multiple_choice':
        return _buildMultipleChoice();
      case 'rating':
        return _buildRating();
      case 'text':
      default:
        return _buildTextInput();
    }
  }

  Widget _buildSingleChoice() {
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
                  child: Text(option, style: SeoulType.body),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildMultipleChoice() {
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
                  child: Text(option, style: SeoulType.body),
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

  Widget _buildTextInput() {
    return _TextAnswerField(
      initialValue: currentAnswer is String ? currentAnswer as String : '',
      onChanged: onChanged,
    );
  }
}

class _TextAnswerField extends StatefulWidget {
  const _TextAnswerField({
    required this.initialValue,
    required this.onChanged,
  });

  final String initialValue;
  final ValueChanged<dynamic> onChanged;

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
      maxLines: 3,
      style: SeoulType.body,
      decoration: InputDecoration(
        hintText: 'Javobingizni yozing...',
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

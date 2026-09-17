import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../data/survey_repository.dart';

class SurveysScreen extends ConsumerWidget {
  const SurveysScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final surveysAsync = ref.watch(activeSurveysProvider);

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
              context.go('/');
            }
          },
        ),
        title: const HangulTag(en: 'Surveys', ko: '설문조사'),
      ),
      body: surveysAsync.when(
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
                  "So'rovnomalarni yuklashda xatolik",
                  style: SeoulType.body,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                SeoulOutlineButton(
                  label: 'Qayta urinish',
                  expand: false,
                  onPressed: () => ref.invalidate(activeSurveysProvider),
                ),
              ],
            ),
          ),
        ),
        data: (surveys) {
          if (surveys.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(SeoulSizes.screenPadding),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const HangulGlyphTile(glyph: '설', size: 56),
                    const SizedBox(height: 18),
                    Text(
                      "Hozircha so'rovnomalar yo'q",
                      style: SeoulType.title,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "Yangi so'rovnomalar paydo bo'lganda bu yerda ko'rsatiladi",
                      style: SeoulType.bodySecondary,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              24,
              SeoulSizes.screenPadding,
              SeoulSizes.orbClearance,
            ),
            itemCount: surveys.length,
            itemBuilder: (context, index) {
              final survey = surveys[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _SurveyCard(survey: survey),
              );
            },
          );
        },
      ),
    );
  }
}

class _SurveyCard extends StatelessWidget {
  const _SurveyCard({required this.survey});

  final Survey survey;

  @override
  Widget build(BuildContext context) {
    final isCompleted = survey.isCompleted;

    return GlassCard(
      blur: false,
      borderColor: isCompleted ? SeoulColors.lime.withValues(alpha: 0.3) : null,
      onTap: () => context.push('/surveys/${survey.id}', extra: survey.title),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(survey.title, style: SeoulType.subtitle),
              ),
              const SizedBox(width: 8),
              if (isCompleted)
                const StatusChip(label: 'Bajarildi', tone: StatusTone.success, ko: '완료')
              else if (survey.answeredCount > 0)
                StatusChip(
                  label: '${survey.answeredCount}/${survey.questionCount}',
                  tone: StatusTone.warning,
                )
              else
                const StatusChip(label: 'Yangi', tone: StatusTone.info, ko: '새'),
            ],
          ),
          if (survey.description != null && survey.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              survey.description!,
              style: SeoulType.bodySecondary,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              if (survey.questionCount > 0) ...[
                Icon(Icons.quiz_outlined, size: 14, color: SeoulColors.textFaint),
                const SizedBox(width: 4),
                Text(
                  '${survey.questionCount} ta savol',
                  style: SeoulType.caption,
                ),
              ],
              const Spacer(),
              if (!isCompleted)
                Text(
                  "To'ldirish →",
                  style: SeoulType.caption.copyWith(color: SeoulColors.lime),
                )
              else
                Icon(Icons.check_circle, size: 16, color: SeoulColors.lime),
            ],
          ),
        ],
      ),
    );
  }
}

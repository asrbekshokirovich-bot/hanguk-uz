import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../applications/data/applications_repository.dart';
import '../../applications/domain/application.dart';
import '../../applications/presentation/widgets/process_tracker.dart';
import '../../documents/data/documents_repository.dart';
import '../../documents/domain/document.dart';
import '../../documents/domain/document_type.dart';
import 'home_tab_provider.dart';

/// The notifications the 한 orb's bell opens (`/notifications`).
///
/// Not a settings screen and not a raw feed — it surfaces the things a student
/// actually has to act on, from data the app already holds:
///  * required documents not yet uploaded (document submission), and
///  * where each application stands in the pipeline (interview, visa
///    preparation, and so on).
///
/// Everything here is derived from `documentsProvider` / `applicationsProvider`;
/// nothing is invented. When there is nothing to act on it says so rather than
/// showing an empty list.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  /// Locale-appropriate document name.
  String _docName(DocumentType t, String locale) {
    switch (locale) {
      case 'uz':
        return t.nameUz;
      case 'ru':
        return t.nameRu;
      default:
        return t.nameEn;
    }
  }

  /// Same match rule as the Documents tab and the Home dashboard: the uploader
  /// stamps the type id into both the display name and the storage path.
  bool _isUploaded(DocumentType type, List<AppDocument> uploaded) {
    for (final doc in uploaded) {
      if (doc.name.contains('[${type.id}]') ||
          doc.filePath.contains('${type.id}-')) {
        return true;
      }
    }
    return false;
  }

  void _openSection(WidgetRef ref, BuildContext context, int section) {
    ref.read(homeTabProvider.notifier).setTab(section);
    context.pop();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).languageCode;

    final docsAsync = ref.watch(documentsProvider);
    final appsAsync = ref.watch(applicationsProvider);

    // ── Documents still to submit ──────────────────────────────────────────
    final List<DocumentType> missingDocs = docsAsync.maybeWhen(
      data: (uploaded) => DocumentConstants.requiredDocuments
          .where((t) => !_isUploaded(t, uploaded))
          .toList(growable: false),
      orElse: () => const <DocumentType>[],
    );

    // ── Where each application stands ──────────────────────────────────────
    final List<StudentApplication> apps = appsAsync.maybeWhen(
      data: (list) => list,
      orElse: () => const <StudentApplication>[],
    );

    final loading = docsAsync.isLoading || appsAsync.isLoading;
    final nothing = !loading && missingDocs.isEmpty && apps.isEmpty;

    return SeoulNightScaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(title: l.homeNotifications),
            Expanded(
              child: loading
                  ? const Center(
                      child: CircularProgressIndicator(color: SeoulColors.lime),
                    )
                  : nothing
                  ? _EmptyState(
                      title: l.notifAllCaughtUp,
                      body: l.notifAllCaughtUpBody,
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(
                        SeoulSizes.screenPadding,
                        8,
                        SeoulSizes.screenPadding,
                        32,
                      ),
                      children: [
                        if (missingDocs.isNotEmpty) ...[
                          _SectionLabel(
                            en: l.documentsRequiredHeading,
                            ko: '서류 제출',
                          ),
                          const SizedBox(height: 10),
                          for (final t in missingDocs) ...[
                            _ReminderCard(
                              glyph: t.nameKo != null && t.nameKo!.isNotEmpty
                                  ? t.nameKo!.characters.first
                                  : '서',
                              title: _docName(t, locale),
                              chipLabel: l.notifToUpload,
                              chipTone: StatusTone.warning,
                              onTap: () => _openSection(
                                ref,
                                context,
                                SeoulSection.documents,
                              ),
                            ),
                            const SizedBox(height: 10),
                          ],
                          const SizedBox(height: 10),
                        ],
                        if (apps.isNotEmpty) ...[
                          _SectionLabel(
                            en: l.notifApplicationUpdates,
                            ko: '지원 현황',
                          ),
                          const SizedBox(height: 10),
                          for (final app in apps) ...[
                            _ReminderCard(
                              glyph: _glyphFor(app.university?.nameKo),
                              title:
                                  app.university?.name ?? l.unknownUniversity,
                              subtitle:
                                  ProcessTracker.currentStageLabel(
                                    app.status,
                                    l,
                                  ) ??
                                  l.sessionStatusLabel(app.status),
                              chipLabel: null,
                              onTap: () => _openSection(
                                ref,
                                context,
                                SeoulSection.applications,
                              ),
                            ),
                            const SizedBox(height: 10),
                          ],
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  static final RegExp _hangulStart = RegExp(r'^[가-힣]');

  static String _glyphFor(String? nameKo) {
    final trimmed = (nameKo ?? '').trim();
    if (!_hangulStart.hasMatch(trimmed)) return '한';
    return HangulGlyphTile.firstSyllable(trimmed);
  }
}

/// The glass back-circle + title, matching the section headers elsewhere.
class _Header extends StatelessWidget {
  const _Header({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(SeoulSizes.screenPadding, 12, 20, 8),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: MaterialLocalizations.of(context).backButtonTooltip,
            child: GestureDetector(
              onTap: () => context.pop(),
              child: Container(
                width: SeoulSizes.minTapTarget,
                height: SeoulSizes.minTapTarget,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: SeoulColors.glass,
                  border: Border.all(color: SeoulColors.glassBorder),
                ),
                child: const Icon(
                  Icons.arrow_back_rounded,
                  size: 20,
                  color: SeoulColors.textPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: HangulTag(en: title, ko: '알림', titleStyle: SeoulType.title),
          ),
        ],
      ),
    );
  }
}

/// A small uppercase-eyebrow + hangul section divider.
class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.en, required this.ko});

  final String en;
  final String ko;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(
          child: Text(
            en,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: SeoulType.subtitle,
          ),
        ),
        const SizedBox(width: 8),
        Text(ko, style: SeoulType.hangulStatus),
      ],
    );
  }
}

/// One actionable reminder.
class _ReminderCard extends StatelessWidget {
  const _ReminderCard({
    required this.glyph,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.chipLabel,
    this.chipTone = StatusTone.warning,
  });

  final String glyph;
  final String title;
  final String? subtitle;
  final String? chipLabel;
  final StatusTone chipTone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      blur: false,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Row(
        children: [
          HangulGlyphTile(glyph: glyph),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle,
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.caption,
                  ),
                ],
              ],
            ),
          ),
          if (chipLabel != null) ...[
            const SizedBox(width: 10),
            StatusChip(label: chipLabel!, tone: chipTone, dense: true),
          ] else ...[
            const SizedBox(width: 10),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: SeoulColors.textFaint,
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const HangulGlyphTile(glyph: '알', size: 56),
            const SizedBox(height: 18),
            Text(title, textAlign: TextAlign.center, style: SeoulType.title),
            const SizedBox(height: 8),
            Text(
              body,
              textAlign: TextAlign.center,
              style: SeoulType.bodySecondary,
            ),
          ],
        ),
      ),
    );
  }
}

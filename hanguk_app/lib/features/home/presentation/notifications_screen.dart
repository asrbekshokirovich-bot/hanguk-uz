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
import '../../uni_db/data/notification_store.dart';
import 'home_tab_provider.dart';

/// The notifications the 한 orb's bell opens (`/notifications`).
///
/// Surfaces:
///  * received push notifications (surveys, announcements),
///  * required documents not yet uploaded, and
///  * where each application stands in the pipeline.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

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

  /// Opens whatever a stored notification is about.
  ///
  /// Tapping the Android system notification has routed to the survey since
  /// the notification service learned to read `survey_id`, but this list —
  /// the one the bell opens — showed the same notifications as dead cards:
  /// a student who cleared the shade, or who came here to find the survey
  /// again, had no way through. The card carries the same `data` payload, so
  /// it can answer the tap the same way.
  void _openNotification(
    BuildContext context,
    WidgetRef ref,
    NotificationItem item,
  ) {
    ref.read(notificationStoreProvider.notifier).markRead(item);

    final surveyId = item.data['survey_id'];
    if (item.data['type'] == 'survey' &&
        surveyId is String &&
        surveyId.isNotEmpty) {
      context.push('/surveys/$surveyId');
      return;
    }

    // Anything else has nowhere specific to go; closing the sheet at least
    // leaves the student where they can act, instead of on a dead list.
    context.pop();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).languageCode;

    final docsAsync = ref.watch(documentsProvider);
    final appsAsync = ref.watch(applicationsProvider);
    final pushNotifications = ref.watch(notificationStoreProvider);

    final List<DocumentType> missingDocs = docsAsync.maybeWhen(
      data: (uploaded) => DocumentConstants.requiredDocuments
          .where((t) => !_isUploaded(t, uploaded))
          .toList(growable: false),
      orElse: () => const <DocumentType>[],
    );

    final List<StudentApplication> apps = appsAsync.maybeWhen(
      data: (list) => list,
      orElse: () => const <StudentApplication>[],
    );

    final loading = docsAsync.isLoading || appsAsync.isLoading;
    final nothing = !loading &&
        missingDocs.isEmpty &&
        apps.isEmpty &&
        pushNotifications.isEmpty;

    return SeoulNightScaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(
              title: l.homeNotifications,
              showMarkRead: pushNotifications.any((n) => !n.read),
              onMarkAllRead: () {
                ref.read(notificationStoreProvider.notifier).markAllRead();
              },
            ),
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
                        // ── Push notifications ──
                        if (pushNotifications.isNotEmpty) ...[
                          const _SectionLabel(
                            en: 'Bildirishnomalar',
                            ko: '푸시 알림',
                          ),
                          const SizedBox(height: 10),
                          for (final n in pushNotifications) ...[
                            _PushNotificationCard(
                              item: n,
                              onTap: () => _openNotification(context, ref, n),
                            ),
                            const SizedBox(height: 10),
                          ],
                          const SizedBox(height: 10),
                        ],
                        // ── Documents still to submit ──
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
                        // ── Application updates ──
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

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    this.showMarkRead = false,
    this.onMarkAllRead,
  });

  final String title;
  final bool showMarkRead;
  final VoidCallback? onMarkAllRead;

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
          if (showMarkRead)
            GestureDetector(
              onTap: onMarkAllRead,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: SeoulColors.glass,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: SeoulColors.glassBorder),
                ),
                child: Text(
                  "O'qildi",
                  style: SeoulType.caption.copyWith(color: SeoulColors.lime),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

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

class _PushNotificationCard extends StatelessWidget {
  const _PushNotificationCard({required this.item, this.onTap});

  final NotificationItem item;
  final VoidCallback? onTap;

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return "hozirgina";
    if (diff.inMinutes < 60) return "${diff.inMinutes} daqiqa oldin";
    if (diff.inHours < 24) return "${diff.inHours} soat oldin";
    if (diff.inDays < 7) return "${diff.inDays} kun oldin";
    return "${dt.day}.${dt.month.toString().padLeft(2, '0')}";
  }

  @override
  Widget build(BuildContext context) {
    // A survey notification is the one that leads somewhere; showing the
    // chevron only there keeps the card honest about what a tap will do.
    final opensSurvey = item.data['type'] == 'survey' &&
        item.data['survey_id'] is String &&
        (item.data['survey_id'] as String).isNotEmpty;

    return GlassCard(
      blur: false,
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: item.read
                  ? SeoulColors.glass
                  : SeoulColors.lime.withValues(alpha: 0.15),
              border: Border.all(
                color: item.read ? SeoulColors.glassBorder : SeoulColors.lime,
              ),
            ),
            child: Icon(
              Icons.notifications_rounded,
              size: 20,
              color: item.read ? SeoulColors.textFaint : SeoulColors.lime,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle.copyWith(
                    fontWeight: item.read ? FontWeight.w400 : FontWeight.w600,
                  ),
                ),
                if (item.body.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    item.body,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.bodySecondary,
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  _timeAgo(item.receivedAt),
                  style: SeoulType.caption.copyWith(
                    color: SeoulColors.textFaint,
                  ),
                ),
              ],
            ),
          ),
          if (!item.read)
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6, left: 8),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: SeoulColors.lime,
              ),
            ),
          if (opensSurvey)
            Padding(
              padding: const EdgeInsets.only(top: 2, left: 6),
              child: Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: SeoulColors.textFaint,
              ),
            ),
        ],
      ),
    );
  }
}

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

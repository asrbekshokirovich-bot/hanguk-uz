import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/documents_repository.dart';
import '../domain/document.dart';
import '../domain/document_type.dart';
import 'widgets/document_slot.dart';

/// Documents section of the Seoul Night shell (DESIGN_SPEC §3.6).
///
/// The screen header ("Docs · 서류 목록") and the 한 orb belong to the shell,
/// so this builds the body only: the collected hero card, the upload note, and
/// one row per required document.
class DocumentsTab extends ConsumerStatefulWidget {
  const DocumentsTab({super.key});

  @override
  ConsumerState<DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends ConsumerState<DocumentsTab> {
  final Map<String, bool> _uploadingDocs = {};

  Future<void> _handleUpload(DocumentType type) async {
    final l = AppLocalizations.of(context)!;
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
      );

      if (result != null && result.files.single.path != null) {
        setState(() => _uploadingDocs[type.id] = true);

        File file = File(result.files.single.path!);
        final repo = ref.read(documentsRepositoryProvider);

        await repo.uploadDocument(file, type);

        // Refresh provider
        ref.invalidate(documentsProvider);
      }
    } catch (e, st) {
      // Real error goes to Sentry; the user sees a friendly localized message.
      await Sentry.captureException(e, stackTrace: st);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l.documentUploadFailed)));
      }
    } finally {
      if (mounted) {
        setState(() => _uploadingDocs[type.id] = false);
      }
    }
  }

  Future<void> _handlePreview(AppDocument doc) async {
    final l = AppLocalizations.of(context)!;
    try {
      final signedUrl = await Supabase.instance.client.storage
          .from('student-documents')
          .createSignedUrl(doc.filePath, 300); // 5-minute expiry

      final uri = Uri.parse(signedUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(l.documentPreviewFailed)));
        }
      }
    } catch (e, st) {
      await Sentry.captureException(e, stackTrace: st);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l.documentPreviewFailed)));
      }
    }
  }

  /// Unchanged delete flow, lifted out of the row builder: the slot goes busy,
  /// the repository removes storage + row, then the provider is invalidated so
  /// the list and the hero counts refresh together.
  Future<void> _handleDelete(DocumentType type, AppDocument doc) async {
    final l = AppLocalizations.of(context)!;
    setState(() => _uploadingDocs[type.id] = true);
    try {
      await ref.read(documentsRepositoryProvider).deleteDocument(doc);
      if (!mounted) return;
      ref.invalidate(documentsProvider);
    } catch (e, st) {
      // Without this the throw escaped to the zone handler, the busy flag was
      // never cleared, and the row's controls stayed disabled until the app
      // was restarted — with nothing on screen to say why.
      await Sentry.captureException(e, stackTrace: st);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l.deleteFailed(e.toString()))));
    } finally {
      if (mounted) setState(() => _uploadingDocs[type.id] = false);
    }
  }

  /// The upload matching a required slot, or null. Same rule the screen has
  /// always used: the repository stamps `[type.id]` into the row name and
  /// `type.id-` into the storage path.
  static AppDocument? _matchFor(DocumentType type, List<AppDocument> docs) {
    for (final doc in docs) {
      if (doc.name.contains('[${type.id}]') ||
          doc.filePath.contains('${type.id}-')) {
        return doc;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final docsAsync = ref.watch(documentsProvider);
    final l = AppLocalizations.of(context)!;

    return docsAsync.when(
      data: (uploadedDocs) => _buildBody(l, uploadedDocs),
      // No counts until the real list lands — a hero showing 0/5 while the
      // request is still in flight would be a lie.
      loading: () => const Center(
        child: CircularProgressIndicator.adaptive(
          valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
        ),
      ),
      error: (err, stack) => _buildError(l),
    );
  }

  Widget _buildBody(AppLocalizations l, List<AppDocument> uploadedDocs) {
    final types = DocumentConstants.requiredDocuments;
    final matches = <AppDocument?>[
      for (final type in types) _matchFor(type, uploadedDocs),
    ];

    // Real counts, straight off the provider's rows.
    final collected = matches.where((doc) => doc != null).length;
    final total = types.length;

    // Spec §4: one primary action per screen — the first still-missing slot.
    final firstMissing = matches.indexWhere((doc) => doc == null);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        8,
        SeoulSizes.screenPadding,
        // Clear of the 한 orb (orbBottom + orbSize + breathing room).
        SeoulSizes.orbClearance,
      ),
      children: [
        _CollectedHero(
          // Not the screen name: the shell header already says "Docs · 서류
          // 목록" directly above, and the section heading below says
          // "Required documents". This slot states the count.
          title: l.documentsCollected(collected, total),
          collected: collected,
          total: total,
        ),
        const SizedBox(height: 16),

        GlassCard(
          padding: const EdgeInsets.all(14),
          radius: SeoulRadii.tile,
          blur: false,
          child: Row(
            children: [
              const Icon(
                Icons.info_outline,
                size: 20,
                color: SeoulColors.infoText,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l.documentUploadInfo,
                  style: SeoulType.bodySecondary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        Text(l.documentsRequiredHeading, style: SeoulType.title),
        const SizedBox(height: 12),

        for (int i = 0; i < types.length; i++)
          _slot(types[i], matches[i], isPrimaryAction: i == firstMissing),
      ],
    );
  }

  Widget _slot(
    DocumentType type,
    AppDocument? match, {
    required bool isPrimaryAction,
  }) {
    VoidCallback? onPreviewTap;
    VoidCallback? onDeleteTap;
    if (match != null) {
      final AppDocument doc = match;
      onPreviewTap = () => _handlePreview(doc);
      onDeleteTap = () => _handleDelete(type, doc);
    }

    return DocumentSlot(
      type: type,
      uploadedDoc: match,
      isUploading: _uploadingDocs[type.id] ?? false,
      isPrimaryAction: isPrimaryAction,
      onUploadTap: () => _handleUpload(type),
      onPreviewTap: onPreviewTap,
      onDeleteTap: onDeleteTap,
    );
  }

  Widget _buildError(AppLocalizations l) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline,
              size: 40,
              color: SeoulColors.textFaint,
            ),
            const SizedBox(height: 12),
            Text(
              l.documentLoadError,
              textAlign: TextAlign.center,
              style: SeoulType.bodySecondary,
            ),
            const SizedBox(height: 16),
            SeoulOutlineButton(
              label: l.commonRetry,
              icon: Icons.refresh,
              expand: false,
              onPressed: () => ref.invalidate(documentsProvider),
            ),
          ],
        ),
      ),
    );
  }
}

/// The one hero card on the screen (DESIGN_SPEC §3.6): a conic ring counting
/// the required documents that have a file against the number required.
class _CollectedHero extends StatelessWidget {
  const _CollectedHero({
    required this.title,
    required this.collected,
    required this.total,
  });

  final String title;

  /// Required document types with an upload behind them.
  final int collected;

  /// `DocumentConstants.requiredDocuments.length`.
  final int total;

  @override
  Widget build(BuildContext context) {
    final value = total == 0 ? 0.0 : collected / total;

    return HeroCard(
      child: Row(
        children: [
          ConicProgressRing(value: value, label: '$collected/$total'),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: SeoulType.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                // Hangul accent (spec §1 Korean voice) — stays Korean in every
                // locale, like the prototype's 서류 수집 진행 중.
                Text(
                  '서류 수집 진행 중',
                  style: SeoulType.hangulLabel.copyWith(
                    color: SeoulColors.textFaint,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

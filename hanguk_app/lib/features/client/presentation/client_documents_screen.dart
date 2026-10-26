import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart' show HardButton;
import '../../../l10n/app_localizations.dart';
import '../../applications/data/applications_repository.dart';
import '../../assessment/presentation/assessment_widgets.dart';
import '../../documents/data/documents_repository.dart';
import '../../documents/domain/document.dart';
import '../../documents/domain/document_type.dart';
import 'widgets/client_parts.dart';

/// Where one required document stands, as the student sees it.
enum DocState { accepted, review, needed }

/// Only an `approved` upload is accepted; any other upload is waiting on a
/// reviewer; nothing uploaded is still needed — the rule the documents list
/// has always used.
DocState docStateOf(AppDocument? doc) => doc == null
    ? DocState.needed
    : doc.status == 'approved'
    ? DocState.accepted
    : DocState.review;

/// The upload matching a required slot, or null: the repository stamps
/// `[type.id]` into the row's name and `type.id-` into its storage path.
AppDocument? documentMatchFor(DocumentType type, List<AppDocument> docs) {
  for (final doc in docs) {
    if (doc.name.contains('[${type.id}]') || doc.filePath.contains('${type.id}-')) return doc;
  }
  return null;
}

/// Design screen 15b, "Hujjatlarim — mijoz": the required documents with
/// where each stands, and the upload button on the ones still needed.
/// Uploading, viewing and removing work as they always have
/// ([DocumentsRepository]); a document's row opens View / Remove.
class ClientDocumentsScreen extends ConsumerStatefulWidget {
  const ClientDocumentsScreen({super.key});

  @override
  ConsumerState<ClientDocumentsScreen> createState() => _ClientDocumentsScreenState();
}

class _ClientDocumentsScreenState extends ConsumerState<ClientDocumentsScreen> {
  final Map<String, bool> _busy = {};

  Future<void> _upload(DocumentType type) async {
    final l = AppLocalizations.of(context)!;
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf']);
      if (result != null && result.files.single.path != null) {
        setState(() => _busy[type.id] = true);
        await ref.read(documentsRepositoryProvider).uploadDocument(File(result.files.single.path!), type);
        AppEvents.track('document_upload', props: {'type': type.id});
        ref.invalidate(documentsProvider);
      }
    } catch (e, st) {
      await Sentry.captureException(e, stackTrace: st);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.documentUploadFailed)));
      }
    } finally {
      if (mounted) setState(() => _busy[type.id] = false);
    }
  }

  Future<void> _view(AppDocument doc) async {
    final l = AppLocalizations.of(context)!;
    try {
      final url = await Supabase.instance.client.storage.from('student-documents').createSignedUrl(doc.filePath, 300);
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.documentPreviewFailed)));
      }
    } catch (e, st) {
      await Sentry.captureException(e, stackTrace: st);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.documentPreviewFailed)));
      }
    }
  }

  Future<void> _remove(DocumentType type, AppDocument doc) async {
    final l = AppLocalizations.of(context)!;
    setState(() => _busy[type.id] = true);
    try {
      await ref.read(documentsRepositoryProvider).deleteDocument(doc);
      if (!mounted) return;
      ref.invalidate(documentsProvider);
    } catch (e, st) {
      await Sentry.captureException(e, stackTrace: st);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.deleteFailed(e.toString()))));
    } finally {
      if (mounted) setState(() => _busy[type.id] = false);
    }
  }

  /// View / Remove for a document that is already there.
  Future<void> _actions(DocumentType type, AppDocument doc) async {
    final l = AppLocalizations.of(context)!;
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.paddingOf(context).bottom),
        decoration: const BoxDecoration(
          color: FdColors.page,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(top: BorderSide(color: FdColors.ink, width: 1.5)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(type.localizedName(l), style: fdText(15, FontWeight.w800, FdColors.onPage)),
            const SizedBox(height: 12),
            HardChoice(label: l.fdDocView, selected: true, height: 46, fontSize: 14, onTap: tracked('client_documents.doc_view', () => Navigator.of(context).pop('view'))),
            const SizedBox(height: 8),
            HardChoice(label: l.fdDocRemove, selected: false, height: 46, fontSize: 14, onTap: tracked('client_documents.doc_remove', () => Navigator.of(context).pop('remove'))),
          ],
        ),
      ),
    );
    if (choice == 'view') await _view(doc);
    if (choice == 'remove') await _remove(type, doc);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final docsAsync = ref.watch(documentsProvider);
    final apps = ref.watch(applicationsProvider).value;
    final firstApp = apps == null || apps.isEmpty ? null : apps.first;
    final uniName = firstApp?.university?.name;
    final subtitle = uniName == null || uniName.isEmpty ? null : shortUniversityName(uniName);

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          docsAsync.when(
            loading: () => ClientHeader(title: l.fdDocsTitle, subtitle: subtitle),
            error: (_, _) => ClientHeader(title: l.fdDocsTitle, subtitle: subtitle),
            data: (docs) {
              final types = DocumentConstants.requiredDocuments;
              final ready = types.where((t) => docStateOf(documentMatchFor(t, docs)) == DocState.accepted).length;
              return ClientHeader(title: l.fdDocsTitle, subtitle: subtitle, badge: l.fdDocsReadyChip(ready, types.length));
            },
          ),
          Expanded(
            child: docsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: FdColors.lime)),
              error: (_, _) => _error(l),
              data: (docs) => _body(l, docs),
            ),
          ),
        ],
      ),
    );
  }

  Widget _error(AppLocalizations l) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l.documentLoadError, textAlign: TextAlign.center, style: fdText(14, FontWeight.w700, FdColors.onPage)),
          const SizedBox(height: 14),
          HardChoice(
            label: l.commonRetry,
            selected: false,
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 24),
            onTap: tracked('client_documents.retry', () => ref.invalidate(documentsProvider)),
          ),
        ],
      ),
    ),
  );

  Widget _body(AppLocalizations l, List<AppDocument> docs) {
    final types = DocumentConstants.requiredDocuments;
    final matches = [for (final t in types) documentMatchFor(t, docs)];
    final states = [for (final m in matches) docStateOf(m)];
    final firstNeeded = states.indexOf(DocState.needed);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(l.documentUploadInfo, style: fdText(12, FontWeight.w400, FdColors.pageMuted, height: 1.4)),
              ),
              for (var i = 0; i < types.length; i++) ...[
                if (i > 0) const SizedBox(height: 10),
                _DocRow(
                  name: types[i].localizedName(l),
                  state: states[i],
                  busy: _busy[types[i].id] ?? false,
                  onUpload: tracked('client_documents.doc_row_upload', () => _upload(types[i]), props: {'value': types[i].id}),
                  onOpen: tracked('client_documents.doc_row_open', matches[i] == null ? null : () => _actions(types[i], matches[i]!)),
                ),
              ],
            ],
          ),
        ),
        if (firstNeeded >= 0)
          FdBottomBar(
            aboveNav: true,
            child: HardButton(
              label: l.fdDocsUploadNext,
              loading: _busy[types[firstNeeded].id] ?? false,
              onPressed: tracked('client_documents.docs_upload_next', () => _upload(types[firstNeeded])),
            ),
          ),
      ],
    );
  }
}

class _DocRow extends StatelessWidget {
  const _DocRow({required this.name, required this.state, required this.busy, required this.onUpload, required this.onOpen});

  final String name;
  final DocState state;
  final bool busy;
  final VoidCallback onUpload;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final (bg, fg, glyph) = switch (state) {
      DocState.accepted => (FdColors.lime, FdColors.onLime, '✓'),
      DocState.review => (FdColors.tint, FdColors.blue, '…'),
      DocState.needed => (FdColors.warn, Colors.white, '!'),
    };
    final (note, noteColor) = switch (state) {
      DocState.accepted => (l.fdDocAccepted, FdColors.good),
      DocState.review => (l.fdDocReview, FdColors.blue),
      DocState.needed => (l.fdDocNeeded, FdColors.warn),
    };
    return Semantics(
      button: onOpen != null,
      label: '$name: $note',
      child: GestureDetector(
        onTap: tracked('client_documents.doc_row_open', onOpen),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: bg, border: Border.all(color: FdColors.ink, width: 1.5)),
                child: Text(glyph, style: fdText(18, FontWeight.w800, fg, height: 1)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: fdText(17, FontWeight.w800, FdColors.ink, height: 1.2)),
                    const SizedBox(height: 2),
                    Text(note, style: fdText(14, FontWeight.w800, noteColor)),
                  ],
                ),
              ),
              if (state == DocState.needed) ...[
                const SizedBox(width: 10),
                Semantics(
                  button: true,
                  label: '${l.fdDocUpload}: $name',
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: tracked('client_documents.doc_row_upload', busy ? null : onUpload),
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: busy
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: FdColors.blue))
                          : Text(l.fdDocUpload, style: fdText(15, FontWeight.w800, FdColors.blue)),
                    ),
                  ),
                ),
              ] else if (busy) ...[
                const SizedBox(width: 10),
                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: FdColors.blue)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/document.dart';
import '../../domain/document_type.dart';

/// Where one required document stands (DESIGN_SPEC §3.6 status words).
enum _SlotState {
  /// Reviewed and accepted — 완료.
  done,

  /// Uploaded, waiting on a reviewer — 대기.
  pending,

  /// Nothing uploaded yet; the row carries the upload action.
  missing,

  /// Not actionable — 잠김, drawn at 45% opacity.
  locked,
}

/// One required-document row (DESIGN_SPEC §3.6): hangul glyph tile, the
/// document's name, its status word, and whatever action the row allows.
///
/// The upload / preview / delete callbacks behave exactly as they did before
/// the redesign — only the surface around them changed.
class DocumentSlot extends StatelessWidget {
  const DocumentSlot({
    super.key,
    required this.type,
    this.uploadedDoc,
    required this.isUploading,
    required this.onUploadTap,
    this.onPreviewTap,
    this.onDeleteTap,
    this.isPrimaryAction = false,
    this.isLocked = false,
  });

  final DocumentType type;

  /// The upload matching this slot, or null when nothing is uploaded yet.
  final AppDocument? uploadedDoc;

  /// True while an upload — or a delete — is in flight for this slot.
  final bool isUploading;

  final VoidCallback onUploadTap;
  final VoidCallback? onPreviewTap;
  final VoidCallback? onDeleteTap;

  /// Spec §4 keeps lime rare, so only one row on the screen — the first one
  /// still missing — gets the lime button; the rest get the outline one.
  final bool isPrimaryAction;

  /// Draws the row as 잠김 at 45% opacity with no actions.
  ///
  /// Nothing in the documents data model gates a slot today, so the tab never
  /// sets this — the state exists so the spec's third status word is ready the
  /// moment the backend grows a gating concept. It is never inferred from real
  /// rows, because guessing would show students a lock that isn't there.
  final bool isLocked;

  /// DESIGN_SPEC §3.6 — "locked at 45% opacity". No token carries it.
  static const double _lockedOpacity = 0.45;

  _SlotState get _state {
    if (isLocked) return _SlotState.locked;
    final doc = uploadedDoc;
    if (doc == null) return _SlotState.missing;
    // Unchanged from the old screen: only 'approved' counts as done, every
    // other server status ('uploaded', 'rejected') reads as awaiting review.
    return doc.status == 'approved' ? _SlotState.done : _SlotState.pending;
  }

  /// The document's own name. These translations live on the domain object
  /// rather than in the ARB files, so pick the one matching the active locale
  /// and fall back to English (vi has no translation yet).
  String _nameFor(String localeCode) {
    switch (localeCode) {
      case 'uz':
        return type.nameUz;
      case 'ru':
        return type.nameRu;
      case 'ko':
        return (type.nameKo?.isNotEmpty ?? false) ? type.nameKo! : type.nameEn;
      default:
        return type.nameEn;
    }
  }

  /// Status pill: Korean word beside the English label (spec §1 Korean voice).
  Widget _status(AppLocalizations l) {
    switch (_state) {
      case _SlotState.done:
        return StatusChip(
          label: l.documentStatusApproved,
          ko: '완료',
          tone: StatusTone.lime,
        );
      case _SlotState.pending:
        return StatusChip(
          label: l.documentStatusPendingReview,
          ko: '대기',
          tone: StatusTone.warning,
        );
      case _SlotState.locked:
        // Korean only: there is no English string for "locked" anywhere in the
        // app yet, and inventing one would bypass the ARB files.
        return const StatusChip(label: '잠김', tone: StatusTone.neutral);
      case _SlotState.missing:
        // Nothing has happened to this document — the upload button on the
        // right is the whole story, and a chip would only invent a status.
        return const SizedBox.shrink();
    }
  }

  List<Widget> _actions(AppLocalizations l) {
    switch (_state) {
      case _SlotState.locked:
        return const <Widget>[];
      case _SlotState.missing:
        return <Widget>[_uploadAction(l)];
      case _SlotState.done:
        // Approved documents can be previewed but not deleted — unchanged.
        return <Widget>[
          _iconAction(
            icon: Icons.visibility_outlined,
            color: SeoulColors.textPrimary,
            tooltip: l.a11yTooltipPreviewDocument,
            onPressed: onPreviewTap,
          ),
        ];
      case _SlotState.pending:
        return <Widget>[
          _iconAction(
            icon: Icons.visibility_outlined,
            color: SeoulColors.textPrimary,
            tooltip: l.a11yTooltipPreviewDocument,
            onPressed: onPreviewTap,
          ),
          _iconAction(
            icon: Icons.delete_outline,
            color: SeoulColors.dangerText,
            tooltip: l.a11yTooltipDeleteDocument,
            onPressed: isUploading ? null : onDeleteTap,
          ),
        ];
    }
  }

  Widget _iconAction({
    required IconData icon,
    required Color color,
    required String tooltip,
    required VoidCallback? onPressed,
  }) {
    // IconButton's default constraints are already 48×48 — above the 44×44
    // minimum in spec §4.
    return IconButton(
      onPressed: onPressed,
      icon: Icon(icon, size: 20),
      color: color,
      tooltip: tooltip,
    );
  }

  Widget _uploadAction(AppLocalizations l) {
    if (isUploading) {
      return const SizedBox(
        width: SeoulSizes.minTapTarget,
        height: SeoulSizes.minTapTarget,
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
            ),
          ),
        ),
      );
    }

    if (isPrimaryAction) {
      return LimeButton(
        label: l.documentActionUpload,
        icon: Icons.cloud_upload_outlined,
        expand: false,
        height: SeoulSizes.minTapTarget,
        onPressed: onUploadTap,
      );
    }

    return SeoulOutlineButton(
      label: l.documentActionUpload,
      icon: Icons.cloud_upload_outlined,
      expand: false,
      height: SeoulSizes.minTapTarget,
      onPressed: onUploadTap,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).languageCode;
    final state = _state;
    final ko = type.nameKo;
    // "Collected" = a file is in, approved or not. The hero ring counts the
    // same set, so the ring and the lime tiles always agree.
    final collected = state == _SlotState.done || state == _SlotState.pending;

    final Widget row = GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      radius: SeoulRadii.tile,
      // A blur per row is a saved layer per row, and the rows read the same
      // against this background either way (GlassCard's own guidance).
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // Lime once the file is in (spec §3.6); whether it is approved
              // yet is the chip's job.
              HangulGlyphTile(
                glyph: HangulGlyphTile.firstSyllable(ko),
                active: collected,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _nameFor(locale),
                      style: SeoulType.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    // Hangul accent — skipped in Korean, where the name above
                    // already is the Korean word.
                    if (ko != null && ko.isNotEmpty && locale != 'ko') ...[
                      const SizedBox(height: 2),
                      Text(
                        ko,
                        style: SeoulType.hangulLabel.copyWith(
                          color: SeoulColors.textFaint,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Status on the left, actions on the right. The names run long in
          // every locale, so they get the full width of the row above rather
          // than competing with a chip and two buttons.
          // Wrap, not Row: at the OS's larger font settings the chip plus two
          // 48px buttons exceed the row width on a 320pt screen, and
          // StatusChip's inner Row is MainAxisSize.min with no Flexible, so it
          // would stripe rather than ellipsise. Wrapping drops the actions to
          // their own line instead.
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            runSpacing: 8,
            spacing: 8,
            children: [
              _status(l),
              Row(mainAxisSize: MainAxisSize.min, children: _actions(l)),
            ],
          ),
        ],
      ),
    );

    if (state == _SlotState.locked) {
      return Opacity(opacity: _lockedOpacity, child: row);
    }
    return row;
  }
}

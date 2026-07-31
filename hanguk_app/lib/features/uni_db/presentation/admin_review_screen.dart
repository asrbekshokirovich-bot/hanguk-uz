import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../data/admin_review_providers.dart';
import '../domain/review_queue_item.dart';

/// `/admin/review` — the in-office reviewer's HITL surface.
///
/// Companions:
///   docs/runbooks/reviewer-onboarding.md  — operational guide
///   ADR-005                               — why the role exists
///
/// Two-column layout: queue list on the left, item detail on the right.
/// Three actions: Accept, Edit then Accept, Reject.
///
/// Seoul Night pass — visuals only. This surface is staff-only (gated
/// server-side by `fn_can_review_uni_db`), so its copy deliberately stays
/// English and out of the ARB files; reviewers are Hanguk staff.
class AdminReviewScreen extends ConsumerStatefulWidget {
  const AdminReviewScreen({super.key});

  @override
  ConsumerState<AdminReviewScreen> createState() => _AdminReviewScreenState();
}

class _AdminReviewScreenState extends ConsumerState<AdminReviewScreen> {
  ReviewQueueItem? _selected;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final canReviewAsync = ref.watch(canReviewUniDbProvider);

    return canReviewAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(error: '$e'),
      data: (canReview) {
        if (!canReview) {
          return const _ForbiddenScaffold();
        }
        return _buildContent(context);
      },
    );
  }

  Widget _buildContent(BuildContext context) {
    final queueAsync = ref.watch(reviewQueueProvider);
    return SeoulNightScaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Header(
            title: 'Review queue',
            trailing: _GlassCircleButton(
              icon: Icons.refresh_rounded,
              tooltip: 'Refresh',
              onTap: _busy ? null : () => ref.invalidate(reviewQueueProvider),
            ),
          ),
          Expanded(
            child: queueAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: SeoulColors.lime),
              ),
              error: (e, _) => Center(
                child: Text('Error: $e', style: SeoulType.bodySecondary),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Queue is empty. Nothing pending right now.',
                        textAlign: TextAlign.center,
                        style: SeoulType.bodySecondary,
                      ),
                    ),
                  );
                }
                // Two panes need room for two panes. A fixed 360px queue
                // beside an Expanded detail leaves the detail 0px wide at
                // 360pt and clips the queue by 41px at 320 — a reviewer on a
                // phone taps an item and nothing appears, with Accept and
                // Reject laid out into a zero-width box. Below the breakpoint
                // the queue becomes a full-width list that pushes the detail
                // on as its own screen instead.
                return LayoutBuilder(
                  builder: (context, constraints) {
                    const queueWidth = 360.0;
                    // queue + hairline + a detail pane wide enough to hold
                    // the action row.
                    final sideBySide = constraints.maxWidth >= queueWidth + 361;

                    final queue = _QueueList(
                      items: items,
                      selected: _selected,
                      onSelect: (item) => setState(() => _selected = item),
                    );

                    if (!sideBySide) {
                      if (_selected == null) return queue;
                      return _DetailPane(
                        item: _selected!,
                        busy: _busy,
                        onBack: () => setState(() => _selected = null),
                        onAccept: _onAccept,
                        onEditAccept: _onEditAccept,
                        onReject: _onReject,
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(width: queueWidth, child: queue),
                        // Hairline between the two panes.
                        const SizedBox(
                          width: 1,
                          child: ColoredBox(color: SeoulColors.glassBorder),
                        ),
                        Expanded(
                          child: _selected == null
                              ? const Center(
                                  child: Text(
                                    'Select a queue item on the left.',
                                    style: SeoulType.bodySecondary,
                                  ),
                                )
                              : _DetailPane(
                                  item: _selected!,
                                  busy: _busy,
                                  onAccept: _onAccept,
                                  onEditAccept: _onEditAccept,
                                  onReject: _onReject,
                                ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _withBusy(Future<void> Function() body) async {
    setState(() => _busy = true);
    try {
      await body();
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $err')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _onAccept(ReviewQueueItem item) async {
    final actions = ref.read(reviewActionsProvider);
    await _withBusy(() async {
      await actions.accept(item.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Accepted')));
      ref.invalidate(reviewQueueProvider);
      setState(() => _selected = null);
    });
  }

  Future<void> _onEditAccept(
    ReviewQueueItem item,
    Map<String, dynamic> corrected,
  ) async {
    final actions = ref.read(reviewActionsProvider);
    await _withBusy(() async {
      await actions.editAccept(item.id, corrected);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Edited and accepted')));
      ref.invalidate(reviewQueueProvider);
      setState(() => _selected = null);
    });
  }

  Future<void> _onReject(
    ReviewQueueItem item,
    String reason,
    String? reasonDetail,
  ) async {
    final actions = ref.read(reviewActionsProvider);
    await _withBusy(() async {
      await actions.reject(item.id, reason: reason, reasonDetail: reasonDetail);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Rejected')));
      ref.invalidate(reviewQueueProvider);
      setState(() => _selected = null);
    });
  }
}

/// Top bar: glass back circle, title, optional trailing control.
class _Header extends StatelessWidget {
  const _Header({required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        12,
        SeoulSizes.screenPadding,
        8,
      ),
      child: Row(
        children: [
          _GlassCircleButton(
            icon: Icons.arrow_back_rounded,
            tooltip: 'Back',
            onTap: () => Navigator.of(context).maybePop(),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              title,
              style: SeoulType.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 10), trailing!],
        ],
      ),
    );
  }
}

class _QueueList extends StatelessWidget {
  const _QueueList({
    required this.items,
    required this.selected,
    required this.onSelect,
  });

  final List<ReviewQueueItem> items;
  final ReviewQueueItem? selected;
  final ValueChanged<ReviewQueueItem> onSelect;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(SeoulSizes.screenPadding, 4, 12, 24),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final item = items[i];
        final isSelected = item.id == selected?.id;
        return GlassCard(
          radius: SeoulRadii.tile,
          blur: false,
          showShadow: false,
          padding: const EdgeInsets.all(12),
          fillColor: isSelected ? SeoulColors.limeFill : null,
          borderColor: isSelected ? SeoulColors.lime : null,
          onTap: () => onSelect(item),
          child: Row(
            children: [
              _PriorityBadge(priority: item.priority, overdue: item.isOverdue),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.institutionLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SeoulType.subtitle,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item.entityType} · ${item.reason}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SeoulType.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  const _PriorityBadge({required this.priority, required this.overdue});

  final int priority;
  final bool overdue;

  @override
  Widget build(BuildContext context) {
    // Overdue and P1 demand attention (danger); P2 is a warning; anything
    // lower is informational.
    final (Color fill, Color fg) = overdue
        ? (SeoulColors.dangerFill, SeoulColors.dangerText)
        : switch (priority) {
            1 => (SeoulColors.dangerFill, SeoulColors.dangerText),
            2 => (SeoulColors.warningFill, SeoulColors.warningText),
            3 => (SeoulColors.infoFill, SeoulColors.infoText),
            _ => (SeoulColors.neutralFill, SeoulColors.textSecondary),
          };
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: fill,
        shape: BoxShape.circle,
        border: Border.all(color: SeoulColors.glassBorder),
      ),
      child: Text(
        'P$priority',
        style: SeoulType.caption.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _DetailPane extends StatelessWidget {
  const _DetailPane({
    required this.item,
    required this.busy,
    this.onBack,
    required this.onAccept,
    required this.onEditAccept,
    required this.onReject,
  });

  final ReviewQueueItem item;
  final bool busy;

  /// Set only in the stacked (narrow) layout, where the detail replaces the
  /// queue instead of sitting beside it and so needs its own way back.
  final VoidCallback? onBack;
  final Future<void> Function(ReviewQueueItem) onAccept;
  final Future<void> Function(ReviewQueueItem, Map<String, dynamic>)
  onEditAccept;
  final Future<void> Function(ReviewQueueItem, String reason, String? detail)
  onReject;

  @override
  Widget build(BuildContext context) {
    final formattedJson = const JsonEncoder.withIndent(
      '  ',
    ).convert(item.parsedOutput);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (onBack == null)
            Text(item.institutionLabel, style: SeoulType.title)
          else
            Row(
              children: [
                _GlassCircleButton(
                  icon: Icons.arrow_back_rounded,
                  tooltip: 'Back to queue',
                  onTap: onBack!,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.institutionLabel,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.title,
                  ),
                ),
              ],
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              StatusChip(label: item.priorityLabel, tone: StatusTone.info),
              StatusChip(label: item.reason),
              if (item.accuracySelfScore != null)
                StatusChip(
                  label:
                      'confidence ${(item.accuracySelfScore! * 100).round()}%',
                ),
              if (item.isOverdue)
                const StatusChip(label: 'OVERDUE', tone: StatusTone.danger),
            ],
          ),
          const SizedBox(height: 12),
          if (item.sourceUrlKo != null)
            Align(
              alignment: Alignment.centerLeft,
              child: SeoulOutlineButton(
                icon: Icons.open_in_new,
                label: 'Open source page (한국어)',
                expand: false,
                height: SeoulSizes.minTapTarget,
                onPressed: () => _launchPdf(context, item.sourceUrlKo!),
              ),
            ),
          const SizedBox(height: 12),
          const Text('Extracted payload:', style: SeoulType.caption),
          const SizedBox(height: 6),
          Expanded(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: SeoulColors.neutralFill,
                borderRadius: SeoulRadii.tileR,
                border: Border.all(color: SeoulColors.glassBorder),
              ),
              child: SingleChildScrollView(
                child: SelectableText(formattedJson, style: _monoStyle),
              ),
            ),
          ),
          const SizedBox(height: 14),
          // Accept is the queue's one lime action; the other two stay quiet.
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              SeoulOutlineButton(
                label: 'Reject',
                expand: false,
                height: SeoulSizes.minTapTarget,
                onPressed: busy ? null : () => _confirmReject(context),
              ),
              SeoulOutlineButton(
                label: 'Edit & accept',
                expand: false,
                height: SeoulSizes.minTapTarget,
                onPressed: busy ? null : () => _editAccept(context),
              ),
              LimeButton(
                label: 'Accept',
                expand: false,
                height: SeoulSizes.minTapTarget,
                onPressed: busy ? null : () => onAccept(item),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _editAccept(BuildContext context) async {
    final corrected = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _EditPayloadDialog(initial: item.parsedOutput),
    );
    if (corrected != null) {
      await onEditAccept(item, corrected);
    }
  }

  Future<void> _confirmReject(BuildContext context) async {
    final result = await showDialog<({String reason, String? detail})>(
      context: context,
      builder: (_) => const _RejectReasonDialog(),
    );
    if (result != null) {
      await onReject(item, result.reason, result.detail);
    }
  }

  Future<void> _launchPdf(BuildContext context, String url) async {
    // The dashboard view emits a pre-signed 15-minute URL. Tapping
    // launches the system PDF viewer (browser on web, the user's
    // chosen app on mobile). We prefer external launch over an in-app
    // viewer because the reviewer typically wants to scroll through
    // the entire admission guideline (50-100 pages) and a native
    // viewer offers better navigation than any in-app pdfx layer.
    final uri = Uri.tryParse(url);
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not parse signed URL.')),
      );
      return;
    }
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not open PDF — no app available to handle the URL.',
          ),
        ),
      );
    }
  }
}

/// The reviewer edits raw JSON, so the payload wears the design system's mono
/// family. Korean values inside the payload fall through the family fallback
/// rather than rendering tofu — the mono subset only carries the code range.
const TextStyle _monoStyle = TextStyle(
  fontFamily: SeoulType.mono,
  fontFamilyFallback: SeoulType.fallback,
  fontSize: 13,
  height: 1.45,
  color: SeoulColors.textPrimary,
);

/// Navy-gradient dialog shell shared by the two dialogs below — same idiom as
/// the Account screen's dialogs.
class _SeoulDialog extends StatelessWidget {
  const _SeoulDialog({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
      child: Container(
        decoration: BoxDecoration(
          gradient: SeoulGradients.appBackground,
          borderRadius: SeoulRadii.heroR,
          border: Border.all(color: SeoulColors.heroBorder, width: 1),
          boxShadow: SeoulShadows.hero,
        ),
        child: ClipRRect(
          borderRadius: SeoulRadii.heroR,
          child: Padding(padding: const EdgeInsets.all(20), child: child),
        ),
      ),
    );
  }
}

/// Seoul Night input decoration for the dialogs' text fields.
InputDecoration _fieldDecoration({String? label}) {
  return InputDecoration(
    labelText: label,
    labelStyle: SeoulType.bodySecondary,
    filled: true,
    fillColor: SeoulColors.neutralFill,
    contentPadding: const EdgeInsets.all(12),
    border: const OutlineInputBorder(
      borderRadius: SeoulRadii.controlR,
      borderSide: BorderSide(color: SeoulColors.glassBorder),
    ),
    enabledBorder: const OutlineInputBorder(
      borderRadius: SeoulRadii.controlR,
      borderSide: BorderSide(color: SeoulColors.glassBorder),
    ),
    focusedBorder: const OutlineInputBorder(
      borderRadius: SeoulRadii.controlR,
      borderSide: BorderSide(color: SeoulColors.lime),
    ),
  );
}

class _EditPayloadDialog extends StatefulWidget {
  const _EditPayloadDialog({required this.initial});
  final Map<String, dynamic> initial;

  @override
  State<_EditPayloadDialog> createState() => _EditPayloadDialogState();
}

class _EditPayloadDialogState extends State<_EditPayloadDialog> {
  late final TextEditingController _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: const JsonEncoder.withIndent('  ').convert(widget.initial),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    try {
      final parsed = json.decode(_controller.text);
      if (parsed is! Map) {
        setState(() => _error = 'Payload must be a JSON object');
        return;
      }
      Navigator.of(context).pop(Map<String, dynamic>.from(parsed));
    } on FormatException catch (e) {
      setState(() => _error = 'Invalid JSON: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    // A Dialog clamps itself to `screen - 56`, so a hard 700x(420 + chrome)
    // could not fit on a phone: measured 39px of horizontal and 38px of
    // vertical overflow at 320x568, worse at larger fonts. Both axes now
    // yield — the editor takes the room that is left rather than demanding
    // a fixed slab.
    final media = MediaQuery.of(context);
    return _SeoulDialog(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 700,
          maxHeight: media.size.height * 0.8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Edit payload', style: SeoulType.title),
            const SizedBox(height: 14),
            Flexible(
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 140),
                child: TextField(
                  controller: _controller,
                  maxLines: null,
                  expands: true,
                  cursorColor: SeoulColors.lime,
                  style: _monoStyle,
                  decoration: _fieldDecoration(),
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _error!,
                  style: SeoulType.caption.copyWith(
                    color: SeoulColors.dangerText,
                  ),
                ),
              ),
            const SizedBox(height: 16),
            // Wrap, not Row: two intrinsic-width buttons in a Row inside a
            // dialog get unbounded constraints and simply run off the edge.
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 8,
              runSpacing: 8,
              children: [
                SeoulOutlineButton(
                  label: 'Cancel',
                  expand: false,
                  height: SeoulSizes.minTapTarget,
                  onPressed: () => Navigator.of(context).pop(),
                ),
                LimeButton(
                  label: 'Save & accept',
                  expand: false,
                  height: SeoulSizes.minTapTarget,
                  onPressed: _submit,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RejectReasonDialog extends StatefulWidget {
  const _RejectReasonDialog();

  @override
  State<_RejectReasonDialog> createState() => _RejectReasonDialogState();
}

class _RejectReasonDialogState extends State<_RejectReasonDialog> {
  static const _reasons = [
    'wrong_year',
    'wrong_archetype',
    'hallucinated_field',
    'ocr_garbled',
    'source_404',
    'other',
  ];
  String _reason = 'wrong_year';
  final _detail = TextEditingController();

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SeoulDialog(
      child: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Reject — reason', style: SeoulType.title),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: SeoulColors.neutralFill,
                borderRadius: SeoulRadii.controlR,
                border: Border.all(color: SeoulColors.glassBorder),
              ),
              child: DropdownButton<String>(
                value: _reason,
                isExpanded: true,
                underline: const SizedBox.shrink(),
                dropdownColor: SeoulColors.royalBlue,
                borderRadius: SeoulRadii.controlR,
                iconEnabledColor: SeoulColors.textSecondary,
                style: SeoulType.body,
                items: _reasons
                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                    .toList(),
                onChanged: (v) => setState(() => _reason = v ?? _reason),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _detail,
              cursorColor: SeoulColors.lime,
              style: SeoulType.body,
              decoration: _fieldDecoration(label: 'Detail (optional)'),
              maxLines: 3,
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                SeoulOutlineButton(
                  label: 'Cancel',
                  expand: false,
                  height: SeoulSizes.minTapTarget,
                  onPressed: () => Navigator.of(context).pop(),
                ),
                const SizedBox(width: 8),
                _DangerButton(
                  label: 'Reject',
                  onPressed: () => Navigator.of(context).pop((
                    reason: _reason,
                    detail: _detail.text.trim().isEmpty
                        ? null
                        : _detail.text.trim(),
                  )),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Destructive confirm: danger fill + border, never lime — rejecting an
/// extraction is not the screen's "go" action.
class _DangerButton extends StatefulWidget {
  const _DangerButton({required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  State<_DangerButton> createState() => _DangerButtonState();
}

class _DangerButtonState extends State<_DangerButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTap: widget.onPressed,
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        child: AnimatedScale(
          scale: _pressed ? SeoulMotion.pressScale : 1.0,
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          child: Container(
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: SeoulColors.dangerFill,
              borderRadius: SeoulRadii.controlR,
              border: Border.all(color: SeoulColors.danger, width: 1),
            ),
            child: Text(
              widget.label,
              style: SeoulType.button.copyWith(color: SeoulColors.dangerText),
            ),
          ),
        ),
      ),
    );
  }
}

/// Glass circle button (back / refresh). Null [onTap] disables it.
class _GlassCircleButton extends StatelessWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: tooltip,
      child: Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          child: AnimatedOpacity(
            opacity: enabled ? 1.0 : 0.45,
            duration: SeoulMotion.fast,
            child: Container(
              width: SeoulSizes.minTapTarget,
              height: SeoulSizes.minTapTarget,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: SeoulColors.glass,
                border: Border.all(color: SeoulColors.glassBorder),
              ),
              child: Icon(icon, size: 20, color: SeoulColors.textPrimary),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoadingScaffold extends StatelessWidget {
  const _LoadingScaffold();
  @override
  Widget build(BuildContext context) => const SeoulNightScaffold(
    body: Center(child: CircularProgressIndicator(color: SeoulColors.lime)),
  );
}

class _ErrorScaffold extends StatelessWidget {
  const _ErrorScaffold({required this.error});
  final String error;
  @override
  Widget build(BuildContext context) => SeoulNightScaffold(
    body: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Header(title: 'Review'),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                error,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _ForbiddenScaffold extends StatelessWidget {
  const _ForbiddenScaffold();
  @override
  Widget build(BuildContext context) => const SeoulNightScaffold(
    body: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(title: 'Review'),
        Expanded(
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'This area is for Hanguk staff only. '
                'If you should have access, ask an admin to add your '
                'staff role.',
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

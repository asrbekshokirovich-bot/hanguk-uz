import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/admin_review_providers.dart';
import '../domain/review_queue_item.dart';
import '../domain/uzbek_projection.dart';

/// `/admin/review` — the in-office reviewer's HITL surface.
///
/// Companions:
///   docs/runbooks/reviewer-onboarding.md  — operational guide
///   ADR-005                               — why the role exists
///
/// Two-column layout: queue list on the left, item detail on the right.
/// Three actions: Accept, Edit then Accept, Reject.
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Review queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _busy ? null : () => ref.invalidate(reviewQueueProvider),
          ),
        ],
      ),
      body: queueAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Queue is empty. Nothing pending right now.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 360,
                child: _QueueList(
                  items: items,
                  selected: _selected,
                  onSelect: (item) => setState(() => _selected = item),
                ),
              ),
              const VerticalDivider(width: 1),
              Expanded(
                child: _selected == null
                    ? const Center(
                        child: Text('Select a queue item on the left.'),
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
      itemCount: items.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (_, i) {
        final item = items[i];
        final isSelected = item.id == selected?.id;
        return ListTile(
          selected: isSelected,
          leading: _PriorityBadge(
            priority: item.priority,
            overdue: item.isOverdue,
          ),
          title: Text(
            item.institutionLabel,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: Text(
            '${item.entityType} · ${item.reason}',
            overflow: TextOverflow.ellipsis,
          ),
          onTap: () => onSelect(item),
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
    final color = overdue
        ? Colors.red.shade700
        : switch (priority) {
            1 => Colors.red.shade400,
            2 => Colors.orange.shade400,
            3 => Colors.amber.shade700,
            _ => Colors.blueGrey,
          };
    return CircleAvatar(
      radius: 14,
      backgroundColor: color,
      child: Text(
        'P$priority',
        style: const TextStyle(fontSize: 10, color: Colors.white),
      ),
    );
  }
}

class _DetailPane extends StatefulWidget {
  const _DetailPane({
    required this.item,
    required this.busy,
    required this.onAccept,
    required this.onEditAccept,
    required this.onReject,
  });

  final ReviewQueueItem item;
  final bool busy;
  final Future<void> Function(ReviewQueueItem) onAccept;
  final Future<void> Function(ReviewQueueItem, Map<String, dynamic>)
  onEditAccept;
  final Future<void> Function(ReviewQueueItem, String reason, String? detail)
  onReject;

  @override
  State<_DetailPane> createState() => _DetailPaneState();
}

class _DetailPaneState extends State<_DetailPane> {
  /// Reviewers read Uzbek by default; the toggle reveals the raw Korean-source
  /// payload for cross-checking against the original guideline. Display-only —
  /// the stored payload and everything sent to accept/edit stays Korean.
  bool _showOriginal = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final busy = widget.busy;

    final hasUzbek = payloadHasUzbek(item.parsedOutput);
    final display = _showOriginal
        ? item.parsedOutput
        : localizeToUzbek(item.parsedOutput);
    final formattedJson = const JsonEncoder.withIndent('  ').convert(display);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            item.institutionLabel,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              Chip(label: Text(item.priorityLabel)),
              Chip(label: Text(item.reason)),
              if (item.accuracySelfScore != null)
                Chip(
                  label: Text(
                    'confidence ${(item.accuracySelfScore! * 100).round()}%',
                  ),
                ),
              if (item.isOverdue)
                Chip(
                  label: const Text('OVERDUE'),
                  backgroundColor: Colors.red.shade100,
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (item.sourceUrlKo != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                icon: const Icon(Icons.open_in_new),
                label: const Text('Manba sahifasi (한국어)'),
                onPressed: () => _launchPdf(context, item.sourceUrlKo!),
              ),
            ),
          const SizedBox(height: 8),
          // Payload header + Uzbek / original toggle.
          Row(
            children: [
              Expanded(
                child: Text(
                  _showOriginal
                      ? 'Asl nusxa (manba tili):'
                      : "Ajratib olingan ma'lumot (o'zbekcha):",
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              TextButton.icon(
                icon: Icon(
                  _showOriginal
                      ? Icons.translate
                      : Icons.description_outlined,
                  size: 18,
                ),
                label: Text(_showOriginal ? "O'zbekcha" : 'Asl nusxa'),
                onPressed: () =>
                    setState(() => _showOriginal = !_showOriginal),
              ),
            ],
          ),
          if (!hasUzbek && !_showOriginal)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                border: Border.all(color: Colors.amber.shade200),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                "Bu yozuv hali o'zbek tiliga tarjima qilinmagan (eski "
                "ma'lumot). Quyida asl matn ko'rsatilmoqda.",
                style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
              ),
            ),
          const SizedBox(height: 4),
          Expanded(
            child: SingleChildScrollView(
              child: SelectableText(
                formattedJson,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              ),
            ),
          ),
          const Divider(),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton(
                onPressed: busy ? null : () => _confirmReject(context),
                child: const Text('Reject'),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: busy ? null : () => _editAccept(context),
                child: const Text('Edit & accept'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: busy ? null : () => widget.onAccept(item),
                child: const Text('Accept'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _editAccept(BuildContext context) async {
    // Editing always operates on the raw Korean-source payload — the Uzbek
    // projection is display-only and never leaves this screen.
    final corrected = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _EditPayloadDialog(initial: widget.item.parsedOutput),
    );
    if (corrected != null) {
      await widget.onEditAccept(widget.item, corrected);
    }
  }

  Future<void> _confirmReject(BuildContext context) async {
    final result = await showDialog<({String reason, String? detail})>(
      context: context,
      builder: (_) => const _RejectReasonDialog(),
    );
    if (result != null) {
      await widget.onReject(widget.item, result.reason, result.detail);
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
    return AlertDialog(
      title: const Text('Edit payload'),
      content: SizedBox(
        width: 700,
        height: 500,
        child: Column(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                maxLines: null,
                expands: true,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Save & accept')),
      ],
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
    return AlertDialog(
      title: const Text('Reject — reason'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButton<String>(
            value: _reason,
            isExpanded: true,
            items: _reasons
                .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                .toList(),
            onChanged: (v) => setState(() => _reason = v ?? _reason),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _detail,
            decoration: const InputDecoration(
              labelText: 'Detail (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop((
            reason: _reason,
            detail: _detail.text.trim().isEmpty ? null : _detail.text.trim(),
          )),
          child: const Text('Reject'),
        ),
      ],
    );
  }
}

class _LoadingScaffold extends StatelessWidget {
  const _LoadingScaffold();
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class _ErrorScaffold extends StatelessWidget {
  const _ErrorScaffold({required this.error});
  final String error;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Review')),
    body: Center(child: Text(error)),
  );
}

class _ForbiddenScaffold extends StatelessWidget {
  const _ForbiddenScaffold();
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Review')),
    body: const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'This area is for Hanguk staff only. '
          'If you should have access, ask an admin to add your '
          'staff role.',
          textAlign: TextAlign.center,
        ),
      ),
    ),
  );
}

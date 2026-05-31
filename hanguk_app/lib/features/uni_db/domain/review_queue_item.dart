/// One pending review-queue row from `v_review_queue_dashboard`.
///
/// Field names mirror the actual view columns (id, priority, reason,
/// entity_type, entity_id, created_at, name_ko, name_en, source_url_ko,
/// storage_path, parsed_output, accuracy_self_score). Pure data class —
/// no Flutter imports.
class ReviewQueueItem {
  const ReviewQueueItem({
    required this.id,
    required this.priority,
    required this.reason,
    required this.entityType,
    required this.entityId,
    required this.createdAt,
    required this.parsedOutput,
    this.nameKo,
    this.nameEn,
    this.sourceUrlKo,
    this.storagePath,
    this.accuracySelfScore,
  });

  factory ReviewQueueItem.fromMap(Map<String, dynamic> map) => ReviewQueueItem(
    id: map['id'] as String,
    priority: (map['priority'] as num?)?.toInt() ?? 5,
    reason: map['reason'] as String? ?? '',
    entityType: map['entity_type'] as String? ?? '',
    entityId: map['entity_id'] as String? ?? '',
    createdAt:
        DateTime.tryParse(map['created_at']?.toString() ?? '') ??
        DateTime.now(),
    parsedOutput:
        (map['parsed_output'] as Map?)?.cast<String, dynamic>() ?? const {},
    nameKo: map['name_ko'] as String?,
    nameEn: map['name_en'] as String?,
    sourceUrlKo: map['source_url_ko'] as String?,
    storagePath: map['storage_path'] as String?,
    accuracySelfScore: (map['accuracy_self_score'] as num?)?.toDouble(),
  );

  final String id;
  final int priority; // 1..5; 1 highest
  final String reason; // why it was queued (e.g. low_confidence)
  final String entityType;
  final String entityId;
  final DateTime createdAt;
  final Map<String, dynamic> parsedOutput; // the AI's extracted data
  final String? nameKo;
  final String? nameEn;
  final String? sourceUrlKo;
  final String? storagePath;
  final double? accuracySelfScore;

  /// Best label to show for the institution.
  String get institutionLabel => nameKo ?? nameEn ?? '(unknown institution)';

  /// Priority label per ADR-005 SLA grid.
  String get priorityLabel => switch (priority) {
    1 => 'P1 — correction notice (4h)',
    2 => 'P2 — attachment change (12h)',
    3 => 'P3 — D3 field with diff (24h)',
    4 => 'P4 — D2 routine (48h)',
    _ => 'P5 — D1 trivial (96h)',
  };

  /// SLA budget per priority — mirrors v_review_queue_overdue.
  Duration get _slaBudget => switch (priority) {
    1 => const Duration(hours: 4),
    2 => const Duration(hours: 12),
    3 => const Duration(hours: 24),
    4 => const Duration(hours: 48),
    _ => const Duration(hours: 96),
  };

  bool get isOverdue => DateTime.now().isAfter(createdAt.add(_slaBudget));
}

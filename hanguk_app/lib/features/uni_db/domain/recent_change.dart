/// Row shape from `v_user_recent_changes` (plan §H.6).
class RecentChange {
  const RecentChange({
    required this.changeEventId,
    required this.detectedAt,
    required this.entityType,
    required this.entityId,
    required this.institutionId,
    required this.nameKo,
    this.nameEn,
    this.fieldName,
    this.reason,
    this.oldValue,
    this.newValue,
  });

  factory RecentChange.fromMap(Map<String, dynamic> map) => RecentChange(
    changeEventId: map['change_event_id'] as String,
    detectedAt: DateTime.parse(map['detected_at'].toString()),
    entityType: map['entity_type'] as String? ?? '',
    entityId: map['entity_id'] as String? ?? '',
    institutionId: map['institution_id'] as String? ?? '',
    nameKo: map['name_ko'] as String? ?? '',
    nameEn: map['name_en'] as String?,
    fieldName: map['field_name'] as String?,
    reason: map['reason'] as String?,
    oldValue: map['old_value'],
    newValue: map['new_value'],
  );

  final String changeEventId;
  final DateTime detectedAt;
  final String entityType;
  final String entityId;
  final String institutionId;
  final String nameKo;
  final String? nameEn;
  final String? fieldName;
  final String? reason;
  final dynamic oldValue;
  final dynamic newValue;

  bool get isCorrectionNotice => reason == 'correction_notice';
}

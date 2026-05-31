/// One per-applicant-category required-document row from
/// `public.documents_required`.
class DocumentRequirementRow {
  const DocumentRequirementRow({
    required this.id,
    required this.applicantCategory,
    required this.documentType,
    required this.isRequired,
    required this.isApostilleRequired,
    this.countrySpecific,
    this.notesKo,
  });

  factory DocumentRequirementRow.fromMap(Map<String, dynamic> map) =>
      DocumentRequirementRow(
        id: map['id'] as String,
        applicantCategory: (map['applicant_category'] as String?) ?? '',
        documentType: (map['document_type'] as String?) ?? '',
        isRequired: (map['is_required'] as bool?) ?? true,
        isApostilleRequired: (map['is_apostille_required'] as bool?) ?? false,
        countrySpecific: (map['country_specific'] as Map?)
            ?.cast<String, dynamic>(),
        notesKo: map['notes_ko'] as String?,
      );

  final String id;
  final String applicantCategory;
  final String documentType;
  final bool isRequired;
  final bool isApostilleRequired;

  /// Country-specific overrides, e.g.
  /// `{"UZ": {"requires_apostille": true},
  ///   "CN": {"requires_chesicc": true},
  ///   "_blocked_countries": ["UZ"]}`.
  final Map<String, dynamic>? countrySpecific;
  final String? notesKo;

  /// True when this document is unavailable to applicants from the
  /// given ISO country code.
  bool isBlockedFor(String countryCode) {
    final blocked = countrySpecific?['_blocked_countries'];
    if (blocked is List) {
      return blocked.contains(countryCode);
    }
    return false;
  }
}

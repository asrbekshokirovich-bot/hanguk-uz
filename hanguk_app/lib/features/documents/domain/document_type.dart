import '../../../l10n/app_localizations.dart';

class DocumentType {
  final String id;

  /// Short Korean label for the Seoul Night redesign (DESIGN_SPEC §1 Korean
  /// voice / §3.6). Its first syllable is the row's glyph tile (신 / 여 / 사)
  /// and the whole word is the row's hangul accent line — a decorative accent
  /// that stays Korean in every locale. The name the student reads comes from
  /// the ARB files via [localizedName].
  ///
  /// Optional so any [DocumentType] declared without one keeps compiling —
  /// the glyph tile falls back to 한.
  final String? nameKo;

  final bool required;
  final String? note;

  const DocumentType({
    required this.id,
    this.nameKo,
    this.required = false,
    this.note,
  });

  /// The document's name in the active app language.
  String localizedName(AppLocalizations l) {
    switch (id) {
      case 'applicant_id_card':
        return l.docTypeIdCard;
      case 'foreign_passport':
        return l.docTypeForeignPassport;
      case 'photo':
        return l.docTypePhoto;
      case 'diploma':
        return l.docTypeDiploma;
      case 'language_certificate':
        return l.docTypeLanguageCertificate;
      default:
        return l.docTypeOther;
    }
  }
}

class DocumentConstants {
  static const List<DocumentType> requiredDocuments = [
    DocumentType(id: 'applicant_id_card', nameKo: '신분증', required: true),
    DocumentType(id: 'foreign_passport', nameKo: '여권', required: true),
    DocumentType(id: 'photo', nameKo: '사진', required: true),
    DocumentType(id: 'diploma', nameKo: '졸업장', required: true),
    DocumentType(id: 'language_certificate', nameKo: '어학 증명서', required: true),
  ];
}

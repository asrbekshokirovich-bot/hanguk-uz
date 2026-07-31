class DocumentType {
  final String id;
  final String nameUz;
  final String nameEn;
  final String nameRu;

  /// Short Korean label for the Seoul Night redesign (DESIGN_SPEC §1 Korean
  /// voice / §3.6). Its first syllable is the row's glyph tile (신 / 여 / 사)
  /// and the whole word is the row's hangul accent line.
  ///
  /// Optional so any [DocumentType] declared without one keeps compiling —
  /// the glyph tile falls back to 한.
  final String? nameKo;

  final bool required;
  final String? note;

  const DocumentType({
    required this.id,
    required this.nameUz,
    required this.nameEn,
    required this.nameRu,
    this.nameKo,
    this.required = false,
    this.note,
  });
}

class DocumentConstants {
  static const List<DocumentType> requiredDocuments = [
    DocumentType(
      id: 'applicant_id_card',
      nameUz: "Topshiruvchining ID karta (pasport) nusxasi",
      nameEn: "Applicant's ID card (passport) copy",
      nameRu: "Копия ID-карты (паспорта) заявителя",
      nameKo: '신분증',
      required: true,
    ),
    DocumentType(
      id: 'foreign_passport',
      nameUz: "Topshiruvchining zagran pasporti nusxasi",
      nameEn: "Applicant's foreign passport copy",
      nameRu: "Копия загранпаспорта заявителя",
      nameKo: '여권',
      required: true,
    ),
    DocumentType(
      id: 'photo',
      nameUz: "Rasm (3.5x4.5)",
      nameEn: "Photo (3.5x4.5 cm)",
      nameRu: "Фото (3.5x4.5 см)",
      nameKo: '사진',
      required: true,
    ),
    DocumentType(
      id: 'diploma',
      nameUz: "Diplom yoki attestat nusxasi",
      nameEn: "Diploma or certificate copy",
      nameRu: "Копия диплома или аттестата",
      nameKo: '졸업장',
      required: true,
    ),
    DocumentType(
      id: 'language_certificate',
      nameUz: "Til sertifikat nusxasi (kamida IELTS 5.5 yoki TOPIK 2)",
      nameEn: "Language certificate (IELTS/TOPIK)",
      nameRu: "Языковой сертификат",
      nameKo: '어학 증명서',
      required: true,
    ),
  ];
}

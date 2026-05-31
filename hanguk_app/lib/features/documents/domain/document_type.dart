class DocumentType {
  final String id;
  final String nameUz;
  final String nameEn;
  final String nameRu;
  final bool required;
  final String? note;

  const DocumentType({
    required this.id,
    required this.nameUz,
    required this.nameEn,
    required this.nameRu,
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
      required: true,
    ),
    DocumentType(
      id: 'foreign_passport',
      nameUz: "Topshiruvchining zagran pasporti nusxasi",
      nameEn: "Applicant's foreign passport copy",
      nameRu: "Копия загранпаспорта заявителя",
      required: true,
    ),
    DocumentType(
      id: 'photo',
      nameUz: "Rasm (3.5x4.5)",
      nameEn: "Photo (3.5x4.5 cm)",
      nameRu: "Фото (3.5x4.5 см)",
      required: true,
    ),
    DocumentType(
      id: 'diploma',
      nameUz: "Diplom yoki attestat nusxasi",
      nameEn: "Diploma or certificate copy",
      nameRu: "Копия диплома или аттестата",
      required: true,
    ),
    DocumentType(
      id: 'language_certificate',
      nameUz: "Til sertifikat nusxasi (kamida IELTS 5.5 yoki TOPIK 2)",
      nameEn: "Language certificate (IELTS/TOPIK)",
      nameRu: "Языковой сертификат",
      required: true,
    ),
  ];
}

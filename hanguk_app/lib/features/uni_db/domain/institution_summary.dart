/// Summary returned by `v_institutions_for_map` (plan §C.17).
///
/// Pure data class — no Flutter imports — so it can move into
/// `domain/` if the layered architecture push-down happens later.
class InstitutionSummary {
  const InstitutionSummary({
    required this.id,
    required this.nameKo,
    this.nameKoShort,
    this.nameEn,
    this.nameUz,
    this.cityKo,
    this.latitude,
    this.longitude,
    this.logoUrl,
    this.tier,
    this.ieqasStatus,
    required this.isPartner,
    required this.isVisibleOnMap,
    this.lastVerifiedAt,
    this.nextEventAt,
  });

  factory InstitutionSummary.fromMap(Map<String, dynamic> map) =>
      InstitutionSummary(
        id: map['id'] as String,
        nameKo: map['name_ko'] as String? ?? '',
        nameKoShort: map['name_ko_short'] as String?,
        nameEn: map['name_en'] as String?,
        nameUz: map['name_uz'] as String?,
        cityKo: map['city_ko'] as String?,
        latitude: (map['latitude'] as num?)?.toDouble(),
        longitude: (map['longitude'] as num?)?.toDouble(),
        logoUrl: map['logo_url'] as String?,
        tier: (map['tier'] as num?)?.toInt(),
        ieqasStatus: map['ieqas_status'] as String?,
        isPartner: map['is_partner'] as bool? ?? false,
        isVisibleOnMap: map['is_visible_on_map'] as bool? ?? true,
        lastVerifiedAt: map['last_verified_at'] != null
            ? DateTime.tryParse(map['last_verified_at'].toString())
            : null,
        nextEventAt: map['next_event_at'] != null
            ? DateTime.tryParse(map['next_event_at'].toString())
            : null,
      );

  final String id;
  final String nameKo;
  final String? nameKoShort;
  final String? nameEn;
  final String? nameUz;
  final String? cityKo;
  final double? latitude;
  final double? longitude;
  final String? logoUrl;
  final int? tier;
  final String? ieqasStatus;
  final bool isPartner;
  final bool isVisibleOnMap;
  final DateTime? lastVerifiedAt;
  final DateTime? nextEventAt;
}

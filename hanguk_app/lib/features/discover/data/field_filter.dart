import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../catalog/data/ai_search.dart';

/// The filter board's "Yo'nalish" tiles (design screen 05). Each one is the
/// field search's text for it — the ones written beforehand in
/// `ai_search_terms` answer at once, without the model — and the icon the
/// design gives it. "Boshqa" opens the search to type any other field.
typedef FieldTile = ({String key, String query, LucideGlyph glyph});

const List<FieldTile> kFieldTiles = [
  (key: 'it', query: 'it', glyph: LucideIcons.laptop),
  (key: 'business', query: 'biznes', glyph: LucideIcons.briefcase),
  (key: 'engineering', query: 'muhandislik', glyph: LucideIcons.wrench),
  (key: 'medicine', query: 'tibbiyot', glyph: LucideIcons.stethoscope),
  (key: 'design', query: 'dizayn', glyph: LucideIcons.palette),
  (key: 'tourism', query: 'turizm', glyph: LucideIcons.plane),
  (key: 'education', query: 'pedagogika', glyph: LucideIcons.bookOpen),
];

/// The universities with a programme of the field [key] (a [kFieldTiles]
/// key), from the field search; null when it could not answer, so the
/// filter then leaves the field out rather than showing nothing.
final fieldUniversitiesProvider = FutureProvider.family<Set<String>?, String>((ref, key) async {
  final tile = kFieldTiles.where((t) => t.key == key).firstOrNull;
  if (tile == null) return null;
  final result = await ref.read(aiSearchCallProvider)(tile.query);
  if (result == null || !result.byField) return null;
  return {for (final h in result.hits) h.institutionId};
});

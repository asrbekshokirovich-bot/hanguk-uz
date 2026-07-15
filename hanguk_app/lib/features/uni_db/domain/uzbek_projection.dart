/// Uzbek-first projection of an AI-extracted `parsed_output` payload, for the
/// reviewer HITL surface (`/admin/review`).
///
/// The extractor stores Korean as the source of truth — `*_ko` fields plus a
/// couple of Korean-carrying fields that do not use the suffix
/// (`applicant_category`, `majors`). Since the "Uzbek translations" prompt
/// addendum (see services/uni_db `extract/prompt_assembler.py`) every one of
/// those ships an Uzbek sibling: `*_uz`, `applicant_category_uz`, `majors_uz`.
///
/// Reviewers read Uzbek, so [localizeToUzbek] walks the payload and, wherever an
/// Uzbek sibling exists, surfaces the Uzbek value under the plain base key and
/// drops the Korean original. Fields with no Uzbek sibling (legacy rows
/// extracted before the addendum shipped) are kept verbatim so the reviewer
/// still sees the data — [payloadHasUzbek] lets the UI flag those rows.
///
/// Pure: returns a brand-new structure and never mutates the input. The stored
/// payload stays the Korean source of truth for edit / accept / publish.
library;

/// Returns an Uzbek-projected copy of [value].
///
/// - For maps: any key ending in `_uz` is re-emitted under its base name
///   (`prose_uz` -> `prose`); the matching Korean counterparts (`<base>_ko` and
///   a plain `<base>`, e.g. `applicant_category`) are suppressed. Keys with no
///   Uzbek sibling pass through unchanged.
/// - For lists: each element is projected.
/// - Scalars (strings, numbers, bools, null) are returned as-is.
Object? localizeToUzbek(Object? value) {
  if (value is Map) {
    final map = value.cast<String, dynamic>();

    // Base names that carry an Uzbek sibling in this map. Their Korean
    // counterparts (`<base>_ko` and the plain `<base>`) are dropped in favour
    // of the Uzbek value, which is re-keyed to `<base>`.
    final uzBases = <String>{};
    for (final key in map.keys) {
      if (key.endsWith('_uz')) {
        uzBases.add(key.substring(0, key.length - 3));
      }
    }

    final result = <String, dynamic>{};
    for (final entry in map.entries) {
      final key = entry.key;
      if (key.endsWith('_uz')) {
        // Surface the Uzbek value under the clean base key.
        result[key.substring(0, key.length - 3)] = localizeToUzbek(entry.value);
      } else if (key.endsWith('_ko')) {
        final base = key.substring(0, key.length - 3);
        if (uzBases.contains(base)) continue; // Uzbek sibling wins.
        result[key] = localizeToUzbek(entry.value); // Legacy: no translation.
      } else {
        if (uzBases.contains(key)) continue; // e.g. applicant_category, majors.
        result[key] = localizeToUzbek(entry.value);
      }
    }
    return result;
  }

  if (value is List) {
    return value.map(localizeToUzbek).toList();
  }

  return value;
}

/// True when [value] contains at least one `*_uz` key anywhere in the tree —
/// i.e. the row was extracted after the Uzbek addendum shipped. The reviewer UI
/// uses this to warn that a legacy row is still shown in Korean.
bool payloadHasUzbek(Object? value) {
  if (value is Map) {
    for (final entry in value.entries) {
      if (entry.key is String && (entry.key as String).endsWith('_uz')) {
        return true;
      }
      if (payloadHasUzbek(entry.value)) return true;
    }
    return false;
  }
  if (value is List) {
    for (final element in value) {
      if (payloadHasUzbek(element)) return true;
    }
    return false;
  }
  return false;
}

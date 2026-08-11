import '../../../l10n/app_localizations.dart';

/// Human label for `institutions.ieqas_status`.
///
/// The column is a database enum — `outstanding`, `accredited`, `none` — and
/// screens were rendering it verbatim. On a card otherwise written in Uzbek a
/// student met the bare English word "outstanding", which names neither the
/// scheme it comes from nor what it certifies (the Korean Ministry of
/// Education's assurance that a university may host international students,
/// with `outstanding` its top grade).
///
/// Returns null for `none` and for anything unrecognised, so a caller shows no
/// chip rather than inventing a meaning for a value this build has never seen
/// — a new grade added server-side must not surface as raw text again.
String? ieqasLabel(AppLocalizations l, String? status) {
  switch (status) {
    case 'outstanding':
      return l.ieqasOutstanding;
    case 'accredited':
      return l.ieqasAccredited;
    default:
      return null;
  }
}

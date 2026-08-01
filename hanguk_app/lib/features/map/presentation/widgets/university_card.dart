import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/university.dart';

/// Matches a string that opens with a hangul syllable (U+AC00–U+D7A3).
final RegExp _hangulStart = RegExp(r'^[가-힣]');

/// A university row in the Map section list (DESIGN_SPEC §3.5).
///
/// Seoul Night shape: a glass card carrying the hangul glyph tile (the
/// university "avatar"), the name with its Korean label underneath, and the
/// metadata — city, quality tier, partner status — as chips.
///
/// The logo image the legacy card fetched is deliberately gone: §1 "Korean
/// voice" asks for a glyph avatar (서 / 연 / 고) in every list row, and a
/// bright PNG logo fights the dark surface. The detail sheet still shows the
/// real logo.
class UniversityCard extends StatelessWidget {
  final University university;
  final VoidCallback? onTap;

  /// Compare mode: swaps the chevron for a checkbox and makes [onTap] mean
  /// "toggle selection" rather than "open the detail sheet".
  final bool selectable;

  /// Whether this row is part of the current comparison selection.
  final bool selected;

  /// False dims the row and drops [onTap] — used when the comparison is
  /// already at its cap and this row is not one of the picks.
  final bool enabled;

  const UniversityCard({
    super.key,
    required this.university,
    this.onTap,
    this.selectable = false,
    this.selected = false,
    this.enabled = true,
  });

  /// The glyph for the avatar tile: first syllable of the Korean name, then
  /// of the (Korean) city, then the 한 brand mark. Anything that is not
  /// hangul falls through so a stray Latin letter never lands in the tile.
  String get _glyph {
    for (final candidate in <String?>[
      university.nameKoShort,
      university.nameKo,
      university.location,
    ]) {
      final trimmed = (candidate ?? '').trim();
      if (_hangulStart.hasMatch(trimmed)) {
        return HangulGlyphTile.firstSyllable(trimmed);
      }
    }
    return '한';
  }

  /// Korean sub-label beside the name. Falls back to the decorative 대학
  /// when the institution has no Korean name, or when the resolved display
  /// name already *is* the Korean one (Korean locale) — repeating it would
  /// read as a duplicate rather than an accent.
  String get _koLabel {
    for (final candidate in <String?>[
      university.nameKoShort,
      university.nameKo,
    ]) {
      final trimmed = (candidate ?? '').trim();
      if (trimmed.isNotEmpty && trimmed != university.name) return trimmed;
    }
    return '대학';
  }

  /// City · tier · partner, as chips. Tier semantics are the post-audit-M3
  /// `tier` (0–4) column: tier ≤ 1 is "Top", 2–4 render the number, and an
  /// unclassified institution renders no tier chip at all.
  List<Widget> _chips(AppLocalizations l) {
    final tier = university.tier;
    return <Widget>[
      StatusChip(label: university.location, dense: true),
      if (tier != null)
        university.isTopTier
            ? StatusChip(label: l.filterTop, tone: StatusTone.info, dense: true)
            : StatusChip(label: l.universityTier(tier), dense: true),
      if (university.isPartner)
        StatusChip(
          label: l.filterPartner,
          tone: StatusTone.lime,
          ko: '파트너',
          dense: true,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    // MergeSemantics on the outside so the button flag and every label inside
    // collapse into one node — a screen reader announces the whole row once.
    return MergeSemantics(
      child: Semantics(
        button: !selectable,
        // In compare mode the row is a checkbox, and a screen reader should
        // say so — and say whether it is currently picked.
        checked: selectable ? selected : null,
        enabled: enabled,
        child: Opacity(
          opacity: enabled ? 1 : 0.45,
          child: GlassCard(
            onTap: enabled ? onTap : null,
            margin: const EdgeInsets.symmetric(
              horizontal: SeoulSizes.screenPadding,
              vertical: 5,
            ),
            padding: const EdgeInsets.fromLTRB(15, 15, 13, 15),
            radius: SeoulRadii.tile,
            // Dozens of these scroll past; each blurred card would cost its
            // own saved layer (see GlassCard.blur).
            blur: false,
            // A lime hairline is the selected state — the fill stays glass so
            // a selected row still reads as the same surface.
            borderColor: selectable && selected ? SeoulColors.lime : null,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    HangulGlyphTile(glyph: _glyph),
                    const SizedBox(width: 12),
                    Expanded(
                      child: HangulTag(
                        en: university.name,
                        ko: _koLabel,
                        titleStyle: SeoulType.subtitle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    if (selectable)
                      Icon(
                        selected
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked_rounded,
                        color: selected
                            ? SeoulColors.lime
                            : SeoulColors.textFaint,
                        size: 22,
                      )
                    else
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: SeoulColors.textFaint,
                        size: 20,
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(spacing: 8, runSpacing: 8, children: _chips(l)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

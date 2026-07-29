import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/uni_db_providers.dart';
import '../domain/institution_summary.dart';

/// `/institutions/compare?ids=a,b` — side-by-side institution comparison.
///
/// Seoul Night pass (DESIGN_SPEC §3b.10): one glass column per institution —
/// glyph tile + name on top, then keyed rows with eyebrow labels. Categorical
/// values render as [StatusChip]s and the tier as a [GlowProgressBar]
/// (tier 0 = flagship = full bar). Columns keep a fixed width and scroll
/// horizontally so the comparison stays readable on a narrow screen.
class InstitutionCompareScreen extends ConsumerWidget {
  const InstitutionCompareScreen({super.key, required this.ids});

  final List<String> ids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(compareInstitutionsProvider(ids));
    final l = AppLocalizations.of(context)!;

    return SeoulNightScaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              12,
              SeoulSizes.screenPadding,
              4,
            ),
            child: Row(
              children: [
                _GlassCircleButton(
                  icon: Icons.arrow_back_rounded,
                  tooltip: l.a11yTooltipBack,
                  onTap: () => Navigator.of(context).maybePop(),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: HangulTag(
                    en: l.uniDbCompareTitle,
                    ko: '비교',
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: asyncRows.when(
              loading: () => const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
                ),
              ),
              error: (e, _) => _CenteredMessage(
                icon: Icons.error_outline,
                title: l.genericError(e),
              ),
              data: (rows) {
                if (rows.isEmpty) {
                  return _CenteredMessage(
                    icon: Icons.compare_arrows,
                    title: l.uniDbCompareEmptyTitle,
                    body: l.uniDbCompareEmptyBody,
                  );
                }
                if (rows.length == 1) {
                  return _CenteredMessage(
                    icon: Icons.compare_arrows,
                    title: l.uniDbCompareNeedSecond,
                    body: l.uniDbCompareSelected(rows.first.nameKo),
                  );
                }
                return _CompareGrid(institutions: rows);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CompareGrid extends StatelessWidget {
  const _CompareGrid({required this.institutions});
  final List<InstitutionSummary> institutions;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 32),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: SeoulSizes.screenPadding,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < institutions.length; i++) ...[
              if (i > 0) const SizedBox(width: 12),
              _CompareColumn(institution: institutions[i]),
            ],
          ],
        ),
      ),
    );
  }
}

/// One glass column of the comparison grid.
class _CompareColumn extends StatelessWidget {
  const _CompareColumn({required this.institution});
  final InstitutionSummary institution;

  /// Fixed column width: two columns fill a typical phone, and the row
  /// scrolls horizontally for anything wider than the viewport.
  static const double _width = 220;

  /// tier 0 (flagship) → full bar, tier 4 → empty. Tiers run 0–4 on
  /// `institutions` (see University.isTopTier).
  static double _tierProgress(int tier) => (4 - tier) / 4;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final i = institution;
    final nameKoShort = (i.nameKoShort ?? '').trim();

    return GlassCard(
      width: _width,
      padding: const EdgeInsets.fromLTRB(15, 16, 15, 16),
      radius: SeoulRadii.card,
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HangulGlyphTile(
                glyph: HangulGlyphTile.firstSyllable(i.nameKoShort ?? i.nameKo),
                size: 40,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      i.nameKo,
                      style: SeoulType.subtitle,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (nameKoShort.isNotEmpty && nameKoShort != i.nameKo) ...[
                      const SizedBox(height: 2),
                      Text(
                        nameKoShort,
                        style: SeoulType.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          _CompareField(label: l.uniDbColEnglishName, child: _text(i.nameEn)),
          _CompareField(label: l.uniDbColUzbekName, child: _text(i.nameUz)),
          _CompareField(label: l.guestRowCity, child: _text(i.cityKo)),
          _CompareField(
            label: l.guestRowTier,
            child: i.tier == null
                ? _text(null)
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      StatusChip(
                        label: l.universityTier(i.tier!),
                        tone: i.tier! <= 1 ? StatusTone.lime : StatusTone.info,
                        dense: true,
                      ),
                      const SizedBox(height: 8),
                      GlowProgressBar(value: _tierProgress(i.tier!)),
                    ],
                  ),
          ),
          _CompareField(
            label: l.guestRowIeqas,
            child: i.ieqasStatus == null
                ? _text(null)
                : StatusChip(
                    label: i.ieqasStatus!,
                    tone: StatusTone.info,
                    dense: true,
                  ),
          ),
          _CompareField(
            label: l.guestRowPartner,
            child: i.isPartner
                ? StatusChip(
                    label: l.filterPartner,
                    tone: StatusTone.lime,
                    ko: '파트너',
                    dense: true,
                  )
                : _text(null),
          ),
          _CompareField(
            label: l.uniDbColLastVerified,
            child: _text(_date(i.lastVerifiedAt)),
          ),
          _CompareField(
            label: l.guestRowNextEvent,
            child: i.nextEventAt == null
                ? _text(null)
                : StatusChip(
                    label: _date(i.nextEventAt)!,
                    tone: StatusTone.warning,
                    dense: true,
                  ),
          ),
        ],
      ),
    );
  }

  static String? _date(DateTime? d) => d?.toIso8601String().split('T').first;

  /// Plain value cell; em dash when the institution has no data for the row.
  static Widget _text(String? value) {
    final v = (value ?? '').trim();
    return Text(
      v.isEmpty ? '—' : v,
      style: SeoulType.bodySecondary,
      maxLines: 3,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// One keyed row of a compare column: hairline on top, uppercase eyebrow
/// label, then the value (text, chip or bar).
class _CompareField extends StatelessWidget {
  const _CompareField({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.only(top: 9),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: SeoulColors.glassBorder, width: 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: SeoulType.eyebrow,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 5),
          child,
        ],
      ),
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  const _CenteredMessage({required this.icon, required this.title, this.body});

  final IconData icon;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: SeoulColors.textFaint),
            const SizedBox(height: 12),
            Text(title, textAlign: TextAlign.center, style: SeoulType.subtitle),
            if (body != null) ...[
              const SizedBox(height: 8),
              Text(
                body!,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Glass back circle — the section-header affordance from DESIGN_SPEC §2.
class _GlassCircleButton extends StatelessWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: SeoulColors.glass,
              border: Border.all(color: SeoulColors.glassBorder),
            ),
            child: Icon(icon, size: 20, color: SeoulColors.textPrimary),
          ),
        ),
      ),
    );
  }
}

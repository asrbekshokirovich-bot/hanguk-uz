import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/uni_db_providers.dart';
import '../domain/institution_facts.dart';
import '../domain/institution_summary.dart';
import 'event_labels.dart';

/// `/institutions/compare?ids=a,b` — side-by-side institution comparison.
///
/// Seoul Night pass (DESIGN_SPEC §3b.10): one glass column per institution —
/// glyph tile + name on top, then keyed rows with eyebrow labels. Categorical
/// values render as [StatusChip]s and the tier as a [GlowProgressBar]
/// (tier 0 = flagship = full bar). Columns keep a fixed width and scroll
/// horizontally so the comparison stays readable on a narrow screen.
///
/// The rows are ordered the way a student decides: **cost, then Korean
/// level, then deadline, then money back, then paperwork** — the things that
/// rule a university in or out — with the identity fields (English/Uzbek
/// name, city) and the trust signals (tier, IEQAS, last verified) below
/// them. Those decision rows come from [compareFactsProvider], which reduces
/// the same `tuition` / `requirements` / `cycle_dates` / `scholarships` /
/// `documents_required` rows the detail screen renders in full.
///
/// A blank cell means *the guideline for that university has not been parsed
/// and reviewed yet*, not "zero" — see [_CompareColumn._pending].
class InstitutionCompareScreen extends ConsumerWidget {
  const InstitutionCompareScreen({super.key, required this.ids});

  final List<String> ids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The providers key on the csv string, not the list: see
    // compareInstitutionsProvider for why a List key breaks caching.
    final idsCsv = ids.join(',');
    final asyncRows = ref.watch(compareInstitutionsProvider(idsCsv));
    final asyncFacts = ref.watch(compareFactsProvider(idsCsv));
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
                // Facts load alongside the names rather than gating them:
                // the columns render immediately with the identity rows and
                // the decision rows fill in a moment later.
                return _CompareGrid(
                  institutions: rows,
                  facts: asyncFacts.valueOrNull,
                  factsLoading: asyncFacts.isLoading,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CompareGrid extends StatelessWidget {
  const _CompareGrid({
    required this.institutions,
    required this.facts,
    required this.factsLoading,
  });

  final List<InstitutionSummary> institutions;
  final Map<String, InstitutionFacts>? facts;
  final bool factsLoading;

  @override
  Widget build(BuildContext context) {
    // The cheapest published tuition and the lowest published TOPIK bar get
    // a "best" accent, but only when more than one column actually has the
    // figure — highlighting the only university that published a number
    // would read as a recommendation rather than a comparison.
    final published = institutions
        .map((i) => facts?[i.id])
        .whereType<InstitutionFacts>()
        .toList();
    final tuitionValues = published
        .map((f) => f.tuitionMinKrw)
        .whereType<int>()
        .toList();
    final topikValues = published
        .map((f) => f.topikMinLevel)
        .whereType<int>()
        .toList();
    final cheapestTuition = tuitionValues.length > 1
        ? tuitionValues.reduce((a, b) => a < b ? a : b)
        : null;
    final lowestTopik = topikValues.length > 1
        ? topikValues.reduce((a, b) => a < b ? a : b)
        : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 32),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: SeoulSizes.screenPadding,
        ),
        // Columns stay top-aligned rather than stretched to a shared height:
        // every cell carries its own eyebrow label, so a shorter column
        // reads fine, and IntrinsicHeight would make the glass cards pay for
        // an extra layout pass to gain nothing.
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < institutions.length; i++) ...[
              if (i > 0) const SizedBox(width: 12),
              _CompareColumn(
                institution: institutions[i],
                facts: facts?[institutions[i].id],
                factsLoading: factsLoading,
                cheapestTuitionKrw: cheapestTuition,
                lowestTopikLevel: lowestTopik,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One glass column of the comparison grid.
class _CompareColumn extends StatelessWidget {
  const _CompareColumn({
    required this.institution,
    required this.facts,
    required this.factsLoading,
    this.cheapestTuitionKrw,
    this.lowestTopikLevel,
  });

  final InstitutionSummary institution;

  /// Null while [compareFactsProvider] is still in flight, or if it failed —
  /// the identity rows render either way.
  final InstitutionFacts? facts;
  final bool factsLoading;

  /// The best figure across the columns being compared, or null when only
  /// one column published it. Used to accent, not to rank.
  final int? cheapestTuitionKrw;
  final int? lowestTopikLevel;

  /// Fixed column width: two columns fill a typical phone, and the row
  /// scrolls horizontally for anything wider than the viewport.
  static const double _width = 220;

  /// tier 0 (flagship) → full bar, tier 3 → nearly empty. Tiers run 0–4 on
  /// `institutions` (see University.isTopTier).
  ///
  /// Tier 4 means *unclassified*, not "worst" — 7 institutions carry it — so
  /// it gets no bar at all. A 0.0 bar reads as "measured and scored zero",
  /// which is a claim nobody made.
  static double _tierProgress(int tier) => (4 - tier) / 4;

  /// Whether a bar should be drawn for this tier at all.
  static bool _tierIsRanked(int? tier) => tier != null && tier < 4;

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
          // ── What a student decides on ────────────────────────────────
          _CompareField(
            label: l.uniDbColTuition,
            child: _tuitionCell(l),
          ),
          _CompareField(label: l.uniDbColKorean, child: _koreanCell(l)),
          _CompareField(
            label: l.uniDbColNextDeadline,
            child: _deadlineCell(l),
          ),
          _CompareField(
            label: l.uniDbScholarshipsHeading,
            child: _scholarshipCell(l),
          ),
          _CompareField(label: l.uniDbColInterview, child: _interviewCell(l)),
          _CompareField(label: l.uniDbColDocuments, child: _documentsCell(l)),

          // ── Identity and trust signals ───────────────────────────────
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
                      if (_tierIsRanked(i.tier)) ...[
                        const SizedBox(height: 8),
                        GlowProgressBar(value: _tierProgress(i.tier!)),
                      ],
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
          // The former "next event" row is gone — the deadline cell above
          // names the event and dates it, where this only had a bare date.
          _CompareField(
            label: l.uniDbColLastVerified,
            child: _text(_date(i.lastVerifiedAt)),
          ),
        ],
      ),
    );
  }

  // ── Decision cells ──────────────────────────────────────────────────────
  // Each renders one of three states: the published value, a spinner-free
  // "…" while the bulk query is in flight, or "not published yet". They never
  // fall back to a zero — a university with no parsed guideline must not read
  // as free tuition or no Korean requirement.

  Widget _tuitionCell(AppLocalizations l) {
    final f = facts;
    if (f == null) return _pending();
    final label = f.tuitionLabel;
    if (label == null) return _notPublished(l);

    final isCheapest =
        cheapestTuitionKrw != null && f.tuitionMinKrw == cheapestTuitionKrw;
    final fee = f.admissionFeeKrw;
    final year = f.academicYear;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Flexible(
              child: Text(
                label,
                style: SeoulType.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isCheapest) ...[
              const SizedBox(width: 6),
              StatusChip(
                label: l.uniDbLowest,
                tone: StatusTone.lime,
                dense: true,
              ),
            ],
          ],
        ),
        if (fee != null) ...[
          const SizedBox(height: 3),
          Text(
            l.uniDbAdmissionFee(formatKrw(fee)),
            style: SeoulType.caption,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (year != null) ...[
          const SizedBox(height: 3),
          Text(
            l.uniDbAcademicYear(year),
            style: SeoulType.caption,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }

  Widget _koreanCell(AppLocalizations l) {
    final f = facts;
    if (f == null) return _pending();
    if (!f.hasRequirementsRow) return _notPublished(l);

    final topik = f.topikLabel;
    final english = f.englishTestLabel;
    final gpa = f.gpaFloorPct;
    final isLowest =
        lowestTopikLevel != null && f.topikMinLevel == lowestTopikLevel;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Flexible(
              child: Text(
                // A verified cycle that names no TOPIK floor is a real
                // answer ("no minimum stated"), distinct from an
                // unparsed guideline.
                topik ?? l.uniDbTopikNoMinimum,
                style: SeoulType.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (topik != null && isLowest) ...[
              const SizedBox(width: 6),
              StatusChip(
                label: l.uniDbLowest,
                tone: StatusTone.lime,
                dense: true,
              ),
            ],
          ],
        ),
        if (f.topikDeferred) ...[
          const SizedBox(height: 4),
          StatusChip(
            label: l.uniDbTopikDeferred,
            tone: StatusTone.info,
            dense: true,
          ),
        ],
        if (english != null) ...[
          const SizedBox(height: 3),
          Text(
            english,
            style: SeoulType.caption,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (gpa != null) ...[
          const SizedBox(height: 3),
          Text(
            l.uniDbGpaChip(gpa.toStringAsFixed(0)),
            style: SeoulType.caption,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }

  Widget _deadlineCell(AppLocalizations l) {
    final f = facts;
    if (f == null) return _pending();
    final at = f.nextDeadlineAt;
    final event = f.nextDeadlineEvent;
    if (at == null || event == null) return _notPublished(l);

    final daysUntil = at.difference(DateTime.now()).inDays;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eventLabel(l, event),
          style: SeoulType.body,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        StatusChip(
          label: DateFormat.yMMMd().format(at),
          // Under a week out is the same urgency threshold the detail
          // screen's deadline tile uses.
          tone: daysUntil < 7 ? StatusTone.warning : StatusTone.info,
          dense: true,
        ),
        if (f.nextDeadlineIsTentative) ...[
          const SizedBox(height: 3),
          Text(
            l.uniDbTentative,
            style: SeoulType.caption,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }

  Widget _scholarshipCell(AppLocalizations l) {
    final f = facts;
    if (f == null) return _pending();
    if (f.scholarshipCount == 0) return _notPublished(l);

    final best = f.bestScholarship;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.uniDbScholarshipsCount(f.scholarshipCount),
          style: SeoulType.body,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (best != null) ...[
          const SizedBox(height: 4),
          StatusChip(label: best.awardLabel, tone: StatusTone.lime, dense: true),
        ],
      ],
    );
  }

  Widget _interviewCell(AppLocalizations l) {
    final f = facts;
    if (f == null) return _pending();
    if (!f.hasRequirementsRow) return _notPublished(l);
    return StatusChip(
      label: f.interviewRequired
          ? l.uniDbInterviewRequired
          : l.uniDbInterviewNotRequired,
      tone: f.interviewRequired ? StatusTone.warning : StatusTone.info,
      dense: true,
    );
  }

  Widget _documentsCell(AppLocalizations l) {
    final f = facts;
    if (f == null) return _pending();
    if (f.documentCount == 0) return _notPublished(l);
    return Text(
      l.uniDbDocumentsCount(f.documentCount),
      style: SeoulType.body,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  /// Facts still loading (or the facts query failed, which leaves the
  /// identity columns useful rather than blanking the screen).
  Widget _pending() =>
      Text(factsLoading ? '…' : '—', style: SeoulType.bodySecondary);

  /// The guideline for this university has not been parsed and reviewed
  /// yet. Deliberately not an em dash: an empty cell next to a filled one
  /// reads as "this university charges nothing / requires nothing".
  Widget _notPublished(AppLocalizations l) => Text(
    l.uniDbNotPublishedYet,
    style: SeoulType.caption,
    maxLines: 2,
    overflow: TextOverflow.ellipsis,
  );

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

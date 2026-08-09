// `show ImageFilter` only: an unrestricted `dart:ui` import would make
// `Image` ambiguous with the widget of the same name used below.
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../uni_db/data/uni_db_providers.dart';
import '../../../uni_db/domain/institution_facts.dart';
import '../../../uni_db/presentation/event_labels.dart';
import '../../data/map_analytics.dart';
import '../../domain/university.dart';
import 'virtual_tour_screen.dart';

/// Matches a string that opens with a hangul syllable (U+AC00–U+D7A3).
final RegExp _hangulStart = RegExp(r'^[가-힣]');

/// The university detail sheet (DESIGN_SPEC §3.5).
///
/// Glass over the blurred map: a backdrop blur behind a `mapWater` wash, one
/// lime primary action (the best available campus tour) and outline
/// secondaries for everything else — §4 keeps lime to a single action.
class UniversityDetailSheet extends ConsumerWidget {
  final University university;

  const UniversityDetailSheet({super.key, required this.university});

  /// First syllable of the Korean name, then of the (Korean) city, then the
  /// 한 brand mark — never a stray Latin letter in a hangul tile.
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

  /// Korean accent under the name. Falls back to the decorative 대학 when the
  /// institution has no Korean name, or when the display name already is it.
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Audit M20 (2026-05-12): cache the analytics sink up-front so
    // every action callback gets the same instance and doesn't
    // re-read on rebuild.
    final analytics = ref.read(mapAnalyticsProvider);
    final l = AppLocalizations.of(context)!;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(SeoulRadii.hero),
          ),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: DecoratedBox(
              decoration: BoxDecoration(
                // Deep enough to keep body copy legible over the map, sheer
                // enough that the blur behind it still reads as glass.
                color: SeoulColors.mapWater.withValues(alpha: 0.92),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(SeoulRadii.hero),
                ),
                border: Border.all(color: SeoulColors.glassBorder, width: 1),
              ),
              child: Column(
                children: [
                  // Drag handle
                  Padding(
                    padding: const EdgeInsets.only(top: 12, bottom: 4),
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: SeoulColors.glassBorder,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ── Header ────────────────────────────────
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildAvatar(72),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    HangulTag(
                                      en: university.name,
                                      ko: _koLabel,
                                      titleStyle: SeoulType.title,
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.location_on_outlined,
                                          size: 14,
                                          color: SeoulColors.textFaint,
                                        ),
                                        const SizedBox(width: 4),
                                        Flexible(
                                          child: Text(
                                            university.location,
                                            style: SeoulType.bodySecondary,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (university.isPartner) ...[
                                      const SizedBox(height: 8),
                                      StatusChip(
                                        label: l.filterPartner,
                                        tone: StatusTone.lime,
                                        ko: '파트너',
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),

                          // Audit M4 (2026-05-11): the legacy stats row
                          // showed `ranking` and `localRank` from columns
                          // that no longer exist on `institutions`.
                          // Replaced with the new tier + next-event
                          // signals sourced from `v_institutions_for_map`.
                          _buildSignalsRow(l),

                          // Audit M4 (2026-05-11) removed the legacy
                          // Annual Tuition / Acceptance Rate rows: they
                          // read from the dropped `universities` table and
                          // always rendered empty. The facts strip below
                          // restores the same *questions* from the uni_db
                          // tables that actually hold the answers, and
                          // renders nothing at all when a university has
                          // no reviewed guideline yet.
                          _QuickFacts(institutionId: university.id),

                          const SizedBox(height: 20),
                          const Divider(
                            color: SeoulColors.glassBorder,
                            height: 1,
                          ),
                          const SizedBox(height: 20),

                          ..._buildActions(context, l, analytics),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Campus-tour and website entries.
  ///
  /// Audit M17 / M18 (2026-05-12): a curated Pannellum tour (`virtualTour`
  /// JSONB) wins; an external VR page (`walkaroundUrl`) is the next best; the
  /// Kakao Roadview walkaround is the fallback and is always offered when the
  /// institution has coordinates. Spec §4 allows exactly one lime action, so
  /// whichever tour ranks highest takes it and the rest are outlines.
  List<Widget> _buildActions(
    BuildContext context,
    AppLocalizations l,
    MapAnalytics analytics,
  ) {
    final walkaroundUrl = university.walkaroundUrl;
    final hasCuratedTour = university.hasVirtualTour;
    // Audit M9 (2026-05-11): navigation goes through go_router
    // (`/walkaround/:institutionId`) so deep-links work.
    final hasRoadview =
        university.latitude != null && university.longitude != null;
    final primaryDomain = university.primaryDomain;

    final actions = <Widget>[
      // The route to everything the guideline actually says — tuition,
      // requirements, scholarships, the document checklist and the full
      // deadline calendar. `/institutions/:id` has existed since the uni_db
      // Phase 3 work but nothing navigated to it, so the detail screen was
      // unreachable from the app.
      SeoulOutlineButton(
        label: l.uniDbViewFullDetails,
        icon: Icons.article_outlined,
        onPressed: () => context.push('/institutions/${university.id}'),
      ),
    ];

    if (hasCuratedTour) {
      actions.add(
        LimeButton(
          label: l.virtualTourTitle,
          icon: Icons.threesixty,
          onPressed: () {
            analytics.virtualTourOpen(university.id);
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => VirtualTourScreen(
                  institutionName: university.name,
                  tourSpec: university.virtualTour!,
                ),
              ),
            );
          },
        ),
      );
    } else if (walkaroundUrl != null && walkaroundUrl.isNotEmpty) {
      final externalTourUrl = walkaroundUrl;
      actions.add(
        SeoulOutlineButton(
          label: l.virtualTourTitle,
          icon: Icons.open_in_new_rounded,
          onPressed: () {
            analytics.virtualTourOpen(university.id, sceneId: 'external');
            _launchWebsite(externalTourUrl);
          },
        ),
      );
    }

    if (hasRoadview) {
      void openWalkaround() {
        analytics.walkaroundOpen(university.id);
        context.push('/walkaround/${university.id}', extra: university);
      }

      actions.add(
        hasCuratedTour
            ? SeoulOutlineButton(
                label: l.virtualWalkaroundTitle,
                icon: Icons.threesixty,
                onPressed: openWalkaround,
              )
            : LimeButton(
                label: l.virtualWalkaroundTitle,
                icon: Icons.threesixty,
                onPressed: openWalkaround,
              ),
      );
    }

    // Visit Website Button — uses the university's official homepage domain
    // (institutions.primary_domain). The old `website` field was deprecated
    // and always null, so this button never showed; primaryDomain is
    // populated for every institution. _launchWebsite prepends https://.
    if (primaryDomain != null && primaryDomain.isNotEmpty) {
      final domain = primaryDomain;
      actions.add(
        SeoulOutlineButton(
          label: l.visitUniversityWebsite,
          icon: Icons.open_in_browser_rounded,
          onPressed: () {
            analytics.universityWebsiteOpen(university.id, domain);
            _launchWebsite(domain);
          },
        ),
      );
    }

    // 12px gutter between stacked actions.
    return <Widget>[
      for (var i = 0; i < actions.length; i++) ...[
        if (i > 0) const SizedBox(height: 12),
        actions[i],
      ],
    ];
  }

  /// The institution's real logo in a glass tile, falling back to the hangul
  /// glyph avatar when there is no logo (or it fails to load).
  Widget _buildAvatar(double size) {
    final url = university.logoUrl;
    if (url == null || url.isEmpty) {
      return HangulGlyphTile(glyph: _glyph, size: size);
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: SeoulColors.glass,
        borderRadius: SeoulRadii.tileR,
        border: Border.all(color: SeoulColors.glassBorder, width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(9),
        // Decorative — the university name appears in the same header.
        child: Image.network(
          url,
          fit: BoxFit.contain,
          excludeFromSemantics: true,
          errorBuilder: (_, _, _) => _glyphFallback(size),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return const Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    SeoulColors.textFaint,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _glyphFallback(double size) {
    return Center(
      child: Text(
        _glyph,
        style: SeoulType.hangulGlyph.copyWith(fontSize: size * 0.42),
      ),
    );
  }

  /// Audit M4 (2026-05-11): replaces the legacy ranking-based stats
  /// row with the new institutions-shape signals — Tier, Verified
  /// (IEQAS) status, and the next admission-cycle event. Renders
  /// nothing when no signals are present (rather than rendering an
  /// empty card).
  Widget _buildSignalsRow(AppLocalizations l) {
    final chips = <Widget>[];
    final tier = university.tier;

    if (tier != null) {
      chips.add(
        university.isTopTier
            ? StatusChip(label: l.filterTop, tone: StatusTone.info, ko: '상위')
            : StatusChip(label: l.universityTier(tier)),
      );
    }

    if (university.isAccredited) {
      chips.add(
        StatusChip(
          label: l.universityVerified,
          tone: StatusTone.lime,
          ko: '인증',
        ),
      );
    }

    final nextEventAt = university.nextEventAt;
    if (nextEventAt != null) {
      chips.add(
        StatusChip(
          label:
              '${l.universityNextEvent} · '
              '${DateFormat.MMMd().format(nextEventAt)}',
          tone: StatusTone.warning,
        ),
      );
    }

    if (chips.isEmpty) return const SizedBox.shrink();

    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }

  Future<void> _launchWebsite(String url) async {
    // Audit M10 (P1; pulled forward as a hygiene fix during the P0
    // batch): use `Uri.tryParse` so a malformed url doesn't throw on
    // the UI thread.
    final uri = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

/// The three facts a student weighs before tapping through: what it costs,
/// what Korean level it asks for, and when the next date is.
///
/// Sourced from [institutionFactsProvider] — the same reduced rows the
/// compare grid uses, so a figure never disagrees between the two screens.
/// Renders nothing while loading, on error, or when the institution has no
/// reviewed guideline: a sheet that silently stays as it was is better than
/// one that flashes a row of em dashes over the map.
class _QuickFacts extends ConsumerWidget {
  const _QuickFacts({required this.institutionId});

  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final facts = ref.watch(institutionFactsProvider(institutionId)).valueOrNull;
    if (facts == null || !facts.hasAnyData) return const SizedBox.shrink();

    final rows = <Widget>[
      if (facts.tuitionLabel != null)
        _FactRow(
          icon: Icons.payments_outlined,
          label: l.uniDbColTuition,
          value: facts.tuitionLabel!,
        ),
      if (facts.hasRequirementsRow)
        _FactRow(
          icon: Icons.translate_rounded,
          label: l.uniDbColKorean,
          value: facts.topikLabel ?? l.uniDbTopikNoMinimum,
        ),
      if (facts.nextDeadlineAt != null && facts.nextDeadlineEvent != null)
        _FactRow(
          icon: Icons.event_outlined,
          label: eventLabel(l, facts.nextDeadlineEvent!),
          value: DateFormat.yMMMd().format(facts.nextDeadlineAt!),
        ),
      if (facts.scholarshipCount > 0)
        _FactRow(
          icon: Icons.school_outlined,
          label: l.uniDbScholarshipsHeading,
          value: l.uniDbScholarshipsCount(facts.scholarshipCount),
        ),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            rows[i],
          ],
        ],
      ),
    );
  }
}

/// Icon, eyebrow label, then the value pushed to the trailing edge.
class _FactRow extends StatelessWidget {
  const _FactRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Row(
        children: [
          Icon(icon, size: 16, color: SeoulColors.textFaint),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: SeoulType.bodySecondary,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              value,
              style: SeoulType.body,
              textAlign: TextAlign.end,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}


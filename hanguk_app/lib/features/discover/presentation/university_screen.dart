import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/campus_photos.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../../assessment/data/assessment_controller.dart';
import '../data/application_windows.dart';
import '../data/chances.dart';
import '../data/qs_ranking.dart';
import '../data/slots.dart';
import 'discover_routes.dart';
import 'widgets/app_nav.dart';
import 'widgets/fd_bottom_nav.dart';
import 'widgets/fd_parts.dart';
import 'widgets/page_tour.dart';
import '../data/board_tour.dart';

/// "Universitet sahifasi" (design screen 10, as of 2026-10-21): the photo,
/// four facts — city, contract, language, the documents' last day — and the
/// question that opens this university's assessment.
class UniversityScreen extends ConsumerStatefulWidget {
  const UniversityScreen({super.key, required this.institutionId});

  final String institutionId;

  @override
  ConsumerState<UniversityScreen> createState() => _UniversityScreenState();
}

class _UniversityScreenState extends ConsumerState<UniversityScreen> {
  @override
  void initState() {
    super.initState();
    AppEvents.track('university_open', props: {'institution_id': widget.institutionId});
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final catalog = ref.watch(catalogProvider);
    final u = catalog.value?.where((u) => u.institutionId == widget.institutionId).firstOrNull;

    return Scaffold(
      backgroundColor: Colors.transparent,
      bottomNavigationBar: const AppNav(current: AppTab.universities),
      floatingActionButton: const AppNavOrb(current: AppTab.universities),
      floatingActionButtonLocation: kFdNavOrbLocation,
      body: FdPage(
        child: u == null
            ? catalog.isLoading
                  ? const Center(child: CircularProgressIndicator(color: FdColors.lime))
                  : SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            HardIconButton(
                              glyph: LucideIcons.chevronLeft,
                              size: 40,
                              radius: 12,
                              iconSize: 18,
                              semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                              onTap: () => _back(context),
                            ),
                            const Spacer(),
                            Center(child: Text(l.uniDbLoadFailed, style: fdText(14, FontWeight.w600, FdColors.onPage))),
                            const SizedBox(height: 12),
                            Center(
                              child: SeoulOutlineButton(
                                label: l.commonRetry,
                                expand: false,
                                onPressed: () => ref.invalidate(catalogProvider),
                              ),
                            ),
                            const Spacer(),
                          ],
                        ),
                      ),
                    )
            : PageTour(
                name: 'university',
                seen: tourSeenProvider('university'),
                steps: (context) {
                  Widget icon(LucideGlyph g) => Lucide(g, size: 16, color: FdColors.onLime);
                  return [
                    TourStep(l.tuHero, icon: icon(LucideIcons.graduationCap)),
                    TourStep(l.tuFacts, icon: icon(LucideIcons.calendar)),
                    TourStep(l.tuAsk, icon: icon(LucideIcons.target)),
                    TourStep(l.tuPick, icon: icon(LucideIcons.heart)),
                  ];
                },
                builder: (context, keys) => _body(context, l, u, keys),
              ),
      ),
    );
  }

  void _back(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(kDiscoverPath);
    }
  }

  Widget _body(BuildContext context, AppLocalizations l, CatalogUniversity u, List<GlobalKey> keys) {
    final book = ref.watch(chanceBookProvider);
    final g = book.guidelineOf(u);
    final slots = ref.watch(slotsProvider);
    final slot = slots.indexOf(u.institutionId);
    final picked = slots.whereType<String>().length;
    final window = ref.watch(applicationWindowsProvider).value?[g.id];
    final deadline = window?.endDate ?? window?.startDate;
    final price = priceOf(g);
    final assessed = ref.watch(assessmentTouchedProvider) || book.testsOf(u).any;

    void pick() {
      final n = ref.read(slotsProvider.notifier);
      final id = u.institutionId;
      if (n.indexOf(id) >= 0) {
        n.remove(id);
        return;
      }
      final messenger = ScaffoldMessenger.of(context)..hideCurrentSnackBar();
      if (!n.add(id)) {
        messenger.showSnackBar(SnackBar(content: Text(l.fdSlotsFull)));
        context.push(kDiscoverChosenPath);
        return;
      }
      final count = ref.read(slotsProvider).whereType<String>().length;
      if (count >= kSlotCount) {
        context.push(kDiscoverChosenPath);
      } else {
        messenger.showSnackBar(SnackBar(content: Text(l.fdUniPickAdded(count))));
        _back(context);
      }
    }

    final none = '—';
    final cells = <_Fact>[
      _Fact(LucideIcons.mapPin, l.uaCity, u.city == null ? none : shortCity(u.city!)),
      _Fact(
        LucideIcons.banknote,
        g.tuitionPeriod == 'yil' ? l.fdUniTuitionYear : l.fdUniTuitionSem,
        price == null ? none : money(price, g.currency, locale: l.localeName),
        lime: price != null,
      ),
      _Fact(
        LucideIcons.languages,
        l.fdCellLanguage,
        g.topikMin != null && g.koreanTrack != false ? 'TOPIK ${scoreText(g.topikMin!)}+' : none,
      ),
      _Fact(LucideIcons.calendar, l.fdUniDeadline, deadline == null ? none : formatDate(context, deadline)),
    ];

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
            child: Row(
              children: [
                HardIconButton(
                  glyph: LucideIcons.chevronLeft,
                  semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                  onTap: () => _back(context),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    u.displayName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(18, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.36),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(top: 8, bottom: 20),
              children: [
                KeyedSubtree(
                  key: keys[0],
                  child: _Hero(university: u, guideline: g),
                ),
                Padding(
                  key: keys[1],
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                  child: Column(
                    children: [
                      for (var i = 0; i < cells.length; i += 2) ...[
                        if (i > 0) const SizedBox(height: 8),
                        IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(child: _FactCell(fact: cells[i])),
                              const SizedBox(width: 8),
                              Expanded(child: _FactCell(fact: cells[i + 1])),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 22, 0),
                  child: _AskCard(
                    key: keys[2],
                    percent: assessed ? book.admission(u) : null,
                    onStart: () => context.push(universityAssessPath(u.institutionId)),
                  ),
                ),
              ],
            ),
          ),
          FdBottomBar(
            key: keys[3],
            aboveNav: true,
            child: HardButton(
              label: slot >= 0 ? l.fdUniInPick(picked) : l.fdUniAddPick(picked),
              fill: slot >= 0 ? FdColors.card : FdColors.lime,
              onPressed: pick,
            ),
          ),
        ],
      ),
    );
  }
}

class _Fact {
  const _Fact(this.glyph, this.label, this.value, {this.lime = false});

  final LucideGlyph glyph;
  final String label;
  final String value;

  /// The contract's figure, marked lime.
  final bool lime;
}

/// One fact: the icon on its tile, the label over the value.
class _FactCell extends StatelessWidget {
  const _FactCell({required this.fact});

  final _Fact fact;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
    decoration: BoxDecoration(
      color: FdColors.card,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: FdColors.ink, width: 1.5),
    ),
    child: Row(
      children: [
        Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(9)),
          child: Lucide(fact.glyph, size: 15, color: FdColors.navy),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                fact.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: fdText(10, FontWeight.w600, FdColors.muted, height: 1.2),
              ),
              const SizedBox(height: 3),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: fact.lime ? const EdgeInsets.symmetric(horizontal: 5, vertical: 1) : EdgeInsets.zero,
                  decoration: fact.lime
                      ? BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(5))
                      : null,
                  child: Text(fact.value, maxLines: 1, style: fdText(14, FontWeight.w800, FdColors.ink, height: 1.15)),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// "Bu universitetga kirish ehtimolingizni bilmoqchimisiz?": blue, lifted on
/// a lime shadow, "?%" in a dashed ring until the student has been assessed.
class _AskCard extends StatelessWidget {
  const _AskCard({super.key, required this.percent, required this.onStart});

  final int? percent;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [FdColors.blue, FdColors.blueDeep],
        ),
        boxShadow: const [BoxShadow(color: FdColors.lime, offset: Offset(5, 5))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CustomPaint(
                painter: const DashedPillPainter(color: FdColors.lime),
                child: SizedBox.square(
                  dimension: 58,
                  child: Center(
                    child: Text(
                      percent == null ? '?%' : '$percent%',
                      style: fdText(18, FontWeight.w800, FdColors.onPage, height: 1),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(child: Text(l.uaAskTitle, style: fdText(16, FontWeight.w800, FdColors.onPage, height: 1.2))),
            ],
          ),
          const SizedBox(height: 12),
          Text(l.uaAskBody, style: fdText(12, FontWeight.w500, const Color(0xFFC9D3F5), height: 1.45)),
          const SizedBox(height: 16),
          HardButton(label: l.uaAskStart, onPressed: onStart),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.university, required this.guideline});

  final CatalogUniversity university;
  final CatalogGuideline guideline;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final photo = campusPhotoAsset(university.institutionId);
    final price = priceOf(guideline);
    final rank = worldRankOf(university.institutionId);
    final sub = [
      if (university.city != null) shortCity(university.city!),
      if (price != null) money(price, guideline.currency, locale: l.localeName),
      rank == null
          ? 'QS —'
          : '${rank.source == RankSource.qs ? 'QS' : 'THE'} ${rank.to != null ? '${rank.from}–${rank.to}' : rank.label}',
    ].join(' · ');

    return Container(
      height: 120,
      margin: const EdgeInsets.symmetric(horizontal: 18),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [FdColors.blue, FdColors.blueDeep, FdColors.blueNight],
          stops: [0, 0.6, 1],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (photo != null) Image.asset(photo, fit: BoxFit.cover, cacheWidth: 900),
          if (photo != null)
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x00060D2B), Color(0xD9060D2B)],
                  stops: [0.25, 1],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (university.nameKo != null)
                  Text(
                    university.nameKo!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(26, FontWeight.w800, Colors.white, height: 1.15, letterSpacing: -0.52),
                  ),
                if (sub.isNotEmpty)
                  Text(
                    sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(12, FontWeight.w700, Colors.white),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

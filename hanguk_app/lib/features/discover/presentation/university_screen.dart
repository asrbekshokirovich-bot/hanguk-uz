import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/campus_photos.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_detail_screen.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../data/application_windows.dart';
import '../data/saved_universities.dart';
import 'discover_routes.dart';
import 'widgets/uni_stack_card.dart';

/// One programme of a faculty with the languages it is taught in.
@visibleForTesting
class MajorRow {
  MajorRow(this.name);

  final String name;
  final Set<String> tracks = {};

  /// "KO", "EN" or "KO · EN".
  String get badge => [if (tracks.contains('korean')) 'KO', if (tracks.contains('english')) 'EN'].join(' · ');
  bool get english => tracks.contains('english');
}

/// A faculty's programmes, one row per name: the Excel lists a programme
/// once per language it is taught in.
@visibleForTesting
List<MajorRow> majorsOf(FacultyGroup group) {
  final byName = <String, MajorRow>{};
  for (final p in group.programmes) {
    final name = [p.facultyEn, p.facultyKr].whereType<String>().where((s) => s.trim().isNotEmpty).firstOrNull?.trim();
    if (name == null) continue;
    final row = byName.putIfAbsent(name, () => MajorRow(name));
    if (p.track != null) row.tracks.add(p.track!);
  }
  return byName.values.toList();
}

/// "Universitet sahifasi" (design screen 10).
class UniversityScreen extends ConsumerStatefulWidget {
  const UniversityScreen({super.key, required this.institutionId});

  final String institutionId;

  @override
  ConsumerState<UniversityScreen> createState() => _UniversityScreenState();
}

class _UniversityScreenState extends ConsumerState<UniversityScreen> {
  String? _degree;
  int? _open = 0;
  final Set<int> _expanded = {};

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final catalog = ref.watch(catalogProvider);
    final u = catalog.value?.where((u) => u.institutionId == widget.institutionId).firstOrNull;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: u == null
            ? catalog.isLoading
                  ? const Center(child: CircularProgressIndicator(color: FdColors.navy))
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
                            Center(child: Text(l.uniDbLoadFailed, style: fdText(14, FontWeight.w600, FdColors.ink))),
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
            : _body(context, l, u),
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

  Widget _body(BuildContext context, AppLocalizations l, CatalogUniversity u) {
    final degree = _degree ?? u.primary.degree ?? CatalogDegree.bachelor;
    final g = u.forDegree(degree) ?? u.primary;
    final detailAsync = ref.watch(catalogDetailProvider(g.id));
    final detail = detailAsync.value;
    final groups = facultyGroups(detail?.faculties ?? const [], byFaculty: kListFacultiesByName.contains(g.id));
    final majorCount = groups.fold<int>(0, (s, x) => s + majorsOf(x).length);
    final saved = ref.watch(savedUniversitiesProvider).contains(u.institutionId);
    final window = ref.watch(applicationWindowsProvider).value?[g.id];
    final deadline = window?.endDate ?? window?.startDate;
    final season = seasonLabel(l, g);
    final rounds = catalogFirstStage(detail?.rounds ?? const []);
    final both = u.hasDegree(CatalogDegree.bachelor) && u.hasDegree(CatalogDegree.master);

    void toggleSaved() => ref.read(savedUniversitiesProvider.notifier).toggle(u.institutionId);

    final stats = <(LucideGlyph, String, String)>[
      if (g.tuitionMin != null || g.tuitionMax != null)
        (
          LucideIcons.banknote,
          g.tuitionPeriod == 'yil' ? l.fdUniTuitionYear : l.fdUniTuitionSem,
          _range(l, g.tuitionMin, g.tuitionMax, g.currency),
        ),
      if (g.applicationFee != null)
        (
          LucideIcons.receipt,
          l.catalogApplicationFee,
          money(g.applicationFee!, g.applicationFeeCurrency ?? g.currency, locale: l.localeName),
        ),
      if (g.topikMin != null && g.koreanTrack != false) (LucideIcons.languages, l.fdCellLanguage, 'TOPIK ${scoreText(g.topikMin!)}+'),
      if (deadline != null) (LucideIcons.calendar, l.fdUniDeadline, formatDate(context, deadline)),
    ];

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              _Hero(
                university: u,
                guideline: g,
                saved: saved,
                onBack: () => _back(context),
                onSave: toggleSaved,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (u.nameKo != null)
                      Text(
                        u.nameKo!,
                        style: fdText(30, FontWeight.w800, FdColors.navy, height: 1.1, letterSpacing: -0.9),
                      ),
                    const SizedBox(height: 3),
                    Text(u.displayName, style: fdText(17, FontWeight.w700, FdColors.ink)),
                    const SizedBox(height: 11),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (u.city != null) _Chip(label: u.city!, glyph: LucideIcons.mapPin),
                        if (season != null) _Chip(label: season, lime: true),
                      ],
                    ),
                  ],
                ),
              ),
              if (both)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                  child: Row(
                    children: [
                      for (final (id, label) in [
                        (CatalogDegree.bachelor, l.catalogDegreeBachelor),
                        (CatalogDegree.master, l.catalogDegreeMaster),
                      ]) ...[
                        if (id == CatalogDegree.master) const SizedBox(width: 8),
                        Expanded(
                          child: HardChoice(
                            label: label,
                            selected: degree == id,
                            onTap: () => setState(() {
                              _degree = id;
                              _open = 0;
                              _expanded.clear();
                            }),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              if (stats.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                  child: _StatGrid(stats: stats),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(child: Text(l.catalogFaculties, style: fdText(15, FontWeight.w800, FdColors.ink))),
                    if (groups.isNotEmpty)
                      Text(
                        l.fdUniFacultiesSummary(groups.length, majorCount),
                        style: fdText(12, FontWeight.w400, FdColors.pageMuted),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: _faculties(l, detailAsync, groups, g),
              ),
              if (_requirements(l, g, detail) case final rows when rows.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                  child: _InfoCard(title: l.catalogRequirements, rows: rows),
                ),
              if (rounds.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                  child: _InfoCard(
                    title: season == null ? l.catalogWindowLabel : l.catalogTimeline(season),
                    rows: [
                      for (final r in rounds)
                        (catalogStepName(l, r), catalogRoundValue(context, l, r)),
                    ],
                  ),
                ),
              const SizedBox(height: 20),
            ],
          ),
        ),
        _BottomBar(
          saved: saved,
          onSave: toggleSaved,
          onAssess: () => context.push(kAssessmentPath, extra: u.institutionId),
        ),
      ],
    );
  }

  Widget _faculties(AppLocalizations l, AsyncValue<CatalogGuidelineDetail> async, List<FacultyGroup> groups, CatalogGuideline g) {
    if (async.isLoading && groups.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(child: CircularProgressIndicator(color: FdColors.navy)),
      );
    }
    if (async.hasError && groups.isEmpty) {
      return Row(
        children: [
          Expanded(child: Text(l.uniDbLoadFailed, style: fdText(12, FontWeight.w500, FdColors.pageMuted))),
          SeoulOutlineButton(
            label: l.commonRetry,
            expand: false,
            onPressed: () => ref.invalidate(catalogDetailProvider(g.id)),
          ),
        ],
      );
    }
    if (groups.isEmpty) {
      return Text(l.catalogNoDegreeData, style: fdText(12, FontWeight.w500, FdColors.pageMuted));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < groups.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          _FacultyCard(
            name: groups[i].name,
            majors: majorsOf(groups[i]),
            price: groups[i].minFee == null
                ? null
                : money(groups[i].minFee!, g.currency, locale: l.localeName),
            open: _open == i,
            expanded: _expanded.contains(i),
            onTap: () => setState(() => _open = _open == i ? null : i),
            onExpand: () => setState(() => _expanded.add(i)),
          ),
        ],
      ],
    );
  }

  List<(String, String)> _requirements(AppLocalizations l, CatalogGuideline g, CatalogGuidelineDetail? detail) {
    final english = [
      if (g.ieltsMin != null) 'IELTS ${scoreText(g.ieltsMin!)}+',
      if (g.toeflMin != null) 'TOEFL ${scoreText(g.toeflMin!)}+',
    ].join(' / ');
    final requiredDocs = detail?.docs.where((d) => d.isRequired).length ?? 0;
    final apostille = detail?.docs.where((d) => d.needsApostille).length ?? 0;
    return [
      if (g.topikMin != null && g.koreanTrack != false) (l.catalogReqKorean, 'TOPIK ${scoreText(g.topikMin!)}+'),
      if (g.englishTrack == true && english.isNotEmpty) (l.catalogReqEnglish, english),
      if (g.recommendation != null)
        (
          l.catalogReqRecommendation,
          switch (g.recommendation) {
            'ha' => l.catalogRecYes,
            'ixtiyoriy' => l.catalogRecOptional,
            _ => l.catalogRecNo,
          },
        ),
      if (requiredDocs > 0) (l.catalogReqDocuments, l.catalogDocsRequired(requiredDocs)),
      if (apostille > 0) (l.catalogReqApostille, l.catalogApostilleDocs(apostille)),
      if (g.bankAmount != null) (l.catalogReqBank, money(g.bankAmount!, g.bankCurrency ?? g.currency, locale: l.localeName)),
    ];
  }

  static String _range(AppLocalizations l, num? a, num? b, String? currency) {
    final x = a ?? b!;
    final y = b ?? a!;
    final loc = l.localeName;
    return x == y ? money(x, currency, locale: loc) : '${money(x, currency, locale: loc)} – ${money(y, currency, locale: loc)}';
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.university,
    required this.guideline,
    required this.saved,
    required this.onBack,
    required this.onSave,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final bool saved;
  final VoidCallback onBack;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final photo = campusPhotoAsset(university.institutionId);
    final type = typeLabel(l, guideline.institutionType);
    final private = catalogType(guideline.institutionType) == CatalogType.private;
    final top = MediaQuery.paddingOf(context).top;

    return Container(
      height: 170 + top,
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: FdColors.ink, width: 1.5))),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (photo != null)
            Image.asset(photo, fit: BoxFit.cover, cacheWidth: 900)
          else
            NameCover(name: university.nameKoShort ?? university.displayName),
          Positioned(
            left: 14,
            top: top + 8,
            child: HardIconButton(
              glyph: LucideIcons.chevronLeft,
              size: 40,
              radius: 12,
              iconSize: 18,
              semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
              onTap: onBack,
            ),
          ),
          Positioned(
            right: 14,
            top: top + 8,
            child: HardIconButton(
              glyph: LucideIcons.heart,
              size: 40,
              radius: 12,
              iconSize: 18,
              fill: saved ? FdColors.lime : FdColors.card,
              iconColor: saved ? FdColors.onLime : FdColors.ink,
              semanticLabel: saved ? l.fdSaved : l.fdSave,
              onTap: onSave,
            ),
          ),
          if (type != null)
            Positioned(
              left: 14,
              bottom: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: FdColors.card,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: private ? FdColors.privateBlue : FdColors.good,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(type, style: fdText(11, FontWeight.w800, FdColors.ink)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.glyph, this.lime = false});

  final String label;
  final LucideGlyph? glyph;
  final bool lime;

  @override
  Widget build(BuildContext context) {
    final fg = lime ? FdColors.onLime : FdColors.ink;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: lime ? FdColors.lime : FdColors.card,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (glyph != null) ...[
            Lucide(glyph!, size: 11, color: fg),
            const SizedBox(width: 5),
          ],
          Text(label, style: fdText(12, lime ? FontWeight.w700 : FontWeight.w600, fg)),
        ],
      ),
    );
  }
}

/// The stat cells: three to a row, two when there are four.
class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.stats});

  final List<(LucideGlyph, String, String)> stats;

  @override
  Widget build(BuildContext context) {
    final cols = stats.length == 4 || stats.length == 2 ? 2 : 3;
    final rows = <Widget>[];
    for (var i = 0; i < stats.length; i += cols) {
      if (i > 0) rows.add(const SizedBox(height: 6));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = i; j < i + cols; j++) ...[
                if (j > i) const SizedBox(width: 6),
                Expanded(child: j < stats.length ? _StatCell(stat: stats[j]) : const SizedBox.shrink()),
              ],
            ],
          ),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.stat});

  final (LucideGlyph, String, String) stat;

  @override
  Widget build(BuildContext context) {
    final (glyph, label, value) = stat;
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 9, 8, 8),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(8)),
            child: Lucide(glyph, size: 14, color: FdColors.navy),
          ),
          const SizedBox(height: 5),
          Text(label, style: fdText(9, FontWeight.w600, FdColors.muted, height: 1.2)),
          const SizedBox(height: 5),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, maxLines: 1, style: fdText(12, FontWeight.w800, FdColors.ink, height: 1.1)),
          ),
        ],
      ),
    );
  }
}

/// One faculty of the accordion: lime and lifted when open, its programmes
/// below on white.
class _FacultyCard extends StatelessWidget {
  const _FacultyCard({
    required this.name,
    required this.majors,
    required this.price,
    required this.open,
    required this.expanded,
    required this.onTap,
    required this.onExpand,
  });

  /// Programmes shown before "Barcha N ta yo'nalish →".
  static const int preview = 4;

  final String name;
  final List<MajorRow> majors;
  final String? price;
  final bool open;
  final bool expanded;
  final VoidCallback onTap;
  final VoidCallback onExpand;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final fg = open ? FdColors.onLime : FdColors.ink;
    final shown = expanded ? majors : majors.take(preview).toList();
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: open ? FdColors.lime : FdColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: open ? const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))] : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: open,
            child: GestureDetector(
              onTap: onTap,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: fdText(13, FontWeight.w800, fg)),
                          Text(l.catalogProgramCount(majors.length), style: fdText(11, FontWeight.w400, fg)),
                        ],
                      ),
                    ),
                    if (price != null) ...[
                      const SizedBox(width: 10),
                      Text(price!, style: fdText(12, FontWeight.w800, fg)),
                    ],
                    const SizedBox(width: 10),
                    Lucide(open ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 16, color: fg),
                  ],
                ),
              ),
            ),
          ),
          if (open && majors.isNotEmpty)
            Container(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
              decoration: const BoxDecoration(
                color: FdColors.card,
                border: Border(top: BorderSide(color: FdColors.ink, width: 1.5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final m in shown) _MajorLine(major: m),
                  if (!expanded && majors.length > preview)
                    Semantics(
                      button: true,
                      child: GestureDetector(
                        onTap: onExpand,
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(l.fdUniAllMajors(majors.length), style: fdText(11, FontWeight.w800, FdColors.navy)),
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _MajorLine extends StatelessWidget {
  const _MajorLine({required this.major});

  final MajorRow major;

  @override
  Widget build(BuildContext context) {
    final badge = major.badge;
    return CustomPaint(
      painter: const _DashedBottom(color: Color(0xFFD9DFE8)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: FdColors.navy),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(major.name, style: fdText(12, FontWeight.w700, FdColors.ink))),
            if (badge.isNotEmpty) ...[
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: major.english ? FdColors.lime : FdColors.card,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Text(
                  badge,
                  style: fdText(10, FontWeight.w800, major.english ? FdColors.onLime : FdColors.ink),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// `border-bottom: 1.5px dashed`.
class _DashedBottom extends CustomPainter {
  const _DashedBottom({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5;
    final y = size.height - 0.75;
    for (var x = 0.0; x < size.width; x += 7) {
      canvas.drawLine(Offset(x, y), Offset((x + 4).clamp(0, size.width), y), paint);
    }
  }

  @override
  bool shouldRepaint(_DashedBottom old) => old.color != color;
}

/// The old page's requirements and timeline, kept below the faculties in the
/// design's white-card style.
class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.title, required this.rows});

  final String title;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: fdText(14, FontWeight.w800, FdColors.ink)),
          const SizedBox(height: 4),
          for (var i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: i == 0
                  ? null
                  : const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFD9DFE8), width: 1.5))),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(rows[i].$1, style: fdText(12, FontWeight.w500, FdColors.muted, height: 1.35))),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      rows[i].$2,
                      textAlign: TextAlign.right,
                      style: fdText(12, FontWeight.w800, FdColors.ink, height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.saved, required this.onSave, required this.onAssess});

  final bool saved;
  final VoidCallback onSave;
  final VoidCallback onAssess;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return FdBottomBar(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: HardChoice(
                  label: saved ? '✓ ${l.fdSaved}' : l.fdSave,
                  selected: saved,
                  height: 44,
                  fontWeight: FontWeight.w800,
                  onTap: onSave,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Semantics(
                  button: true,
                  child: GestureDetector(
                    onTap: onAssess,
                    behavior: HitTestBehavior.opaque,
                    child: CustomPaint(
                      painter: const DashedPillPainter(color: FdColors.navy, radius: 12),
                      child: SizedBox(
                        height: 44,
                        child: Center(child: Text(l.fdAdmissionUnknown, style: fdText(13, FontWeight.w800, FdColors.navy))),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          HardButton(label: l.fdUniCta, onPressed: onAssess),
        ],
      ),
    );
  }
}

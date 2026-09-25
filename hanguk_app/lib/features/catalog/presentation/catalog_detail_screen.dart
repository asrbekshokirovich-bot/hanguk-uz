import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../guest/data/guest_compare_provider.dart';
import '../../guest/presentation/widgets/contact_sheet.dart';
import '../data/catalog_filters.dart';
import '../data/catalog_repository.dart';
import '../domain/catalog_models.dart';
import 'catalog_format.dart';

/// Design screen 03 — "Talablar, narx va daraja": one university's faculties
/// and fees, what it asks for, and its timeline, all from the guideline Excel
/// staff loaded. A field the Excel leaves empty is left out rather than
/// filled in.
class CatalogDetailScreen extends ConsumerStatefulWidget {
  const CatalogDetailScreen({
    super.key,
    required this.university,
    required this.initialDegree,
    required this.allowCompare,
    required this.isGuest,
  });

  final CatalogUniversity university;
  final String initialDegree;
  final bool allowCompare;
  final bool isGuest;

  static Future<void> open(
    BuildContext context, {
    required CatalogUniversity university,
    required String degree,
    required bool allowCompare,
    required bool isGuest,
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CatalogDetailScreen(
          university: university,
          initialDegree: degree,
          allowCompare: allowCompare,
          isGuest: isGuest,
        ),
      ),
    );
  }

  @override
  ConsumerState<CatalogDetailScreen> createState() => _CatalogDetailScreenState();
}

/// Faculties grouped the way the design lists them: one row per college,
/// "N ta yo'nalish" for the programmes under it, and its lowest fee.
class _FacultyGroup {
  _FacultyGroup(this.name);

  final String name;
  final List<CatalogFaculty> programmes = [];

  num? get minFee => programmes.map((p) => p.tuition).whereType<num>().fold<num?>(null, (a, b) => a == null ? b : math.min(a, b));
  num? get maxFee => programmes.map((p) => p.tuition).whereType<num>().fold<num?>(null, (a, b) => a == null ? b : math.max(a, b));
  String? get period => programmes.map((p) => p.tuitionPeriod).whereType<String>().firstOrNull;
}

List<_FacultyGroup> _groups(List<CatalogFaculty> faculties) {
  final byName = <String, _FacultyGroup>{};
  for (final f in faculties) {
    final name = [f.collegeEn, f.collegeKr, f.facultyEn, f.facultyKr].whereType<String>().where((s) => s.trim().isNotEmpty).firstOrNull;
    if (name == null) continue;
    byName.putIfAbsent(name.trim(), () => _FacultyGroup(name.trim())).programmes.add(f);
  }
  return byName.values.toList();
}

class _CatalogDetailScreenState extends ConsumerState<CatalogDetailScreen> {
  late String _degree = _initialDegree();
  int _group = 0;

  String _initialDegree() {
    final u = widget.university;
    if (widget.initialDegree != CatalogDegree.all && u.hasDegree(widget.initialDegree)) {
      return widget.initialDegree;
    }
    return u.primary.degree ?? CatalogDegree.bachelor;
  }

  void _contact() {
    final router = GoRouter.maybeOf(context);
    ContactSheet.show(
      context,
      onJoin: widget.isGuest && router != null ? () => router.push('/login', extra: {'magic_code': true}) : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = widget.university;
    final g = u.forDegree(_degree) ?? u.primary;
    final detailAsync = ref.watch(catalogDetailProvider(g.id));
    final detail = detailAsync.value;
    final season = seasonLabel(l, g);
    final compared = widget.allowCompare && ref.watch(guestCompareProvider).contains(u.institutionId);

    final groups = _groups(detail?.faculties ?? const []);
    final group = groups.isEmpty ? null : groups[_group.clamp(0, groups.length - 1)];

    final rounds = _firstStage(detail?.rounds ?? const []);
    final window = _window(rounds);

    return SeoulNightScaffold(
      safeArea: false,
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.only(bottom: 130),
            children: [
              _Header(
                university: u,
                guideline: g,
                season: season,
                compared: compared,
                onBack: () => Navigator.of(context).pop(),
                onToggleCompare: widget.allowCompare
                    ? () => ref.read(guestCompareProvider.notifier).toggle(u.institutionId)
                    : null,
                compareLabel: l.catalogFavorite,
              ),
              Transform.translate(
                offset: const Offset(0, -40),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _DegreeTabs(
                        degree: _degree,
                        hasBachelor: u.hasDegree(CatalogDegree.bachelor),
                        hasMaster: u.hasDegree(CatalogDegree.master),
                        onPick: (d) => setState(() {
                          _degree = d;
                          _group = 0;
                        }),
                      ),
                      const SizedBox(height: 14),
                      if (!u.hasDegree(_degree))
                        _Card(child: Text(l.catalogNoDegreeData, style: SeoulType.bodySecondary))
                      else ...[
                        _facultiesCard(l, detailAsync, groups),
                        const SizedBox(height: 14),
                        _tuitionCard(l, g, group),
                        const SizedBox(height: 14),
                        _requirementsCard(l, g, detail),
                        if (rounds.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          _timelineCard(context, l, rounds, season),
                        ],
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _BottomBar(window: window, onContact: _contact),
          ),
        ],
      ),
    );
  }

  Widget _facultiesCard(AppLocalizations l, AsyncValue<CatalogGuidelineDetail> async, List<_FacultyGroup> groups) {
    return _Card(
      gap: 8,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: _CardTitle(
            title: l.catalogFaculties,
            trailing: groups.isEmpty ? null : l.catalogFacultyCount(groups.length),
          ),
        ),
        if (async.isLoading && groups.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(child: CircularProgressIndicator(color: SeoulColors.lime)),
          )
        else if (async.hasError && groups.isEmpty)
          Row(
            children: [
              Expanded(child: Text(l.uniDbLoadFailed, style: SeoulType.caption)),
              SeoulOutlineButton(
                label: l.commonRetry,
                expand: false,
                onPressed: () => ref.invalidate(catalogDetailProvider(widget.university.forDegree(_degree)!.id)),
              ),
            ],
          )
        else
          for (var i = 0; i < groups.length; i++)
            _FacultyRow(
              name: groups[i].name,
              programmes: l.catalogProgramCount(groups[i].programmes.length),
              price: groups[i].minFee == null
                  ? null
                  : '${money(groups[i].minFee!, widget.university.forDegree(_degree)!.currency)}${periodSuffix(l, groups[i].period)}',
              selected: i == _group,
              onTap: () => setState(() => _group = i),
            ),
      ],
    );
  }

  Widget _tuitionCard(AppLocalizations l, CatalogGuideline g, _FacultyGroup? group) {
    final lo = group?.minFee ?? g.tuitionMin;
    final hi = group?.maxFee ?? g.tuitionMax;
    final period = group?.period ?? g.tuitionPeriod;
    String? range(num? a, num? b, [num k = 1]) {
      if (a == null && b == null) return null;
      final x = a ?? b!;
      final y = b ?? a!;
      return x == y ? money(x * k, g.currency) : '${money(x * k, g.currency)} – ${money(y * k, g.currency)}';
    }

    final cells = <(String, String)>[
      if (period == 'semestr' && range(lo, hi, 2) != null) (l.catalogYearlyTuition, range(lo, hi, 2)!),
      if (g.applicationFee != null) (l.catalogApplicationFee, money(g.applicationFee!, g.applicationFeeCurrency ?? g.currency)),
      if (g.entranceFee != null) (l.catalogEntranceFee, money(g.entranceFee!, g.currency)),
    ];
    final big = range(lo, hi);

    if (big == null && cells.isEmpty) return const SizedBox.shrink();

    return _Card(
      gap: 14,
      children: [
        _CardTitle(
          title: group != null ? l.catalogTuitionTitle(group.name) : l.catalogFilterPrice,
          trailing: g.currency,
          trailingSmall: true,
        ),
        if (big != null)
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    big,
                    style: SeoulType.display.copyWith(fontSize: 32, fontWeight: FontWeight.w900, height: 1, color: SeoulColors.infoText),
                  ),
                ),
              ),
              if (period != null) ...[
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(
                    period == 'yil' ? l.catalogPerYear : l.catalogPerSemester,
                    style: SeoulType.caption.copyWith(fontSize: 13),
                  ),
                ),
              ],
            ],
          ),
        if (cells.isNotEmpty)
          _TwoColumn(
            children: [
              for (final c in cells)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: SeoulColors.glass, borderRadius: BorderRadius.circular(14)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.$1, style: SeoulType.caption.copyWith(fontSize: 11)),
                      const SizedBox(height: 3),
                      Text(c.$2, style: SeoulType.body.copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _requirementsCard(AppLocalizations l, CatalogGuideline g, CatalogGuidelineDetail? detail) {
    final english = [
      if (g.ieltsMin != null) 'IELTS ${scoreText(g.ieltsMin!)}+',
      if (g.toeflMin != null) 'TOEFL ${scoreText(g.toeflMin!)}+',
    ].join(' / ');
    final requiredDocs = detail?.docs.where((d) => d.isRequired).length ?? 0;
    final apostille = detail?.docs.where((d) => d.needsApostille).length ?? 0;
    final rows = <(String, String)>[
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
      if (g.bankAmount != null) (l.catalogReqBank, money(g.bankAmount!, g.bankCurrency ?? g.currency)),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();

    return _Card(
      gap: 6,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: _CardTitle(title: l.catalogRequirements),
        ),
        for (final r in rows)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 9),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: SeoulColors.glassBorder))),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: SeoulColors.limeFill, borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Icons.check_rounded, size: 16, color: SeoulColors.lime),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(r.$1, style: SeoulType.bodySecondary.copyWith(fontSize: 13.5))),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    r.$2,
                    textAlign: TextAlign.right,
                    style: SeoulType.body.copyWith(fontSize: 13.5, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _timelineCard(BuildContext context, AppLocalizations l, List<CatalogRound> rounds, String? season) {
    return _Card(
      gap: 12,
      children: [
        _CardTitle(title: season == null ? l.catalogWindowLabel : l.catalogTimeline(season)),
        for (var i = 0; i < rounds.length; i++)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i == 0
                        ? SeoulColors.lime
                        : i == rounds.length - 1
                        ? const Color(0xFF2E5FA8)
                        : const Color(0xFF4E80C9),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(rounds[i].name ?? '', style: SeoulType.bodySecondary.copyWith(fontSize: 13.5)),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  _roundValue(context, l, rounds[i]),
                  textAlign: TextAlign.right,
                  style: SeoulType.body.copyWith(fontSize: 13.5, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
      ],
    );
  }

  static String _roundValue(BuildContext context, AppLocalizations l, CatalogRound r) {
    final s = r.startDate;
    final e = r.endDate;
    String text;
    if (s != null && e != null && s != e) {
      text = formatDateRange(context, s, e);
    } else if (e != null || s != null) {
      text = formatDate(context, (e ?? s)!);
    } else if (r.status == 'keyin_elon') {
      return l.catalogRoundLater;
    } else {
      return l.catalogRoundRelative;
    }
    return r.status == 'taxminiy' ? '$text (${l.catalogRoundEstimated})' : text;
  }

  /// The first admission stage's steps — the round a student reading today
  /// applies to. Steps the Excel marks as not held are dropped.
  static List<CatalogRound> _firstStage(List<CatalogRound> rounds) {
    final live = rounds.where((r) => r.status != 'etap_yoq').toList();
    if (live.isEmpty) return const [];
    final first = live.map((r) => r.stage).reduce(math.min);
    return live.where((r) => r.stage == first).toList();
  }

  /// The application window for the bottom bar: the first step with a date.
  static CatalogRound? _window(List<CatalogRound> rounds) =>
      rounds.where((r) => r.endDate != null || r.startDate != null).firstOrNull;
}

class _Header extends StatelessWidget {
  const _Header({
    required this.university,
    required this.guideline,
    required this.season,
    required this.compared,
    required this.onBack,
    required this.onToggleCompare,
    required this.compareLabel,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final String? season;
  final bool compared;
  final VoidCallback onBack;
  final VoidCallback? onToggleCompare;
  final String compareLabel;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final type = typeLabel(l, guideline.institutionType, short: true);
    final ko = university.nameKoShort;

    return ClipRect(
      child: Container(
        decoration: const BoxDecoration(gradient: SeoulGradients.heroCard),
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 64),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -70,
              bottom: -114,
              child: Transform.rotate(
                angle: math.pi / 4,
                child: Container(width: 150, height: 150, color: SeoulColors.lime),
              ),
            ),
            SafeArea(
              bottom: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _CircleButton(
                        icon: Icons.chevron_left_rounded,
                        label: MaterialLocalizations.of(context).backButtonTooltip,
                        onTap: onBack,
                      ),
                      const Spacer(),
                      if (onToggleCompare != null)
                        _CircleButton(
                          icon: compared ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                          color: compared ? SeoulColors.lime : Colors.white,
                          label: compareLabel,
                          selected: compared,
                          onTap: onToggleCompare!,
                        ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  if (ko != null)
                    Text(
                      ko,
                      style: SeoulType.hangulGlyph.copyWith(fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: -0.8, color: Colors.white),
                    ),
                  const SizedBox(height: 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 260),
                    child: Text(
                      university.displayName,
                      style: SeoulType.headline.copyWith(fontSize: 22, height: 1.2, letterSpacing: -0.44),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (university.city != null) _HeaderChip(label: university.city!),
                      if (type != null) _HeaderChip(label: type),
                      if (season != null) _HeaderChip(label: season!, lime: true),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = Colors.white,
    this.selected = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x24FFFFFF)),
          child: Icon(icon, size: 22, color: color),
        ),
      ),
    );
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.label, this.lime = false});

  final String label;
  final bool lime;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: lime ? SeoulColors.lime : const Color(0x24FFFFFF),
        borderRadius: BorderRadius.circular(SeoulRadii.pill),
      ),
      child: Center(widthFactor: 1, child: Text(
        label,
        style: SeoulType.caption.copyWith(
          fontWeight: lime ? FontWeight.w700 : FontWeight.w600,
          color: lime ? SeoulColors.ink : Colors.white,
        ),
      )),
    );
  }
}

class _DegreeTabs extends StatelessWidget {
  const _DegreeTabs({
    required this.degree,
    required this.hasBachelor,
    required this.hasMaster,
    required this.onPick,
  });

  final String degree;
  final bool hasBachelor;
  final bool hasMaster;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    Widget tab(String id, String label, bool available) {
      final on = degree == id;
      final ink = on ? SeoulColors.ink : (available ? SeoulColors.textSecondary : SeoulColors.textFaint);
      return Expanded(
        child: Semantics(
          button: true,
          selected: on,
          enabled: available,
          child: GestureDetector(
            onTap: available ? () => onPick(id) : null,
            behavior: HitTestBehavior.opaque,
            child: AnimatedContainer(
              duration: SeoulMotion.fast,
              height: 44,
              decoration: BoxDecoration(
                color: on ? SeoulColors.lime : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.school_outlined, size: 16, color: ink),
                  const SizedBox(width: 7),
                  Text(label, style: SeoulType.body.copyWith(fontSize: 14, fontWeight: FontWeight.w700, color: ink)),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: const Color(0xFF142B4F),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: SeoulColors.glassBorder),
        boxShadow: SeoulShadows.card,
      ),
      child: Row(
        children: [
          tab(CatalogDegree.bachelor, l.catalogDegreeBachelor, hasBachelor),
          const SizedBox(width: 4),
          tab(CatalogDegree.master, l.catalogDegreeMaster, hasMaster),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({this.child, this.children, this.gap = 0});

  final Widget? child;
  final List<Widget>? children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final kids = children;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF12284A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: SeoulColors.glassBorder),
      ),
      child: kids == null
          ? child
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < kids.length; i++) ...[
                  if (i > 0 && gap > 0) SizedBox(height: gap),
                  kids[i],
                ],
              ],
            ),
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle({required this.title, this.trailing, this.trailingSmall = false});

  final String title;
  final String? trailing;
  final bool trailingSmall;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text(title, style: SeoulType.subtitle.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.16)),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 8),
          Text(
            trailing!,
            style: SeoulType.caption.copyWith(
              fontSize: trailingSmall ? 11 : 12,
              fontWeight: trailingSmall ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}

class _FacultyRow extends StatelessWidget {
  const _FacultyRow({
    required this.name,
    required this.programmes,
    required this.price,
    required this.selected,
    required this.onTap,
  });

  final String name;
  final String programmes;
  final String? price;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: SeoulMotion.fast,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? SeoulColors.limeFill : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? SeoulColors.lime : SeoulColors.glassBorder, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? SeoulColors.lime : SeoulColors.glass,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(Icons.school_outlined, size: 17, color: selected ? SeoulColors.ink : Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: SeoulType.body.copyWith(fontSize: 13.5, fontWeight: FontWeight.w700, height: 1.3)),
                    const SizedBox(height: 2),
                    Text(programmes, style: SeoulType.caption.copyWith(fontSize: 11.5)),
                  ],
                ),
              ),
              if (price != null) ...[
                const SizedBox(width: 8),
                Text(
                  price!,
                  style: SeoulType.body.copyWith(fontSize: 13, fontWeight: FontWeight.w700, color: SeoulColors.infoText),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TwoColumn extends StatelessWidget {
  const _TwoColumn({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      if (i > 0) rows.add(const SizedBox(height: 8));
      rows.add(IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: children[i]),
            const SizedBox(width: 8),
            Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox.shrink()),
          ],
        ),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.window, required this.onContact});

  final CatalogRound? window;
  final VoidCallback onContact;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final w = window;
    String? range;
    String? note;
    if (w != null) {
      final s = w.startDate;
      final e = w.endDate;
      range = s != null && e != null && s != e ? formatDateRange(context, s, e) : formatDate(context, (e ?? s)!);
      final today = DateUtils.dateOnly(DateTime.now());
      final start = s == null ? null : DateTime.tryParse(s);
      final end = e == null ? null : DateTime.tryParse(e);
      if (start != null && today.isBefore(start)) {
        note = l.catalogWindowOpens(formatDate(context, s!));
      } else if (end != null && !today.isAfter(end)) {
        note = l.catalogDaysLeft(end.difference(today).inDays);
      } else if (end != null) {
        note = l.catalogWindowClosed;
      }
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: const BoxDecoration(
        color: Color(0xF20F213D),
        border: Border(top: BorderSide(color: SeoulColors.glassBorder)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (range != null) ...[
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: SeoulColors.limeFill, borderRadius: BorderRadius.circular(14)),
                child: const Icon(Icons.calendar_today_outlined, size: 20, color: SeoulColors.lime),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.catalogWindowLabel, style: SeoulType.caption.copyWith(fontSize: 11)),
                    const SizedBox(height: 2),
                    Text(
                      range,
                      style: SeoulType.body.copyWith(fontSize: 14.5, fontWeight: FontWeight.w800, height: 1.25, letterSpacing: -0.15),
                    ),
                    if (note != null) ...[
                      const SizedBox(height: 2),
                      Text(note, style: SeoulType.caption.copyWith(fontSize: 11, fontWeight: FontWeight.w600, color: SeoulColors.warningText)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
            ] else
              const Spacer(),
            SizedBox(
              height: 48,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: SeoulGradients.limeButton,
                  borderRadius: SeoulRadii.controlR,
                  boxShadow: SeoulShadows.limeGlow,
                ),
                child: Material(
                  type: MaterialType.transparency,
                  child: InkWell(
                    borderRadius: SeoulRadii.controlR,
                    onTap: onContact,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Center(
                        child: Text(l.catalogContact, style: SeoulType.button.copyWith(fontSize: 14)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

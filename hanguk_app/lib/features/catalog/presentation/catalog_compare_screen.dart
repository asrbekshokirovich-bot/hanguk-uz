import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/svg_path_icon.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart' show cssLinearGradient;
import '../../guest/presentation/widgets/contact_sheet.dart';
import '../data/campus_photos.dart';
import '../data/catalog_compare_provider.dart';
import '../data/catalog_filters.dart';
import '../data/catalog_repository.dart';
import '../domain/catalog_models.dart';
import 'catalog_format.dart';

/// Taqqoslash ekrani — the two universities picked in compare mode, side by
/// side: their columns on top, then the key facts row by row (the better
/// value marked), then each one's admission requirements.
class CatalogCompareScreen extends ConsumerStatefulWidget {
  const CatalogCompareScreen({super.key, required this.isGuest});

  /// Guest mode shows the "Bog'lanish" button at the bottom; a student does
  /// not get it.
  final bool isGuest;

  static Future<void> open(BuildContext context, {required bool isGuest}) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CatalogCompareScreen(isGuest: isGuest)));

  @override
  ConsumerState<CatalogCompareScreen> createState() => _CatalogCompareScreenState();
}

// ── Design values ──────────────────────────────────────────────────────────
const _white04 = Color(0x0AFFFFFF);
const _white14 = Color(0x24FFFFFF);
const _mint = Color(0xFF5EE0B0);
const _chipFill = Color(0xFF1C3764);
const _pageEnd = Color(0xFF0A0A1A);
const _dash = '—';

const _xIcon = 'M6 6l12 12M18 6L6 18';
const _plusIcon = 'M12 5v14M5 12h14';
const _chevronIcon = 'M15 18l-6-6 6-6';

/// Inter as the design sets it. Without a line height the design means the
/// browser's "normal" one — Inter's own 1.21 — which is spelled out so the
/// theme's body height is not inherited; leading is split evenly, like CSS.
TextStyle _inter(double size, FontWeight weight, {Color color = Colors.white, double height = 1.21}) => TextStyle(
  fontFamily: SeoulType.inter,
  fontFamilyFallback: SeoulType.fallback,
  fontSize: size,
  fontWeight: weight,
  color: color,
  height: height,
  leadingDistribution: TextLeadingDistribution.even,
);

/// The design sets its hangul in Inter too, so the browser falls back to a
/// Korean font but keeps Inter's line box and baseline; this strut does the
/// same for [_hangul] text.
StrutStyle _interStrut(double size) => StrutStyle(
  fontFamily: SeoulType.inter,
  fontSize: size,
  height: 1.21,
  leadingDistribution: TextLeadingDistribution.even,
  forceStrutHeight: true,
);

/// The hangul accents ("비교", "문의", the name cover).
TextStyle _hangul(double size, FontWeight weight, Color color) => TextStyle(
  fontFamily: SeoulType.korean,
  fontFamilyFallback: const [SeoulType.inter],
  fontSize: size,
  fontWeight: weight,
  color: color,
  height: 1.21,
  leadingDistribution: TextLeadingDistribution.even,
);

/// One picked university with the guideline its catalogue card shows and
/// that guideline's detail (null until loaded).
class _Pick {
  const _Pick(this.university, this.guideline, this.detail);

  final CatalogUniversity university;
  final CatalogGuideline? guideline;
  final CatalogGuidelineDetail? detail;
}

/// One "Asosiy ma'lumotlar" row: the two values as shown and which of them,
/// if any, is the better one.
class _Row {
  const _Row(this.label, this.values, {this.best, this.bestLabel});

  final String label;
  final List<String> values;
  final int? best;
  final String? bestLabel;

  bool get same => values[0] == values[1];
}

class _CatalogCompareScreenState extends ConsumerState<CatalogCompareScreen> {
  bool _onlyDiff = false;

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
    final inset = MediaQuery.paddingOf(context);
    final ids = ref.watch(catalogCompareProvider).ids;
    final all = ref.watch(catalogProvider).value;
    final filter = ref.watch(catalogFilterProvider);

    // An id the loaded catalogue no longer has is simply not shown: its slot
    // reads as empty.
    final picks = <_Pick>[];
    for (final id in ids) {
      final u = all?.where((u) => u.institutionId == id).firstOrNull;
      if (u == null) continue;
      final g = guidelineFor(u, filter);
      picks.add(_Pick(u, g, g == null ? null : ref.watch(catalogDetailProvider(g.id)).value));
    }
    final enough = picks.length == CatalogCompareState.maxSlots;

    var rows = enough ? _rows(context, l, picks) : const <_Row>[];
    if (_onlyDiff) rows = rows.where((r) => !r.same).toList();

    final bottomPad = widget.isGuest ? 85 + inset.bottom : 16 + inset.bottom;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: LayoutBuilder(
        builder: (context, constraints) => DecoratedBox(
          decoration: BoxDecoration(
            gradient: cssLinearGradient(
              165,
              constraints.biggest,
              colors: const [Color(0xFF1A3A6C), Color(0xFF132A4D), Color(0xFF0F213D), _pageEnd],
              stops: const [0, 0.3, 0.6, 1],
            ),
          ),
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: inset.top),
                  _Header(
                    onlyDiff: _onlyDiff,
                    onBack: () => Navigator.of(context).pop(),
                    onToggleDiff: () => setState(() => _onlyDiff = !_onlyDiff),
                  ),
                  if (all != null) ...[
                    _Columns(
                      picks: picks,
                      onRemove: (id) => ref.read(catalogCompareProvider.notifier).remove(id),
                      onAdd: () => Navigator.of(context).pop(),
                    ),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: EdgeInsets.fromLTRB(14, 16, 14, bottomPad),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          spacing: 10,
                          children: [
                            if (!enough)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 16),
                                child: Text(
                                  l.compareNeedTwo,
                                  textAlign: TextAlign.center,
                                  style: _inter(13, FontWeight.w400, color: const Color(0xB3FFFFFF), height: 1.5),
                                ),
                              )
                            else ...[
                              _SectionTitle(l.compareMainInfo),
                              for (final r in rows) _MainRow(row: r),
                              _SectionTitle(l.compareDetails, top: 12),
                              _DetailRow(
                                label: l.compareRowRequirements,
                                items: [
                                  for (final p in picks)
                                    (short: p.university.displayName, text: _requirements(p.detail, Localizations.localeOf(context).languageCode)),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              if (widget.isGuest)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: _ContactBar(label: l.guestContactCta, bottomInset: inset.bottom, onTap: _contact),
                ),
            ],
          ),
        ),
      ),
    );
  }

  List<_Row> _rows(BuildContext context, AppLocalizations l, List<_Pick> picks) {
    final gs = [for (final p in picks) p.guideline];

    // Kontrakt: a yearly fee says so, and is never ranked against a
    // semester one (nor against a fee in another currency).
    final prices = [for (final g in gs) g == null ? null : priceOf(g)];
    final yearly = [for (final g in gs) g?.tuitionPeriod == 'yil'];
    final currencies = [for (final g in gs) (g?.currency ?? 'KRW').toUpperCase()];
    final tuition = [
      for (var i = 0; i < gs.length; i++)
        prices[i] == null ? _dash : money(prices[i]!, gs[i]!.currency) + (yearly[i] ? periodSuffix(l, 'yil') : ''),
    ];

    final topik = [for (final g in gs) g?.topikMin];
    final ielts = [for (final g in gs) g?.ieltsMin];
    String score(num? v) => v == null ? _dash : '${scoreText(v)}+';

    return [
      _Row(
        l.compareRowTuition,
        tuition,
        best: yearly[0] == yearly[1] && currencies[0] == currencies[1] ? _lowest(prices) : null,
        bestLabel: l.compareBestCheaper,
      ),
      _Row(l.compareRowTopik, [for (final v in topik) score(v)], best: _lowest(topik), bestLabel: l.compareBestLower),
      _Row(l.compareRowIelts, [for (final v in ielts) score(v)], best: _lowest(ielts), bestLabel: l.compareBestLower),
      _Row(l.compareRowDeadline, [for (final p in picks) _deadline(context, p.detail) ?? _dash]),
      _Row(l.compareRowCity, [for (final p in picks) p.university.city ?? _dash]),
    ];
  }

  /// Index of the lower value — only when both exist and differ.
  static int? _lowest(List<num?> v) {
    final a = v[0], b = v[1];
    if (a == null || b == null || a == b) return null;
    return a < b ? 0 : 1;
  }

  /// End of the application window ("30-oktabr"): the first step with a date
  /// of the first admission stage — the window the detail screen shows.
  static String? _deadline(BuildContext context, CatalogGuidelineDetail? detail) {
    final live = (detail?.rounds ?? const <CatalogRound>[]).where((r) => r.status != 'etap_yoq').toList();
    if (live.isEmpty) return null;
    final first = live.map((r) => r.stage).reduce(math.min);
    final window = live
        .where((r) => r.stage == first)
        .where((r) => r.endDate != null || r.startDate != null)
        .firstOrNull;
    final iso = window?.endDate ?? window?.startDate;
    if (iso == null) return null;
    final date = DateTime.tryParse(iso);
    if (date == null) return formatDate(context, iso);
    try {
      return DateFormat.MMMMd(Localizations.localeOf(context).toLanguageTag()).format(date);
    } catch (_) {
      return formatDate(context, iso);
    }
  }

  /// The guideline's required documents as one sentence.
  static String _requirements(CatalogGuidelineDetail? detail, String languageCode) {
    final names = [
      for (final d in detail?.docs ?? const <CatalogDoc>[])
        if (d.isRequired && (d.nameIn(languageCode)?.trim().isNotEmpty ?? false)) d.nameIn(languageCode)!.trim(),
    ];
    return names.isEmpty ? _dash : '${names.join(', ')}.';
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onlyDiff, required this.onBack, required this.onToggleDiff});

  final bool onlyDiff;
  final VoidCallback onBack;
  final VoidCallback onToggleDiff;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(17, 10, 14, 14),
      child: Row(
        spacing: 12,
        children: [
          Semantics(
            button: true,
            label: MaterialLocalizations.of(context).backButtonTooltip,
            child: GestureDetector(
              onTap: onBack,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFF1E4078),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0x59D4E94C)),
                ),
                child: const SvgPathIcon(paths: [_chevronIcon], size: 18, color: SeoulColors.lime, strokeWidth: 2.4),
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              spacing: 1,
              children: [
                Text(l.compareTitle, style: _inter(16.5, FontWeight.w800, height: 1.15)),
                Text('비교', strutStyle: _interStrut(9.5), style: _hangul(9.5, FontWeight.w600, SeoulColors.lime)),
              ],
            ),
          ),
          Semantics(
            button: true,
            toggled: onlyDiff,
            child: GestureDetector(
              onTap: onToggleDiff,
              behavior: HitTestBehavior.opaque,
              child: Container(
                height: 30,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: onlyDiff ? SeoulColors.lime : Colors.transparent,
                  borderRadius: BorderRadius.circular(SeoulRadii.pill),
                  border: Border.all(color: onlyDiff ? SeoulColors.lime : const Color(0x4DFFFFFF)),
                ),
                child: Text(
                  l.compareOnlyDiff,
                  style: _inter(11, FontWeight.w700, color: onlyDiff ? SeoulColors.ink : const Color(0xCCFFFFFF)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The fixed strip of university columns, plus a dashed slot for each one
/// still to pick.
class _Columns extends StatelessWidget {
  const _Columns({required this.picks, required this.onRemove, required this.onAdd});

  final List<_Pick> picks;
  final ValueChanged<String> onRemove;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final cells = <Widget>[
      for (var i = 0; i < picks.length; i++)
        _UniversityColumn(
          university: picks[i].university,
          index: i,
          onRemove: () => onRemove(picks[i].university.institutionId),
        ),
      for (var i = picks.length; i < CatalogCompareState.maxSlots; i++)
        _EmptyColumn(label: l.compareAddSlot, onTap: onAdd),
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: SeoulColors.glassBorder)),
      ),
      child: _Pair(cells[0], cells[1]),
    );
  }
}

/// Two equal columns 10px apart, stretched to the taller one — the design's
/// two-column grid.
class _Pair extends StatelessWidget {
  const _Pair(this.a, this.b);

  final Widget a;
  final Widget b;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          Expanded(child: a),
          Expanded(child: b),
        ],
      ),
    );
  }
}

class _UniversityColumn extends StatelessWidget {
  const _UniversityColumn({required this.university, required this.index, required this.onRemove});

  final CatalogUniversity university;

  /// The column's position, which picks the name cover's colours.
  final int index;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final photo = campusPhotoAsset(university.institutionId);
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: _white04,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _white14, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 6,
        children: [
          SizedBox(
            height: 64,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: photo != null
                      ? ColoredBox(
                          color: _chipFill,
                          child: Image.asset(photo, fit: BoxFit.cover, cacheWidth: 480),
                        )
                      : _NameCover(name: university.nameKoShort ?? university.displayName, index: index),
                ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: Semantics(
                    button: true,
                    label: MaterialLocalizations.of(context).deleteButtonTooltip,
                    child: GestureDetector(
                      onTap: onRemove,
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        width: 24,
                        height: 24,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                        child: const SvgPathIcon(paths: [_xIcon], size: 11, color: SeoulColors.ink, strokeWidth: 3),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 29),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(3, 0, 3, 4),
              child: Text(
                university.displayName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: _inter(12, FontWeight.w700, height: 1.2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The tile when there is no campus photo: the Korean name on one of the two
/// cover colours, alternating by column.
class _NameCover extends StatelessWidget {
  const _NameCover({required this.name, required this.index});

  final String name;
  final int index;

  @override
  Widget build(BuildContext context) {
    final first = index.isEven;
    return LayoutBuilder(
      builder: (context, constraints) => Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: first
              ? cssLinearGradient(150, constraints.biggest, colors: const [Color(0xFF2B5096), Color(0xFF1C3A6E)])
              : null,
          color: first ? null : const Color(0xFF3A4533),
        ),
        child: Text(
          name,
          maxLines: 1,
          softWrap: false,
          overflow: TextOverflow.clip,
          strutStyle: _interStrut(13),
          style: _hangul(13, FontWeight.w800, first ? Colors.white : const Color(0xFFCFE24E)),
        ),
      ),
    );
  }
}

/// A slot with nobody in it; tapping it goes back to the list to pick one.
class _EmptyColumn extends StatelessWidget {
  const _EmptyColumn({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const ink = Color(0x99FFFFFF);
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: CustomPaint(
          painter: const _DashedBorderPainter(),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 112),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: 6,
              children: [
                const SvgPathIcon(paths: [_plusIcon], size: 18, color: ink),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: _inter(11, FontWeight.w600, color: ink),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// `1.5px dashed rgba(255,255,255,.3)` at radius 16, dashed the way the
/// browser draws it.
class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter();

  static const double _width = 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x4DFFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = _width;
    final rrect = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(_width / 2),
      const Radius.circular(16 - _width / 2),
    );
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      for (var d = 0.0; d < metric.length; d += 5) {
        canvas.drawPath(metric.extractPath(d, math.min(d + 3, metric.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) => false;
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {this.top = 0});

  final String text;
  final double top;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(3, top, 3, 0),
    child: Text(text, style: _inter(15, FontWeight.w700)),
  );
}

class _RowLabel extends StatelessWidget {
  const _RowLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 3),
    child: Text(text, style: _inter(10.5, FontWeight.w600, color: _mint)),
  );
}

BoxDecoration get _cellDecoration => BoxDecoration(
  color: _white04,
  borderRadius: BorderRadius.circular(14),
  border: Border.all(color: _white14, width: 1.5),
);

class _MainRow extends StatelessWidget {
  const _MainRow({required this.row});

  final _Row row;

  Widget _cell(int i) {
    final best = row.best == i;
    return Container(
      constraints: const BoxConstraints(minHeight: 44),
      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
      decoration: _cellDecoration,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 5,
        children: [
          Text(
            row.values[i],
            style: best ? _inter(14, FontWeight.w700, color: SeoulColors.lime) : _inter(14, FontWeight.w600),
          ),
          if (best)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 7),
              decoration: BoxDecoration(color: SeoulColors.lime, borderRadius: BorderRadius.circular(SeoulRadii.pill)),
              child: Text(row.bestLabel!, style: _inter(9.5, FontWeight.w700, color: SeoulColors.ink)),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 6,
      children: [_RowLabel(row.label), _Pair(_cell(0), _cell(1))],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.items});

  final String label;
  final List<({String short, String text})> items;

  Widget _cell(({String short, String text}) it) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
      decoration: _cellDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 6,
        children: [
          Container(
            height: 18,
            padding: const EdgeInsets.symmetric(horizontal: 7),
            decoration: BoxDecoration(
              color: _chipFill,
              borderRadius: BorderRadius.circular(SeoulRadii.pill),
              border: Border.all(color: const Color(0x33FFFFFF)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    it.short,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _inter(9.5, FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          Text(it.text, style: _inter(12, FontWeight.w400, color: const Color(0xD9FFFFFF), height: 1.45)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 6,
      children: [_RowLabel(label), _Pair(_cell(items[0]), _cell(items[1]))],
    );
  }
}

/// The guest's "Bog'lanish 문의" pill over a fade into the page bottom. The
/// solid page colour carries on under the system inset, so the rows never
/// show through below the pill.
class _ContactBar extends StatelessWidget {
  const _ContactBar({required this.label, required this.bottomInset, required this.onTap});

  final String label;
  final double bottomInset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _bar(),
        ColoredBox(
          color: _pageEnd,
          child: SizedBox(height: bottomInset),
        ),
      ],
    );
  }

  Widget _bar() {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x000A0A1A), _pageEnd],
          stops: [0, 0.45],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        child: Semantics(
          button: true,
          child: GestureDetector(
            onTap: onTap,
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: SeoulColors.lime,
                borderRadius: BorderRadius.circular(SeoulRadii.pill),
                boxShadow: const [BoxShadow(color: Color(0x4DD4E94C), blurRadius: 18)],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: 6,
                children: [
                  Text(label, style: _inter(14, FontWeight.w700, color: SeoulColors.ink)),
                  Text('문의', strutStyle: _interStrut(10), style: _hangul(10, FontWeight.w700, SeoulColors.ink)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

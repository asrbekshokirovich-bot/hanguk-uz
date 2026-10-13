import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../map/presentation/map_deeplink_provider.dart';
import '../data/map_pins.dart';
import 'discover_routes.dart';
import 'filter_board_screen.dart';
import 'widgets/fd_parts.dart';

/// The design's Korea outline, as fractions of the panel (`clip-path:
/// polygon(...)`), and Jeju's ellipse.
const List<Offset> _outline = [
  Offset(.28, .06),
  Offset(.46, .03),
  Offset(.63, .09),
  Offset(.73, .18),
  Offset(.77, .34),
  Offset(.74, .50),
  Offset(.79, .62),
  Offset(.70, .75),
  Offset(.58, .81),
  Offset(.44, .79),
  Offset(.33, .72),
  Offset(.25, .60),
  Offset(.23, .44),
  Offset(.21, .28),
];
const Rect _jeju = Rect.fromLTWH(.23, .74, .14, .06);

/// Design screen 17, "360° xarita": the universities as pins on a drawing of
/// Korea — a city's pin with the number of universities in it — and under
/// it the selected one's card, whose 360° button opens its campus view. The
/// filter board's choices apply here too. A pin holds the cities around it
/// (Suwon and Incheon are under Seul), so its card swipes through them all.
class KoreaMapScreen extends ConsumerStatefulWidget {
  const KoreaMapScreen({super.key});

  @override
  ConsumerState<KoreaMapScreen> createState() => _KoreaMapScreenState();
}

class _KoreaMapScreenState extends ConsumerState<KoreaMapScreen> {
  final _view = TransformationController();
  final _pages = PageController();
  String? _selected;
  Size _panel = Size.zero;

  @override
  void dispose() {
    _view.dispose();
    _pages.dispose();
    super.dispose();
  }

  void _select(String label) {
    setState(() {
      _selected = label;
    });
    if (_pages.hasClients) _pages.jumpToPage(0);
  }

  void _zoom(double factor) {
    final current = _view.value.getMaxScaleOnAxis();
    final next = (current * factor).clamp(1.0, 3.0);
    if (next == current) return;
    final c = Offset(_panel.width / 2, _panel.height / 2);
    // Zoom about the panel's centre.
    _view.value = Matrix4.diagonal3Values(next, next, 1)..setTranslationRaw(c.dx - c.dx * next, c.dy - c.dy * next, 0);
  }

  /// `/map/:institutionId`: select the pin that holds the university and show
  /// its card.
  void _showUniversity(String id, List<MapPin> pins) {
    for (final p in pins) {
      final i = p.universities.indexWhere((u) => u.institutionId == id);
      if (i < 0) continue;
      setState(() => _selected = p.label);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_pages.hasClients) _pages.jumpToPage(i);
      });
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final shown = boardResults(ref, all, f);
    final pins = clusterPins(shown);
    ref.listen<String?>(pendingMapDetailProvider, (prev, id) {
      if (id == null) return;
      _showUniversity(id, pins);
      ref.read(pendingMapDetailProvider.notifier).set(null);
    });
    final selected = pins.where((p) => p.label == _selected).firstOrNull ?? pins.firstOrNull;
    final markStyle = fdText(26, FontWeight.w800, FdColors.ink, height: 1, letterSpacing: -0.78);

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.fdMapKicker(shown.length), style: fdText(12, FontWeight.w700, FdColors.muted)),
                      const SizedBox(height: 2),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.end,
                        children: [
                          Text('360° ', style: markStyle),
                          LimeMark(l.fdMapTitleMark, style: markStyle),
                        ],
                      ),
                    ],
                  ),
                ),
                Semantics(
                  button: true,
                  child: GestureDetector(
                    onTap: () => context.push(kDiscoverFilterPath),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      height: 34,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: FdColors.card,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: FdColors.ink, width: 1.5),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Lucide(LucideIcons.slidersHorizontal, size: 14, color: FdColors.ink),
                          const SizedBox(width: 6),
                          Text(l.catalogFilterTitle, style: fdText(12, FontWeight.w700, FdColors.ink)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: FdColors.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                  boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
                ),
                child: LayoutBuilder(
                  builder: (context, box) {
                    _panel = box.biggest;
                    final w = box.maxWidth;
                    final h = box.maxHeight;
                    return Stack(
                      children: [
                        InteractiveViewer(
                          transformationController: _view,
                          minScale: 1,
                          maxScale: 3,
                          child: SizedBox(
                            width: w,
                            height: h,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                const Positioned.fill(child: CustomPaint(painter: _MapPainter())),
                                Positioned(
                                  left: .08 * w,
                                  top: .08 * h,
                                  child: ExcludeSemantics(
                                    child: Text(
                                      l.fdMapLabel,
                                      style: fdText(10, FontWeight.w700, const Color(0xFFB9C5D8), letterSpacing: 1),
                                    ),
                                  ),
                                ),
                                for (final p in pins)
                                  Positioned(
                                    left: p.x / 100 * w,
                                    top: p.y / 100 * h,
                                    child: FractionalTranslation(
                                      translation: const Offset(-.5, -1),
                                      child: _Pin(pin: p, selected: p == selected, onTap: () => _select(p.label)),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        if (pins.isEmpty)
                          Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                l.fdMapEmpty,
                                textAlign: TextAlign.center,
                                style: fdText(13, FontWeight.w700, FdColors.muted),
                              ),
                            ),
                          ),
                        Positioned(
                          right: 10,
                          top: 10,
                          child: Column(
                            children: [
                              _ZoomButton(glyph: LucideIcons.plus, label: l.fdMapZoomIn, onTap: () => _zoom(1.5)),
                              const SizedBox(height: 6),
                              _ZoomButton(glyph: LucideIcons.minus, label: l.fdMapZoomOut, onTap: () => _zoom(1 / 1.5)),
                            ],
                          ),
                        ),
                        if (selected != null)
                          Positioned(
                            left: 10,
                            right: 10,
                            bottom: 10,
                            child: SizedBox(
                              height: 78,
                              child: PageView.builder(
                                key: ValueKey(selected.label),
                                controller: _pages,
                                itemCount: selected.universities.length,
                                itemBuilder: (context, i) => _MapCard(
                                  university: selected.universities[i],
                                  guideline: guidelineFor(selected.universities[i], f) ?? selected.universities[i].primary,
                                  counter: selected.count > 1 ? l.fdMapCardOf(i + 1, selected.count) : null,
                                ),
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The white panel's grid, the outline of Korea and Jeju's ellipse.
class _MapPainter extends CustomPainter {
  const _MapPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = FdColors.page
      ..strokeWidth = 1;
    for (var x = 0.0; x <= size.width; x += 28) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (var y = 0.0; y <= size.height; y += 28) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    final land = Paint()..color = FdColors.tint;
    final path = Path()..moveTo(_outline.first.dx * size.width, _outline.first.dy * size.height);
    for (final p in _outline.skip(1)) {
      path.lineTo(p.dx * size.width, p.dy * size.height);
    }
    path.close();
    canvas.drawPath(path, land);
    canvas.drawOval(
      Rect.fromLTWH(_jeju.left * size.width, _jeju.top * size.height, _jeju.width * size.width, _jeju.height * size.height),
      land,
    );
  }

  @override
  bool shouldRepaint(_MapPainter old) => false;
}

/// A city's pin: its name and the number of universities in a pill, and a
/// drop under it — lime and ink when it is the selected one.
class _Pin extends StatelessWidget {
  const _Pin({required this.pin, required this.selected, required this.onTap});

  final MapPin pin;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: true,
      selected: selected,
      label: l.fdMapPin(pin.label, pin.count),
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: selected ? FdColors.ink : FdColors.card,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(pin.label, style: fdText(10, FontWeight.w800, selected ? Colors.white : FdColors.ink)),
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(4)),
                      child: Text('${pin.count}', style: fdText(9, FontWeight.w800, FdColors.onLime)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 3),
              // `border-radius: 50% 50% 50% 0` turned -45°: a drop.
              Transform.rotate(
                angle: -0.7853981634,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: selected ? FdColors.lime : FdColors.navy,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(8),
                      topRight: Radius.circular(8),
                      bottomRight: Radius.circular(8),
                    ),
                    border: Border.all(color: FdColors.ink, width: 1.5),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ZoomButton extends StatelessWidget {
  const _ZoomButton({required this.glyph, required this.label, required this.onTap});

  final LucideGlyph glyph;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) =>
      HardIconButton(glyph: glyph, semanticLabel: label, size: 34, radius: 10, iconSize: 16, onTap: onTap);
}

/// The selected university: photo, name, "city · fee · TOPIK", and the lime
/// 360° button. The card itself opens the university's page.
class _MapCard extends StatelessWidget {
  const _MapCard({required this.university, required this.guideline, required this.counter});

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final String? counter;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.only(right: 3, bottom: 3),
      child: Semantics(
        button: true,
        label: university.displayName,
        child: GestureDetector(
          onTap: () => context.push(universityPath(university.institutionId)),
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: FdColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: FdColors.ink, width: 1.5),
              boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
            ),
            child: Row(
              children: [
                UniThumb(university: university, width: 64, height: 48),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        university.displayName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: fdText(13, FontWeight.w800, FdColors.ink, height: 1.2),
                      ),
                      const SizedBox(height: 2),
                      uniMetaLine(l, university, guideline, maxLines: 1),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (counter != null) Text(counter!, style: fdText(9, FontWeight.w700, FdColors.muted)),
                    if (counter != null) const SizedBox(height: 2),
                    Semantics(
                      button: true,
                      label: l.fdMapOpen360,
                      excludeSemantics: true,
                      child: GestureDetector(
                        onTap: () => context.push('/walkaround/${university.institutionId}'),
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          height: 36,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: FdColors.lime,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: FdColors.ink, width: 1.5),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Lucide(LucideIcons.rotate3d, size: 14, color: FdColors.onLime),
                              const SizedBox(width: 5),
                              Text('360°', style: fdText(12, FontWeight.w800, FdColors.onLime)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

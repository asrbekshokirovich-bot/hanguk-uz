import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/catalog_filters.dart';
import '../data/catalog_repository.dart';
import '../domain/catalog_models.dart';
import 'catalog_format.dart';

/// Design screen 02 — "Filtr tugmasi bosilganda": city, degree, the IELTS
/// score and the fee range. Changes apply as they are made, so the button at
/// the bottom always states how many universities the list will show.
class CatalogFilterScreen extends ConsumerWidget {
  const CatalogFilterScreen({super.key});

  static Future<void> open(BuildContext context) => Navigator.of(context).push(
    MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => const CatalogFilterScreen()),
  );

  static const _ieltsOptions = <double?>[null, 5.5, 6.0, 6.5];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final set = ref.read(catalogFilterProvider.notifier).set;
    final cities = catalogCities(all);
    final bounds = priceBounds(all);
    final lo = (f.minPrice ?? bounds.min).clamp(bounds.min, bounds.max);
    final hi = (f.maxPrice ?? bounds.max).clamp(bounds.min, bounds.max);
    final count = applyCatalogFilter(all, f).length;

    // Four ranges across the catalogue's own spread, on round millions.
    final presets = _presets(bounds.min, bounds.max);

    return SeoulNightScaffold(
      body: Stack(
        children: [
          Column(
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 14),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: SeoulColors.glassBorder))),
                child: Row(
                  children: [
                    Semantics(
                      button: true,
                      label: MaterialLocalizations.of(context).closeButtonTooltip,
                      child: GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 44,
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: SeoulColors.glassBorder)),
                          child: const Icon(Icons.close_rounded, size: 18, color: SeoulColors.textPrimary),
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        l.catalogFilterTitle,
                        textAlign: TextAlign.center,
                        style: SeoulType.title.copyWith(fontSize: 18, letterSpacing: -0.18),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => set(f.cleared()),
                      behavior: HitTestBehavior.opaque,
                      child: SizedBox(
                        height: 44,
                        child: Center(
                          child: Text(
                            l.catalogFilterClear,
                            style: SeoulType.body.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: SeoulColors.infoText),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 110),
                  children: [
                    _SectionHeader(
                      title: l.catalogFilterCity,
                      trailing: f.cities.isEmpty ? l.filterAll : l.catalogFilterCityPicked(f.cities.length),
                    ),
                    const SizedBox(height: 12),
                    _Grid(
                      columns: 4,
                      spacing: 8,
                      children: [
                        _CityTile(
                          ko: '전체',
                          name: l.filterAll,
                          selected: f.cities.isEmpty,
                          onTap: () => set(f.copyWith(cities: const {})),
                        ),
                        for (final c in cities)
                          _CityTile(
                            ko: c.ko,
                            name: c.name,
                            selected: f.cities.contains(c.name),
                            onTap: () {
                              final next = {...f.cities};
                              if (!next.remove(c.name)) next.add(c.name);
                              set(f.copyWith(cities: next));
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 26),
                    _SectionHeader(title: l.catalogFilterDegree),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: SeoulColors.glass, borderRadius: SeoulRadii.controlR),
                      child: Row(
                        children: [
                          for (final (id, label) in [
                            (CatalogDegree.all, l.filterAll),
                            (CatalogDegree.bachelor, l.catalogDegreeBachelor),
                            (CatalogDegree.master, l.catalogDegreeMaster),
                          ])
                            Expanded(
                              child: _Segment(
                                label: label,
                                selected: f.degree == id,
                                onTap: () => set(f.copyWith(degree: id)),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 26),
                    _SectionHeader(title: l.catalogFilterEnglish, trailing: l.catalogFilterEnglishHint),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        for (var i = 0; i < _ieltsOptions.length; i++) ...[
                          if (i > 0) const SizedBox(width: 6),
                          Expanded(
                            child: _Tile(
                              height: 44,
                              radius: 12,
                              selected: f.ielts == _ieltsOptions[i],
                              onTap: () => set(f.copyWith(ielts: () => _ieltsOptions[i])),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                _ieltsOptions[i] == null
                                    ? l.catalogIeltsNone
                                    : i == _ieltsOptions.length - 1
                                    ? '${scoreText(_ieltsOptions[i]!)}+'
                                    : _ieltsOptions[i]!.toStringAsFixed(1),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SeoulType.body.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: f.ielts == _ieltsOptions[i] ? SeoulColors.ink : SeoulColors.textSecondary,
                                ),
                              ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      f.ielts == null ? l.catalogIeltsNoteAll : l.catalogIeltsNote(f.ielts!.toStringAsFixed(1)),
                      style: SeoulType.caption,
                    ),
                    const SizedBox(height: 26),
                    _SectionHeader(title: l.catalogFilterPrice, trailing: l.catalogPricePerSemester),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(child: _PriceBox(label: l.catalogPriceFrom, value: money(lo, 'KRW'))),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8),
                          child: Text('–', style: TextStyle(color: SeoulColors.textFaint, fontWeight: FontWeight.w700)),
                        ),
                        Expanded(child: _PriceBox(label: l.catalogPriceTo, value: money(hi, 'KRW'))),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        activeTrackColor: SeoulColors.lime,
                        inactiveTrackColor: SeoulColors.glassBorder,
                        thumbColor: SeoulColors.lime,
                        overlayColor: SeoulColors.limeFill,
                        trackHeight: 4,
                      ),
                      child: Column(
                        children: [
                          Slider(
                            min: bounds.min.toDouble(),
                            max: bounds.max.toDouble(),
                            divisions: ((bounds.max - bounds.min) ~/ 100000).clamp(1, 1000),
                            value: lo.toDouble(),
                            onChanged: (v) {
                              final next = v.round().clamp(bounds.min, hi);
                              set(f.copyWith(
                                minPrice: () => next == bounds.min && f.maxPrice == null ? null : next,
                              ));
                            },
                          ),
                          Slider(
                            min: bounds.min.toDouble(),
                            max: bounds.max.toDouble(),
                            divisions: ((bounds.max - bounds.min) ~/ 100000).clamp(1, 1000),
                            value: hi.toDouble(),
                            onChanged: (v) {
                              final next = v.round().clamp(lo, bounds.max);
                              set(f.copyWith(
                                maxPrice: () => next == bounds.max && f.minPrice == null ? null : next,
                              ));
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final p in presets)
                          _PresetChip(
                            label: p.label(l),
                            selected: f.minPrice == p.lo && f.maxPrice == p.hi,
                            onTap: () => set(f.copyWith(minPrice: () => p.lo, maxPrice: () => p.hi)),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              decoration: const BoxDecoration(
                color: Color(0xF20F213D),
                border: Border(top: BorderSide(color: SeoulColors.glassBorder)),
              ),
              child: SafeArea(
                top: false,
                child: LimeButton(label: l.catalogApply(count), onPressed: () => Navigator.of(context).pop()),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static List<_Preset> _presets(int min, int max) {
    // Round-million cut points inside the catalogue's spread, so every preset
    // can match something: e.g. ₩2m–8m → up to 3m, 3–4m, 4–5m, 5m+.
    const m = 1000000;
    final a = ((min ~/ m) + 1) * m;
    final points = [a, a + m, a + 2 * m].where((p) => p < max).toList();
    if (points.isEmpty) return const [];
    final out = <_Preset>[_Preset(min, points.first, upTo: true)];
    for (var i = 0; i + 1 < points.length; i++) {
      out.add(_Preset(points[i], points[i + 1]));
    }
    out.add(_Preset(points.last, max, plus: true));
    return out;
  }
}

class _Preset {
  const _Preset(this.lo, this.hi, {this.upTo = false, this.plus = false});

  final int lo;
  final int hi;
  final bool upTo;
  final bool plus;

  String label(AppLocalizations l) {
    if (upTo) return l.catalogPriceUpTo(money(hi, 'KRW'));
    if (plus) return '${money(lo, 'KRW')}+';
    return '${money(lo, 'KRW')}–${groupThousands(hi)}';
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Expanded(
          child: Text(title, style: SeoulType.subtitle.copyWith(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.15)),
        ),
        if (trailing != null) Text(trailing!, style: SeoulType.caption),
      ],
    );
  }
}

/// Equal-width columns that wrap — the design's CSS grid.
class _Grid extends StatelessWidget {
  const _Grid({required this.columns, required this.spacing, required this.children});

  final int columns;
  final double spacing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      if (i > 0) rows.add(SizedBox(height: spacing));
      rows.add(Row(
        children: [
          for (var j = 0; j < columns; j++) ...[
            if (j > 0) SizedBox(width: spacing),
            Expanded(child: i + j < children.length ? children[i + j] : const SizedBox.shrink()),
          ],
        ],
      ));
    }
    return Column(children: rows);
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.height,
    required this.radius,
    required this.selected,
    required this.onTap,
    required this.child,
  });

  final double height;
  final double radius;
  final bool selected;
  final VoidCallback onTap;
  final Widget child;

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
          curve: SeoulMotion.smooth,
          height: height,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: selected ? SeoulColors.lime : SeoulColors.glass,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: selected ? SeoulColors.lime : SeoulColors.glassBorder),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _CityTile extends StatelessWidget {
  const _CityTile({required this.ko, required this.name, required this.selected, required this.onTap});

  final String? ko;
  final String name;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _Tile(
      height: 60,
      radius: 16,
      selected: selected,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (ko != null)
            Text(
              ko!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: SeoulType.hangulGlyph.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: selected ? SeoulColors.ink : SeoulColors.textPrimary,
              ),
            ),
          const SizedBox(height: 2),
          Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: SeoulType.caption.copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: selected ? SeoulColors.ink : SeoulColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({required this.label, required this.selected, required this.onTap});

  final String label;
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
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? const Color(0x29FFFFFF) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: selected ? const [BoxShadow(color: Color(0x40000000), blurRadius: 8, offset: Offset(0, 2))] : null,
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: SeoulType.body.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: selected ? SeoulColors.textPrimary : SeoulColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _PriceBox extends StatelessWidget {
  const _PriceBox({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: SeoulColors.glass,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: SeoulColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: SeoulType.caption.copyWith(fontSize: 11)),
          const SizedBox(height: 1),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: SeoulType.subtitle.copyWith(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _PresetChip extends StatelessWidget {
  const _PresetChip({required this.label, required this.selected, required this.onTap});

  final String label;
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
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: selected ? SeoulColors.lime : SeoulColors.glass,
            borderRadius: BorderRadius.circular(SeoulRadii.pill),
            border: Border.all(color: selected ? SeoulColors.lime : SeoulColors.glassBorder),
          ),
          child: Center(
            widthFactor: 1,
            child: Text(
              label,
              style: SeoulType.caption.copyWith(
                fontWeight: FontWeight.w600,
                color: selected ? SeoulColors.ink : SeoulColors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

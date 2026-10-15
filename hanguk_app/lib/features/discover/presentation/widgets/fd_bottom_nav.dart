import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';

/// One tab of [FdBottomNav].
@immutable
class FdNavItem {
  const FdNavItem({required this.label, required this.glyph, this.locked = false});

  final String label;
  final LucideGlyph glyph;

  /// A tab only a client can open: a small grey dot sits on its corner.
  final bool locked;
}

/// The prototype's bottom nav: a blue bar under a pale rule, the tabs in a
/// row, the current one lime with an ink border. With [hasCenter] the tabs
/// split around the gap the round [FdNavOrb] rises out of — give the same
/// Scaffold that orb as its `floatingActionButton` and [kFdNavOrbLocation] as
/// its location, so the whole circle takes taps.
class FdBottomNav extends StatelessWidget {
  const FdBottomNav({
    super.key,
    required this.items,
    required this.current,
    required this.onSelect,
    this.hasCenter = false,
  });

  final List<FdNavItem> items;

  /// The lit tab's index in [items]; -1 when none (the centre's screen).
  final int current;
  final ValueChanged<int> onSelect;
  final bool hasCenter;

  /// Room the round button takes between the two halves of the tabs.
  static const double centerGap = 44;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.paddingOf(context).bottom;
    final split = hasCenter ? items.length ~/ 2 : items.length;
    Widget tab(int i) => Expanded(
      child: _Tab(item: items[i], selected: i == current, onTap: () => onSelect(i)),
    );
    final bar = DecoratedBox(
      decoration: const BoxDecoration(
        color: FdColors.page,
        border: Border(top: BorderSide(color: FdColors.navRule, width: 1.5)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(8, 8, 8, inset > 0 ? inset : 8),
        child: SizedBox(
          height: 46,
          child: Row(
            children: [
              for (var i = 0; i < split; i++) ...[if (i > 0) const SizedBox(width: 4), tab(i)],
              if (hasCenter) const SizedBox(width: centerGap + 8),
              for (var i = split; i < items.length; i++) ...[if (i > split) const SizedBox(width: 4), tab(i)],
            ],
          ),
        ),
      ),
    );
    if (!hasCenter) return bar;
    // Above the bar the page keeps 16px clear, so the content stops short of
    // the round button's top (the prototype's spacer).
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const ColoredBox(color: FdColors.page, child: SizedBox(height: kFdNavOrbClearance, width: double.infinity)),
        bar,
      ],
    );
  }
}

/// The page left clear above a bar that has a round button (the prototype's
/// 16px spacer).
const double kFdNavOrbClearance = 16;

/// Puts [FdNavOrb] on the middle of the bar's top edge, a little above it:
/// the circle's lower 38px sit in the bar, the upper 24px over the page.
const FloatingActionButtonLocation kFdNavOrbLocation = _OrbLocation();

class _OrbLocation extends FloatingActionButtonLocation {
  const _OrbLocation();

  @override
  Offset getOffset(ScaffoldPrelayoutGeometry g) => Offset(
    (g.scaffoldSize.width - g.floatingActionButtonSize.width) / 2,
    // The bar starts [kFdNavOrbClearance] below the content; the circle rises
    // 24px above the bar.
    g.contentBottom + kFdNavOrbClearance - 24,
  );
}

/// The round button in the middle of the bar: the best admission chance (or
/// "?%") over "BAHOLASH". Lime while its screen is open, white otherwise.
class FdNavOrb extends StatelessWidget {
  const FdNavOrb({super.key, required this.value, required this.label, required this.active, required this.onTap});

  /// "86%" or "?%".
  final String value;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = active ? FdColors.onLime : FdColors.ink;
    return Semantics(
      button: true,
      selected: active,
      label: '$label $value',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 62,
          height: 62,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? FdColors.lime : FdColors.card,
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(value, style: fdText(16, FontWeight.w800, fg, height: 1)),
              const SizedBox(height: 1),
              Text(label, style: fdText(8, FontWeight.w800, fg, height: 1.2)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.item, required this.selected, required this.onTap});

  final FdNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? FdColors.onLime : FdColors.pageMuted;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                decoration: BoxDecoration(
                  color: selected ? FdColors.lime : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: selected ? FdColors.ink : Colors.transparent, width: 1.5),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Lucide(item.glyph, size: 18, color: color),
                    const SizedBox(height: 3),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          item.label,
                          maxLines: 1,
                          style: fdText(9, selected ? FontWeight.w800 : FontWeight.w600, color, height: 1.1),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (item.locked)
              Positioned(
                top: 4,
                right: 8,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: FdColors.muted,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

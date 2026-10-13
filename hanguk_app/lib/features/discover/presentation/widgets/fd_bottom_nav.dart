import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';

/// One tab of [FdBottomNav].
typedef FdNavItem = ({String label, LucideGlyph glyph});

/// The full design's bottom nav: a white bar under an ink rule, the tabs in a
/// grid, the current one lime with an ink border.
class FdBottomNav extends StatelessWidget {
  const FdBottomNav({super.key, required this.items, required this.current, required this.onSelect});

  final List<FdNavItem> items;
  final int current;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.paddingOf(context).bottom;
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: FdColors.card,
        border: Border(top: BorderSide(color: FdColors.ink, width: 1.5)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(10, 8, 10, inset > 0 ? inset : 8),
        child: SizedBox(
          height: 44,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(child: _Tab(item: items[i], selected: i == current, onTap: () => onSelect(i))),
              ],
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
    final color = selected ? FdColors.onLime : FdColors.muted;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
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
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: fdText(11, selected ? FontWeight.w800 : FontWeight.w600, color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

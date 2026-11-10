import 'package:flutter/material.dart';

import '../icons.dart';
import '../insets.dart';
import '../tokens.dart';
import '../typography.dart';
import 'buttons.dart';
import 'pressable.dart';

/// One destination of [HiBottomNav].
class HiNavItem {
  const HiNavItem({required this.icon, required this.label, this.wide = false});

  final HiIconData icon;
  final String label;

  /// Takes a double-width column («Mening smenalarim»).
  final bool wide;
}

/// The worker app's bottom menu: dark bar, lime pill behind the current icon.
class HiBottomNav extends StatelessWidget {
  const HiBottomNav({
    super.key,
    required this.items,
    required this.current,
    required this.onSelect,
  });

  final List<HiNavItem> items;
  final int current;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF060D2B),
        border: Border(top: BorderSide(color: HiColors.white10)),
      ),
      padding: EdgeInsets.fromLTRB(6, 6, 6, HiInsets.bottom(context, 20)),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++)
            Expanded(
              flex: items[i].wide ? 2 : 1,
              child: _NavButton(
                item: items[i],
                selected: i == current,
                onTap: () => onSelect(i),
              ),
            ),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({required this.item, required this.selected, required this.onTap});

  final HiNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: selected,
      builder: (context, pressed) => ConstrainedBox(
        // The prototype's bar is 84 px high with a 1 px border and 6 / 20 px
        // padding: its grid row, where the item is centred, is 57 px.
        constraints: const BoxConstraints(minHeight: 57),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 52,
              height: 30,
              decoration: selected
                  ? BoxDecoration(color: HiColors.lime, borderRadius: BorderRadius.circular(HiRadii.pill))
                  : null,
              alignment: Alignment.center,
              child: HiIcon(
                item.icon,
                size: 20,
                strokeWidth: 2,
                color: selected ? HiColors.onLime : HiColors.textMuted,
              ),
            ),
            const SizedBox(height: 4),
            HiText(
              item.label,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.visible,
              style: hiStyle(
                12,
                selected ? FontWeight.w800 : FontWeight.w600,
                color: selected ? HiColors.white : HiColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 44×44 / 50×50 translucent square icon button on navy (bell, close).
class HiGlassIconButton extends StatelessWidget {
  const HiGlassIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
    this.size = 50,
    this.radius = 16,
    this.iconSize = 21,
    this.badge = false,
  });

  final HiIconData icon;
  final VoidCallback? onTap;
  final String semanticsLabel;
  final double size;
  final double radius;
  final double iconSize;

  /// The amber dot for unread notifications.
  final bool badge;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      builder: (context, pressed) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: pressed ? HiColors.white14 : HiColors.white08,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: HiColors.white14),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            HiIcon(icon, size: iconSize, strokeWidth: 2, color: HiColors.white),
            if (badge)
              Positioned(
                top: 11 - 1,
                right: 12 - 1,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: HiColors.amber,
                    shape: BoxShape.circle,
                    border: Border.all(color: HiColors.navy, width: 2),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// List ⇄ map switch in the feed header (two 44 px squares in a frame).
class HiViewToggle extends StatelessWidget {
  const HiViewToggle({
    super.key,
    required this.mapSelected,
    required this.onList,
    required this.onMap,
    required this.listLabel,
    required this.mapLabel,
  });

  final bool mapSelected;
  final VoidCallback onList;
  final VoidCallback onMap;
  final String listLabel;
  final String mapLabel;

  @override
  Widget build(BuildContext context) {
    Widget cell(HiIconData icon, bool on, VoidCallback onTap, String label) => HiPressable(
          onTap: onTap,
          selected: on,
          semanticsLabel: label,
          builder: (context, pressed) => Container(
            width: 44,
            height: 44,
            decoration: on
                ? BoxDecoration(color: HiColors.white, borderRadius: BorderRadius.circular(13))
                : null,
            alignment: Alignment.center,
            child: HiIcon(icon, size: 20, strokeWidth: 2, color: on ? HiColors.ink : HiColors.white),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: HiColors.white08,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: HiColors.white14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          cell(HiIcons.list, !mapSelected, onList, listLabel),
          const SizedBox(width: 2),
          cell(HiIcons.map, mapSelected, onMap, mapLabel),
        ],
      ),
    );
  }
}

/// Equal-width tabs in a translucent track (Bugun / Ertaga / Hafta oxiri).
class HiSegmentedTabs extends StatelessWidget {
  const HiSegmentedTabs({
    super.key,
    required this.labels,
    required this.current,
    required this.onSelect,
    this.flex,
    this.semanticsLabel,
  });

  final List<String> labels;
  final int current;
  final ValueChanged<int> onSelect;

  /// Column widths (`grid-template-columns` fr values × 100); equal if null.
  final List<int>? flex;

  /// Name of the tab group for screen readers.
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final tabs = Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: HiColors.white08,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: HiColors.white12),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              flex: flex?[i] ?? 1,
              child: HiPressable(
                onTap: () => onSelect(i),
                selected: i == current,
                builder: (context, pressed) => Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: i == current ? HiColors.white : (pressed ? HiColors.white08 : null),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: HiText(
                    labels[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: hiStyle(
                      15,
                      i == current ? FontWeight.w800 : FontWeight.w700,
                      color: i == current ? HiColors.ink : HiColors.textSoft,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
    final label = semanticsLabel;
    return label == null ? tabs : Semantics(container: true, label: label, child: tabs);
  }
}

/// A filter pill with a chevron (Maosh ▾); white when a value is set.
class HiFilterChip extends StatelessWidget {
  const HiFilterChip({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    this.background,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  /// Fill of an inactive chip (navy on the map, transparent on the feed).
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: active,
      builder: (context, pressed) => Container(
        height: 44,
        padding: const EdgeInsets.only(left: 16, right: 12),
        decoration: BoxDecoration(
          color: active ? HiColors.white : (pressed ? HiColors.white08 : background),
          borderRadius: BorderRadius.circular(HiRadii.pill),
          border: active ? Border.fromBorderSide(HiBorders.ink) : Border.all(color: HiColors.white30, width: HiBorders.width),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            HiText(
              label,
              style: hiStyle(15, active ? FontWeight.w800 : FontWeight.w700, color: active ? HiColors.ink : HiColors.white),
            ),
            const SizedBox(width: 4),
            HiIcon(HiIcons.chevronDown, size: 16, strokeWidth: 2, color: active ? HiColors.ink : HiColors.white),
          ],
        ),
      ),
    );
  }
}

/// The round «Barcha filtrlar» button.
class HiFilterAllButton extends StatelessWidget {
  const HiFilterAllButton({super.key, required this.onTap, required this.semanticsLabel, this.background});

  final VoidCallback onTap;
  final String semanticsLabel;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      builder: (context, pressed) => Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: pressed ? HiColors.white08 : background,
          shape: BoxShape.circle,
          border: Border.all(color: HiColors.white30, width: HiBorders.width),
        ),
        alignment: Alignment.center,
        child: const HiIcon(HiIcons.slidersHorizontal, size: 18, strokeWidth: 2, color: HiColors.white),
      ),
    );
  }
}

/// Centred message with a big white icon tile and an action (empty feed,
/// no internet).
class HiStatusMessage extends StatelessWidget {
  const HiStatusMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.text,
    this.action,
    this.actionIcon,
    this.onAction,
    this.textMaxWidth,
  });

  final HiIconData icon;
  final String title;
  final String text;

  /// The lime button; none when null.
  final String? action;
  final HiIconData? actionIcon;
  final VoidCallback? onAction;
  final double? textMaxWidth;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: HiColors.white,
              borderRadius: BorderRadius.circular(26),
              border: Border.fromBorderSide(HiBorders.ink),
              boxShadow: HiShadows.hard,
            ),
            alignment: Alignment.center,
            child: HiIcon(icon, size: 40, strokeWidth: 2, color: HiColors.ink),
          ),
          const SizedBox(height: 10 + 10),
          HiText(title, textAlign: TextAlign.center, style: hiStyle(22, FontWeight.w800, height: 1.25)),
          if (text.isNotEmpty) ...[
            const SizedBox(height: 10),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: textMaxWidth ?? double.infinity),
              child: HiText(
                text,
                textAlign: TextAlign.center,
                style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.textSoft),
              ),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: 10 + 12),
            IntrinsicWidth(
              child: HiButton(
                label: action!,
                icon: actionIcon,
                iconStroke: 2.2,
                horizontalPadding: 26,
                onPressed: onAction,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

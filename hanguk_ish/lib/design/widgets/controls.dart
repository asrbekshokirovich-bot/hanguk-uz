import 'package:flutter/widgets.dart';

import '../icons.dart';
import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// The prototype's 26×26 white checkbox (A01 terms).
class HiCheckbox extends StatelessWidget {
  const HiCheckbox({super.key, required this.value});

  final bool value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.fromBorderSide(HiBorders.ink),
      ),
      alignment: Alignment.center,
      child: value
          ? const HiIcon(
              HiIcons.check,
              size: 16,
              strokeWidth: 3.2,
              color: HiColors.ink,
            )
          : null,
    );
  }
}

/// One choice in a grid of large options (the A01 language buttons).
///
/// Selected: white tile, ink outline, hard shadow and an ink check disc.
/// Unselected: translucent tile with a hairline white outline.
class HiOptionTile extends StatelessWidget {
  const HiOptionTile({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.family = HiFamily.inter,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final HiFamily family;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: selected,
      builder: (context, pressed) {
        return Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: selected
                ? HiColors.white
                : (pressed ? HiColors.white12 : HiColors.white06),
            borderRadius: BorderRadius.circular(HiRadii.field),
            border: selected
                ? Border.fromBorderSide(HiBorders.ink)
                : Border.all(color: HiColors.white18),
            boxShadow: selected ? HiShadows.hard : null,
          ),
          child: Row(
            children: [
              Expanded(
                child: HiText(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: hiStyle(
                    16,
                    selected ? FontWeight.w800 : FontWeight.w700,
                    color: selected ? HiColors.ink : HiColors.white,
                    family: family,
                  ),
                ),
              ),
              if (selected)
                Container(
                  width: 24,
                  height: 24,
                  decoration: const BoxDecoration(
                    color: HiColors.ink,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const HiIcon(
                    HiIcons.check,
                    size: 14,
                    strokeWidth: 3,
                    color: HiColors.white,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

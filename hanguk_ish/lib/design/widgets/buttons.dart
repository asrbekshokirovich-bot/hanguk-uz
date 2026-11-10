import 'package:flutter/widgets.dart';

import '../icons.dart';
import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// Looks of the prototype's full-width buttons.
enum HiButtonStyle {
  /// Lime fill, ink outline and hard shadow — the main action of a screen.
  lime,

  /// Transparent with a `1.5px` (drawn 1 px) `rgba(255,255,255,0.45)` outline, on navy.
  ghost,

  /// Solid ink, white text, no outline (card «Olish»).
  ink,

  /// Text only («Orqaga», «Lentaga qaytish»); colour from [HiButton.textColor].
  text,

  /// White with an ink outline, no shadow (A06 «Chat»).
  outline,

  /// Red fill, ink outline and hard shadow — confirming something that
  /// cannot be undone («Ha, bekor qilish»).
  danger,
}

/// A prototype button: label (and optional leading icon) centred in a
/// rounded box of [height].
///
/// Pressing sinks a shadowed button 2 px toward its shadow; a disabled
/// button ([onPressed] null) is drawn at 45 % opacity.
class HiButton extends StatelessWidget {
  const HiButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.style = HiButtonStyle.lime,
    this.icon,
    this.height = 52,
    this.fontSize = 17,
    this.iconSize = 20,
    this.iconStroke = 2.2,
    this.horizontalPadding = 0,
    this.textColor,
    this.iconGap = 10,
  });

  final String label;
  final VoidCallback? onPressed;
  final HiButtonStyle style;
  final HiIconData? icon;
  final double height;
  final double fontSize;
  final double iconSize;
  final double iconStroke;

  /// Inner side padding; 0 = the button fills its width (most screens).
  final double horizontalPadding;

  /// Label colour of [HiButtonStyle.text] buttons (white on navy, ink on white).
  final Color? textColor;

  /// Space between the icon and the label.
  final double iconGap;

  @override
  Widget build(BuildContext context) {
    final (Color fill, Color fg, BorderSide side, bool shadow) = switch (style) {
      HiButtonStyle.lime => (HiColors.lime, HiColors.onLime, HiBorders.ink, true),
      HiButtonStyle.ghost => (
          const Color(0x00000000),
          HiColors.white,
          const BorderSide(color: HiColors.white45, width: HiBorders.width),
          false,
        ),
      HiButtonStyle.ink => (HiColors.ink, HiColors.white, BorderSide.none, false),
      HiButtonStyle.text => (
          const Color(0x00000000),
          textColor ?? HiColors.white,
          BorderSide.none,
          false,
        ),
      HiButtonStyle.outline => (HiColors.white, HiColors.ink, HiBorders.ink, false),
      HiButtonStyle.danger => (HiColors.red, HiColors.white, HiBorders.ink, true),
    };
    final leading = icon;
    return Opacity(
      opacity: onPressed == null ? 0.45 : 1,
      child: HiPressable(
        onTap: onPressed,
        builder: (context, pressed) {
          final sink = shadow && pressed ? 2.0 : 0.0;
          return Transform.translate(
            offset: Offset(sink, sink),
            child: Container(
              height: height,
              padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
              decoration: BoxDecoration(
                color: !shadow && pressed
                    ? switch (style) {
                        HiButtonStyle.ink => const Color(0xFF1C2C4A),
                        HiButtonStyle.outline => HiColors.surface,
                        _ => HiColors.white08,
                      }
                    : fill,
                borderRadius: BorderRadius.circular(HiRadii.button),
                border: side == BorderSide.none ? null : Border.fromBorderSide(side),
                boxShadow: shadow
                    ? [
                        BoxShadow(
                          color: HiColors.ink,
                          offset: Offset(4 - sink, 4 - sink),
                        ),
                      ]
                    : null,
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (leading != null) ...[
                    HiIcon(
                      leading,
                      size: iconSize,
                      strokeWidth: iconStroke,
                      color: fg,
                    ),
                    SizedBox(width: iconGap),
                  ],
                  Flexible(
                    child: HiText(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: hiStyle(fontSize, FontWeight.w800, color: fg),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

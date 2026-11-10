import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../icons.dart';
import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// 44×44 translucent square with a chevron (A02 «Orqaga»).
class HiBackButton extends StatelessWidget {
  const HiBackButton({super.key, required this.onPressed, this.semanticsLabel});

  final VoidCallback? onPressed;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onPressed,
      semanticsLabel: semanticsLabel ??
          MaterialLocalizations.of(context).backButtonTooltip,
      builder: (context, pressed) => Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: pressed ? HiColors.white14 : HiColors.white08,
          borderRadius: BorderRadius.circular(HiRadii.button),
          border: Border.all(color: HiColors.white14),
        ),
        alignment: Alignment.center,
        child: const HiIcon(
          HiIcons.chevronLeft,
          size: 22,
          strokeWidth: 2.2,
          color: HiColors.white,
        ),
      ),
    );
  }
}

/// Back button, centred title, and a 44 px spacer so the title stays centred.
class HiTopBar extends StatelessWidget {
  const HiTopBar({super.key, required this.title, required this.onBack});

  final String title;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        HiBackButton(onPressed: onBack),
        const SizedBox(width: 12),
        Expanded(
          child: HiText(
            title,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: hiStyle(15, FontWeight.w700, color: HiColors.textMuted),
          ),
        ),
        const SizedBox(width: 12),
        const SizedBox(width: 44),
      ],
    );
  }
}

/// Segmented progress (A02 «Profil · 1 / 3»): lime up to [current].
class HiStepProgress extends StatelessWidget {
  const HiStepProgress({super.key, required this.count, required this.current});

  final int count;

  /// 1-based.
  final int current;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      value: '$current / $count',
      child: Row(
        children: [
          for (var i = 0; i < count; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: Container(
                height: 6,
                decoration: BoxDecoration(
                  color: i < current ? HiColors.lime : HiColors.white16,
                  borderRadius: BorderRadius.circular(HiRadii.pill),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// «1-qadam» / title / optional subtitle of an onboarding step.
class HiStepHeader extends StatelessWidget {
  const HiStepHeader({
    super.key,
    required this.step,
    required this.title,
    this.subtitle,
    this.titleSize = 24,
  });

  final String step;
  final String title;
  final String? subtitle;
  final double titleSize;

  @override
  Widget build(BuildContext context) {
    final sub = subtitle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HiText(step, style: hiStyle(14, FontWeight.w700, color: HiColors.textMuted)),
        const SizedBox(height: 6),
        Semantics(
          header: true,
          child: HiText(
            title,
            style: hiStyle(
              titleSize,
              FontWeight.w800,
              height: 1.2,
              letterSpacingEm: -0.02,
            ),
          ),
        ),
        if (sub != null) ...[
          const SizedBox(height: 6),
          HiText(
            sub,
            style: hiStyle(
              15,
              FontWeight.w500,
              height: 1.45,
              color: HiColors.textSoft,
            ),
          ),
        ],
      ],
    );
  }
}

/// Label above a field (`15px / 700 / #D6DEEC`).
class HiFieldLabel extends StatelessWidget {
  const HiFieldLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return HiText(text, style: hiStyle(15, FontWeight.w700, color: HiColors.textSoft));
  }
}

/// White 56 px input with ink outline and hard shadow.
///
/// [mono] uses JetBrains Mono 18/700 (numbers, BA0); otherwise Inter 17/700
/// (names, A02).
class HiInputField extends StatelessWidget {
  const HiInputField({
    super.key,
    required this.controller,
    this.placeholder,
    this.mono = false,
    this.keyboardType = TextInputType.text,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters = const [],
    this.autofillHints,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.onChanged,
    this.focusNode,
    this.maxLength,
  });

  final TextEditingController controller;
  final String? placeholder;
  final bool mono;
  final TextInputType keyboardType;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter> inputFormatters;
  final Iterable<String>? autofillHints;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final FocusNode? focusNode;
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    final text = mono
        ? hiStyle(18, FontWeight.w700, color: HiColors.ink, family: HiFamily.mono)
        : hiStyle(17, FontWeight.w700, color: HiColors.ink);
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(HiRadii.field),
        border: Border.fromBorderSide(HiBorders.ink),
        boxShadow: HiShadows.hard,
      ),
      alignment: Alignment.centerLeft,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        style: text,
        strutStyle: hiStrut(text),
        cursorColor: HiColors.ink,
        keyboardType: keyboardType,
        textCapitalization: textCapitalization,
        inputFormatters: [
          if (maxLength != null) LengthLimitingTextInputFormatter(maxLength),
          ...inputFormatters,
        ],
        autofillHints: autofillHints,
        textInputAction: textInputAction,
        onSubmitted: onSubmitted,
        onChanged: onChanged,
        maxLines: 1,
        decoration: InputDecoration.collapsed(
          hintText: placeholder,
          hintStyle: text.copyWith(color: HiColors.inkMuted),
        ),
      ),
    );
  }
}

/// White 56 px button that opens a picker (A02 Universitet / Tuman).
class HiSelectField extends StatelessWidget {
  const HiSelectField({
    super.key,
    required this.icon,
    required this.value,
    required this.onTap,
    this.placeholder,
  });

  final HiIconData icon;
  final String? value;
  final String? placeholder;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shown = value;
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.field),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: pressed ? HiShadows.hardSmall : HiShadows.hard,
        ),
        child: Row(
          children: [
            HiIcon(icon, size: 20, strokeWidth: 2, color: HiColors.inkMuted),
            const SizedBox(width: 10),
            Expanded(
              child: HiText(
                shown ?? placeholder ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: hiStyle(
                  16,
                  FontWeight.w700,
                  color: shown == null ? HiColors.inkMuted : HiColors.ink,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const HiIcon(HiIcons.chevronDown, size: 20, strokeWidth: 2, color: HiColors.ink),
          ],
        ),
      ),
    );
  }
}

/// Pill-shaped toggle (A02 languages, visa): white with a check when on,
/// outlined when off.
class HiChoiceChip extends StatelessWidget {
  const HiChoiceChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.horizontalPadding = 14,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// 14 for the language chips, 16 for the visa chips.
  final double horizontalPadding;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: selected,
      builder: (context, pressed) => Container(
        height: 44,
        padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
        decoration: BoxDecoration(
          color: selected ? HiColors.white : (pressed ? HiColors.white08 : null),
          borderRadius: BorderRadius.circular(HiRadii.pill),
          border: selected
              ? Border.fromBorderSide(HiBorders.ink)
              : Border.all(color: HiColors.white30, width: HiBorders.width),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              const HiIcon(HiIcons.check, size: 16, strokeWidth: 3, color: HiColors.ink),
              const SizedBox(width: 6),
            ],
            HiText(
              label,
              style: hiStyle(
                15,
                selected ? FontWeight.w800 : FontWeight.w700,
                color: selected ? HiColors.ink : HiColors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A row of equal number buttons (A02 TOPIK 0–6).
class HiNumberChoice extends StatelessWidget {
  const HiNumberChoice({
    super.key,
    required this.values,
    required this.selected,
    required this.onSelect,
  });

  final List<int> values;
  final int? selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < values.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(child: _NumberCell(
            value: values[i],
            selected: values[i] == selected,
            onTap: () => onSelect(values[i]),
          )),
        ],
      ],
    );
  }
}

class _NumberCell extends StatelessWidget {
  const _NumberCell({required this.value, required this.selected, required this.onTap});

  final int value;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: selected,
      builder: (context, pressed) => Container(
        height: 48,
        decoration: BoxDecoration(
          color: selected ? HiColors.white : (pressed ? HiColors.white12 : HiColors.white06),
          borderRadius: BorderRadius.circular(HiRadii.button),
          border: selected ? Border.fromBorderSide(HiBorders.ink) : Border.all(color: HiColors.white18),
          boxShadow: selected ? HiShadows.hardSmall : null,
        ),
        alignment: Alignment.center,
        child: HiText(
          '$value',
          style: hiStyle(
            17,
            FontWeight.w800,
            color: selected ? HiColors.ink : HiColors.white,
            family: HiFamily.mono,
          ),
        ),
      ),
    );
  }
}

/// Small translucent tag (A02 «Ixtiyoriy»).
class HiTag extends StatelessWidget {
  const HiTag(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 9),
      decoration: BoxDecoration(
        color: HiColors.white12,
        borderRadius: BorderRadius.circular(HiRadii.pill),
      ),
      alignment: Alignment.center,
      child: HiText(label, style: hiStyle(12, FontWeight.w700, color: HiColors.textSoft)),
    );
  }
}

/// The dashed photo circle with a plus badge (A02 «Rasm yuklash»).
class HiPhotoCircle extends StatelessWidget {
  const HiPhotoCircle({super.key, this.image});

  /// The chosen photo; null shows the camera icon.
  final ImageProvider? image;

  @override
  Widget build(BuildContext context) {
    final photo = image;
    return SizedBox(
      width: 120,
      height: 120,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: const _DashedCirclePainter(),
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: ClipOval(
                  child: photo == null
                      ? const ColoredBox(
                          color: HiColors.white06,
                          child: Center(
                            child: HiIcon(
                              HiIcons.camera,
                              size: 34,
                              strokeWidth: 1.8,
                              color: HiColors.white,
                            ),
                          ),
                        )
                      : Image(image: photo, fit: BoxFit.cover),
                ),
              ),
            ),
          ),
          Positioned(
            right: 2,
            bottom: 2,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: HiColors.white,
                shape: BoxShape.circle,
                border: Border.fromBorderSide(HiBorders.ink),
              ),
              alignment: Alignment.center,
              child: const HiIcon(HiIcons.plus, size: 18, strokeWidth: 3, color: HiColors.ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// `border: 2px dashed rgba(255,255,255,0.4)` on a circle: dashes of 6 px
/// and gaps of ~4.5 px, spread evenly around (as the browser draws it).
class _DashedCirclePainter extends CustomPainter {
  const _DashedCirclePainter();

  @override
  void paint(Canvas canvas, Size size) {
    const width = 2.0;
    final radius = size.shortestSide / 2 - width / 2;
    final center = size.center(Offset.zero);
    final circumference = 2 * math.pi * radius;
    final count = (circumference / 10.5).round();
    final period = 2 * math.pi / count;
    final dash = period * 6 / 10.5;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..color = HiColors.white.withValues(alpha: 0.4);
    final rect = Rect.fromCircle(center: center, radius: radius);
    for (var i = 0; i < count; i++) {
      canvas.drawArc(rect, -math.pi / 2 + i * period, dash, false, paint);
    }
  }

  @override
  bool shouldRepaint(_DashedCirclePainter oldDelegate) => false;
}

/// Weekly availability grid (A02 step 3): rows are days, columns the four
/// day parts; a selected cell is blue with a check.
class HiScheduleGrid extends StatelessWidget {
  const HiScheduleGrid({
    super.key,
    required this.dayLabels,
    required this.dayNames,
    required this.slotLabels,
    required this.slotRanges,
    required this.isOn,
    required this.onToggle,
  });

  /// Short labels down the side (Du, Se, …).
  final List<String> dayLabels;

  /// Full day names for screen readers.
  final List<String> dayNames;
  final List<String> slotLabels;
  final List<String> slotRanges;
  final bool Function(int day, int slot) isOn;
  final void Function(int day, int slot) onToggle;

  @override
  Widget build(BuildContext context) {
    final header = hiStyle(12, FontWeight.w800, height: 1.3);
    final range = hiStyle(12, FontWeight.w600, height: 1.3, color: HiColors.textMuted, family: HiFamily.mono);
    Widget row(List<Widget> cells, {Widget? lead}) => Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(width: 40, child: lead),
            for (final cell in cells) ...[
              const SizedBox(width: 5),
              Expanded(child: cell),
            ],
          ],
        );
    return Column(
      children: [
        row([
          for (var s = 0; s < slotLabels.length; s++)
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                HiText(slotLabels[s], style: header, maxLines: 1, softWrap: false),
                HiText(slotRanges[s], style: range, maxLines: 1, softWrap: false),
              ],
            ),
        ]),
        for (var d = 0; d < dayLabels.length; d++) ...[
          const SizedBox(height: 5),
          row(
            lead: HiText(dayLabels[d], style: hiStyle(14, FontWeight.w800)),
            [
              for (var s = 0; s < slotLabels.length; s++)
                _ScheduleCell(
                  on: isOn(d, s),
                  label: '${dayNames[d]}, ${slotLabels[s]}',
                  onTap: () => onToggle(d, s),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _ScheduleCell extends StatelessWidget {
  const _ScheduleCell({required this.on, required this.label, required this.onTap});

  final bool on;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: on,
      semanticsLabel: label,
      builder: (context, pressed) => Container(
        height: 44,
        decoration: BoxDecoration(
          color: on ? HiColors.blue : (pressed ? HiColors.white12 : HiColors.white06),
          borderRadius: BorderRadius.circular(12),
          border: on ? Border.fromBorderSide(HiBorders.ink) : Border.all(color: HiColors.white14),
        ),
        alignment: Alignment.center,
        child: on
            ? const HiIcon(HiIcons.check, size: 18, strokeWidth: 3, color: HiColors.white)
            : null,
      ),
    );
  }
}

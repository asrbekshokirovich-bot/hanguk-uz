import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

/// A sentence with one link in it, underlined like the prototype:
/// `text-decoration: underline; text-underline-offset: 3px`.
///
/// Flutter cannot move an underline, so the line is painted here: under each
/// piece of the link (it may wrap), its top edge [offset] px below that line's
/// alphabetic baseline, as thick as the font's own underline (Inter 700:
/// 0.0928 em). The link is an ordinary text span, so the sentence wraps,
/// measures and scales like any other text.
class HiLinkSentence extends StatefulWidget {
  const HiLinkSentence({
    super.key,
    this.prefix = '',
    required this.link,
    this.suffix = '',
    required this.style,
    required this.linkStyle,
    this.onLink,
    this.textAlign = TextAlign.start,
    this.offset = 3,
  });

  final String prefix;
  final String link;
  final String suffix;
  final TextStyle style;
  final TextStyle linkStyle;
  final VoidCallback? onLink;
  final TextAlign textAlign;
  final double offset;

  @override
  State<HiLinkSentence> createState() => _HiLinkSentenceState();
}

class _HiLinkSentenceState extends State<HiLinkSentence> {
  final _tap = TapGestureRecognizer();

  @override
  void dispose() {
    _tap.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _tap.onTap = widget.onLink;
    final span = TextSpan(
      style: widget.style,
      children: [
        if (widget.prefix.isNotEmpty) TextSpan(text: widget.prefix),
        TextSpan(
          text: widget.link,
          style: widget.linkStyle,
          recognizer: widget.onLink == null ? null : _tap,
        ),
        if (widget.suffix.isNotEmpty) TextSpan(text: widget.suffix),
      ],
    );
    final scaler = MediaQuery.textScalerOf(context);
    return CustomPaint(
      foregroundPainter: _LinkUnderlinePainter(
        span: span,
        start: widget.prefix.length,
        end: widget.prefix.length + widget.link.length,
        textAlign: widget.textAlign,
        direction: Directionality.of(context),
        scaler: scaler,
        offset: widget.offset,
        color: widget.linkStyle.color ?? const Color(0xFFFFFFFF),
        fontSize: widget.linkStyle.fontSize ?? widget.style.fontSize ?? 14,
      ),
      child: Text.rich(span, textAlign: widget.textAlign, textScaler: scaler),
    );
  }
}

class _LinkUnderlinePainter extends CustomPainter {
  _LinkUnderlinePainter({
    required this.span,
    required this.start,
    required this.end,
    required this.textAlign,
    required this.direction,
    required this.scaler,
    required this.offset,
    required this.color,
    required this.fontSize,
  });

  final TextSpan span;
  final int start;
  final int end;
  final TextAlign textAlign;
  final TextDirection direction;
  final TextScaler scaler;
  final double offset;
  final Color color;
  final double fontSize;

  @override
  void paint(Canvas canvas, Size size) {
    final painter = TextPainter(
      text: span,
      textAlign: textAlign,
      textDirection: direction,
      textScaler: scaler,
    )..layout(minWidth: size.width, maxWidth: size.width);
    final lines = painter.computeLineMetrics();
    final boxes = painter.getBoxesForSelection(
      TextSelection(baseOffset: start, extentOffset: end),
    );
    final scaled = scaler.scale(fontSize);
    final thickness = scaled * 0.0928 < 1 ? 1.0 : scaled * 0.0928;
    final paint = Paint()..color = color;
    for (final box in boxes) {
      final middle = (box.top + box.bottom) / 2;
      LineMetrics? line;
      for (final candidate in lines) {
        final top = candidate.baseline - candidate.ascent;
        final bottom = candidate.baseline + candidate.descent;
        if (middle >= top && middle <= bottom) {
          line = candidate;
          break;
        }
      }
      final baseline = line?.baseline ?? box.bottom;
      canvas.drawRect(
        Rect.fromLTRB(box.left, baseline + offset, box.right,
            baseline + offset + thickness),
        paint,
      );
    }
    painter.dispose();
  }

  @override
  bool shouldRepaint(_LinkUnderlinePainter old) =>
      old.span != span ||
      old.start != start ||
      old.end != end ||
      old.textAlign != textAlign ||
      old.scaler != scaler ||
      old.offset != offset ||
      old.color != color;
}

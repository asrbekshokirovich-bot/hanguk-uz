import 'package:flutter/material.dart';

/// A stroked icon drawn straight from SVG path data on a 24x24 viewBox, with
/// round caps and joins — how the designs' Lucide-style icons are drawn, so
/// they match the design stroke for stroke.
class SvgPathIcon extends StatelessWidget {
  const SvgPathIcon({
    super.key,
    required this.paths,
    required this.size,
    required this.color,
    this.strokeWidth = 2,
    this.circles = const [],
    this.filledCircles = const [],
  });

  /// SVG `d` strings.
  final List<String> paths;

  /// Stroked `<circle>`s as (cx, cy, r).
  final List<(double, double, double)> circles;

  /// Circles that are filled as well as stroked (e.g. a key's hole).
  final List<(double, double, double)> filledCircles;

  final double size;
  final Color color;

  /// In viewBox units, like the SVG `stroke-width`.
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: CustomPaint(
        size: Size.square(size),
        painter: _SvgPathIconPainter(this),
      ),
    );
  }
}

class _SvgPathIconPainter extends CustomPainter {
  _SvgPathIconPainter(this.icon);

  final SvgPathIcon icon;

  static final Map<String, Path> _cache = {};

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24);
    final stroke = Paint()
      ..color = icon.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = icon.strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    for (final d in icon.paths) {
      canvas.drawPath(_cache.putIfAbsent(d, () => parseSvgPath(d)), stroke);
    }
    for (final (cx, cy, r) in icon.circles) {
      canvas.drawCircle(Offset(cx, cy), r, stroke);
    }
    for (final (cx, cy, r) in icon.filledCircles) {
      canvas.drawCircle(Offset(cx, cy), r, Paint()..color = icon.color);
      canvas.drawCircle(Offset(cx, cy), r, stroke);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SvgPathIconPainter old) =>
      old.icon.paths != icon.paths ||
      old.icon.color != icon.color ||
      old.icon.strokeWidth != icon.strokeWidth ||
      old.icon.circles != icon.circles ||
      old.icon.filledCircles != icon.filledCircles;
}

/// Minimal SVG path-data parser: M L H V C S A Z, absolute and relative —
/// the commands the design icons use.
Path parseSvgPath(String d) {
  final tokens = RegExp(r'[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?')
      .allMatches(d)
      .map((m) => m.group(0)!)
      .toList();
  final path = Path();
  var i = 0;
  var cmd = '';
  var x = 0.0, y = 0.0, sx = 0.0, sy = 0.0;
  // Second control point of the last cubic, for S's reflection.
  double? cx2, cy2;
  bool isCmd(String t) => RegExp(r'^[A-Za-z]$').hasMatch(t);
  double n() => double.parse(tokens[i++]);
  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    final rel = cmd == cmd.toLowerCase();
    final ox = rel ? x : 0.0, oy = rel ? y : 0.0;
    var cubic = false;
    switch (cmd.toUpperCase()) {
      case 'M':
        x = ox + n();
        y = oy + n();
        path.moveTo(x, y);
        sx = x;
        sy = y;
        cmd = rel ? 'l' : 'L'; // implicit lineto after the first pair
      case 'L':
        x = ox + n();
        y = oy + n();
        path.lineTo(x, y);
      case 'H':
        x = ox + n();
        path.lineTo(x, y);
      case 'V':
        y = oy + n();
        path.lineTo(x, y);
      case 'C':
        final x1 = ox + n(), y1 = oy + n(), x2 = ox + n(), y2 = oy + n();
        x = ox + n();
        y = oy + n();
        path.cubicTo(x1, y1, x2, y2, x, y);
        cx2 = x2;
        cy2 = y2;
        cubic = true;
      case 'S':
        final x1 = cx2 == null ? x : 2 * x - cx2;
        final y1 = cy2 == null ? y : 2 * y - cy2;
        final x2 = ox + n(), y2 = oy + n();
        x = ox + n();
        y = oy + n();
        path.cubicTo(x1, y1, x2, y2, x, y);
        cx2 = x2;
        cy2 = y2;
        cubic = true;
      case 'A':
        final rx = n(), ry = n(), rot = n(), large = n(), sweep = n();
        x = ox + n();
        y = oy + n();
        path.arcToPoint(
          Offset(x, y),
          radius: Radius.elliptical(rx, ry),
          rotation: rot,
          largeArc: large != 0,
          clockwise: sweep != 0,
        );
      case 'Z':
        path.close();
        x = sx;
        y = sy;
      default:
        i++;
    }
    if (!cubic) {
      cx2 = null;
      cy2 = null;
    }
  }
  return path;
}

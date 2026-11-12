import 'package:flutter/widgets.dart';
import 'package:path_parsing/path_parsing.dart';

part 'hi_icons.g.dart';

/// One icon of the prototype: SVG shapes on a [viewBox]-wide square grid
/// (Lucide's 24×24), drawn as a round-capped stroke and optionally filled.
///
/// Painted directly (no SVG decoding, no async loading), so icons appear in
/// the first frame and in golden tests exactly like the rest of the screen.
@immutable
class HiIconData {
  const HiIconData(this.shapes, {this.viewBox = 24});

  final List<HiShape> shapes;
  final double viewBox;

  static final Expando<Path> _paths = Expando<Path>('HiIconData.path');

  /// The icon's outline in viewBox units, built once per icon.
  Path get path => _paths[this] ??= _build();

  Path _build() {
    final path = Path();
    for (final shape in shapes) {
      shape.addTo(path);
    }
    return path;
  }
}

/// An SVG element of an icon.
sealed class HiShape {
  const HiShape();

  void addTo(Path path);
}

/// `<path d="…">`.
final class HiPathShape extends HiShape {
  const HiPathShape(this.d);

  final String d;

  @override
  void addTo(Path path) => writeSvgPathDataToPath(d, _PathSink(path));
}

/// `<rect x y width height rx ry>`.
final class HiRectShape extends HiShape {
  const HiRectShape(this.x, this.y, this.width, this.height,
      [this.rx = 0, this.ry = 0]);

  final double x, y, width, height, rx, ry;

  @override
  void addTo(Path path) {
    final rect = Rect.fromLTWH(x, y, width, height);
    if (rx == 0 && ry == 0) {
      path.addRect(rect);
    } else {
      path.addRRect(RRect.fromRectXY(rect, rx, ry));
    }
  }
}

/// `<circle cx cy r>`.
final class HiCircleShape extends HiShape {
  const HiCircleShape(this.cx, this.cy, this.r);

  final double cx, cy, r;

  @override
  void addTo(Path path) =>
      path.addOval(Rect.fromCircle(center: Offset(cx, cy), radius: r));
}

/// `<line x1 y1 x2 y2>`.
final class HiLineShape extends HiShape {
  const HiLineShape(this.x1, this.y1, this.x2, this.y2);

  final double x1, y1, x2, y2;

  @override
  void addTo(Path path) => path
    ..moveTo(x1, y1)
    ..lineTo(x2, y2);
}

/// `<polyline points>`: x, y pairs.
final class HiPolylineShape extends HiShape {
  const HiPolylineShape(this.points);

  final List<double> points;

  @override
  void addTo(Path path) {
    path.moveTo(points[0], points[1]);
    for (var i = 2; i + 1 < points.length; i += 2) {
      path.lineTo(points[i], points[i + 1]);
    }
  }
}

/// `<polygon points>`: a closed [HiPolylineShape].
final class HiPolygonShape extends HiShape {
  const HiPolygonShape(this.points);

  final List<double> points;

  @override
  void addTo(Path path) {
    HiPolylineShape(points).addTo(path);
    path.close();
  }
}

class _PathSink implements PathProxy {
  _PathSink(this.path);

  final Path path;

  @override
  void moveTo(double x, double y) => path.moveTo(x, y);

  @override
  void lineTo(double x, double y) => path.lineTo(x, y);

  @override
  void cubicTo(
          double x1, double y1, double x2, double y2, double x3, double y3) =>
      path.cubicTo(x1, y1, x2, y2, x3, y3);

  @override
  void close() => path.close();
}

/// Draws [icon] at [size]×[size] logical pixels.
///
/// [strokeWidth] is in viewBox units, exactly like the prototype's
/// `stroke-width` (so 3 on a 16 px icon draws a 2 px line). [color] defaults
/// to the surrounding text colour, like SVG `currentColor`.
class HiIcon extends StatelessWidget {
  const HiIcon(
    this.icon, {
    super.key,
    this.size = 20,
    this.color,
    this.strokeWidth = 2,
    this.fill,
  });

  final HiIconData icon;
  final double size;
  final Color? color;
  final double strokeWidth;

  /// Fill colour for solid icons (the rating star); null = outline only.
  final Color? fill;

  @override
  Widget build(BuildContext context) {
    final resolved = color ??
        DefaultTextStyle.of(context).style.color ??
        const Color(0xFFFFFFFF);
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _HiIconPainter(icon, resolved, strokeWidth, fill),
        ),
      ),
    );
  }
}

class _HiIconPainter extends CustomPainter {
  _HiIconPainter(this.icon, this.color, this.strokeWidth, this.fill);

  final HiIconData icon;
  final Color color;
  final double strokeWidth;
  final Color? fill;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / icon.viewBox;
    canvas
      ..save()
      ..scale(scale);
    final path = icon.path;
    final fillColor = fill;
    if (fillColor != null) {
      canvas.drawPath(
        path,
        Paint()
          ..isAntiAlias = true
          ..style = PaintingStyle.fill
          ..color = fillColor,
      );
    }
    canvas
      ..drawPath(
        path,
        Paint()
          ..isAntiAlias = true
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = color,
      )
      ..restore();
  }

  @override
  bool shouldRepaint(_HiIconPainter old) =>
      !identical(old.icon, icon) ||
      old.color != color ||
      old.strokeWidth != strokeWidth ||
      old.fill != fill;
}

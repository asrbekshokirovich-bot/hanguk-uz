import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:qr/qr.dart';

import '../tokens.dart';
import '../typography.dart';

/// The dark modules of a QR code for [data] (error correction M): row by
/// row, `matrix[y][x]`.
List<List<bool>> qrMatrix(String data) {
  final image = QrImage(QrCode.fromData(data: data, errorCorrectLevel: QrErrorCorrectLevel.M));
  return [
    for (var y = 0; y < image.moduleCount; y++) [for (var x = 0; x < image.moduleCount; x++) image.isDark(y, x)],
  ];
}

/// A QR code drawn like the prototype's: ink modules on white with a
/// two-module margin, crisp edges (`shape-rendering:crispEdges`).
class HiQrCode extends StatelessWidget {
  const HiQrCode({super.key, required this.data, this.size = 180, this.semanticsLabel});

  final String data;
  final double size;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: semanticsLabel,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(painter: _QrPainter(qrMatrix(data))),
      ),
    );
  }
}

class _QrPainter extends CustomPainter {
  _QrPainter(this.matrix);

  final List<List<bool>> matrix;

  @override
  void paint(Canvas canvas, Size size) => paintQr(canvas, Offset.zero, size.shortestSide, matrix);

  @override
  bool shouldRepaint(_QrPainter old) => !identical(old.matrix, matrix);
}

/// Paints [matrix] in a [side]×[side] square at [origin], margin included.
void paintQr(Canvas canvas, Offset origin, double side, List<List<bool>> matrix) {
  final n = matrix.length;
  final module = side / (n + 4);
  canvas.drawRect(origin & Size.square(side), Paint()..color = HiColors.white);
  final ink = Paint()
    ..color = HiColors.ink
    ..isAntiAlias = false;
  for (var y = 0; y < n; y++) {
    var x = 0;
    while (x < n) {
      if (!matrix[y][x]) {
        x++;
        continue;
      }
      final start = x;
      while (x < n && matrix[y][x]) {
        x++;
      }
      canvas.drawRect(
        Rect.fromLTWH(origin.dx + (start + 2) * module, origin.dy + (y + 2) * module, (x - start) * module, module),
        ink,
      );
    }
  }
}

/// A printable card of a shift's QR code as PNG bytes: the business, the
/// shift and the code on white (BA3 «QR 인쇄·공유»).
Future<Uint8List> qrCardPng({
  required String data,
  required String title,
  required String subtitle,
  required String note,
}) async {
  const width = 1080.0;
  const height = 1440.0;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, width, height));
  canvas.drawRect(const Rect.fromLTWH(0, 0, width, height), Paint()..color = HiColors.white);

  double line(String text, double y, double size, FontWeight weight, Color color) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: hiStyle(size, weight, color: color, height: 1.3)),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
      maxLines: 2,
    )..layout(maxWidth: width - 160);
    painter.paint(canvas, Offset((width - painter.width) / 2, y));
    final h = painter.height;
    painter.dispose();
    return h;
  }

  var y = 110.0;
  y += line(title, y, 64, FontWeight.w800, HiColors.ink) + 18;
  y += line(subtitle, y, 44, FontWeight.w600, HiColors.inkMuted) + 50;
  const qrSide = 820.0;
  paintQr(canvas, Offset((width - qrSide) / 2, y), qrSide, qrMatrix(data));
  y += qrSide + 40;
  line(note, y, 38, FontWeight.w600, HiColors.inkMuted);

  final picture = recorder.endRecording();
  final image = await picture.toImage(width.toInt(), height.toInt());
  picture.dispose();
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return bytes!.buffer.asUint8List();
}

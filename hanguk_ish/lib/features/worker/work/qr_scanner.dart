import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../data/demo/demo_shifts.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';

/// Which camera A07 uses: the phone's, or — in the demo without a backend —
/// the prototype's picture of a printed code, which reads when tapped.
enum QrCameraKind { device, demo }

final qrCameraKindProvider = Provider<QrCameraKind>(
  (ref) => ref.watch(shiftRepositoryProvider) is DemoShiftRepository ? QrCameraKind.demo : QrCameraKind.device,
);

/// Whether the scan line moves (off in screen tests, which need a still frame).
final qrScanAnimationProvider = Provider<bool>((ref) => true);

/// The phone's camera reading QR codes.
class DeviceQrCamera extends StatefulWidget {
  const DeviceQrCamera({super.key, required this.onCode, required this.torch});

  final ValueChanged<String> onCode;
  final bool torch;

  @override
  State<DeviceQrCamera> createState() => _DeviceQrCameraState();
}

class _DeviceQrCameraState extends State<DeviceQrCamera> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  bool _torchOn = false;

  @override
  void didUpdateWidget(DeviceQrCamera oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.torch != _torchOn) {
      _torchOn = widget.torch;
      _controller.toggleTorch();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MobileScanner(
      controller: _controller,
      onDetect: (capture) {
        for (final code in capture.barcodes) {
          final value = code.rawValue;
          if (value != null && value.isNotEmpty) {
            widget.onCode(value);
            return;
          }
        }
      },
    );
  }
}

/// The prototype's camera picture: a dim room and the printed «출근 · 퇴근»
/// poster with the business's code.
class DemoQrScene extends StatelessWidget {
  const DemoQrScene({super.key, required this.businessName, required this.angleDegrees});

  /// The business's Korean name under the code (달빛카페 신촌점).
  final String businessName;

  /// −4° on the entry screen, 3° on the exit screen.
  final double angleDegrees;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final dx = (width - 390) / 2;
    Widget blur(double sigma, Widget child) => ImageFiltered(
          imageFilter: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma, tileMode: TileMode.decal),
          child: child,
        );
    return ColoredBox(
      color: const Color(0xFF070B1E),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        fit: StackFit.expand,
        children: [
          const Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 560,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFF1C2340), Color(0xFF141A30)],
                ),
              ),
            ),
          ),
          Positioned(
            left: -20,
            right: -20,
            top: 560,
            bottom: 0,
            child: blur(6, const ColoredBox(color: Color(0xFF262B42))),
          ),
          Positioned(
            left: dx + 20,
            top: 110,
            width: 120,
            height: 120,
            child: blur(30, const DecoratedBox(
              decoration: BoxDecoration(color: Color.fromRGBO(255, 226, 170, 0.22), shape: BoxShape.circle),
            )),
          ),
          Positioned(
            right: 10 - dx,
            top: 60,
            width: 150,
            height: 150,
            child: blur(34, const DecoratedBox(
              decoration: BoxDecoration(color: Color.fromRGBO(170, 190, 255, 0.16), shape: BoxShape.circle),
            )),
          ),
          Positioned(
            left: dx + 300,
            top: 250,
            width: 60,
            height: 180,
            child: blur(8, DecoratedBox(
              decoration: BoxDecoration(color: const Color(0xFF2E3552), borderRadius: BorderRadius.circular(14)),
            )),
          ),
          Positioned(
            left: dx + 100,
            top: 232,
            width: 190,
            height: 236,
            child: Transform.rotate(
              angle: angleDegrees * 3.141592653589793 / 180,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xFFF7F8FB),
                  borderRadius: BorderRadius.circular(6),
                  boxShadow: [
                    BoxShadow(color: const Color.fromRGBO(0, 0, 0, 0.35), offset: const Offset(0, 10), blurRadius: HiShadows.blur(24)),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    HiText('출근 · 퇴근', style: hiStyle(15, FontWeight.w800, color: HiColors.ink, family: HiFamily.korean)),
                    const SizedBox(height: 8),
                    const SizedBox(width: 150, height: 150, child: CustomPaint(painter: _DemoQrPainter())),
                    const SizedBox(height: 8),
                    HiText(businessName, style: hiStyle(12, FontWeight.w700, color: HiColors.inkMuted, family: HiFamily.korean)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The printed code of the prototype (25 modules and a 2-module margin).
class _DemoQrPainter extends CustomPainter {
  const _DemoQrPainter();

  static const _rows = [
  [0, 7, 8, 1, 11, 1, 14, 1, 18, 7],
  [0, 1, 6, 1, 9, 3, 14, 1, 18, 1, 24, 1],
  [0, 1, 2, 3, 6, 1, 10, 2, 13, 4, 18, 1, 20, 3, 24, 1],
  [0, 1, 2, 3, 6, 1, 8, 2, 13, 1, 15, 2, 18, 1, 20, 3, 24, 1],
  [0, 1, 2, 3, 6, 1, 12, 4, 18, 1, 20, 3, 24, 1],
  [0, 1, 6, 1, 8, 1, 10, 1, 13, 2, 16, 1, 18, 1, 24, 1],
  [0, 7, 8, 1, 10, 1, 12, 1, 14, 1, 16, 1, 18, 7],
  [9, 2, 13, 3],
  [1, 4, 6, 2, 9, 2, 12, 1, 14, 4, 20, 1, 22, 2],
  [1, 1, 3, 2, 7, 4, 12, 1, 14, 2, 17, 1, 20, 2, 24, 1],
  [0, 1, 3, 1, 6, 1, 8, 3, 12, 1, 14, 1, 17, 2, 20, 2],
  [0, 1, 2, 4, 7, 3, 11, 2, 18, 3, 24, 1],
  [1, 1, 3, 1, 5, 2, 14, 1, 18, 1, 23, 1],
  [1, 1, 7, 1, 10, 1, 12, 1, 14, 1, 16, 2, 19, 1, 22, 3],
  [1, 2, 5, 2, 8, 1, 10, 2, 15, 1, 17, 3, 24, 1],
  [0, 5, 7, 2, 11, 3, 15, 1, 18, 1, 20, 4],
  [0, 3, 4, 1, 6, 1, 11, 10, 22, 3],
  [12, 1, 15, 2, 20, 1, 23, 2],
  [0, 7, 10, 1, 15, 2, 18, 1, 20, 1, 22, 1],
  [0, 1, 6, 1, 10, 1, 16, 1, 20, 2, 24, 1],
  [0, 1, 2, 3, 6, 1, 8, 2, 12, 2, 15, 6, 22, 2],
  [0, 1, 2, 3, 6, 1, 8, 2, 15, 1, 17, 2, 20, 1],
  [0, 1, 2, 3, 6, 1, 9, 2, 13, 1, 18, 1, 22, 1],
  [0, 1, 6, 1, 8, 1, 11, 1, 13, 1, 15, 1, 18, 4, 24, 1],
  [0, 7, 8, 2, 12, 1, 14, 3, 18, 2, 21, 1, 23, 1],
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final unit = size.width / 29;
    canvas.drawRect(Offset.zero & size, Paint()..color = HiColors.white);
    final ink = Paint()
      ..color = HiColors.ink
      ..isAntiAlias = false;
    for (var y = 0; y < _rows.length; y++) {
      final row = _rows[y];
      for (var i = 0; i + 1 < row.length; i += 2) {
        canvas.drawRect(Rect.fromLTWH((row[i] + 2) * unit, (y + 2) * unit, row[i + 1] * unit, unit), ink);
      }
    }
  }

  @override
  bool shouldRepaint(_DemoQrPainter oldDelegate) => false;
}

/// The A07 viewfinder: everything outside the 260 px frame dimmed, lime
/// corners and the scan line.
class QrViewfinder extends StatefulWidget {
  const QrViewfinder({super.key, required this.frame, required this.lineTop, required this.animate});

  /// The frame in this widget's coordinates.
  final Rect frame;

  /// Where the scan line rests (px from the frame's top).
  final double lineTop;
  final bool animate;

  @override
  State<QrViewfinder> createState() => _QrViewfinderState();
}

class _QrViewfinderState extends State<QrViewfinder> with SingleTickerProviderStateMixin {
  late final AnimationController _line = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400));

  @override
  void initState() {
    super.initState();
    if (widget.animate) _line.repeat(reverse: true);
  }

  @override
  void dispose() {
    _line.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _line,
      builder: (context, _) {
        final top = widget.animate ? 30 + (widget.frame.height - 63) * Curves.easeInOut.transform(_line.value) : widget.lineTop;
        return CustomPaint(painter: _ViewfinderPainter(widget.frame, top), child: const SizedBox.expand());
      },
    );
  }
}

class _ViewfinderPainter extends CustomPainter {
  _ViewfinderPainter(this.frame, this.lineTop);

  final Rect frame;
  final double lineTop;

  @override
  void paint(Canvas canvas, Size size) {
    final hole = RRect.fromRectAndRadius(frame, const Radius.circular(28));
    canvas.drawPath(
      Path()
        ..fillType = PathFillType.evenOdd
        ..addRect(Offset.zero & size)
        ..addRRect(hole),
      Paint()..color = const Color.fromRGBO(4, 7, 22, 0.68),
    );
    // Corners: 46 px boxes 3 px outside the frame, 5 px lime borders on two
    // sides, outer radius 30 (inner 25), as the prototype's spans draw them.
    final lime = Paint()..color = HiColors.lime;
    for (final (cx, cy) in const [(0, 0), (1, 0), (0, 1), (1, 1)]) {
      final x = cx == 0 ? frame.left - 3 : frame.right + 3 - 46;
      final y = cy == 0 ? frame.top - 3 : frame.bottom + 3 - 46;
      final box = Rect.fromLTWH(x.toDouble(), y.toDouble(), 46, 46);
      final outer = RRect.fromRectAndCorners(
        box,
        topLeft: cx == 0 && cy == 0 ? const Radius.circular(30) : Radius.zero,
        topRight: cx == 1 && cy == 0 ? const Radius.circular(30) : Radius.zero,
        bottomLeft: cx == 0 && cy == 1 ? const Radius.circular(30) : Radius.zero,
        bottomRight: cx == 1 && cy == 1 ? const Radius.circular(30) : Radius.zero,
      );
      final inner = RRect.fromRectAndCorners(
        Rect.fromLTRB(
          cx == 0 ? box.left + 5 : box.left,
          cy == 0 ? box.top + 5 : box.top,
          cx == 1 ? box.right - 5 : box.right,
          cy == 1 ? box.bottom - 5 : box.bottom,
        ),
        topLeft: cx == 0 && cy == 0 ? const Radius.circular(25) : Radius.zero,
        topRight: cx == 1 && cy == 0 ? const Radius.circular(25) : Radius.zero,
        bottomLeft: cx == 0 && cy == 1 ? const Radius.circular(25) : Radius.zero,
        bottomRight: cx == 1 && cy == 1 ? const Radius.circular(25) : Radius.zero,
      );
      canvas.drawPath(
        Path.combine(PathOperation.difference, Path()..addRRect(outer), Path()..addRRect(inner)),
        lime,
      );
    }
    final line = RRect.fromRectAndRadius(
      Rect.fromLTWH(frame.left + 20, frame.top + lineTop, frame.width - 40, 3),
      const Radius.circular(3),
    );
    canvas.drawRRect(
      line,
      Paint()
        ..color = const Color.fromRGBO(212, 233, 76, 0.7)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
    canvas.drawRRect(line, lime);
  }

  @override
  bool shouldRepaint(_ViewfinderPainter oldDelegate) => oldDelegate.lineTop != lineTop || oldDelegate.frame != frame;
}

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../data/client_code_qr.dart';

/// The camera for "QR kodni skanerlash" on the client-code screen (14). It
/// closes with the client code of the first QR that holds one; a QR without
/// one says so and keeps scanning.
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  /// Opens the scanner; the code, or null when the student closed it.
  static Future<String?> open(BuildContext context) =>
      Navigator.of(context).push<String>(
        MaterialPageRoute(settings: const RouteSettings(name: 'qr_scan'), builder: (_) => const QrScanScreen()),
      );

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  bool _done = false;
  String? _lastBad;
  bool _showBad = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;
    for (final b in capture.barcodes) {
      final code = clientCodeFromQr(b.rawValue);
      if (code != null) {
        _done = true;
        Navigator.of(context).pop(code);
        return;
      }
      if (b.rawValue != null && b.rawValue != _lastBad) {
        _lastBad = b.rawValue;
        setState(() => _showBad = true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) => _CameraError(
              text: error.errorCode == MobileScannerErrorCode.permissionDenied ? l.fdScanNoCamera : l.fdScanFailed,
            ),
          ),
          const IgnorePointer(child: CustomPaint(painter: _FramePainter())),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
                  child: Row(
                    children: [
                      HardIconButton(
                        glyph: LucideIcons.x,
                        semanticLabel: MaterialLocalizations.of(context).closeButtonTooltip,
                        onTap: () => Navigator.of(context).pop(),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          l.fdScanTitle,
                          style: fdText(18, FontWeight.w800, Colors.white, letterSpacing: -0.36),
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.fromLTRB(28, 0, 28, 28),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: _showBad ? const Color(0xFFFDECEC) : FdColors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: FdColors.ink, width: 1.5),
                    ),
                    child: Text(
                      _showBad ? l.fdScanNoCode : l.fdScanHint,
                      textAlign: TextAlign.center,
                      style: fdText(12, FontWeight.w700, _showBad ? FdColors.bad : FdColors.ink, height: 1.4),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CameraError extends StatelessWidget {
  const _CameraError({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: FdColors.page,
    child: Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Text(text, textAlign: TextAlign.center, style: fdText(14, FontWeight.w700, FdColors.onPage, height: 1.4)),
      ),
    ),
  );
}

/// A dimmed screen with a clear lime-cornered square in the middle.
class _FramePainter extends CustomPainter {
  const _FramePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final side = size.shortestSide * 0.66;
    final rect = Rect.fromCenter(center: size.center(Offset.zero), width: side, height: side);
    final hole = RRect.fromRectAndRadius(rect, const Radius.circular(20));
    canvas.drawPath(
      Path.combine(PathOperation.difference, Path()..addRect(Offset.zero & size), Path()..addRRect(hole)),
      Paint()..color = Colors.black.withValues(alpha: 0.55),
    );
    final corner = Paint()
      ..color = FdColors.lime
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    const arm = 34.0;
    final r = rect;
    for (final (o, dx, dy) in [
      (r.topLeft, 1.0, 1.0),
      (r.topRight, -1.0, 1.0),
      (r.bottomLeft, 1.0, -1.0),
      (r.bottomRight, -1.0, -1.0),
    ]) {
      canvas.drawPath(
        Path()
          ..moveTo(o.dx, o.dy + dy * arm)
          ..lineTo(o.dx, o.dy)
          ..lineTo(o.dx + dx * arm, o.dy),
        corner,
      );
    }
  }

  @override
  bool shouldRepaint(_FramePainter old) => false;
}

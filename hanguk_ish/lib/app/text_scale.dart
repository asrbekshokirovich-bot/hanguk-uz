import 'package:flutter/widgets.dart';

/// Caps the system font size at [maxScale] so the prototype's fixed-height
/// buttons and tiles keep their text inside; smaller settings pass through.
class HiTextScaleCap extends StatelessWidget {
  const HiTextScaleCap({super.key, required this.child, this.maxScale = 1.2});

  final Widget child;
  final double maxScale;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    return MediaQuery(
      data: MediaQuery.of(context).copyWith(
        textScaler: scaler.clamp(maxScaleFactor: maxScale),
      ),
      child: child,
    );
  }
}

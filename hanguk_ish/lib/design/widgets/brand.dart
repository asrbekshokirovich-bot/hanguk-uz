import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../typography.dart';

/// The 72×72 white tile with a blue 한 (entry screens).
class HiBrandTile extends StatelessWidget {
  const HiBrandTile({super.key});

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        alignment: Alignment.center,
        child: Text(
          '한',
          textScaler: TextScaler.noScaling,
          style: hiStyle(
            40,
            FontWeight.w900,
            color: HiColors.blue,
            family: HiFamily.korean,
          ),
        ),
      ),
    );
  }
}

/// Small translucent pill on navy (`사장님용`).
class HiNavyPill extends StatelessWidget {
  const HiNavyPill(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: HiColors.white12,
        borderRadius: BorderRadius.circular(HiRadii.pill),
        border: Border.all(color: HiColors.white20),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: hiStyle(13, FontWeight.w700, color: HiColors.white),
      ),
    );
  }
}

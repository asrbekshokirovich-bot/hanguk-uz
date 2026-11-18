import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../typography.dart';

/// The 72×72 app logo of the entry screens: the worker app's blue 한 with the
/// taegeuk, or the employer app's (the launcher icons, `tool/icons/`).
class HiBrandTile extends StatelessWidget {
  const HiBrandTile({super.key, this.employer = false});

  final bool employer;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.asset(
          employer ? 'assets/images/logo_employer.png' : 'assets/images/logo_worker.png',
          width: 72,
          height: 72,
          fit: BoxFit.cover,
          filterQuality: FilterQuality.high,
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
      // As wide as its text, also where the parent offers a whole line (BA0's
      // Wrap): Container(alignment:) alone would fill it.
      child: Align(
        widthFactor: 1,
        child: HiText(
          label,
          style: hiStyle(13, FontWeight.w700, color: HiColors.white),
        ),
      ),
    );
  }
}

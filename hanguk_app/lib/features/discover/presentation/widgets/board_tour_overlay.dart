import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/board_tour.dart';
import 'page_tour.dart';

/// What the tour points at, top to bottom: the twelve places of the board
/// (owner, 2026-10-20) — the count, the visa gauge, the strip, each choice
/// section, and the "N ta universitetni ko'rish" button.
class BoardTourTargets {
  BoardTourTargets(this.inOrder);

  final List<GlobalKey> inOrder;

  GlobalKey get count => inOrder[0];
  GlobalKey get visa => inOrder[1];
  GlobalKey get strip => inOrder[2];
  GlobalKey get field => inOrder[3];
  GlobalKey get city => inOrder[4];
  GlobalKey get degree => inOrder[5];
  GlobalKey get topik => inOrder[6];
  GlobalKey get ielts => inOrder[7];
  GlobalKey get fee => inOrder[8];
  GlobalKey get type => inOrder[9];
  GlobalKey get grant => inOrder[10];
  GlobalKey get button => inOrder[11];
}

/// The home board's first-run tour (design 12a–12d, twelve places); see
/// [PageTour].
class BoardTour extends StatelessWidget {
  const BoardTour({super.key, required this.builder});

  final Widget Function(BuildContext context, BoardTourTargets targets) builder;

  @override
  Widget build(BuildContext context) => PageTour(
    name: 'board',
    seen: boardTourProvider,
    steps: (context) {
      final l = AppLocalizations.of(context)!;
      Widget icon(IconData i) => Icon(i, size: 17, color: FdColors.onLime);
      return [
        TourStep(l.btCount, icon: icon(Icons.tag), align: TourAlign.start),
        TourStep(
          l.btVisa,
          icon: const Lucide(LucideIcons.plane, size: 16, color: FdColors.onLime),
          align: TourAlign.end,
        ),
        TourStep(l.btStrip, icon: icon(Icons.auto_awesome_outlined)),
        TourStep(l.btField, icon: icon(Icons.touch_app_outlined)),
        TourStep(l.btCity, icon: icon(Icons.place_outlined)),
        TourStep(l.btDegree, icon: icon(Icons.school_outlined)),
        TourStep(l.btTopik, icon: icon(Icons.translate)),
        TourStep(l.btIelts, icon: icon(Icons.language)),
        TourStep(l.btFee, icon: icon(Icons.payments_outlined)),
        TourStep(l.btType, icon: icon(Icons.account_balance_outlined)),
        TourStep(l.btGrant, icon: icon(Icons.card_giftcard_outlined)),
        TourStep(l.btList, icon: icon(Icons.format_list_bulleted)),
      ];
    },
    builder: (context, keys) => builder(context, BoardTourTargets(keys)),
  );
}

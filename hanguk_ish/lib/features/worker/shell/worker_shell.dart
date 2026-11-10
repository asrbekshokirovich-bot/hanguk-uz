import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../design/icons.dart';
import '../../../design/tokens.dart';
import '../../../design/widgets/navigation.dart';
import '../../../l10n/gen/worker_l10n.dart';

/// The worker app's five tabs with the bottom menu (A03–A11).
class WorkerShell extends StatelessWidget {
  const WorkerShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: shell,
      bottomNavigationBar: HiBottomNav(
        current: shell.currentIndex,
        onSelect: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        items: [
          HiNavItem(icon: HiIcons.briefcase, label: l10n.navShifts),
          HiNavItem(icon: HiIcons.map, label: l10n.navMap),
          HiNavItem(icon: HiIcons.calendarCheck, label: l10n.navMyShifts, wide: true),
          HiNavItem(icon: HiIcons.wallet, label: l10n.navEarnings),
          HiNavItem(icon: HiIcons.user, label: l10n.navProfile),
        ],
      ),
    );
  }
}

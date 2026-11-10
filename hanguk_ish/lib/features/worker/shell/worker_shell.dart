import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/forms.dart';
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

/// A tab or page whose screen comes in a later phase (A06–A12): the
/// screen's title on the navy background.
class WorkerPendingScreen extends StatelessWidget {
  const WorkerPendingScreen({super.key, required this.title, this.onBack});

  final String title;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final back = onBack;
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Padding(
          padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 18, 0),
          child: Row(
            children: [
              if (back != null) ...[
                HiBackButton(onPressed: back),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Semantics(
                  header: true,
                  child: HiText(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: hiStyle(28, FontWeight.w800, height: 1.15, letterSpacingEm: -0.02),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../../guest/presentation/guest_map_screen.dart';
import 'discover_screen.dart';
import 'prepare_screen.dart';
import 'widgets/fd_bottom_nav.dart';

/// The guest's app in the full design: Universitetlar (screen 03), 360°
/// xarita and Tayyorgarlik (screen 18) under the design's bottom nav, on the
/// navy backdrop. A section is built the first time it is opened.
class DiscoverShell extends StatefulWidget {
  const DiscoverShell({super.key});

  @override
  State<DiscoverShell> createState() => _DiscoverShellState();
}

class _DiscoverShellState extends State<DiscoverShell> {
  int _tab = 0;
  final Set<int> _built = {0};

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SignInBackdrop(
        child: IndexedStack(
          index: _tab,
          children: [
            const DiscoverScreen(),
            if (_built.contains(1))
              const SafeArea(bottom: false, child: Padding(padding: EdgeInsets.only(top: 12), child: GuestMapScreen()))
            else
              const SizedBox.shrink(),
            if (_built.contains(2)) const PrepareScreen() else const SizedBox.shrink(),
          ],
        ),
      ),
      bottomNavigationBar: FdBottomNav(
        current: _tab,
        items: [
          (label: l.fdNavUniversities, glyph: LucideIcons.graduationCap),
          (label: l.fdNavMap, glyph: LucideIcons.map),
          (label: l.fdNavPrepare, glyph: LucideIcons.target),
        ],
        onSelect: (i) => setState(() {
          _built.add(i);
          _tab = i;
        }),
      ),
    );
  }
}

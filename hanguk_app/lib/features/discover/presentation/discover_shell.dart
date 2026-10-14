import 'package:flutter/material.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import 'discover_screen.dart';
import 'map_screen.dart';
import 'prepare_screen.dart';
import 'widgets/fd_bottom_nav.dart';

/// The guest's app in the full design: Universitetlar (screen 03), 360°
/// xarita (17) and Tayyorgarlik (screen 18) under the design's bottom nav, on the
/// design's light page. A section is built the first time it is opened.
class DiscoverShell extends StatefulWidget {
  const DiscoverShell({super.key, this.tab = 0});

  /// The tab to show (0 Universitetlar, 1 xarita, 2 Tayyorgarlik), from
  /// `/guest?tab=` when a pushed screen's bottom nav sends the student here.
  final int tab;

  @override
  State<DiscoverShell> createState() => _DiscoverShellState();
}

class _DiscoverShellState extends State<DiscoverShell> {
  late int _tab = widget.tab.clamp(0, 2);
  late final Set<int> _built = {0, _tab};

  @override
  void didUpdateWidget(DiscoverShell old) {
    super.didUpdateWidget(old);
    if (old.tab != widget.tab) {
      _tab = widget.tab.clamp(0, 2);
      _built.add(_tab);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: IndexedStack(
          index: _tab,
          children: [
            const DiscoverScreen(),
            if (_built.contains(1)) const KoreaMapScreen() else const SizedBox.shrink(),
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
          if (i != _tab) AppEvents.track('tab_open', screen: 'guest', props: {'tab': const ['universities', 'map', 'prepare'][i]});
          _built.add(i);
          _tab = i;
        }),
      ),
    );
  }
}

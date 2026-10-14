import 'package:flutter/material.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../discover/presentation/discover_screen.dart';
import '../../discover/presentation/map_screen.dart';
import '../../discover/presentation/prepare_screen.dart';
import '../../discover/presentation/widgets/fd_bottom_nav.dart';
import 'client_documents_screen.dart';
import 'journey_screen.dart';

/// The signed-in student's app (design 15, 15b): the guest's three tabs —
/// Universitetlar, 360° xarita, Tayyorgarlik — and the two that are theirs,
/// Ariza and Hujjatlar. It opens on Ariza: the client code opens "arizangiz
/// holati". A tab is built the first time it is opened.
class ClientShell extends StatefulWidget {
  const ClientShell({super.key, this.tab = tabApplication});

  static const int tabUniversities = 0;
  static const int tabMap = 1;
  static const int tabPrepare = 2;
  static const int tabApplication = 3;
  static const int tabDocuments = 4;

  final int tab;

  @override
  State<ClientShell> createState() => _ClientShellState();
}

class _ClientShellState extends State<ClientShell> {
  late int _tab = widget.tab.clamp(0, 4);
  late final Set<int> _built = {_tab};

  @override
  void didUpdateWidget(ClientShell old) {
    super.didUpdateWidget(old);
    if (old.tab != widget.tab) _go(widget.tab.clamp(0, 4));
  }

  void _go(int i) => setState(() {
    _built.add(i);
    _tab = i;
  });

  Widget _page(int i) {
    if (!_built.contains(i)) return const SizedBox.shrink();
    return switch (i) {
      ClientShell.tabUniversities => const DiscoverScreen(),
      ClientShell.tabMap => const KoreaMapScreen(),
      ClientShell.tabPrepare => const PrepareScreen(signedIn: true),
      ClientShell.tabApplication => JourneyScreen(onBrowse: () => _go(ClientShell.tabUniversities)),
      _ => const ClientDocumentsScreen(),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: IndexedStack(index: _tab, children: [for (var i = 0; i < 5; i++) _page(i)]),
      ),
      bottomNavigationBar: FdBottomNav(
        current: _tab,
        items: [
          (label: l.fdNavUniversities, glyph: LucideIcons.graduationCap),
          (label: l.fdNavMap, glyph: LucideIcons.map),
          (label: l.fdNavPrepare, glyph: LucideIcons.target),
          (label: l.fdNavApplication, glyph: LucideIcons.route),
          (label: l.fdNavDocuments, glyph: LucideIcons.folderOpen),
        ],
        onSelect: _go,
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/client_code_screen.dart';
import 'visa_screen.dart';
import 'prepare_screen.dart';
import 'universities_screen.dart';
import 'widgets/app_nav.dart';
import 'widgets/fd_bottom_nav.dart';

/// The guest's app in the prototype's design: the same five places the client
/// has — Universitetlar (the list), Tayyorgarlik, the round button's home
/// ("Qanday universitet kerak?"), and the client's Ariza and Hujjatlar, which
/// a guest sees locked: they open the client-code sign-in. It opens on the
/// home. A section is built the first time it is opened.
class DiscoverShell extends StatefulWidget {
  const DiscoverShell({super.key, this.tab = AppTab.home});

  /// The [AppTab] to show, from `/guest?tab=` when a pushed screen's bottom nav
  /// sends the student here.
  final int tab;

  @override
  State<DiscoverShell> createState() => _DiscoverShellState();
}

class _DiscoverShellState extends State<DiscoverShell> {
  late int _tab = widget.tab.clamp(0, AppTab.count - 1);
  late final Set<int> _built = {AppTab.home, _tab};

  @override
  void didUpdateWidget(DiscoverShell old) {
    super.didUpdateWidget(old);
    if (old.tab != widget.tab) _go(widget.tab.clamp(0, AppTab.count - 1));
  }

  static const _names = ['universities', 'prepare', 'home', 'application', 'documents'];

  void _go(int tab) => setState(() {
    if (tab != _tab) {
      AppEvents.track('tab_open', screen: 'guest', props: {'tab': _names[tab]});
      // The code's cells in a tab left behind keep no keyboard up.
      FocusManager.instance.primaryFocus?.unfocus();
    }
    _built.add(tab);
    _tab = tab;
  });

  Widget _page(int tab) {
    if (!_built.contains(tab)) return const SizedBox.shrink();
    return switch (tab) {
      AppTab.universities => const UniversitiesScreen(),
      AppTab.prepare => const PrepareScreen(),
      AppTab.home => const VisaScreen(embedded: true),
      _ => ClientCodeScreen(embedded: true, notice: AppLocalizations.of(context)!.fdNavNeedsClientCode),
    };
  }

  @override
  Widget build(BuildContext context) {
    // On the code's tabs the nav steps aside for the keyboard, as on the
    // sign-in page.
    final hideNav = AppTab.needsClient(_tab) && MediaQuery.viewInsetsOf(context).bottom > 0;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: IndexedStack(index: _tab, children: [for (var i = 0; i < AppTab.count; i++) _page(i)]),
      ),
      bottomNavigationBar: hideNav ? null : AppNav(current: _tab, onLocal: _go),
      floatingActionButton: hideNav ? null : AppNavOrb(current: _tab, onLocal: _go),
      floatingActionButtonLocation: kFdNavOrbLocation,
    );
  }
}

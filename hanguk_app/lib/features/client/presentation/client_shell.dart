import 'package:flutter/material.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../discover/presentation/visa_screen.dart';
import '../../discover/presentation/prepare_screen.dart';
import '../../discover/presentation/universities_screen.dart';
import '../../discover/presentation/widgets/app_nav.dart';
import '../../discover/presentation/widgets/fd_bottom_nav.dart';
import 'client_documents_screen.dart';
import 'journey_screen.dart';

/// The signed-in student's app (design 15, 15b): the guest's three places —
/// Universitetlar, Tayyorgarlik and the round button's home — and the two
/// that are theirs, Ariza and Hujjatlar. It opens on Ariza: the client code
/// opens "arizangiz holati". A tab is built the first time it is opened.
class ClientShell extends StatefulWidget {
  const ClientShell({super.key, this.tab = tabApplication});

  static const int tabUniversities = AppTab.universities;
  static const int tabPrepare = AppTab.prepare;
  static const int tabHome = AppTab.home;
  static const int tabApplication = AppTab.application;
  static const int tabDocuments = AppTab.documents;

  final int tab;

  @override
  State<ClientShell> createState() => _ClientShellState();
}

class _ClientShellState extends State<ClientShell> {
  late int _tab = widget.tab.clamp(0, AppTab.count - 1);
  late final Set<int> _built = {_tab};

  @override
  void didUpdateWidget(ClientShell old) {
    super.didUpdateWidget(old);
    if (old.tab != widget.tab) _go(widget.tab.clamp(0, AppTab.count - 1));
  }

  static const _names = ['universities', 'prepare', 'home', 'application', 'documents'];

  void _go(int i) => setState(() {
    if (i != _tab) AppEvents.track('tab_open', screen: 'client', props: {'tab': _names[i]});
    _built.add(i);
    _tab = i;
  });

  Widget _page(int i) {
    if (!_built.contains(i)) return const SizedBox.shrink();
    return switch (i) {
      AppTab.universities => const UniversitiesScreen(),
      AppTab.prepare => const PrepareScreen(signedIn: true),
      AppTab.home => const VisaScreen(embedded: true),
      AppTab.application => JourneyScreen(onBrowse: () => _go(AppTab.universities)),
      _ => const ClientDocumentsScreen(),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: IndexedStack(index: _tab, children: [for (var i = 0; i < AppTab.count; i++) _page(i)]),
      ),
      bottomNavigationBar: AppNav(current: _tab, onLocal: _go),
      floatingActionButton: AppNavOrb(current: _tab, onLocal: _go),
      floatingActionButtonLocation: kFdNavOrbLocation,
    );
  }
}

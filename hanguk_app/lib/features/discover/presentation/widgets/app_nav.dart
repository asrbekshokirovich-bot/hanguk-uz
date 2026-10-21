import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/data/auth_repository.dart' show signedInProvider;
import '../../../catalog/data/catalog_filters.dart';
import '../../../catalog/data/catalog_repository.dart';
import '../../data/chances.dart';
import '../../data/slots.dart';
import '../discover_routes.dart';
import '../filter_board_screen.dart' show boardResults;
import 'fd_bottom_nav.dart';

/// The home's tabs, by where they sit in the bottom nav (the round button
/// is the middle one). The guest's home and the client's are the same five.
abstract final class AppTab {
  static const int universities = 0;
  static const int prepare = 1;

  /// The round "BAHOLASH" button: the filter board, "Qanday universitet kerak?".
  static const int home = 2;
  static const int application = 3;
  static const int documents = 4;

  static const int count = 5;

  /// Only a client has these two.
  static bool needsClient(int tab) => tab == application || tab == documents;
}

/// The nav's four tabs, left to right, as [AppTab]s.
const List<int> _navTabs = [AppTab.universities, AppTab.prepare, AppTab.application, AppTab.documents];

/// Opens [tab] of the home from a screen pushed over it (or from the home's
/// own nav when [onLocal] is null): a client's tabs for a guest go to the
/// client-code sign-in with a note, as the prototype's lock dots promise.
/// The sign-in's own nav passes [onLocked], as it is that page already.
void openAppTab(BuildContext context, WidgetRef ref, int tab, {ValueChanged<int>? onLocal, VoidCallback? onLocked}) {
  final signedIn = ref.read(signedInProvider);
  if (AppTab.needsClient(tab) && !signedIn) {
    if (onLocked != null) {
      onLocked();
      return;
    }
    context.push('/login', extra: {'notice': AppLocalizations.of(context)!.fdNavNeedsClientCode});
    return;
  }
  if (onLocal != null) {
    onLocal(tab);
    return;
  }
  context.go(signedIn ? '/?tab=$tab' : discoverTabPath(tab));
}

/// The bottom nav of the home and of the screens pushed over it.
/// [current] is the lit [AppTab]; pass [AppTab.home] to light only the round
/// button, or -1 for none.
class AppNav extends ConsumerWidget {
  const AppNav({super.key, required this.current, this.onLocal, this.onLocked});

  final int current;

  /// The home's own switch; null on a pushed screen, where a tab goes back
  /// to the home with that tab open.
  final ValueChanged<int>? onLocal;

  /// See [openAppTab].
  final VoidCallback? onLocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final signedIn = ref.watch(signedInProvider);
    final items = [
      FdNavItem(label: l.fdNavUniversities, glyph: LucideIcons.graduationCap),
      FdNavItem(label: l.fdNavPrepare, glyph: LucideIcons.target),
      FdNavItem(label: l.fdNavApplication, glyph: LucideIcons.clipboardList, locked: !signedIn),
      FdNavItem(label: l.fdNavDocuments, glyph: LucideIcons.fileText, locked: !signedIn),
    ];
    return FdBottomNav(
      items: items,
      current: _navTabs.indexOf(current),
      hasCenter: true,
      onSelect: (i) => openAppTab(context, ref, _navTabs[i], onLocal: onLocal, onLocked: onLocked),
    );
  }
}

/// The round button of [AppNav]: the best chance among the three picked
/// universities, or "?%", over "BAHOLASH"; it opens the home tab, "Vizam
/// chiqadimi?" (owner, 2026-10-21). Give it to the Scaffold as its
/// `floatingActionButton`, with [kFdNavOrbLocation].
class AppNavOrb extends ConsumerWidget {
  const AppNavOrb({super.key, required this.current, this.onLocal, this.onTap});

  final int current;
  final ValueChanged<int>? onLocal;

  /// In place of opening the home tab (the visa page pushed on its own).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final book = ref.watch(chanceBookProvider);
    final all = ref.watch(catalogProvider).value ?? const [];
    final picked = {for (final id in ref.watch(slotsProvider)) ?id};
    // The picks' best chance; with none picked yet, the best of what the
    // filters leave.
    final pool = picked.isEmpty
        ? boardResults(ref, all, ref.watch(catalogFilterProvider))
        : all.where((u) => picked.contains(u.institutionId));
    final best = bestChance(book, pool);
    return FdNavOrb(
      value: best == null ? '?%' : '$best%',
      label: l.fdNavAssess,
      active: current == AppTab.home,
      onTap: onTap ?? () => openAppTab(context, ref, AppTab.home, onLocal: onLocal),
    );
  }
}

/// A page over the home that keeps the home's bottom nav and round button:
/// the page, in the design's blue page, with [AppNav] under it.
class NavScaffold extends StatelessWidget {
  const NavScaffold({super.key, required this.current, required this.child});

  /// The [AppTab] to light (or -1).
  final int current;
  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.transparent,
    body: FdPage(child: child),
    bottomNavigationBar: AppNav(current: current),
    floatingActionButton: AppNavOrb(current: current),
    floatingActionButtonLocation: kFdNavOrbLocation,
  );
}

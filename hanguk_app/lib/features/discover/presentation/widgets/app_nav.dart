import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/analytics/tracked.dart';
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

/// Ticks when the round button is tapped while its page is already open:
/// the page scrolls back to the top instead of the tap doing nothing.
final ValueNotifier<int> kAssessTabReselected = ValueNotifier(0);

/// The nav's four tabs, left to right, as [AppTab]s.
const List<int> _navTabs = [AppTab.universities, AppTab.prepare, AppTab.application, AppTab.documents];

/// One tab asked for from a screen over the home ([goOverPushed]). A new
/// object each time, so the same tab asked for twice still reaches the home.
class AppTabRequest {
  AppTabRequest(this.tab);

  /// The [AppTab] to open.
  final int tab;
}

/// The tab the nav of a screen over the home asked for, set once the screens
/// over the home have closed: the home's shell (ClientShell, DiscoverShell)
/// opens it.
///
/// The URL's `?tab=` reaches a shell only when it changes, and a tab picked in
/// the home's own nav never changes the URL. So «Arizam» from a Study Plan
/// opened over Tayyorgarlik closed the Study Plan and left Tayyorgarlik open:
/// the URL was "/" (Arizam) before and after (audit C-F1, 2026-11-10).
final ValueNotifier<AppTabRequest?> kAppTabRequest = ValueNotifier(null);

/// Opens [tab] of the home from a screen pushed over it (or from the home's
/// own nav when [onLocal] is null). A client's tab for a guest opens in the
/// guest home itself, where it asks for the client code (owner, 2026-10-22).
/// The sign-in's own nav passes [onLocked], as it is that page already.
void openAppTab(BuildContext context, WidgetRef ref, int tab, {ValueChanged<int>? onLocal, VoidCallback? onLocked}) {
  final signedIn = ref.read(signedInProvider);
  if (AppTab.needsClient(tab) && !signedIn) {
    if (onLocked != null) {
      onLocked();
    } else if (onLocal != null) {
      onLocal(tab);
    } else {
      unawaited(goOverPushed(context, discoverTabPath(tab), tab: tab));
    }
    return;
  }
  if (onLocal != null) {
    onLocal(tab);
    return;
  }
  unawaited(goOverPushed(context, signedIn ? '/?tab=$tab' : discoverTabPath(tab), tab: tab));
}

/// A tab asked for from a screen over the home, until it opens.
class _TabAsk {
  _TabAsk(this.router, this.navigator, this.location, this.tab) : from = router.routeInformationProvider.value.uri;

  final GoRouter router;
  final NavigatorState? navigator;
  final String location;
  final int tab;

  /// Where the app was when it was asked for: a link opened meanwhile (a
  /// notification's) wins over it.
  final Uri from;
}

/// The newest tab asked for that has not opened yet: a newer tap replaces it,
/// and [dropPendingTab] forgets it.
_TabAsk? _wanted;

/// True while a screen over the home is being asked to close.
bool _asking = false;

/// A screen that stayed when it was asked to close: the tab asked for opens
/// when it goes.
Route<Object?>? _waitingOn;

/// Goes to [location], the home with [tab] open, from a screen pushed over the
/// home with `Navigator.push` (the Study Plan, the interview), closing those
/// screens first the way the back button does: one that saves on its way out
/// (the Study Plan) still saves, then closes itself.
///
/// `go` alone left them on top. go_router keys a page by its path, and
/// '/?tab=1' → '/?tab=0' changes only the query, so the home page and every
/// screen pushed over it stayed while the tab switched underneath — 51 of 75
/// nav taps on the interview did only that (app_events, 2026-10-20…11-10).
///
/// A screen that does not close at once — it saves first, or it asks first
/// (a live interview) — keeps the tab until it does close, and the nav answers
/// other taps meanwhile: the newest one is the tab that opens. One lock held
/// for up to 20 s used to drop every tap in that time, and then the tab itself
/// when the save took longer (audit C-F6). A screen that stays (its save
/// failed, its "leave?" was answered "stay") opens no tab.
Future<void> goOverPushed(BuildContext context, String location, {required int tab}) {
  _wanted = _TabAsk(GoRouter.of(context), Navigator.maybeOf(context), location, tab);
  // The screen being asked right now answers for this tap too.
  if (_asking) return Future<void>.value();
  return _closeAndGo();
}

/// Forgets the tab a nav tap asked for while the screen it was tapped on was
/// closing: that screen stays after all (its "leave?" was answered "stay"), so
/// when it goes later, by its own back button, it goes back to the home as it
/// is.
void dropPendingTab() => _wanted = null;

/// Closes the screens over the home, top first, then opens the newest tab
/// asked for.
Future<void> _closeAndGo() async {
  for (var i = 0; i < 8; i++) {
    final ask = _wanted;
    if (ask == null) return;
    final navigator = ask.navigator;
    final top = navigator == null || !navigator.mounted ? null : _topRoute(navigator);
    // A page's own route (go_router's) is where pushed screens end.
    if (navigator == null || top == null || top.settings is Page<Object?>) break;
    _asking = true;
    try {
      await navigator.maybePop();
    } finally {
      _asking = false;
    }
    if (top.isActive) {
      // It stays for now; the nav is free again.
      _waitFor(top);
      return;
    }
  }
  final wanted = _wanted;
  if (wanted == null) return;
  _wanted = null;
  if (wanted.router.routeInformationProvider.value.uri != wanted.from) return;
  wanted.router.go(wanted.location);
  kAppTabRequest.value = AppTabRequest(wanted.tab);
}

/// Carries on with the tab asked for once [route] has gone.
void _waitFor(Route<Object?> route) {
  if (identical(_waitingOn, route)) return;
  _waitingOn = route;
  unawaited(
    route.popped.then((_) {
      if (!identical(_waitingOn, route)) return;
      _waitingOn = null;
      if (!_asking) unawaited(_closeAndGo());
    }),
  );
}

Route<Object?>? _topRoute(NavigatorState navigator) {
  Route<Object?>? top;
  navigator.popUntil((route) {
    top = route;
    return true;
  });
  return top;
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
      onTap: tracked(
        'app_nav.nav_assess',
        onTap ??
            () {
              if (current == AppTab.home) {
                kAssessTabReselected.value++;
              } else {
                openAppTab(context, ref, AppTab.home, onLocal: onLocal);
              }
            },
      ),
    );
  }
}

/// Whether the keyboard is up. The bottom nav and the round button step aside
/// while it is (owner, 2026-10-28): the button floats just above the
/// keyboard, so it covered the very line being typed (the third answer of
/// the Study Plan test).
bool keyboardOpen(BuildContext context) => MediaQuery.viewInsetsOf(context).bottom > 0;

/// A page over the home that keeps the home's bottom nav and round button:
/// the page, in the design's blue page, with [AppNav] under it. Both step
/// aside while the keyboard is up ([keyboardOpen]).
class NavScaffold extends StatelessWidget {
  const NavScaffold({super.key, required this.current, required this.child});

  /// The [AppTab] to light (or -1).
  final int current;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final typing = keyboardOpen(context);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(child: child),
      bottomNavigationBar: typing ? null : AppNav(current: current),
      floatingActionButton: typing ? null : AppNavOrb(current: current),
      floatingActionButtonLocation: kFdNavOrbLocation,
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../home/presentation/widgets/han_orb.dart';
import 'guest_compare_screen.dart';
import 'guest_explore_screen.dart';
import 'guest_map_screen.dart';

/// Sections of the guest shell (DESIGN_SPEC §3b).
class GuestSection {
  const GuestSection._();

  static const int explore = 0;
  static const int map = 1;
  static const int compare = 2;

  static const int count = 3;
}

/// Guest Explorer — the catalogue a visitor can browse before they have a
/// magic code (DESIGN_SPEC §3b, screens 8–10).
///
/// Read-only by construction. There is no journey, no documents and no
/// interview here, and the shell never touches a provider that needs a
/// session: everything on screen comes from `universitiesProvider`, which
/// reads the public `v_institutions_for_map` view. Every conversion moment —
/// the header pill, the dial's last item, the compare CTA — routes to the
/// magic-code login.
class GuestShell extends ConsumerStatefulWidget {
  const GuestShell({super.key, this.initialSection = GuestSection.explore});

  final int initialSection;

  @override
  ConsumerState<GuestShell> createState() => _GuestShellState();
}

class _GuestShellState extends ConsumerState<GuestShell> {
  final HanOrbController _orb = HanOrbController();
  late int _section = widget.initialSection;

  /// Sections the visitor has actually opened.
  ///
  /// IndexedStack builds every child, so listing Map unconditionally spun up
  /// the Kakao WebView the moment someone tapped "Explore Universities" —
  /// an SDK download on mobile data for a visitor who may never open the map,
  /// and hidden spinners keeping the app in a permanent frame loop. Same
  /// guard the signed-in shell uses.
  late final Set<int> _visited = <int>{widget.initialSection};

  @override
  void dispose() {
    _orb.dispose();
    super.dispose();
  }

  void _go(int section) => setState(() {
    _section = section;
    _visited.add(section);
  });

  /// One section of the stack, built lazily and with its tickers stopped
  /// while it is not the visible one.
  Widget _lazySection(int index, Widget Function() build) {
    if (!_visited.contains(index)) return const SizedBox.shrink();
    return TickerMode(enabled: index == _section, child: build());
  }

  /// Every conversion moment lands here.
  void _join() => context.push('/login', extra: {'magic_code': true});

  /// The 한 tile exits guest mode entirely (spec §3b).
  void _exit() => context.go('/welcome');

  ({String title, String ko}) _sectionLabels(AppLocalizations l) {
    switch (_section) {
      case GuestSection.map:
        return (title: l.navMap, ko: '대학 지도');
      case GuestSection.compare:
        return (title: l.guestNavCompare, ko: '비교');
      default:
        return (title: l.guestNavExplore, ko: '탐색');
    }
  }

  List<HanOrbItem> _dial(AppLocalizations l) => [
    HanOrbItem(
      label: l.guestNavExplore,
      ko: '탐색',
      glyph: '탐',
      active: _section == GuestSection.explore,
      onTap: () => _go(GuestSection.explore),
    ),
    HanOrbItem(
      label: l.navMap,
      ko: '지도',
      glyph: '도',
      active: _section == GuestSection.map,
      onTap: () => _go(GuestSection.map),
    ),
    HanOrbItem(
      label: l.guestNavCompare,
      ko: '비교',
      glyph: '비',
      active: _section == GuestSection.compare,
      onTap: () => _go(GuestSection.compare),
    ),
    // The conversion item. `active` is deliberately false: it paints the
    // tile lime, but it also sets Semantics(selected: true), which announces
    // "Join Hanguk" to a screen reader as the section you are currently in.
    // The header pill already carries the lime emphasis.
    HanOrbItem(label: l.guestJoinCta, ko: '가입', glyph: '가', onTap: _join),
  ];

  Widget _header(AppLocalizations l) {
    final labels = _sectionLabels(l);
    return Padding(
      padding: const EdgeInsets.fromLTRB(SeoulSizes.screenPadding, 10, 16, 6),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: MaterialLocalizations.of(context).backButtonTooltip,
            child: GestureDetector(
              onTap: _exit,
              child: Container(
                width: SeoulSizes.minTapTarget,
                height: SeoulSizes.minTapTarget,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: SeoulRadii.controlR,
                  gradient: SeoulGradients.heroCard,
                  border: Border.all(color: SeoulColors.heroBorder),
                ),
                child: Text(
                  '한',
                  style: SeoulType.hangulGlyph.copyWith(
                    fontSize: 20,
                    color: SeoulColors.lime,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${l.guestModeEyebrow} · 탐색 모드',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.eyebrow.copyWith(color: SeoulColors.lime),
                ),
                const SizedBox(height: 2),
                HangulTag(
                  en: labels.title,
                  ko: labels.ko,
                  titleStyle: SeoulType.title,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _JoinPill(label: l.guestJoinCta, onTap: _join),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return SeoulNightScaffold(
      // ValueListenableBuilder, because `canPop` has to be recomputed when
      // the dial opens. Without it BACK on Explore was already "poppable",
      // so the orb-closing branch never ran and the visitor was ejected to
      // /welcome — losing their compare tray — instead of the dial closing.
      body: ValueListenableBuilder<bool>(
        valueListenable: _orb,
        builder: (context, orbOpen, child) => PopScope(
          canPop: !orbOpen && _section == GuestSection.explore,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) return;
            if (_orb.value) {
              _orb.close();
              return;
            }
            _go(GuestSection.explore);
          },
          child: child!,
        ),
        child: Stack(
          children: [
            Column(
              children: [
                _header(l),
                Expanded(
                  child: IndexedStack(
                    index: _section,
                    children: [
                      _lazySection(
                        GuestSection.explore,
                        () => GuestExploreScreen(
                          onOpenCompare: () => _go(GuestSection.compare),
                        ),
                      ),
                      _lazySection(
                        GuestSection.map,
                        () => const GuestMapScreen(),
                      ),
                      _lazySection(
                        GuestSection.compare,
                        () => GuestCompareScreen(
                          onExplore: () => _go(GuestSection.explore),
                          onJoin: _join,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            HanOrb(items: _dial(l), tooltip: l.navMenu, controller: _orb),
          ],
        ),
      ),
    );
  }
}

/// The lime conversion pill in the guest header.
class _JoinPill extends StatelessWidget {
  const _JoinPill({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(
            minHeight: SeoulSizes.minTapTarget,
            maxWidth: 150,
          ),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            gradient: SeoulGradients.limeButton,
            borderRadius: BorderRadius.circular(SeoulRadii.pill),
            boxShadow: SeoulShadows.limeGlowSmall,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.button,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '가입',
                style: SeoulType.hangulStatus.copyWith(color: SeoulColors.ink),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

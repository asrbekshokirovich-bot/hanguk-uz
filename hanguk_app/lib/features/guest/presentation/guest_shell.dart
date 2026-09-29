import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart' show cssBlur, cssLinearGradient;
import '../../catalog/data/catalog_compare_provider.dart';
import '../../catalog/presentation/catalog_compare_tray.dart';
import '../../home/presentation/widgets/han_orb.dart';
import 'guest_explore_screen.dart';
import 'guest_map_screen.dart';
import 'widgets/contact_sheet.dart';

/// Sections of the guest shell (DESIGN_SPEC §3b).
class GuestSection {
  const GuestSection._();

  static const int explore = 0;
  static const int map = 1;

  static const int count = 2;
}

/// Guest Explorer — the catalogue a visitor can browse before they have a
/// magic code (DESIGN_SPEC §3b, screens 8–10).
///
/// Read-only by construction. There is no journey, no documents and no
/// interview here, and the shell never touches a provider that needs a
/// session: everything on screen comes from `universitiesProvider`, which
/// reads the public `v_institutions_for_map` view. The dial's last item
/// routes to the magic-code login; the header pill opens the contact sheet,
/// which keeps that login as its last row. While Explore is in compare mode
/// the 한 orb gives way to the compare tray.
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

  /// The header pill opens the contact sheet — Telegram channel, a direct
  /// message, Instagram and the phone — with the magic-code login kept as its
  /// last row so the conversion path is not lost.
  void _contact() => ContactSheet.show(context, onJoin: _join);

  /// The 한 tile exits guest mode entirely (spec §3b).
  void _exit() => context.go('/welcome');

  ({String title, String ko}) _sectionLabels(AppLocalizations l) {
    switch (_section) {
      case GuestSection.map:
        return (title: l.navMap, ko: '대학 지도');
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
    // The conversion item. `active` is deliberately false: it paints the
    // tile lime, but it also sets Semantics(selected: true), which announces
    // "Join Hanguk" to a screen reader as the section you are currently in.
    // The header pill already carries the lime emphasis.
    HanOrbItem(label: l.guestJoinCta, ko: '가입', glyph: '가', onTap: _join),
  ];

  Widget _header(AppLocalizations l) {
    final labels = _sectionLabels(l);
    return Padding(
      padding: const EdgeInsets.fromLTRB(17, 10, 14, 0),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: MaterialLocalizations.of(context).backButtonTooltip,
            child: GestureDetector(
              onTap: _exit,
              child: Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: const Color(0xFF1E4078),
                  border: Border.all(color: const Color(0x59D4E94C)), // .35
                ),
                child: Text(
                  '한',
                  style: SeoulType.hangulGlyph.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
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
                  softWrap: false,
                  overflow: TextOverflow.ellipsis,
                  style: _inter(10, FontWeight.w700, SeoulColors.lime, letterSpacing: 0.4),
                ),
                // Gap 1, plus the 1px the hangul fallback adds to this line
                // in the design.
                const SizedBox(height: 2),
                Text(
                  labels.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _inter(16.5, FontWeight.w800, Colors.white, height: 1.15, letterSpacing: -0.165),
                ),
                const SizedBox(height: 1),
                Text(
                  labels.ko,
                  style: SeoulType.hangulLabel.copyWith(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                    // The design's 13px line.
                    height: 13 / 9.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Short on purpose: "Join Hanguk" was ellipsised to "Hangukk…" in
          // the width the header can spare, and the pill no longer goes to
          // the login anyway — it opens the contact sheet.
          _JoinPill(label: l.guestContactCta, ko: '문의', onTap: _contact),
        ],
      ),
    );
  }

  /// Design 3a's background: a plain 165deg navy-to-black gradient, without
  /// the Seoul Night glow blobs.
  static const List<Color> _backdrop = [
    Color(0xFF1A3A6C),
    Color(0xFF132A4D),
    Color(0xFF0F213D),
    Color(0xFF0A0A1A),
  ];
  static const List<double> _backdropStops = [0, 0.30, 0.60, 1];

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final comparing =
        _section == GuestSection.explore && ref.watch(catalogCompareProvider).active;

    return SeoulNightScaffold(
      // The gradient below covers the scaffold's own backdrop edge to edge,
      // so it draws its own safe area inside it.
      safeArea: false,
      body: LayoutBuilder(
        builder: (context, constraints) => DecoratedBox(
          decoration: BoxDecoration(
            gradient: cssLinearGradient(
              165,
              constraints.biggest,
              colors: _backdrop,
              stops: _backdropStops,
            ),
          ),
          child: SafeArea(
            // ValueListenableBuilder, because `canPop` has to be recomputed
            // when the dial opens. Without it BACK on Explore was already
            // "poppable", so the orb-closing branch never ran and the visitor
            // was ejected to /welcome instead of the dial closing.
            child: ValueListenableBuilder<bool>(
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
                      // On Explore the header scrolls away with the list
                      // (design 3a), so Explore draws it itself.
                      if (_section != GuestSection.explore) _header(l),
                      Expanded(
                        child: IndexedStack(
                          index: _section,
                          children: [
                            _lazySection(
                              GuestSection.explore,
                              () => GuestExploreScreen(header: _header(l)),
                            ),
                            _lazySection(
                              GuestSection.map,
                              () => const GuestMapScreen(),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  // Compare mode hides the orb; the tray takes its place.
                  if (comparing)
                    const CatalogCompareTray(isGuest: true)
                  else
                    HanOrb(items: _dial(l), tooltip: l.navMenu, controller: _orb),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The lime conversion pill in the guest header.
class _JoinPill extends StatelessWidget {
  const _JoinPill({
    required this.label,
    required this.ko,
    required this.onTap,
  });

  final String label;

  /// The Hangul chip riding alongside the label.
  final String ko;
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
          height: 39,
          constraints: const BoxConstraints(maxWidth: 150),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: SeoulColors.lime,
            borderRadius: BorderRadius.circular(SeoulRadii.pill),
            boxShadow: [
              BoxShadow(color: const Color(0x59D4E94C), blurRadius: cssBlur(18)), // .35
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _inter(13, FontWeight.w700, SeoulColors.ink),
                ),
              ),
              const SizedBox(width: 5),
              Text(
                ko,
                style: SeoulType.hangulStatus.copyWith(fontSize: 9, color: SeoulColors.ink),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Inter at the design's size and weight. [height] defaults to CSS
/// `line-height: normal` for Inter.
TextStyle _inter(
  double size,
  FontWeight weight,
  Color color, {
  double height = 1.21,
  double? letterSpacing,
}) => TextStyle(
  fontFamily: SeoulType.inter,
  fontFamilyFallback: SeoulType.fallback,
  fontSize: size,
  fontWeight: weight,
  height: height,
  letterSpacing: letterSpacing,
  color: color,
);

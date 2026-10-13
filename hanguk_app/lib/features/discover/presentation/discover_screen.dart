import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_browser.dart' show kGuestUniversityId;
import '../../catalog/presentation/catalog_format.dart';
import '../data/application_windows.dart';
import '../data/saved_universities.dart';
import 'discover_routes.dart';
import 'widgets/uni_stack_card.dart';

/// The catalogue in the order the card stack deals it: the visiting
/// delegation's university first, then the catalogue's own order (official
/// partners first, then by name).
@visibleForTesting
List<CatalogUniversity> stackOrder(List<CatalogUniversity> all) => [
  ...all.where((u) => u.institutionId == kGuestUniversityId),
  ...all.where((u) => u.institutionId != kGuestUniversityId),
];

/// Design screen 03, "Bosh oyna — karta to'plami": the header, the search
/// row, the card stack with ✕ / ♡ and the count, the "N universitet" banner
/// and "Mijoz kodim bor". The bottom nav belongs to [DiscoverShell].
class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  int _index = 0;
  final _deck = GlobalKey<_DeckState>();

  void _advance(int count) => setState(() => _index = (_index + 1) % count);
  void _back(int count) => setState(() => _index = (_index - 1 + count) % count);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final async = ref.watch(catalogProvider);
    final windows = ref.watch(applicationWindowsProvider).value ?? const {};
    final saved = ref.watch(savedUniversitiesProvider);

    return SafeArea(
      bottom: false,
      child: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: FdColors.navy)),
        error: (_, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l.uniDbLoadFailed, textAlign: TextAlign.center, style: SeoulType.bodySecondary),
                const SizedBox(height: 16),
                SeoulOutlineButton(
                  label: l.commonRetry,
                  expand: false,
                  onPressed: () => ref.invalidate(catalogProvider),
                ),
              ],
            ),
          ),
        ),
        data: (all) {
          final deck = stackOrder(all);
          if (deck.isEmpty) {
            return Center(child: Text(l.catalogEmptyTitle, style: SeoulType.subtitle));
          }
          final index = _index % deck.length;
          final u = deck[index];
          final g = u.primary;
          final season = seasonLabel(l, g);

          return LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight),
                child: IntrinsicHeight(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Header(intake: season == null ? null : l.fdIntakeLabel(season)),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                        child: Row(
                          children: [
                            Expanded(child: _SearchField(hint: l.fdSearchHint, onTap: () => context.push(kDiscoverSearchPath))),
                            const SizedBox(width: 8),
                            HardIconButton(
                              glyph: LucideIcons.slidersHorizontal,
                              semanticLabel: l.catalogFilterTitle,
                              size: 48,
                              radius: 14,
                              iconSize: 19,
                              fill: FdColors.navy,
                              iconColor: Colors.white,
                              shadow: 3,
                              onTap: () => context.push(kDiscoverFilterPath),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                        child: _Deck(
                          key: _deck,
                          cardAt: (offset) {
                            final i = (index + offset) % deck.length;
                            final c = deck[i];
                            return UniStackCard(
                              key: ValueKey(c.institutionId),
                              university: c,
                              guideline: c.primary,
                              position: i + 1,
                              deadline: _deadlineOf(windows, c.primary),
                              isVisiting: c.institutionId == kGuestUniversityId,
                              onAdmission: () => context.push(kAssessmentPath, extra: c.institutionId),
                            );
                          },
                          onTap: () => context.push(universityPath(u.institutionId)),
                          onSkip: () => _advance(deck.length),
                          onSave: () {
                            ref.read(savedUniversitiesProvider.notifier).save(u.institutionId);
                            _advance(deck.length);
                          },
                          onPrevious: () => _back(deck.length),
                          previousLabel: l.fdPrevious,
                          nextLabel: l.fdNext,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _RoundButton(
                              semanticLabel: l.fdSkip,
                              fill: FdColors.card,
                              glyph: LucideIcons.x,
                              iconColor: FdColors.ink,
                              onTap: () => _deck.currentState?.fling(right: false),
                            ),
                            const SizedBox(width: 24),
                            SizedBox(
                              width: 52,
                              child: Text(
                                l.fdCounter(index + 1, deck.length),
                                textAlign: TextAlign.center,
                                style: fdText(13, FontWeight.w800, FdColors.pageMuted),
                              ),
                            ),
                            const SizedBox(width: 24),
                            _RoundButton(
                              semanticLabel: l.fdSave,
                              fill: FdColors.lime,
                              glyph: LucideIcons.heart,
                              iconColor: FdColors.onLime,
                              badge: saved.isEmpty ? null : '${saved.length}',
                              badgeLabel: l.fdSavedTitle,
                              onBadgeTap: () => context.push(kDiscoverSavedPath),
                              onTap: () => _deck.currentState?.fling(right: true),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                        child: _CatalogBanner(
                          count: deck.length,
                          onTap: () => context.push(kDiscoverFilterPath),
                        ),
                      ),
                      const Spacer(),
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: _ClientCodePill(
                            label: l.onbWelcomeClientCode,
                            onTap: () => context.push('/login', extra: const {'magic_code': true}),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  static String? _deadlineOf(Map<String, CatalogRound> windows, CatalogGuideline g) {
    final w = windows[g.id];
    return w?.endDate ?? w?.startDate;
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.intake});

  final String? intake;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
      child: Row(
        children: [
          const SignInLogoTile(size: 34, radius: 10, haloBleed: 0, shadowOffsetY: 2, shadowBlur: 6),
          const SizedBox(width: 10),
          Semantics(
            label: 'Hanguk Consulting',
            excludeSemantics: true,
            child: Text('Hanguk', style: fdText(17, FontWeight.w800, FdColors.ink, letterSpacing: -0.17)),
          ),
          const Spacer(),
          if (intake != null) Text(intake!, style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
        ],
      ),
    );
  }
}

/// The search field, as a button: the search itself is design screen 04.
class _SearchField extends StatelessWidget {
  const _SearchField({required this.hint, required this.onTap});

  final String hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: hint,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
          ),
          child: Row(
            children: [
              const Lucide(LucideIcons.search, size: 18, color: FdColors.ink),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  hint,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(14, FontWeight.w400, FdColors.muted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The card on top of two tilted blank cards. Dragging it sideways throws it:
/// left skips, right saves; a short drag springs back. The side chevrons
/// step through the stack.
/// Where a layer of the stack sits: how far down, how much it is turned,
/// and how much smaller than the top card it is drawn.
class _Pose {
  const _Pose(this.top, this.degrees, this.scale);

  final double top;
  final double degrees;
  final double scale;

  static _Pose lerp(_Pose a, _Pose b, double t) => _Pose(
    a.top + (b.top - a.top) * t,
    a.degrees + (b.degrees - a.degrees) * t,
    a.scale + (b.scale - a.scale) * t,
  );
}

/// The card stack (design screen 03). The top card follows the finger; let
/// go past a third of the width (or flick it) and it drops away to that side
/// while the next university, already waiting behind it, pops up into its
/// place. ✕, ♡ and the chevrons play the same throw.
class _Deck extends StatefulWidget {
  const _Deck({
    super.key,
    required this.cardAt,
    required this.onTap,
    required this.onSkip,
    required this.onSave,
    required this.onPrevious,
    required this.previousLabel,
    required this.nextLabel,
  });

  /// The card [offset] places after the top one: 0 is on top, 1 behind it.
  final Widget Function(int offset) cardAt;
  final VoidCallback onTap;
  final VoidCallback onSkip;
  final VoidCallback onSave;
  final VoidCallback onPrevious;
  final String previousLabel;
  final String nextLabel;

  @override
  State<_Deck> createState() => _DeckState();
}

class _DeckState extends State<_Deck> with TickerProviderStateMixin {
  static const _Pose _front = _Pose(22, 0, 1);
  static const _Pose _second = _Pose(10, 2, 0.955);
  static const _Pose _third = _Pose(0, -3, 0.91);

  /// The top card going back to the middle when it was not thrown far
  /// enough, or coming in from the left for "previous".
  late final AnimationController _settle = AnimationController(vsync: this, duration: const Duration(milliseconds: 260))
    ..addListener(() => setState(() => _dx = _from * (1 - Curves.easeOutCubic.transform(_settle.value))));

  /// The throw: the top card leaves, the one behind rises.
  late final AnimationController _fly = AnimationController(vsync: this, duration: const Duration(milliseconds: 380));

  /// The card that became second sliding up from third place.
  late final AnimationController _enter = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
    value: 1,
  );

  double _dx = 0;
  double _from = 0;
  double _flyFrom = 0;
  bool _flyRight = true;
  double _width = 1;

  @override
  void initState() {
    super.initState();
    _fly.addListener(() => setState(() {}));
    _enter.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _settle.dispose();
    _fly.dispose();
    _enter.dispose();
    super.dispose();
  }

  bool get _busy => _fly.isAnimating;

  /// Throws the top card to the right (saved) or the left (skipped).
  Future<void> fling({required bool right}) async {
    if (_busy) return;
    _settle.stop();
    HapticFeedback.lightImpact();
    _flyRight = right;
    _flyFrom = _dx;
    await _fly.forward(from: 0);
    if (!mounted) return;
    right ? widget.onSave() : widget.onSkip();
    _dx = 0;
    // The card that was behind is now the top one, drawn where it ended up;
    // the next one slides up behind it.
    _fly.value = 0;
    _enter.forward(from: 0);
  }

  /// The previous card comes back in from the left.
  void back() {
    if (_busy) return;
    widget.onPrevious();
    _from = -_width * 1.1;
    _dx = _from;
    _settle.forward(from: 0);
  }

  void _end(DragEndDetails d) {
    final vx = d.velocity.pixelsPerSecond.dx;
    if (_dx.abs() > _width * 0.3 || vx.abs() > 900) {
      fling(right: (_dx.abs() > 8 ? _dx : vx) > 0);
      return;
    }
    _from = _dx;
    _settle.forward(from: 0);
  }

  Widget _layer(_Pose pose, Widget child, {Offset shift = Offset.zero, double extraTurn = 0}) => Positioned(
    left: 0,
    right: 0,
    top: pose.top,
    child: Transform.translate(
      offset: shift,
      child: Transform.rotate(
        angle: pose.degrees * math.pi / 180 + extraTurn,
        child: Transform.scale(scale: pose.scale, alignment: Alignment.topCenter, child: child),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 310,
      child: LayoutBuilder(
        builder: (context, box) {
          _width = box.maxWidth;
          final w = _width;
          final t = _fly.value;

          // The top card: following the finger, or on its way out — out to
          // the side, a little down, turning further as it goes.
          final out = Curves.easeInCubic.transform(t);
          final target = (_flyRight ? 1 : -1) * w * 1.35;
          final dx = _busy || t > 0 ? _flyFrom + (target - _flyFrom) * out : _dx;
          final dy = 70 * out;
          final turn = (dx / w) * 0.28;

          // How far the card behind has come up: with the drag, then all the
          // way with a small overshoot while the top card flies.
          final drag = (_dx.abs() / (w * 0.3)).clamp(0.0, 1.0) * 0.35;
          final rise = t > 0 ? drag + (1 - drag) * Curves.easeOutBack.transform(t) : drag;
          final secondPose = _Pose.lerp(_second, _front, rise);

          // A new second card slides up from third place after a throw.
          final enter = Curves.easeOutCubic.transform(_enter.value);
          final restingSecond = _Pose.lerp(_third, _second, enter);

          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: -17,
                top: 150,
                child: _Chevron(glyph: LucideIcons.chevronLeft, label: widget.previousLabel, onTap: back),
              ),
              Positioned(
                right: -17,
                top: 150,
                child: _Chevron(glyph: LucideIcons.chevronRight, label: widget.nextLabel, onTap: () => fling(right: false)),
              ),
              _layer(_third, const _BlankCard()),
              _layer(
                t > 0 || _dx != 0 ? secondPose : restingSecond,
                IgnorePointer(
                  child: ExcludeSemantics(child: RepaintBoundary(child: widget.cardAt(1))),
                ),
              ),
              _layer(
                _front,
                GestureDetector(
                  onTap: _busy ? null : widget.onTap,
                  onHorizontalDragStart: (_) => _settle.stop(),
                  onHorizontalDragUpdate: (d) {
                    if (!_busy) setState(() => _dx += d.delta.dx);
                  },
                  onHorizontalDragEnd: (d) {
                    if (!_busy) _end(d);
                  },
                  child: RepaintBoundary(child: widget.cardAt(0)),
                ),
                shift: Offset(dx, dy),
                extraTurn: turn,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _BlankCard extends StatelessWidget {
  const _BlankCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: UniStackCard.height,
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
    );
  }
}

class _Chevron extends StatelessWidget {
  const _Chevron({required this.glyph, required this.label, required this.onTap});

  final LucideGlyph glyph;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Lucide(glyph, size: 18, color: FdColors.pageMuted),
        ),
      ),
    );
  }
}

/// ✕ and ♡: 62px circles with a 3px hard shadow; ♡ carries the saved count,
/// which opens the saved list (screen 16).
class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.semanticLabel,
    required this.fill,
    required this.glyph,
    required this.iconColor,
    required this.onTap,
    this.badge,
    this.onBadgeTap,
    this.badgeLabel,
  });

  final String semanticLabel;
  final Color fill;
  final LucideGlyph glyph;
  final Color iconColor;
  final VoidCallback onTap;
  final String? badge;
  final VoidCallback? onBadgeTap;
  final String? badgeLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox.square(
          dimension: 62,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                decoration: BoxDecoration(
                  color: fill,
                  shape: BoxShape.circle,
                  border: Border.all(color: FdColors.ink, width: 1.5),
                  boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
                ),
                alignment: Alignment.center,
                child: ExcludeSemantics(child: Lucide(glyph, size: 24, color: iconColor)),
              ),
              if (badge != null)
                Positioned(
                  top: -14,
                  right: -14,
                  child: Semantics(
                    button: true,
                    label: badgeLabel,
                    value: badge,
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: onBadgeTap,
                      behavior: HitTestBehavior.opaque,
                      // A bigger target than the 22px badge it draws.
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 22),
                          height: 22,
                          padding: const EdgeInsets.symmetric(horizontal: 5),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: FdColors.ink, borderRadius: BorderRadius.circular(999)),
                          child: Text(badge!, style: fdText(11, FontWeight.w800, FdColors.lime)),
                        ),
                      ),
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

/// "N universitet · Yo'nalish · shahar · TOPIK bo'yicha": the fanned cards,
/// the count, and the filter button — opens the filter board (screen 05).
class _CatalogBanner extends StatelessWidget {
  const _CatalogBanner({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final rest = math.max(0, count - 3);
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 11, 12, 11),
          decoration: BoxDecoration(
            color: FdColors.navy,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.lime, offset: Offset(4, 4))],
          ),
          child: Row(
            children: [
              SizedBox(
                width: 52,
                height: 44,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    _fan(0, 8, 28, -10, FdColors.card, null),
                    _fan(8, 4, 28, -4, FdColors.card, null),
                    _fan(17, 0, 30, 4, FdColors.lime, '+$rest'),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '$count', style: const TextStyle(color: FdColors.lime)),
                          TextSpan(text: ' ${l.fdBannerUniversities}'),
                        ],
                      ),
                      style: fdText(15, FontWeight.w800, Colors.white),
                    ),
                    const SizedBox(height: 1),
                    Text(l.fdBannerSubtitle, style: fdText(11, FontWeight.w400, FdColors.onNavyMuted)),
                  ],
                ),
              ),
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: const Lucide(LucideIcons.slidersHorizontal, size: 18, color: FdColors.onLime),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _fan(double left, double top, double width, double deg, Color fill, String? label) => Positioned(
    left: left,
    top: top,
    child: Transform.rotate(
      angle: deg * math.pi / 180,
      child: Container(
        width: width,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
        child: label == null ? null : Text(label, style: fdText(9, FontWeight.w800, FdColors.onLime)),
      ),
    ),
  );
}

/// "가 Mijoz kodim bor →" — sign in with the code the agency gave.
class _ClientCodePill extends StatelessWidget {
  const _ClientCodePill({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('가', style: fdText(12, FontWeight.w800, FdColors.navy)),
              const SizedBox(width: 8),
              Text('$label →', style: fdText(12, FontWeight.w700, FdColors.ink)),
            ],
          ),
        ),
      ),
    );
  }
}

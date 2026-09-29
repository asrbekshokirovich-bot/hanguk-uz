import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';

/// Guest Explorer (DESIGN_SPEC §3b) — the read-only catalog an external
/// student browses without a Magic Code.
///
/// Live: the `/guest` route serves Explore / Guest Map / Compare from the
/// `v_institutions_for_map` view, which anon may read (see the migration).
/// Kept as a flag so the entry point can be pulled without touching the
/// screens.
const bool kGuestModeEnabled = true;

// Text the design leaves at `line-height: normal` sets the line a browser
// gives Inter at that size (rounded ascent + rounded descent: 14px at 11,
// 16 at 13, 19 at 15, 20 at 17). The bundled Inter's own default line is
// taller, which would push everything below it down.

/// Welcome ("Sign-in 2a Polished").
///
/// The logo tile and headline block, then the action stack: the lime
/// "Explore Universities" CTA with its guest caption, a "Hanguk clients"
/// divider, and the glass Magic Code button under it.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  // No update check here. This screen used to run the APK self-updater on
  // first frame — read `app_versions`, then open UpdateDialog to download a
  // build from Supabase Storage — which is what put "Update Failed" in front
  // of a student before they had touched anything.
  //
  // Removing that gate from `UpdateGate` (a3370d5) missed this call site and
  // the one in home_screen, so the dialog kept appearing on the two screens
  // students actually land on. Updates come from Play now, through
  // `features/updater/data/play_in_app_update.dart`; nothing in the app
  // should be downloading an APK itself.

  /// Guest Explorer entry (spec §3b). `push`, not `go`, so backing out of the
  /// catalogue returns here.
  void _openGuestExplorer() => context.push('/guest');

  static const Color _white72 = Color(0xB8FFFFFF);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      // SignInBackdrop is the background; the Scaffold must not paint over it.
      backgroundColor: Colors.transparent,
      body: SignInBackdrop(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              // Centred between the safe areas, but scrollable so a short
              // screen or a large text scale never overflows.
              return SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 40),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _hero(l10n),
                          const SizedBox(height: 40),
                          _actions(l10n),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _hero(AppLocalizations l10n) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SignInLogoTile(
          size: 92,
          radius: 26,
          haloBleed: 44,
          shadowOffsetY: 14,
          shadowBlur: 28,
        ),
        const SizedBox(height: 26),

        // Brand wordmark — intentionally not localized, same rule as the
        // 'Hanguk' mark on the login screen.
        const Text(
          'HANGUK CONSULTING',
          semanticsLabel: 'Hanguk Consulting',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: SeoulType.inter,
            fontFamilyFallback: SeoulType.fallback,
            fontSize: 11,
            height: 14 / 11,
            leadingDistribution: TextLeadingDistribution.even,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.98, // .18em
            color: SeoulColors.lime,
          ),
        ),
        const SizedBox(height: 12),

        Text(
          l10n.welcomeHeadline,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontFamily: SeoulType.inter,
            fontFamilyFallback: SeoulType.fallback,
            fontSize: 31,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.93, // -.03em
            height: 1.08,
            leadingDistribution: TextLeadingDistribution.even,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),

        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 260),
          child: Text(
            l10n.welcomeSubtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: SeoulType.inter,
              fontFamilyFallback: SeoulType.fallback,
              fontSize: 15,
              height: 1.55,
              leadingDistribution: TextLeadingDistribution.even,
              color: _white72,
            ),
          ),
        ),
      ],
    );
  }

  Widget _actions(AppLocalizations l10n) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (kGuestModeEnabled) ...[
          // The one lime action on this screen: the guest catalogue.
          _ExploreButton(
            label: l10n.welcomeExploreCta,
            onPressed: _openGuestExplorer,
          ),
          const SizedBox(height: 12),
          // The guest caption under the explore button (spec §3.1).
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              l10n.welcomeGuestCaption,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: SeoulType.inter,
                fontFamilyFallback: SeoulType.fallback,
                fontSize: 13,
                height: 16 / 13,
                leadingDistribution: TextLeadingDistribution.even,
                color: _white72,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],

        _ClientsDivider(label: l10n.welcomeClientsDivider),
        const SizedBox(height: 12),

        // Target is unchanged: the Magic Code portal.
        _GlassButton(
          label: l10n.welcomeMagicCodeCta,
          onPressed: () => context.push('/login', extra: {'magic_code': true}),
        ),
      ],
    );
  }
}

/// Tap handling shared by both buttons: one semantic button with the label,
/// and a slight shrink while pressed.
class _Pressable extends StatefulWidget {
  const _Pressable({
    required this.label,
    required this.onPressed,
    required this.child,
  });

  final String label;
  final VoidCallback onPressed;
  final Widget child;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _pressed = false;

  void _set(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      excludeSemantics: true,
      onTap: widget.onPressed,
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onPressed,
          onTapDown: (_) => _set(true),
          onTapUp: (_) => _set(false),
          onTapCancel: () => _set(false),
          child: AnimatedScale(
            scale: _pressed ? SeoulMotion.pressScale : 1.0,
            duration: SeoulMotion.fast,
            curve: SeoulMotion.smooth,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

/// CSS `ease-in-out` applied to each half of a `0%,100% {a} 50% {b}`
/// keyframe loop: 0 at both ends, 1 at the midpoint.
double _pingPong(double t) =>
    Curves.easeInOut.transform(t < 0.5 ? t * 2 : 2 - t * 2);

/// The lime primary: a breathing blurred glow behind it, a shine sweeping
/// across it and a nudging arrow. All three stop when the platform asks for
/// reduced motion.
class _ExploreButton extends StatefulWidget {
  const _ExploreButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  State<_ExploreButton> createState() => _ExploreButtonState();
}

class _ExploreButtonState extends State<_ExploreButton>
    with TickerProviderStateMixin {
  static const double _height = 60;
  static const double _radius = 18;

  /// Glow opacity / scale while motion is off: the middle of the breath.
  static const double _restingGlow = 0.34;

  late final AnimationController _breathe = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2800),
  );
  late final AnimationController _shine = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3400),
  );
  late final AnimationController _nudge = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  bool _still = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _still = MediaQuery.disableAnimationsOf(context);
    for (final c in [_breathe, _shine, _nudge]) {
      if (_still) {
        c.stop();
      } else if (!c.isAnimating) {
        c.repeat();
      }
    }
  }

  @override
  void dispose() {
    _breathe.dispose();
    _shine.dispose();
    _nudge.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(_radius);

    // hgBreathe: opacity .18 → .5, scale .97 → 1.02 and back.
    final glow = Positioned(
      left: -4,
      top: -4,
      right: -4,
      bottom: -4,
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _breathe,
          builder: (context, _) {
            final p = _pingPong(_breathe.value);
            final opacity = _still ? _restingGlow : 0.18 + 0.32 * p;
            final scale = _still ? 1.0 : 0.97 + 0.05 * p;
            return Transform.scale(
              scale: scale,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    // `filter: blur(16px)` is a 16px sigma — twice what a
                    // CSS box-shadow blur of 16 would be.
                    BoxShadow(
                      color: SeoulColors.lime.withValues(alpha: opacity),
                      blurRadius: cssBlur(32),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );

    // hgShine: a 45%-wide band sweeping from -130% to 330% of its own width
    // over the first 55% of the loop, then parked off the right edge.
    final shine = LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth * 0.45;
        final h = constraints.maxHeight;
        return AnimatedBuilder(
          animation: _shine,
          builder: (context, child) {
            final t = (_shine.value / 0.55).clamp(0.0, 1.0);
            final x = -1.3 + 4.6 * Curves.easeInOut.transform(t);
            return Transform.translate(offset: Offset(x * w, 0), child: child);
          },
          child: Align(
            alignment: Alignment.centerLeft,
            child: SizedBox(
              width: w,
              height: h,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: cssLinearGradient(
                    100,
                    Size(w, h),
                    colors: const [
                      Color(0x00FFFFFF),
                      Color(0x99FFFFFF),
                      Color(0x00FFFFFF),
                    ],
                    stops: const [0, 0.5, 1],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );

    // hgNudge: the arrow drifts 4px right and back.
    final arrow = AnimatedBuilder(
      animation: _nudge,
      builder: (context, child) => Transform.translate(
        offset: Offset(_still ? 0 : 4 * _pingPong(_nudge.value), 0),
        child: child,
      ),
      child: const SignInIconView(
        SignInIcon.arrowRight,
        size: 18,
        color: SeoulColors.ink,
        strokeWidth: 2.2,
      ),
    );

    final button = Container(
      constraints: const BoxConstraints(minHeight: _height),
      decoration: BoxDecoration(
        borderRadius: r,
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFE2F36A), SeoulColors.lime],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0x4DA8C014), // rgba(168,192,20,.3)
            offset: const Offset(0, 10),
            blurRadius: cssBlur(28),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: r,
        child: Stack(
          children: [
            // inset 0 1px 0 rgba(255,255,255,.6)
            const Positioned.fill(
              child: DecoratedBox(
                decoration: InsetEdgesDecoration(
                  radius: _radius,
                  top: Color(0x99FFFFFF),
                ),
              ),
            ),
            if (!_still) Positioned.fill(child: IgnorePointer(child: shine)),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: _height),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SignInIconView(
                      SignInIcon.graduationCap,
                      size: 20,
                      color: SeoulColors.ink,
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Text(
                        widget.label,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontFamily: SeoulType.inter,
                          fontFamilyFallback: SeoulType.fallback,
                          fontSize: 17,
                          height: 20 / 17,
                          leadingDistribution: TextLeadingDistribution.even,
                          fontWeight: FontWeight.w700,
                          color: SeoulColors.ink,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    arrow,
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );

    return _Pressable(
      label: widget.label,
      onPressed: widget.onPressed,
      child: Stack(clipBehavior: Clip.none, children: [glow, button]),
    );
  }
}

/// "HANGUK CLIENTS" between two hairlines that fade out toward the edges.
class _ClientsDivider extends StatelessWidget {
  const _ClientsDivider({required this.label});

  final String label;

  static const Color _line = Color(0x2EFFFFFF); // rgba(255,255,255,.18)
  static const Color _clear = Color(0x00FFFFFF);

  Widget _hairline(List<Color> colors) => Expanded(
    child: Container(
      height: 1,
      decoration: BoxDecoration(gradient: LinearGradient(colors: colors)),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 2),
      child: LayoutBuilder(
        builder: (context, constraints) => Row(
          children: [
            _hairline(const [_clear, _line]),
            const SizedBox(width: 12),
            ConstrainedBox(
              // A long translation wraps instead of pushing the lines out.
              constraints: BoxConstraints(maxWidth: constraints.maxWidth * 0.7),
              child: Text(
                label.toUpperCase(),
                semanticsLabel: label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: SeoulType.inter,
                  fontFamilyFallback: SeoulType.fallback,
                  fontSize: 11,
                  height: 14 / 11,
                  leadingDistribution: TextLeadingDistribution.even,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.54, // .14em
                  color: Color(0x8CFFFFFF), // rgba(255,255,255,.55)
                ),
              ),
            ),
            const SizedBox(width: 12),
            _hairline(const [_line, _clear]),
          ],
        ),
      ),
    );
  }
}

/// The secondary action: a frosted glass pill with a lime key.
class _GlassButton extends StatelessWidget {
  const _GlassButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  static const double _radius = 16;

  @override
  Widget build(BuildContext context) {
    return _Pressable(
      label: label,
      onPressed: onPressed,
      child: Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(_radius),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0x17FFFFFF), Color(0x0AFFFFFF)],
          ),
          border: Border.all(color: const Color(0x24FFFFFF)),
        ),
        // inset 0 1px 0 rgba(255,255,255,.08), inside the border.
        foregroundDecoration: const InsetEdgesDecoration(
          radius: _radius,
          top: Color(0x14FFFFFF),
          inset: 1,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SignInIconView(
              SignInIcon.key,
              size: 18,
              color: SeoulColors.lime,
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: SeoulType.inter,
                  fontFamilyFallback: SeoulType.fallback,
                  fontSize: 15,
                  height: 19 / 15,
                  leadingDistribution: TextLeadingDistribution.even,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

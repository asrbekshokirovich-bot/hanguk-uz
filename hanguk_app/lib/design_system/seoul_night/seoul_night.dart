/// Seoul Night — the design foundation for the hanguk_app redesign.
///
/// Import this one file to get the whole system:
///
/// ```dart
/// import '../../design_system/seoul_night/seoul_night.dart';
/// ```
///
/// **Reading order** if you are new to it: `DESIGN_SPEC.md` first (it is
/// the binding document, this library only implements it), then
/// `tokens/sn_colors.dart`, then `widgets/seoul_night_scaffold.dart`.
///
/// **The three rules that the type system cannot enforce** (spec §4):
///
/// 1. **Lime is rare.** One primary action per screen, plus active and
///    selected states and glows. Never body text on lime — only
///    [SnColors.ink].
/// 2. **No bottom tab bar, ever.** The 한 orb (Phase 1) is the only
///    global navigation.
/// 3. **Depth is gradient + glow + layered glass.** Never a lighter flat
///    panel, never a pure-black one.
///
/// Every screen goes inside a [SeoulNightScaffold]; without it the glass
/// has nothing to sample and the whole language collapses to grey boxes.
///
/// Two widgets carry an `Sn` prefix ([SnOutlineButton], [SnFilterChip])
/// because Material owns or used to own those names and an unprefixed
/// export would make them ambiguous in any file importing both this
/// barrel and `material.dart`.
library;

export 'seoul_night_theme.dart';
export 'tokens/sn_colors.dart';
export 'tokens/sn_gradients.dart';
export 'tokens/sn_motion.dart';
export 'tokens/sn_radii.dart';
export 'tokens/sn_shadows.dart';
export 'tokens/sn_typography.dart';
export 'widgets/conic_progress_ring.dart';
export 'widgets/glass_card.dart';
export 'widgets/glow_progress_bar.dart';
export 'widgets/hangul_tag.dart';
export 'widgets/hero_card.dart';
export 'widgets/seoul_night_scaffold.dart';
export 'widgets/sn_buttons.dart';
export 'widgets/sn_chips.dart';

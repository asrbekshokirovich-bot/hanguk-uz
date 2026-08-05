import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../updater/data/updater_repository.dart';
import '../../updater/presentation/update_dialog.dart';

/// Guest Explorer (DESIGN_SPEC §3b) — the read-only catalog an external
/// student browses without a Magic Code.
///
/// Live: the `/guest` route serves Explore / Guest Map / Compare from the
/// `v_institutions_for_map` view, which anon may read (see the migration).
/// Kept as a flag so the entry point can be pulled without touching the
/// screens.
const bool kGuestModeEnabled = true;

/// Welcome (DESIGN_SPEC §3.1).
///
/// Centred 한 mark in a lime halo ring, the headline block with its faint
/// 한국으로 가는 길 accent, then the action stack: the lime Magic Code CTA and
/// — once guest mode ships — the glass "explore" button with its 탐색 chip.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkForUpdates();
    });
  }

  Future<void> _checkForUpdates() async {
    final repo = ref.read(updaterRepositoryProvider);
    final versionInfo = await repo.checkForUpdate();
    if (!mounted) return;
    if (versionInfo is UpdateAvailable) {
      showDialog(
        context: context,
        barrierDismissible: !versionInfo.effectivelyForced,
        builder: (context) => const UpdateDialog(),
      );
    }
  }

  /// Guest Explorer entry (spec §3b). `push`, not `go`, so backing out of the
  /// catalogue returns here.
  void _openGuestExplorer() => context.push('/guest');

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return SeoulNightScaffold(
      body: Column(
        children: [
          // ── Hero ──────────────────────────────────────────────────────
          // Centred, but scrollable so a short screen or a large text scale
          // never overflows.
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 24,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const _HanTile(),
                    const SizedBox(height: 26),

                    // Brand wordmark — intentionally not localized, same rule
                    // as the 'Hanguk' mark on the login screen.
                    Text(
                      'Hanguk Consulting',
                      textAlign: TextAlign.center,
                      style: SeoulType.eyebrow.copyWith(
                        color: SeoulColors.lime,
                      ),
                    ),
                    const SizedBox(height: 10),

                    Text(
                      l10n.welcomeHeadline,
                      textAlign: TextAlign.center,
                      style: SeoulType.display,
                    ),
                    const SizedBox(height: 10),

                    Text(
                      l10n.welcomeSubtitle,
                      textAlign: TextAlign.center,
                      style: SeoulType.bodySecondary,
                    ),
                    const SizedBox(height: 14),

                    // Decorative Korean accent — stays hangul in every locale
                    // (spec §1 Korean voice).
                    Text(
                      '한국으로 가는 길',
                      textAlign: TextAlign.center,
                      style: SeoulType.hangulLabel.copyWith(
                        color: SeoulColors.textFaint,
                        letterSpacing: 3.6, // 0.3em at 12px
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Actions ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 0, 28, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // The one lime action on this screen (spec §4). Target is
                // unchanged: the Magic Code portal. A forward arrow, not a
                // key — the prototype's CTA points onward into the flow (the
                // key mark belongs to the Magic Code screen it opens).
                LimeButton(
                  label: l10n.welcomeMagicCodeCta,
                  icon: Icons.arrow_forward_rounded,
                  iconAfterLabel: true,
                  onPressed: () =>
                      context.push('/login', extra: {'magic_code': true}),
                ),

                if (kGuestModeEnabled) ...[
                  const SizedBox(height: 12),
                  SeoulOutlineButton(
                    label: l10n.welcomeExploreCta,
                    onPressed: _openGuestExplorer,
                    trailing: const StatusChip(
                      label: '탐색',
                      tone: StatusTone.lime,
                      dense: true,
                    ),
                  ),
                ],

                const SizedBox(height: 16),
                // The guest caption under the explore button (spec §3.1).
                Text(
                  l10n.welcomeGuestCaption,
                  textAlign: TextAlign.center,
                  style: SeoulType.caption,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The brand 한 mark: a navy hero-gradient tile inside a lime halo ring
/// (spec §3.1).
///
/// Decorative — the "Hanguk Consulting" wordmark below it carries the brand
/// for assistive tech, so the glyph is excluded from semantics rather than
/// read out as "한".
class _HanTile extends StatelessWidget {
  const _HanTile();

  static const double _size = 116;

  /// Width of the lime ring around the tile.
  static const double _halo = 6;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        padding: const EdgeInsets.all(_halo),
        decoration: const BoxDecoration(
          color: SeoulColors.limeFill,
          borderRadius: SeoulRadii.heroR,
          boxShadow: [...SeoulShadows.hero, ...SeoulShadows.limeGlowSmall],
        ),
        child: Container(
          width: _size,
          height: _size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: SeoulGradients.heroCard,
            borderRadius: SeoulRadii.heroR,
            border: Border.all(color: SeoulColors.heroBorder, width: 1),
          ),
          // The real brand mark, not the bare 한 syllable the tile used to
          // typeset: the logo carries the arc under the glyph, which no font
          // gives us. Its navy plate matches the hero gradient, so it is
          // clipped to the tile radius and fills it edge to edge.
          child: ClipRRect(
            borderRadius: SeoulRadii.heroR,
            child: Image.asset(
              'assets/images/brand_mark.png',
              width: _size,
              height: _size,
              fit: BoxFit.cover,
              filterQuality: FilterQuality.medium,
            ),
          ),
        ),
      ),
    );
  }
}

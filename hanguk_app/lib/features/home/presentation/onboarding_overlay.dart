import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';

/// One-time, skippable first-run orientation shown on Home (audit A9).
///
/// Three steps explaining the core value props (track applications, explore
/// universities + upload documents, practice interviews). Persisted via a
/// single secure-storage flag so returning users never see it again.
class OnboardingStore {
  static const _key = 'onboarding_seen_v1';
  static const _storage = FlutterSecureStorage();

  /// Returns true when the orientation has already been shown. On any storage
  /// error we treat it as "seen" so a failure never blocks or loops the app.
  static Future<bool> hasSeen() async {
    try {
      return (await _storage.read(key: _key)) == 'true';
    } catch (_) {
      return true;
    }
  }

  static Future<void> markSeen() async {
    try {
      await _storage.write(key: _key, value: 'true');
    } catch (_) {
      /* non-fatal: worst case it shows again next launch */
    }
  }
}

class _Step {
  const _Step(this.glyph, this.ko, this.title, this.body);

  /// The oversized hangul syllable that fronts the step (DESIGN_SPEC §1
  /// Korean voice). Decorative — stays Korean in every locale.
  final String glyph;

  /// Small lime hangul label under the title, mirroring the orb dial labels.
  final String ko;

  final String title;
  final String body;
}

class OnboardingOverlay extends StatefulWidget {
  const OnboardingOverlay({super.key});

  @override
  State<OnboardingOverlay> createState() => _OnboardingOverlayState();
}

class _OnboardingOverlayState extends State<OnboardingOverlay> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await OnboardingStore.markSeen();
    if (mounted) Navigator.of(context).pop();
  }

  void _next(int last) {
    if (_index >= last) {
      _finish();
      return;
    }
    // Respect reduced-motion: jump instead of animate when animations are off.
    if (MediaQuery.of(context).disableAnimations) {
      _controller.jumpToPage(_index + 1);
    } else {
      _controller.nextPage(
        duration: SeoulMotion.base,
        curve: SeoulMotion.smooth,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    // Glyphs match the orb speed-dial (지원 / 지도 / 면접) so the first thing a
    // student learns is the same Korean shorthand the shell navigates by.
    final steps = <_Step>[
      _Step('지', '지원 현황', l.onboardingStep1Title, l.onboardingStep1Body),
      _Step('도', '대학 지도', l.onboardingStep2Title, l.onboardingStep2Body),
      _Step('면', '면접 연습', l.onboardingStep3Title, l.onboardingStep3Body),
    ];
    final last = steps.length - 1;

    return SeoulNightScaffold(
      body: Column(
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: TextButton(
                onPressed: _finish,
                style: TextButton.styleFrom(
                  foregroundColor: SeoulColors.textSecondary,
                  minimumSize: const Size(
                    SeoulSizes.minTapTarget,
                    SeoulSizes.minTapTarget,
                  ),
                ),
                child: Text(l.onboardingSkip, style: SeoulType.bodySecondary),
              ),
            ),
          ),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) => PageView.builder(
                controller: _controller,
                itemCount: steps.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) {
                  final s = steps[i];
                  // Scrollable, not a fixed centred Column: the glyph tile is a
                  // hard 120px and the body text scales, so at the OS's largest
                  // font settings the page overflows its viewport. Centred while
                  // it fits, scrollable once it doesn't.
                  return SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 32,
                      vertical: 16,
                    ),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: constraints.maxHeight - 32,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          HangulGlyphTile(
                            glyph: s.glyph,
                            size: 120,
                            radius: SeoulRadii.hero,
                          ),
                          const SizedBox(height: 32),
                          Text(
                            s.title,
                            textAlign: TextAlign.center,
                            style: SeoulType.headline,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            s.ko,
                            textAlign: TextAlign.center,
                            style: SeoulType.hangulLabel,
                          ),
                          const SizedBox(height: 14),
                          Text(
                            s.body,
                            textAlign: TextAlign.center,
                            style: SeoulType.bodySecondary,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          // Page indicator — lime for the active dot (spec §1: lime marks the
          // active state), neutral glass for the rest.
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(steps.length, (i) {
              final active = i == _index;
              return AnimatedContainer(
                duration: SeoulMotion.fast,
                curve: SeoulMotion.smooth,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: active ? 24 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: active ? SeoulColors.lime : SeoulColors.neutralFill,
                  // 999 is the design system's pill idiom (see StatusChip).
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: active ? SeoulShadows.limeGlowSmall : null,
                ),
              );
            }),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.fromLTRB(32, 0, 32, 32),
            child: LimeButton(
              label: _index >= last ? l.onboardingStart : l.onboardingNext,
              onPressed: () => _next(last),
            ),
          ),
        ],
      ),
    );
  }
}

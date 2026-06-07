import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../design_system/theme/app_colors.dart';
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
  const _Step(this.icon, this.title, this.body);
  final IconData icon;
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
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final steps = <_Step>[
      _Step(Icons.school, l.onboardingStep1Title, l.onboardingStep1Body),
      _Step(Icons.map, l.onboardingStep2Title, l.onboardingStep2Body),
      _Step(
        Icons.smart_toy,
        l.onboardingStep3Title,
        l.onboardingStep3Body,
      ),
    ];
    final last = steps.length - 1;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.royalBlue,
              Color(0xFF132A4D),
              Color(0xFF0F213D),
              AppColors.backgroundNavy,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: TextButton(
                    onPressed: _finish,
                    child: Text(
                      l.onboardingSkip,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: steps.length,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (context, i) {
                    final s = steps[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              color: AppColors.vibrantLime.withValues(
                                alpha: 0.10,
                              ),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.vibrantLime.withValues(
                                  alpha: 0.30,
                                ),
                              ),
                            ),
                            child: Icon(
                              s.icon,
                              size: 56,
                              color: AppColors.vibrantLime,
                            ),
                          ),
                          const SizedBox(height: 32),
                          Text(
                            s.title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            s.body,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 15,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              // Page indicator
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(steps.length, (i) {
                  final active = i == _index;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: active ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: active
                          ? AppColors.vibrantLime
                          : Colors.white.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.fromLTRB(32, 0, 32, 32),
                child: SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () => _next(last),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.vibrantLime,
                      foregroundColor: AppColors.pureBlack,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      _index >= last ? l.onboardingStart : l.onboardingNext,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
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

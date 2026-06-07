import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../updater/data/updater_repository.dart';
import '../../updater/presentation/update_dialog.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.royalBlue,
              Color(0xFF132A4D), // primary/90
              Color(0xFF0F213D), // primary/80
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.all(20.0),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      // Decorative — wordmark next to it carries the
                      // brand for assistive tech.
                      child: Image.asset(
                        'assets/images/app_icon.png',
                        height: 40,
                        width: 40,
                        fit: BoxFit.cover,
                        excludeFromSemantics: true,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Hanguk',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(),

              // Hero Section
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32.0),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: AppColors.vibrantLime.withValues(alpha: 0.3),
                          width: 4,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        // Decorative — the "Hanguk Consulting" headline
                        // immediately below carries the brand identity.
                        child: Image.asset(
                          'assets/images/app_icon.png',
                          height: 100,
                          width: 100,
                          fit: BoxFit.cover,
                          excludeFromSemantics: true,
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: const Text(
                        'Hanguk Consulting',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'South Korean University Application Platform',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 48),

                    // Actions
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: () =>
                            context.push('/login', extra: {'magic_code': true}),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.vibrantLime,
                          foregroundColor: AppColors.pureBlack,
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.workspace_premium, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'I have a Magic Code',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Quiet helper for students without a code yet. Phone
                    // sign-up is intentionally hidden until it ships
                    // (no "coming soon" placeholder — audit A2/S2).
                    Text(
                      'Get a Magic Code from your consultant to sign in.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }
}

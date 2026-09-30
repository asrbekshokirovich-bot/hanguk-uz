import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../auth/presentation/widgets/auth_controls.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../data/entry_store.dart';
import 'widgets/language_options.dart';

/// The app's first screen: pick Uzbek, English, Korean or Russian. Shown once;
/// the choice is remembered ([EntryStore]) and can be changed later from the
/// Welcome screen or the account screen.
///
/// Nothing here goes through `AppLocalizations`: no language has been chosen
/// yet, so the title reads in all four and the button in the one selected.
class LanguageScreen extends ConsumerStatefulWidget {
  const LanguageScreen({super.key});

  @override
  ConsumerState<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends ConsumerState<LanguageScreen> {
  String? _selected;
  bool _saving = false;

  static const Map<String, String> _continue = {
    'uz': 'Davom etish',
    'en': 'Continue',
    'ko': '계속',
    'ru': 'Продолжить',
  };

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Start on the phone's own language when it is one of the four.
    _selected ??= () {
      final device = Localizations.localeOf(context).languageCode;
      return kEntryLanguages.contains(device) ? device : null;
    }();
  }

  Future<void> _confirm() async {
    final code = _selected;
    if (code == null || _saving) return;
    setState(() => _saving = true);
    // The router moves on to sign-up once the language is stored.
    await ref.read(entryProvider.notifier).setLanguage(code);
  }

  static const TextStyle _titleStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 28,
    height: 1.12,
    leadingDistribution: TextLeadingDistribution.even,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.7,
    color: Colors.white,
  );

  static const TextStyle _subtitleStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: [SeoulType.korean, ...SeoulType.fallback],
    fontSize: 14,
    height: 1.5,
    leadingDistribution: TextLeadingDistribution.even,
    color: Color(0xB8FFFFFF),
  );

  @override
  Widget build(BuildContext context) {
    final ready = _selected != null;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SignInBackdrop(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Center(
                          child: SignInLogoTile(
                            size: 72,
                            radius: 21,
                            haloBleed: 34,
                            shadowOffsetY: 12,
                            shadowBlur: 24,
                          ),
                        ),
                        const SizedBox(height: 22),
                        const Text(
                          'HANGUK CONSULTING',
                          semanticsLabel: 'Hanguk Consulting',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: SeoulType.inter,
                            fontFamilyFallback: SeoulType.fallback,
                            fontSize: 11,
                            height: 14 / 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.98,
                            color: SeoulColors.lime,
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'Tilni tanlang',
                          textAlign: TextAlign.center,
                          style: _titleStyle,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Choose a language · 언어 선택\nВыберите язык',
                          textAlign: TextAlign.center,
                          style: _subtitleStyle,
                        ),
                        const SizedBox(height: 28),
                        LanguageOptions(
                          selected: _selected,
                          onSelected: (code) =>
                              setState(() => _selected = code),
                        ),
                        const SizedBox(height: 24),
                        IgnorePointer(
                          ignoring: !ready,
                          child: AnimatedOpacity(
                            opacity: ready ? 1 : 0.45,
                            duration: SeoulMotion.fast,
                            child: AuthSubmitButton(
                              label: _continue[_selected ?? 'uz']!,
                              loading: _saving,
                              onPressed: _confirm,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

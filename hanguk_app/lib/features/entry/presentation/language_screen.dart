import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../data/entry_store.dart';
import 'widgets/language_cards.dart';

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
    final device = Localizations.localeOf(context).languageCode;
    await ref.read(entryProvider.notifier).setLanguage(code, source: 'first_run', deviceDefault: code == device);
  }

  static const TextStyle _titleStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: 34,
    height: 1.1,
    leadingDistribution: TextLeadingDistribution.even,
    fontWeight: FontWeight.w800,
    letterSpacing: -1,
    color: Colors.white,
  );

  static const TextStyle _subtitleStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: [SeoulType.korean, ...SeoulType.fallback],
    fontSize: 15,
    height: 1.45,
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
                child: IntrinsicHeight(
                  child: Stack(
                    children: [
                      // The big ghost word behind the title ("language").
                      const Positioned(
                        top: 6,
                        right: -22,
                        child: ExcludeSemantics(
                          child: Text(
                            '언어',
                            style: TextStyle(
                              fontFamily: SeoulType.korean,
                              fontFamilyFallback: SeoulType.fallback,
                              fontSize: 124,
                              height: 1,
                              fontWeight: FontWeight.w900,
                              color: Color(0x0FFFFFFF),
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const SignInLogoTile(
                                  size: 36,
                                  radius: 11,
                                  haloBleed: 0,
                                  shadowOffsetY: 3,
                                  shadowBlur: 8,
                                ),
                                const SizedBox(width: 12),
                                Semantics(
                                  label: 'Hanguk Consulting',
                                  excludeSemantics: true,
                                  child: const Text(
                                    'Hanguk',
                                    style: TextStyle(
                                      fontFamily: SeoulType.inter,
                                      fontFamilyFallback: SeoulType.fallback,
                                      fontSize: 19,
                                      height: 1.2,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.4,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 56),
                            Text.rich(
                              const TextSpan(
                                children: [
                                  TextSpan(text: 'Tilni '),
                                  // The design marks the key word in lime.
                                  TextSpan(
                                    text: 'tanlang',
                                    style: TextStyle(color: SeoulColors.lime),
                                  ),
                                ],
                              ),
                              style: _titleStyle,
                            ),
                            const SizedBox(height: 10),
                            const Text(
                              "Keyin sozlamalardan o'zgartirish mumkin",
                              style: _subtitleStyle,
                            ),
                            const SizedBox(height: 28),
                            LanguageCards(
                              selected: _selected,
                              onSelected: (code) =>
                                  setState(() => _selected = code),
                            ),
                            const SizedBox(height: 28),
                            // The design pins the action to the bottom edge.
                            const Spacer(),
                            IgnorePointer(
                              ignoring: !ready,
                              child: AnimatedOpacity(
                                opacity: ready ? 1 : 0.45,
                                duration: SeoulMotion.fast,
                                child: HardButton(
                                  label: _continue[_selected ?? 'uz']!,
                                  loading: _saving,
                                  onPressed: _confirm,
                                  trailing: const Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 20,
                                    color: SeoulColors.ink,
                                  ),
                                ),
                              ),
                            ),
                          ],
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
    );
  }
}

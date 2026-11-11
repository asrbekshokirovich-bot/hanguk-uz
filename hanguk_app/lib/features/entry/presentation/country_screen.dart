import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/tracked.dart';
import '../../../core/country/app_country.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../data/entry_store.dart';
import 'widgets/country_cards.dart';

const String kCountryPath = '/country';

/// The screen after the language on first launch (plan KG2, design B):
/// Uzbekistan or Kyrgyzstan, pre-selected from the phone's region and time
/// zone. Shown once; the account screen (a guest: the Universitetlar header)
/// changes it later. Unlike the language screen it is in the language just
/// chosen.
class CountryScreen extends ConsumerStatefulWidget {
  const CountryScreen({super.key});

  @override
  ConsumerState<CountryScreen> createState() => _CountryScreenState();
}

class _CountryScreenState extends ConsumerState<CountryScreen> {
  /// What the phone's settings pointed to; null when they say nothing.
  final AppCountry? _guess = EntryStore.phoneCountry();
  late AppCountry? _selected = _guess;
  bool _saving = false;

  Future<void> _confirm() async {
    final country = _selected;
    if (country == null || _saving) return;
    setState(() => _saving = true);
    // The router moves on to the home once the country is stored.
    await ref.read(entryProvider.notifier).setCountry(country);
  }

  static const TextStyle _titleStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: [SeoulType.korean, ...SeoulType.fallback],
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

  static const TextStyle _hintStyle = TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: [SeoulType.korean, ...SeoulType.fallback],
    fontSize: 13,
    height: 1.4,
    leadingDistribution: TextLeadingDistribution.even,
    color: Color(0x99FFFFFF),
  );

  /// [title] with [accent] in lime — the design marks the key word.
  static List<TextSpan> _titleSpans(String title, String accent) {
    final at = accent.isEmpty ? -1 : title.indexOf(accent);
    if (at < 0) return [TextSpan(text: title)];
    return [
      if (at > 0) TextSpan(text: title.substring(0, at)),
      TextSpan(text: accent, style: const TextStyle(color: SeoulColors.lime)),
      if (at + accent.length < title.length) TextSpan(text: title.substring(at + accent.length)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
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
                      // The big ghost word behind the title ("country").
                      const Positioned(
                        top: 6,
                        right: -22,
                        child: ExcludeSemantics(
                          child: Text(
                            '나라',
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
                              TextSpan(children: _titleSpans(l.countryScreenTitle, l.countryScreenTitleAccent)),
                              style: _titleStyle,
                            ),
                            const SizedBox(height: 10),
                            Text(l.countryScreenSubtitle, style: _subtitleStyle),
                            const SizedBox(height: 28),
                            CountryCards(
                              selected: _selected,
                              onSelected: (country) => setState(() => _selected = country),
                            ),
                            // Only while the pick is still the phone's.
                            if (_guess != null && _selected == _guess) ...[
                              const SizedBox(height: 14),
                              Text(l.countryScreenGuessHint, style: _hintStyle),
                            ],
                            const SizedBox(height: 20),
                            // The design pins the action to the bottom edge.
                            const Spacer(),
                            IgnorePointer(
                              ignoring: !ready,
                              child: AnimatedOpacity(
                                opacity: ready ? 1 : 0.45,
                                duration: SeoulMotion.fast,
                                child: HardButton(
                                  label: l.onbQuizContinue,
                                  loading: _saving,
                                  onPressed: tracked('country.confirm', _confirm),
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

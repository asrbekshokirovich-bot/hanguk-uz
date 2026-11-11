import 'package:flutter/material.dart';

import '../../../../core/analytics/tracked.dart';
import '../../../../core/country/app_country.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';

/// [country]'s name in the app's language.
String countryName(AppLocalizations l, AppCountry country) => switch (country) {
  AppCountry.uz => l.countryUzbekistan,
  AppCountry.kg => l.countryKyrgyzstan,
};

/// The line under the name on the country screen: phone code · currency.
String countryCaption(AppLocalizations l, AppCountry country) => switch (country) {
  AppCountry.uz => l.countryUzCaption,
  AppCountry.kg => l.countryKgCaption,
};

/// The country screen's cards (design B), the same cards as the language
/// screen's: white with a hard ink shadow; the selected one turns lime, its
/// code badge ink and the check fills in.
///
/// (Changing the country later uses [CountryOptions] in a bottom sheet.)
class CountryCards extends StatelessWidget {
  const CountryCards({super.key, required this.selected, required this.onSelected});

  final AppCountry? selected;
  final ValueChanged<AppCountry> onSelected;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final country in AppCountry.values) ...[
          _CountryCard(
            code: country.code,
            name: countryName(l, country),
            caption: countryCaption(l, country),
            selected: country == selected,
            onTap: tracked('country_cards.selected', () => onSelected(country), props: {'value': country.code}),
          ),
          if (country != AppCountry.values.last) const SizedBox(height: 14),
        ],
      ],
    );
  }
}

class _CountryCard extends StatelessWidget {
  const _CountryCard({
    required this.code,
    required this.name,
    required this.caption,
    required this.selected,
    required this.onTap,
  });

  final String code;
  final String name;
  final String caption;
  final bool selected;
  final VoidCallback onTap;

  static const Color _badgeIdle = Color(0xFFE3EAF6);
  static const Color _caption = Color(0xFF52627A);

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: name,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: tracked('country_cards.country_card', onTap),
        child: AnimatedContainer(
          duration: SeoulMotion.fast,
          curve: Curves.easeOut,
          child: HardShadowBox(
            fill: selected ? SeoulColors.lime : Colors.white,
            radius: 18,
            padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected ? SeoulColors.ink : _badgeIdle,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Text(
                    code,
                    style: TextStyle(
                      fontFamily: SeoulType.inter,
                      fontFamilyFallback: SeoulType.fallback,
                      fontSize: 14,
                      height: 1.2,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                      color: selected ? SeoulColors.lime : SeoulColors.royalBlue,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontFamily: SeoulType.inter,
                          fontFamilyFallback: [SeoulType.korean, ...SeoulType.fallback],
                          fontSize: 19,
                          height: 1.2,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                          color: SeoulColors.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        caption,
                        style: const TextStyle(
                          fontFamily: SeoulType.inter,
                          fontFamilyFallback: [SeoulType.korean, ...SeoulType.fallback],
                          fontSize: 13,
                          height: 1.2,
                          color: _caption,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                AnimatedContainer(
                  duration: SeoulMotion.fast,
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: selected ? SeoulColors.ink : Colors.white,
                    border: Border.all(color: SeoulColors.ink, width: 1.5),
                  ),
                  child: selected ? const Icon(Icons.check_rounded, size: 16, color: SeoulColors.lime) : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

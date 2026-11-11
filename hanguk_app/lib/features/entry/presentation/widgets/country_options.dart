import 'package:flutter/material.dart';

import '../../../../core/analytics/tracked.dart';
import '../../../../core/country/app_country.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/presentation/widgets/sign_in_chrome.dart';
import 'country_cards.dart';

/// The two countries as glass rows, the same as the language sheet's: a code
/// badge, the name, and a lime check on the one selected.
class CountryOptions extends StatelessWidget {
  const CountryOptions({super.key, required this.selected, required this.onSelected});

  final AppCountry? selected;
  final ValueChanged<AppCountry> onSelected;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final country in AppCountry.values) ...[
          _CountryRow(
            code: country.code,
            name: countryName(l, country),
            selected: country == selected,
            onTap: tracked('country_options.selected', () => onSelected(country), props: {'value': country.code}),
          ),
          if (country != AppCountry.values.last) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _CountryRow extends StatelessWidget {
  const _CountryRow({required this.code, required this.name, required this.selected, required this.onTap});

  final String code;
  final String name;
  final bool selected;
  final VoidCallback onTap;

  static const double _radius = 16;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: name,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: tracked('country_options.country_row', onTap),
        child: AnimatedContainer(
          duration: SeoulMotion.base,
          curve: SeoulMotion.smooth,
          constraints: const BoxConstraints(minHeight: 60),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(_radius),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: selected
                  ? const [Color.fromRGBO(212, 233, 76, .16), Color.fromRGBO(212, 233, 76, .06)]
                  : const [Color(0x17FFFFFF), Color(0x0AFFFFFF)],
            ),
            border: Border.all(
              color: selected ? SeoulColors.lime : const Color(0x24FFFFFF),
              width: selected ? 1.5 : 1,
            ),
          ),
          foregroundDecoration: const InsetEdgesDecoration(radius: _radius, top: Color(0x14FFFFFF), inset: 1),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? SeoulColors.lime : const Color.fromRGBO(255, 255, 255, .08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  code,
                  style: TextStyle(
                    fontFamily: SeoulType.inter,
                    fontFamilyFallback: SeoulType.fallback,
                    fontSize: 13,
                    height: 1.21,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: selected ? SeoulColors.ink : Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  name,
                  style: const TextStyle(
                    fontFamily: SeoulType.inter,
                    fontFamilyFallback: [SeoulType.korean, ...SeoulType.fallback],
                    fontSize: 17,
                    height: 1.21,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
              AnimatedOpacity(
                opacity: selected ? 1 : 0,
                duration: SeoulMotion.fast,
                child: const Icon(Icons.check_circle_rounded, size: 22, color: SeoulColors.lime),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

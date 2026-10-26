import 'package:flutter/material.dart';

import '../../../../core/analytics/tracked.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../data/entry_store.dart';

/// The first-launch language picker from the full design: one white card per
/// language with a hard ink shadow. The selected card turns lime, its code
/// badge turns ink and the check fills in.
///
/// (Changing the language later uses [LanguageOptions] in a bottom sheet.)
class LanguageCards extends StatelessWidget {
  const LanguageCards({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final String? selected;
  final ValueChanged<String> onSelected;

  /// The line under each language's name, as the design words them.
  static const Map<String, String> _captions = {
    'uz': 'Asosiy til',
    'ru': 'Rus tili',
    'en': 'Ingliz tili',
    'ko': 'Koreys tili',
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final code in kEntryLanguages) ...[
          _LanguageCard(
            code: code,
            name: kEntryLanguageNames[code]!,
            caption: _captions[code] ?? '',
            selected: code == selected,
            onTap: tracked('language_cards.selected', () => onSelected(code), props: {'value': code}),
          ),
          if (code != kEntryLanguages.last) const SizedBox(height: 14),
        ],
      ],
    );
  }
}

class _LanguageCard extends StatelessWidget {
  const _LanguageCard({
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
        onTap: tracked('language_cards.language_card', onTap),
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
                    code.toUpperCase(),
                    style: TextStyle(
                      fontFamily: SeoulType.inter,
                      fontFamilyFallback: SeoulType.fallback,
                      fontSize: 14,
                      height: 1.2,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                      color: selected
                          ? SeoulColors.lime
                          : SeoulColors.royalBlue,
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
                          fontFamilyFallback: [
                            SeoulType.korean,
                            ...SeoulType.fallback,
                          ],
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
                          fontFamilyFallback: SeoulType.fallback,
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
                  child: selected
                      ? const Icon(
                          Icons.check_rounded,
                          size: 16,
                          color: SeoulColors.lime,
                        )
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

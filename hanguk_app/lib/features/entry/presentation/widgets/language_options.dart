import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../auth/presentation/widgets/sign_in_chrome.dart';
import '../../data/entry_store.dart';

/// The four languages as a column of glass rows: a code badge, the name in
/// its own language, and a lime check on the one selected.
class LanguageOptions extends StatelessWidget {
  const LanguageOptions({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final String? selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final code in kEntryLanguages) ...[
          _LanguageRow(
            code: code,
            name: kEntryLanguageNames[code]!,
            selected: code == selected,
            onTap: () => onSelected(code),
          ),
          if (code != kEntryLanguages.last) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _LanguageRow extends StatelessWidget {
  const _LanguageRow({
    required this.code,
    required this.name,
    required this.selected,
    required this.onTap,
  });

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
        onTap: onTap,
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
                  ? const [
                      Color.fromRGBO(212, 233, 76, .16),
                      Color.fromRGBO(212, 233, 76, .06),
                    ]
                  : const [Color(0x17FFFFFF), Color(0x0AFFFFFF)],
            ),
            border: Border.all(
              color: selected ? SeoulColors.lime : const Color(0x24FFFFFF),
              width: selected ? 1.5 : 1,
            ),
          ),
          foregroundDecoration: const InsetEdgesDecoration(
            radius: _radius,
            top: Color(0x14FFFFFF),
            inset: 1,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected
                      ? SeoulColors.lime
                      : const Color.fromRGBO(255, 255, 255, .08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  code.toUpperCase(),
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
                    fontFamilyFallback: [
                      SeoulType.korean,
                      ...SeoulType.fallback,
                    ],
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
                child: const Icon(
                  Icons.check_circle_rounded,
                  size: 22,
                  color: SeoulColors.lime,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

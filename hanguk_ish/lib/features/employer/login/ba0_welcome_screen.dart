import 'package:flutter/material.dart';

import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/brand.dart';
import '../../../design/widgets/buttons.dart';
import '../../worker/settings/app_language.dart';

/// The first screen of a first launch: the owner chooses the app's language
/// before anything else. Every language is shown in its own name, so the
/// question is understood whichever one the person reads.
class Ba0WelcomeScreen extends StatelessWidget {
  const Ba0WelcomeScreen({super.key, required this.selected, required this.onSelect, required this.onNext});

  final AppLanguage selected;
  final ValueChanged<AppLanguage> onSelect;
  final VoidCallback onNext;

  static const _next = {'ko': '다음', 'uz': 'Davom etish', 'ru': 'Далее', 'en': 'Continue'};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.entry,
        watermark: '사장님',
        watermarkSize: 150,
        child: Padding(
          padding: EdgeInsets.fromLTRB(22, HiInsets.top(context, 96), 22, HiInsets.bottom(context, 30)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(alignment: Alignment.centerLeft, child: HiBrandTile(employer: true)),
              const SizedBox(height: 28),
              Semantics(
                header: true,
                child: HiText(
                  '언어 · Til · Язык · Language',
                  style: hiStyle(22, FontWeight.w800, height: 1.3, color: HiColors.white),
                ),
              ),
              const SizedBox(height: 18),
              for (final language in AppLanguage.values) ...[
                _LanguageRow(
                  language: language,
                  selected: language == selected,
                  onTap: () => onSelect(language),
                ),
                const SizedBox(height: 10),
              ],
              const Spacer(),
              HiButton(label: _next[selected.code]!, height: 56, fontSize: 18, onPressed: onNext),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageRow extends StatelessWidget {
  const _LanguageRow({required this.language, required this.selected, required this.onTap});

  final AppLanguage language;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: language.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            color: selected ? HiColors.lime : HiColors.white07,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Expanded(
                child: ExcludeSemantics(
                  child: HiText(
                    language.label,
                    style: hiStyle(18, FontWeight.w700, color: selected ? HiColors.onLime : HiColors.white),
                  ),
                ),
              ),
              if (selected) const Icon(Icons.check_rounded, color: HiColors.onLime),
            ],
          ),
        ),
      ),
    );
  }
}

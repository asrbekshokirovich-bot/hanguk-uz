import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/shift_repository.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/brand.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/controls.dart';
import '../../../design/widgets/layout.dart';
import '../../../design/widgets/link_text.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../settings/app_language.dart';

/// The sentence for a failed «Boshlash».
String signInErrorText(WorkerL10n l10n, Object error) => switch (error) {
      ShiftActionException(code: 'TOO_MANY_REQUESTS') => l10n.errTooManyRequests,
      OfflineException() => l10n.errOffline,
      _ => l10n.errorGeneric,
    };

/// A01 «Kirish»: app language, terms consent and «Boshlash». Since P49 there
/// is no phone number and no SMS code: «Boshlash» starts an account on this
/// phone (the prototype's «Telefon raqam bilan» / «Telegram bilan» are gone).
class A01LoginScreen extends ConsumerStatefulWidget {
  const A01LoginScreen({super.key, this.onStart, this.onTerms});

  /// «Boshlash»: signs in and goes on; the button waits while it runs.
  final Future<void> Function()? onStart;

  /// The "Foydalanish shartlari" link.
  final VoidCallback? onTerms;

  @override
  ConsumerState<A01LoginScreen> createState() => _A01LoginScreenState();
}

class _A01LoginScreenState extends ConsumerState<A01LoginScreen> {
  // The prototype shows the box ticked.
  bool _agreed = true;
  bool _starting = false;

  Future<void> _start() async {
    final start = widget.onStart;
    if (start == null || _starting) return;
    setState(() => _starting = true);
    try {
      await start();
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final language = ref.watch(appLanguageProvider);
    final canContinue = _agreed;

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.entry,
        watermark: '일',
        watermarkSize: 230,
        child: HiPinnedBottomLayout(
          top: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Header(l10n: l10n),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 40, 22, 0),
                child: _LanguageSection(
                  title: l10n.appLanguage,
                  selected: language,
                  onSelect: (value) =>
                      ref.read(appLanguageProvider.notifier).select(value),
                ),
              ),
            ],
          ),
          bottom: Padding(
            padding: EdgeInsets.fromLTRB(
              18,
              // Keeps the block clear of the language grid on short screens.
              24,
              22,
              HiInsets.bottom(context, 30),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _TermsRow(
                  agreed: _agreed,
                  prefix: l10n.termsPrefix,
                  link: l10n.termsLink,
                  suffix: l10n.termsSuffix,
                  onToggle: () => setState(() => _agreed = !_agreed),
                  onLink: widget.onTerms,
                ),
                const SizedBox(height: 12),
                HiButton(
                  label: l10n.start,
                  onPressed: canContinue && !_starting ? _start : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.l10n});

  final WorkerL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 96), 22, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const HiBrandTile(),
          // 14 px column gap + 6 px top margin of the heading.
          const SizedBox(height: 20),
          Semantics(
            header: true,
            child: HiText(
              l10n.appTitle,
              style: hiStyle(
                34,
                FontWeight.w800,
                height: 1.1,
                letterSpacingEm: -0.02,
                color: HiColors.white,
              ),
            ),
          ),
          const SizedBox(height: 14),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: HiText(
              l10n.appTagline,
              style: hiStyle(
                16,
                FontWeight.w500,
                height: 1.45,
                color: HiColors.textSoft,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LanguageSection extends StatelessWidget {
  const _LanguageSection({
    required this.title,
    required this.selected,
    required this.onSelect,
  });

  final String title;
  final AppLanguage selected;
  final ValueChanged<AppLanguage> onSelect;

  @override
  Widget build(BuildContext context) {
    Widget tile(AppLanguage language) => Expanded(
          child: HiOptionTile(
            label: language.label,
            selected: language == selected,
            family:
                language == AppLanguage.ko ? HiFamily.korean : HiFamily.inter,
            onTap: () => onSelect(language),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: HiText(
            title,
            style: hiStyle(15, FontWeight.w700, color: HiColors.textMuted),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            tile(AppLanguage.uz),
            const SizedBox(width: 12),
            tile(AppLanguage.ru),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            tile(AppLanguage.en),
            const SizedBox(width: 12),
            tile(AppLanguage.ko),
          ],
        ),
      ],
    );
  }
}

class _TermsRow extends StatelessWidget {
  const _TermsRow({
    required this.agreed,
    required this.prefix,
    required this.link,
    required this.suffix,
    required this.onToggle,
    required this.onLink,
  });

  final bool agreed;
  final String prefix;
  final String link;
  final String suffix;
  final VoidCallback onToggle;
  final VoidCallback? onLink;

  @override
  Widget build(BuildContext context) {
    final base = hiStyle(
      15,
      FontWeight.w500,
      height: 1.4,
      color: HiColors.textSoft,
    );
    final linkStyle = base.copyWith(
      color: HiColors.white,
      fontWeight: FontWeight.w700,
    );
    return Semantics(
      checked: agreed,
      label: '$prefix$link$suffix'.trim(),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onToggle,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Row(
            children: [
              HiCheckbox(value: agreed),
              const SizedBox(width: 12),
              Expanded(
                child: HiLinkSentence(
                  prefix: prefix,
                  link: link,
                  suffix: suffix,
                  style: base,
                  linkStyle: linkStyle,
                  onLink: onLink ?? () {},
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

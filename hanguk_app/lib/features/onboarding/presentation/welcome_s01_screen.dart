import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../entry/data/entry_store.dart';
import '../data/quiz_controller.dart';
import '../onboarding_routes.dart';
import 's01_s04_ui.dart';

/// The S01 photo ("talaba Koreya kampusida"). Null until the owner sends the
/// real photo: the frame is then drawn empty, exactly sized. To ship the
/// photo, add the file under `assets/images/` and set this to its path.
const String? kWelcomePhotoAsset = null;

/// The languages offered on S01, in the design's order.
const List<String> _kWelcomeLanguages = ['uz', 'ru', 'en'];

/// S01 — Kirish ekrani.
class OnboardingWelcomeScreen extends ConsumerWidget {
  const OnboardingWelcomeScreen({super.key, this.operatorReplyMinutes});

  /// The trust row ("Operator javobi ≤N daqiqa"). The spec allows only a
  /// real figure here (last week's SLA median, when ≤10) and there is no
  /// source for it yet, so the row stays hidden while this is null.
  final int? operatorReplyMinutes;

  void _startQuiz(BuildContext context, WidgetRef ref) {
    ref.read(quizProvider.notifier).restart();
    context.go(kQuizPath);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final language =
        ref.watch(entryProvider.select((s) => s.languageCode)) ??
        Localizations.localeOf(context).languageCode;
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: OnbBackground(
        child: OnbFillScroll(
          padding: EdgeInsets.fromLTRB(
            20,
            top + 12,
            20,
            bottom > 28 ? bottom : 28,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const _BrandMark(),
                  const SizedBox(width: 10),
                  Text(
                    'Hanguk',
                    style: onbText(18, FontWeight.w800, letterSpacingEm: -.02),
                  ),
                  const Spacer(),
                  _LanguageSwitch(
                    selected: language,
                    onSelect: (code) =>
                        ref.read(entryProvider.notifier).setLanguage(code),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const _Photo(),
              const SizedBox(height: 18),
              Text(
                '유학 진단',
                style: onbHangul(letterSpacingEm: .04),
              ),
              const SizedBox(height: 10),
              Text(
                l.onbWelcomeTitle,
                style: onbText(
                  27,
                  FontWeight.w800,
                  height: 1.15,
                  letterSpacingEm: -.02,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                l.onbWelcomeBody,
                style: onbText(
                  15,
                  FontWeight.w400,
                  height: 1.5,
                  color: OnbColors.text64,
                ),
              ),
              const SizedBox(height: 18),
              const Spacer(),
              const SizedBox(height: 18),
              OnbPrimaryButton(
                label: l.onbWelcomeCta,
                onPressed: () => _startQuiz(context, ref),
              ),
              const SizedBox(height: 10),
              OnbOutlineButton(
                label: l.onbWelcomeCatalog,
                onPressed: () => context.push('/guest'),
              ),
              if (operatorReplyMinutes != null) ...[
                const SizedBox(height: 18),
                _TrustRow(
                  label: l.onbWelcomeTrustReply,
                  value: l.onbWelcomeTrustReplyValue('$operatorReplyMinutes'),
                ),
              ],
              const SizedBox(height: 18),
              Center(
                child: OnbTap(
                  label: l.onbWelcomeClientCode,
                  onTap: () =>
                      context.push('/login', extra: {'magic_code': true}),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    child: Text(
                      l.onbWelcomeClientCode,
                      style: onbText(
                        14,
                        FontWeight.w600,
                        color: OnbColors.lime,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 40×40 tile, radius 12, #1E4078, lime .35 hairline, 한 19px 700 lime.
class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFF1E4078),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color.fromRGBO(212, 233, 76, .35)),
      ),
      child: const Text(
        '한',
        style: TextStyle(
          fontFamily: SeoulType.korean,
          fontFamilyFallback: [SeoulType.inter],
          fontSize: 19,
          fontWeight: FontWeight.w700,
          color: OnbColors.lime,
          height: 1.0,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

class _LanguageSwitch extends StatelessWidget {
  const _LanguageSwitch({required this.selected, required this.onSelect});

  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color.fromRGBO(255, 255, 255, .08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: OnbColors.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final code in _kWelcomeLanguages) ...[
            if (code != _kWelcomeLanguages.first) const SizedBox(width: 2),
            OnbTap(
              label: kEntryLanguageNames[code],
              selected: code == selected,
              onTap: () => onSelect(code),
              child: Container(
                height: 30,
                constraints: const BoxConstraints(minWidth: 38),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: code == selected ? OnbColors.lime : null,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  code,
                  style: onbText(
                    13,
                    code == selected ? FontWeight.w700 : FontWeight.w600,
                    color: code == selected ? OnbColors.ink : OnbColors.text64,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 220px, radius 22, 1px rgba(255,255,255,.16), clipped. Empty, it keeps the
/// design's empty-frame fill and nothing else.
class _Photo extends StatelessWidget {
  const _Photo();

  @override
  Widget build(BuildContext context) {
    const asset = kWelcomePhotoAsset;
    return Container(
      height: 220,
      foregroundDecoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: OnbColors.line),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: asset == null
            ? const ColoredBox(color: Color.fromRGBO(127, 127, 127, .08))
            : Image.asset(asset, fit: BoxFit.cover, width: double.infinity),
      ),
    );
  }
}

/// radius 16, rgba(255,255,255,.07), 1px .16, padding 12 14.
class _TrustRow extends StatelessWidget {
  const _TrustRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color.fromRGBO(255, 255, 255, .07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: OnbColors.line),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: onbText(12, FontWeight.w400, color: OnbColors.text64)),
          // ≤ comes from a fallback font; the strut keeps Inter's line box.
          Text(
            value,
            style: onbText(16, FontWeight.w700),
            strutStyle: const StrutStyle(
              fontFamily: SeoulType.inter,
              fontSize: 16,
              height: kCssNormalLineHeight,
              leadingDistribution: TextLeadingDistribution.even,
              forceStrutHeight: true,
            ),
          ),
        ],
      ),
    );
  }
}

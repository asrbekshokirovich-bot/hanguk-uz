import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../entry/data/entry_store.dart';
import '../data/quiz_controller.dart';
import '../onboarding_routes.dart';
import 's01_s04_ui.dart';

/// The S01 photos, shown one after another in the photo frame — the owner's
/// "Ilova landing rasmlari" with more than 10 people in them, each once, in
/// the list's order. Empty, the frame is drawn empty, exactly sized.
const List<String> kWelcomePhotoAssets = [
  'assets/images/landing/01_hero_daegu-haany_2025-09-14.jpg',
  'assets/images/landing/02_hero-mobil_zal_2025-09-14.jpg',
  'assets/images/landing/03_guruh_daegu-haany_2025-09-13.jpg',
  'assets/images/landing/07_katta-zal_2025-01-17.jpg',
  'assets/images/landing/08_koreys-mehmonlar_2024-10-20.jpg',
  'assets/images/landing/10_guruh_seoyeong_2025-10-20.jpg',
  'assets/images/landing/11_tinglovchilar_2025-09-13.jpg',
  'assets/images/landing/15_guruh_2025-01-16.jpg',
  'assets/images/landing/Z02_zaxira_guruh-tinch_2025-09-13.jpg',
  'assets/images/landing/Z07_zaxira_kichik-guruh_2025-09-14.jpg',
  'assets/images/landing/Z08_zaxira_katta-zal-tik_2025-01-17.jpg',
  'assets/images/landing/Z10_zaxira_guruh_2024-09-29.jpg',
];

/// How long each S01 photo stays before the next one.
const Duration kWelcomePhotoInterval = Duration(seconds: 4);

/// The languages offered on S01, in the design's order.
const List<String> _kWelcomeLanguages = ['uz', 'ru', 'en'];

/// S01 — Kirish ekrani.
class OnboardingWelcomeScreen extends ConsumerWidget {
  const OnboardingWelcomeScreen({super.key, this.operatorReplyMinutes = 10});

  /// The trust row ("Operator javobi ≤N daqiqa"): the same 10-minute promise
  /// the result and the contact sheet make. Hidden when null.
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
/// design's empty-frame fill and nothing else; otherwise it shows
/// [kWelcomePhotoAssets] in turn, cross-fading every [kWelcomePhotoInterval].
class _Photo extends StatefulWidget {
  const _Photo();

  @override
  State<_Photo> createState() => _PhotoState();
}

class _PhotoState extends State<_Photo> {
  int _index = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (kWelcomePhotoAssets.length > 1) {
      _timer = Timer.periodic(kWelcomePhotoInterval, (_) {
        setState(() => _index = (_index + 1) % kWelcomePhotoAssets.length);
        _precacheNext();
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _precacheNext();
  }

  /// Decodes the next photo ahead of time, so the fade never shows a gap.
  void _precacheNext() {
    if (kWelcomePhotoAssets.length < 2) return;
    final next = kWelcomePhotoAssets[(_index + 1) % kWelcomePhotoAssets.length];
    precacheImage(AssetImage(next), context);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 220,
      foregroundDecoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: OnbColors.line),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: kWelcomePhotoAssets.isEmpty
            ? const ColoredBox(color: Color.fromRGBO(127, 127, 127, .08))
            : AnimatedSwitcher(
                duration: const Duration(milliseconds: 600),
                layoutBuilder: (current, previous) => Stack(
                  fit: StackFit.expand,
                  children: [...previous, ?current],
                ),
                child: Image.asset(
                  kWelcomePhotoAssets[_index],
                  key: ValueKey(_index),
                  fit: BoxFit.cover,
                  // Most photos are portrait: keep the faces, crop the floor.
                  alignment: const Alignment(0, -.4),
                  width: double.infinity,
                  height: 220,
                  gaplessPlayback: true,
                ),
              ),
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
              height: 20 / 16,
              leadingDistribution: TextLeadingDistribution.even,
              forceStrutHeight: true,
            ),
          ),
        ],
      ),
    );
  }
}

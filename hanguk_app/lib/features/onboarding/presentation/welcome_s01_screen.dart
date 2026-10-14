import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/svg_path_icon.dart';
import '../../../l10n/app_localizations.dart';
import '../../entry/data/entry_store.dart';
import '../data/quiz_controller.dart';
import '../onboarding_routes.dart';
import 'contact_sheet_s04.dart' show contactSheetClockProvider, isTashkentWorkingHours;
import 's01_s04_ui.dart';

/// The S01 photos, shown on the card deck one after another — the owner's
/// "Ilova landing rasmlari" with more than 10 people in them, each once, in
/// the list's order. Empty, the cards are drawn empty, exactly sized.
const List<String> kWelcomePhotoAssets = [
  'assets/images/landing/01_hero_daegu-haany_2025-09-14.jpg',
  'assets/images/landing/02_hero-mobil_zal_2025-09-14.jpg',
  'assets/images/landing/07_katta-zal_2025-01-17.jpg',
  'assets/images/landing/08_koreys-mehmonlar_2024-10-20.jpg',
  'assets/images/landing/10_guruh_seoyeong_2025-10-20.jpg',
  'assets/images/landing/11_tinglovchilar_2025-09-13.jpg',
  'assets/images/landing/Z02_zaxira_guruh-tinch_2025-09-13.jpg',
  'assets/images/landing/Z07_zaxira_kichik-guruh_2025-09-14.jpg',
  'assets/images/landing/Z08_zaxira_katta-zal-tik_2025-01-17.jpg',
  'assets/images/landing/Z10_zaxira_guruh_2024-09-29.jpg',
];

/// How long each card stays on top of the deck before it flies off.
const Duration kWelcomePhotoInterval = Duration(milliseconds: 4500);

/// The languages offered on S01, in the design's order.
const List<String> _kWelcomeLanguages = ['uz', 'ru', 'en'];

/// S01 — Kirish ekrani.
class OnboardingWelcomeScreen extends ConsumerWidget {
  const OnboardingWelcomeScreen({super.key, this.operatorReplyMinutes = 10});

  /// The call-back promise over the main button ("10 daqiqada operatorimiz
  /// bog'lanadi", with a countdown from that many minutes) — shown during
  /// working hours only. Hidden when null.
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
        angleDeg: 160,
        stops: const [0, .4, .7, 1],
        child: OnbFillScroll(
          padding: EdgeInsets.fromLTRB(0, top + 12, 0, bottom > 22 ? bottom : 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    const _BrandMark(),
                    const SizedBox(width: 10),
                    Text('Hanguk', style: onbText(19, FontWeight.w800, letterSpacingEm: -.02)),
                    const Spacer(),
                    _LanguageSwitch(
                      selected: language,
                      onSelect: (code) => ref.read(entryProvider.notifier).setLanguage(code),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              const _PhotoDeck(),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '유학 진단',
                      style: onbHangul(
                        letterSpacingEm: .04,
                      ).copyWith(fontSize: 13, letterSpacing: .04 * 13),
                    ),
                    const SizedBox(height: 8),
                    _Title(l.onbWelcomeTitle),
                    const SizedBox(height: 8),
                    Text(
                      l.onbWelcomeBody,
                      style: onbText(
                        15,
                        FontWeight.w400,
                        height: 1.45,
                        color: const Color.fromRGBO(255, 255, 255, .74),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _StartBlock(
                      label: l.onbWelcomeCta,
                      minutes: operatorReplyMinutes,
                      onPressed: () => _startQuiz(context, ref),
                    ),
                    const SizedBox(height: 8),
                    OnbTap(
                      label: l.onbWelcomeCatalog,
                      onTap: () => context.push('/guest'),
                      child: Container(
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: OnbColors.line30),
                        ),
                        child: Text(
                          l.onbWelcomeCatalog,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: onbText(16, FontWeight.w600),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    OnbTap(
                      label: l.onbWelcomeClientCode,
                      onTap: () => context.push('/login', extra: {'magic_code': true}),
                      child: SizedBox(
                        height: 44,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SvgPathIcon(
                              paths: [
                                'm15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4',
                                'm21 2-9.6 9.6',
                              ],
                              circles: [(7.5, 15.5, 5.5)],
                              size: 16,
                              color: OnbColors.lime,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              l.onbWelcomeClientCode,
                              style: onbText(15, FontWeight.w600, color: OnbColors.lime),
                            ),
                          ],
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
    );
  }
}

/// 28/1.1 800, -0.03em. The part of [text] between square brackets is lime
/// ("Visangiz chiqish ehtimolini [2 daqiqada] bilib oling").
class _Title extends StatelessWidget {
  const _Title(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final style = onbText(28, FontWeight.w800, height: 1.1, letterSpacingEm: -.03);
    final m = RegExp(r'^(.*?)\[(.*?)\](.*)$', dotAll: true).firstMatch(text);
    if (m == null) return Text(text, style: style);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: m.group(1)),
          TextSpan(
            text: m.group(2),
            style: const TextStyle(color: OnbColors.lime),
          ),
          TextSpan(text: m.group(3)),
        ],
      ),
      style: style,
    );
  }
}

/// 40×40 tile, radius 12, rgba(255,255,255,.12), 1px .16, 한 20px 800 lime.
class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color.fromRGBO(255, 255, 255, .12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color.fromRGBO(255, 255, 255, .16)),
      ),
      child: const Text(
        '한',
        style: TextStyle(
          fontFamily: SeoulType.korean,
          fontFamilyFallback: [SeoulType.inter],
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: OnbColors.lime,
          height: 1.0,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

/// padding 4, gap 2, rgba(255,255,255,.08), 1px .14; items min 38×30,
/// 13px 700, the chosen one lime on ink, the others white .7.
class _LanguageSwitch extends StatelessWidget {
  const _LanguageSwitch({required this.selected, required this.onSelect});

  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color.fromRGBO(255, 255, 255, .08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color.fromRGBO(255, 255, 255, .14)),
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
                padding: const EdgeInsets.symmetric(horizontal: 6),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: code == selected ? OnbColors.lime : null,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  code,
                  style: onbText(
                    13,
                    FontWeight.w700,
                    color: code == selected
                        ? OnbColors.ink
                        : const Color.fromRGBO(255, 255, 255, .7),
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

/// A card's place on the deck: (dx, dy) px, rotation in degrees, scale,
/// opacity and paint order — the design's four positions.
typedef _DeckSpot = ({double dx, double dy, double deg, double scale, double opacity, int z});

const _DeckSpot _kFront = (dx: 0, dy: 0, deg: -3, scale: 1, opacity: 1, z: 4);
const _DeckSpot _kSecond = (dx: 22, dy: -10, deg: 5, scale: .94, opacity: 1, z: 3);
const _DeckSpot _kThird = (dx: -18, dy: -16, deg: -9, scale: .88, opacity: .85, z: 2);
const _DeckSpot _kHidden = (dx: -18, dy: -16, deg: -9, scale: .88, opacity: 0, z: 1);

/// Off to the left: translate(-150%, 40px) rotate(-24deg) scale(.96), faded.
const _DeckSpot _kGone = (dx: -1.5 * _kCardWidth, dy: 40, deg: -24, scale: .96, opacity: 0, z: 5);

const double _kCardWidth = 230;
const double _kCardHeight = 240;

/// The photo deck: 262px tall, cards 230×240 at left 65 / top 16 of the
/// design's 370px-wide screen, i.e. 120px left of the centre. Every
/// [kWelcomePhotoInterval] the top card flies off to the left and the next
/// one comes forward; a tap does the same at once.
class _PhotoDeck extends StatefulWidget {
  const _PhotoDeck();

  @override
  State<_PhotoDeck> createState() => _PhotoDeckState();
}

class _PhotoDeckState extends State<_PhotoDeck> {
  int _index = 0;
  Timer? _timer;

  int get _count => kWelcomePhotoAssets.isEmpty ? 4 : kWelcomePhotoAssets.length;

  @override
  void initState() {
    super.initState();
    _arm();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _precache();
  }

  void _arm() {
    _timer?.cancel();
    _timer = Timer(kWelcomePhotoInterval, _next);
  }

  void _next() {
    if (!mounted) return;
    setState(() => _index = (_index + 1) % _count);
    _precache();
    _arm();
  }

  /// Decodes the cards about to come forward, so none shows up blank.
  void _precache() {
    if (kWelcomePhotoAssets.isEmpty) return;
    for (var k = 1; k <= 3; k++) {
      precacheImage(AssetImage(kWelcomePhotoAssets[(_index + k) % _count]), context);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  _DeckSpot _spot(int k) {
    final rel = (k - _index) % _count;
    if (rel == 0) return _kFront;
    if (rel == 1) return _kSecond;
    if (rel == 2) return _kThird;
    if (rel == _count - 1) return _kGone;
    return _kHidden;
  }

  @override
  Widget build(BuildContext context) {
    final left = MediaQuery.sizeOf(context).width / 2 - 120;
    final cards = [for (var k = 0; k < _count; k++) (k, _spot(k))]
      ..sort((a, b) => a.$2.z.compareTo(b.$2.z));
    return SizedBox(
      height: 262,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (final (k, spot) in cards)
            Positioned(
              key: ValueKey(k),
              left: left,
              top: 16,
              width: _kCardWidth,
              height: _kCardHeight,
              child: _DeckCard(
                spot: spot,
                asset: kWelcomePhotoAssets.isEmpty ? null : kWelcomePhotoAssets[k],
                onTap: _next,
              ),
            ),
        ],
      ),
    );
  }
}

/// One card: radius 22, 4px white border, #132A4D, shadow 0 18 40 .4, the
/// photo filling it. Moves with transform .75s cubic-bezier(.2,.8,.2,1) and
/// opacity .5s ease.
class _DeckCard extends StatelessWidget {
  const _DeckCard({required this.spot, required this.asset, required this.onTap});

  final _DeckSpot spot;
  final String? asset;
  final VoidCallback onTap;

  static const _move = Duration(milliseconds: 750);
  static const _curve = Cubic(.2, .8, .2, 1);

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      offset: Offset(spot.dx / _kCardWidth, spot.dy / _kCardHeight),
      duration: _move,
      curve: _curve,
      child: AnimatedRotation(
        turns: spot.deg / 360,
        duration: _move,
        curve: _curve,
        child: AnimatedScale(
          scale: spot.scale,
          duration: _move,
          curve: _curve,
          child: AnimatedOpacity(
            opacity: spot.opacity,
            duration: const Duration(milliseconds: 500),
            curve: Curves.ease,
            child: GestureDetector(
              onTap: onTap,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF132A4D),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Colors.white, width: 4),
                  boxShadow: const [
                    BoxShadow(
                      color: Color.fromRGBO(0, 0, 0, .4),
                      offset: Offset(0, 18),
                      blurRadius: 40,
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: asset == null
                      ? const SizedBox.expand()
                      : Image.asset(
                          asset!,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          gaplessPlayback: true,
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

/// The main button with the call-back promise above it: radius 20,
/// rgba(212,233,76,.12), 1px lime .4, clipped. During working hours a row
/// (stopwatch, "10 daqiqada operatorimiz bog'lanadi", a mm:ss countdown from
/// [minutes] that starts over at zero) and a 3px bar that empties with it;
/// then the 56px lime button.
class _StartBlock extends ConsumerStatefulWidget {
  const _StartBlock({required this.label, required this.minutes, required this.onPressed});

  final String label;
  final int? minutes;
  final VoidCallback onPressed;

  @override
  ConsumerState<_StartBlock> createState() => _StartBlockState();
}

class _StartBlockState extends ConsumerState<_StartBlock> {
  late final int _total = (widget.minutes ?? 10) * 60;
  late int _sec = _total;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _sec = _sec <= 1 ? _total : _sec - 1);
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final open =
        widget.minutes != null && isTashkentWorkingHours(ref.watch(contactSheetClockProvider)());
    final clock =
        '${(_sec ~/ 60).toString().padLeft(2, '0')}:${(_sec % 60).toString().padLeft(2, '0')}';
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color.fromRGBO(212, 233, 76, .12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color.fromRGBO(212, 233, 76, .4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (open) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              child: Row(
                children: [
                  const SvgPathIcon(
                    paths: ['M10 2h4', 'M12 14l3-3'],
                    circles: [(12, 14, 8)],
                    size: 20,
                    color: OnbColors.lime,
                    strokeWidth: 2.2,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l.onbWelcomeCallTimer('${widget.minutes}'),
                      style: onbText(14, FontWeight.w700, height: 1.3),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    clock,
                    style: const TextStyle(
                      fontFamily: SeoulType.mono,
                      // The bundled mono subset has digits only; ':' from Inter.
                      fontFamilyFallback: [SeoulType.inter],
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: OnbColors.lime,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
            Container(
              height: 3,
              color: const Color.fromRGBO(255, 255, 255, .1),
              alignment: Alignment.centerLeft,
              child: TweenAnimationBuilder<double>(
                tween: Tween(end: _sec / _total),
                duration: const Duration(seconds: 1),
                builder: (context, v, _) => FractionallySizedBox(
                  widthFactor: v.clamp(0, 1),
                  heightFactor: 1,
                  child: const ColoredBox(color: OnbColors.lime),
                ),
              ),
            ),
          ],
          OnbTap(
            label: widget.label,
            onTap: widget.onPressed,
            child: Container(
              height: 56,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: OnbColors.lime,
                boxShadow: [
                  BoxShadow(
                    color: Color.fromRGBO(212, 233, 76, .28),
                    offset: Offset(0, 8),
                    blurRadius: 28,
                  ),
                ],
              ),
              child: Text(
                widget.label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: onbText(17, FontWeight.w700, color: OnbColors.ink),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

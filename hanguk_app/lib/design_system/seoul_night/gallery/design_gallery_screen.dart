import 'package:flutter/material.dart';

import '../seoul_night.dart';

/// Visual QA surface for the Seoul Night design system.
///
/// Renders every token and every widget in one scroll so a change to
/// `lib/design_system/seoul_night/` can be compared side by side against
/// `Hanguk Seoul Night App v2.dc.html`. Nothing here is product UI — it
/// is deliberately dense and unstyled beyond the system itself.
///
/// Reachable at `/dev/design-gallery` when `kDesignGalleryEnabled`
/// (debug and profile builds, or `--dart-define=DESIGN_GALLERY=true`).
///
/// When adding a widget to the system, add it here in the same PR. A
/// component with no gallery entry is a component nobody will notice
/// breaking.
class DesignGalleryScreen extends StatefulWidget {
  const DesignGalleryScreen({super.key});

  @override
  State<DesignGalleryScreen> createState() => _DesignGalleryScreenState();
}

class _DesignGalleryScreenState extends State<DesignGalleryScreen> {
  // Live state so the interactive widgets can actually be exercised
  // rather than shown in a single frozen pose.
  double _progress = 0.57;
  String _city = 'Seoul';
  final Set<String> _faculties = {'CS'};
  bool _themeApplied = true;

  static const _cities = ['All', 'Seoul', 'Daejeon', 'Busan'];
  static const _facultyOptions = ['Engineering', 'CS', 'Business', 'Medicine'];

  @override
  Widget build(BuildContext context) {
    // The gallery wraps itself in the Seoul Night theme so it renders
    // correctly while `main.dart` is still on `AppTheme.materialTheme`.
    // Toggle it off to see what a screen looks like when someone forgets
    // to migrate the theme — a genuinely useful diff to have on hand.
    final body = _buildBody(context);

    return SeoulNightScaffold(
      body: _themeApplied
          ? Theme(data: SeoulNightTheme.theme, child: body)
          : body,
    );
  }

  Widget _buildBody(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _header(context)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 48),
          sliver: SliverList.list(
            children: [
              _section('Colours', '색상'),
              _colourGrid(),
              _section('Gradients', '그라데이션'),
              _gradientStrip(),
              _section('Type scale', '서체'),
              _typeSpecimens(),
              _section('Radii & shadows', '모서리'),
              _radiiRow(),
              _section('Glass card', '유리 카드'),
              _glassCards(),
              _section('Hero card', '히어로'),
              _heroCards(),
              _section('Buttons', '버튼'),
              _buttons(),
              _section('Hangul tags & tiles', '한글 태그'),
              _hangulSamples(),
              _section('Status chips', '상태'),
              _statusChips(),
              _section('Filter chips', '필터'),
              _filterChips(),
              _section('Progress', '진행'),
              _progressSamples(),
              _section('Motion', '모션'),
              _motionNotes(),
            ],
          ),
        ),
      ],
    );
  }

  // ------------------------------------------------------------- header
  Widget _header(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const HangulGlyphTile(glyph: '한', size: 44, active: true),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'DESIGN GALLERY',
                      style: SnType.captionSmall.copyWith(
                        letterSpacing: 1.6,
                        color: SnColors.textFaint,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const HangulTag(
                      title: 'Seoul Night',
                      hangul: '서울의 밤',
                      axis: Axis.horizontal,
                    ),
                  ],
                ),
              ),
              SnFilterChip(
                label: 'Theme',
                selected: _themeApplied,
                onTap: () => setState(() => _themeApplied = !_themeApplied),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Every token and widget in lib/design_system/seoul_night/. '
            'Compare against Hanguk Seoul Night App v2.dc.html.',
            style: SnType.bodySmall,
          ),
        ],
      ),
    );
  }

  Widget _section(String title, String hangul) => Padding(
    padding: const EdgeInsets.only(top: 28, bottom: 12),
    child: HangulTag(title: title, hangul: hangul),
  );

  // ------------------------------------------------------------ colours
  Widget _colourGrid() {
    const swatches = <(String, Color)>[
      ('royalBlue', SnColors.royalBlue),
      ('lime', SnColors.lime),
      ('limeBright', SnColors.limeBright),
      ('limePressed', SnColors.limePressed),
      ('ink', SnColors.ink),
      ('glass', SnColors.glass),
      ('glassBorder', SnColors.glassBorder),
      ('heroBorder', SnColors.heroBorder),
      ('textPrimary', SnColors.textPrimary),
      ('textSecondary', SnColors.textSecondary),
      ('textFaint', SnColors.textFaint),
      ('warning', SnColors.warning),
      ('warningText', SnColors.warningText),
      ('info', SnColors.info),
      ('infoText', SnColors.infoText),
      ('danger', SnColors.danger),
      ('mapCanvas', SnColors.mapCanvas),
      ('mapLand', SnColors.mapLand),
      ('bgStop0', SnColors.bgStop0),
      ('bgStop3', SnColors.bgStop3),
    ];

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final (name, colour) in swatches)
          SizedBox(
            width: 96,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: colour,
                    borderRadius: SnRadii.controlR,
                    border: Border.all(color: SnColors.glassBorder),
                  ),
                ),
                const SizedBox(height: 4),
                Text(name, style: SnType.captionSmall),
                Text(
                  '#${(colour.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}'
                  ' · ${(colour.a * 100).round()}%',
                  style: SnType.captionSmall.copyWith(
                    color: SnColors.textFaint,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _gradientStrip() {
    const gradients = <(String, Gradient)>[
      ('appBackground', SnGradients.appBackground),
      ('heroCard', SnGradients.heroCard),
      ('limeButton', SnGradients.limeButton),
      ('glassTile', SnGradients.glassTile),
      ('navyTile', SnGradients.navyTile),
      ('progressFill', SnGradients.progressFill),
    ];

    return Column(
      children: [
        for (final (name, gradient) in gradients)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 108,
                  child: Text(name, style: SnType.captionSmall),
                ),
                Expanded(
                  child: Container(
                    height: 32,
                    decoration: BoxDecoration(
                      gradient: gradient,
                      borderRadius: SnRadii.buttonR,
                      border: Border.all(color: SnColors.glassBorder),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  // --------------------------------------------------------------- type
  Widget _typeSpecimens() {
    final specimens = <(String, TextStyle, String)>[
      ('display 40/900', SnType.display, 'Find Your University'),
      ('headline 32/800', SnType.headline, 'Your Journey'),
      ('titleLarge 23/800', SnType.titleLarge, 'Step 4 of 7'),
      ('title 18/800', SnType.title, 'Seoul National University'),
      ('sectionTitle 16/800', SnType.sectionTitle, 'Applications'),
      ('body 15/500', SnType.body, 'Submit your documents before the deadline.'),
      ('bodySmall 14/500', SnType.bodySmall, 'Seoul · Rank 1 · ₩4.2M / term'),
      ('label 14/700', SnType.label, 'Continue Journey'),
      ('caption 12/600', SnType.caption, '38 universities · 24 open'),
      ('captionSmall 11/600', SnType.captionSmall, 'Open now'),
      ('hangulLabel 11/700', SnType.hangulLabel, '지원 현황'),
      ('magicCode 22/600 mono', SnType.magicCode, 'HG7K2M9Q'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (name, style, sample) in specimens)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: SnType.captionSmall.copyWith(
                    color: SnColors.textFaint,
                  ),
                ),
                const SizedBox(height: 2),
                Text(sample, style: style, maxLines: 2),
              ],
            ),
          ),
        // Weight ramp proves the variable-font `wght` axis is wired up.
        // If this renders as six identical lines, `fontVariations` is
        // missing somewhere — see the note in sn_typography.dart.
        Text(
          'Inter weight axis',
          style: SnType.captionSmall.copyWith(color: SnColors.textFaint),
        ),
        const SizedBox(height: 4),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: [
            for (final w in [400, 500, 600, 700, 800, 900])
              Text('$w Aa', style: SnType.inter(size: 20, weight: w)),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          'Noto Sans KR weight axis',
          style: SnType.captionSmall.copyWith(color: SnColors.textFaint),
        ),
        const SizedBox(height: 4),
        Wrap(
          spacing: 12,
          children: [
            for (final w in [500, 700, 900])
              Text(
                '$w 한국',
                style: SnType.hangul(
                  size: 20,
                  weight: w,
                  color: SnColors.textPrimary,
                ),
              ),
          ],
        ),
      ],
    );
  }

  // -------------------------------------------------------------- radii
  Widget _radiiRow() {
    const radii = <(String, double)>[
      ('button 14', SnRadii.button),
      ('control 16', SnRadii.control),
      ('card 18', SnRadii.card),
      ('hero 22', SnRadii.hero),
      ('sheet 24', SnRadii.sheet),
    ];

    const shadows = <(String, List<BoxShadow>)>[
      ('card', SnShadows.card),
      ('cardTight', SnShadows.cardTight),
      ('hero', SnShadows.hero),
      ('limeGlow', SnShadows.limeGlow),
      ('orb', SnShadows.orb),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final (name, r) in radii)
              Column(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: SnColors.glass,
                      borderRadius: BorderRadius.circular(r),
                      border: Border.all(color: SnColors.glassBorder),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(name, style: SnType.captionSmall),
                ],
              ),
          ],
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 18,
          runSpacing: 18,
          children: [
            for (final (name, s) in shadows)
              Column(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: SnColors.bgStop1,
                      borderRadius: SnRadii.cardR,
                      boxShadow: s,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(name, style: SnType.captionSmall),
                ],
              ),
          ],
        ),
      ],
    );
  }

  // -------------------------------------------------------------- cards
  Widget _glassCards() {
    return Column(
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Default glass card', style: SnType.sectionTitle),
              const SizedBox(height: 6),
              Text(
                'blur 12 · radius 18 · rgba(255,255,255,0.07) fill · '
                '1px rgba(255,255,255,0.12) hairline.',
                style: SnType.bodySmall,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        GlassCard(
          onTap: () {},
          semanticLabel: 'Tappable glass card',
          child: Row(
            children: [
              const HangulGlyphTile(glyph: '서'),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Tappable · press me', style: SnType.sectionTitle),
                    const SizedBox(height: 2),
                    Text('scales to 0.97 on press', style: SnType.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        GlassCard(
          blur: 0,
          borderRadius: SnRadii.sheetR,
          child: Text(
            'blur: 0 · radius 24 — the list-row variant. Use inside long '
            'scrollers where a per-row BackdropFilter is too expensive.',
            style: SnType.bodySmall,
          ),
        ),
      ],
    );
  }

  Widget _heroCards() {
    return Column(
      children: [
        HeroCard(
          watermark: '한국',
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('YOUR JOURNEY', style: SnType.captionSmall),
                    const SizedBox(height: 4),
                    Text('Step 4 of 7', style: SnType.titleLarge),
                    const SizedBox(height: 10),
                    const StatusChip(
                      label: 'In Review',
                      tone: SnStatusTone.warning,
                    ),
                  ],
                ),
              ),
              ConicProgressRing(value: _progress, size: 88),
            ],
          ),
        ),
        const SizedBox(height: 12),
        HeroCard(
          showLimeGlow: false,
          child: Text(
            'showLimeGlow: false · no watermark — the quieter variant for '
            'screens that already carry a lot of lime.',
            style: SnType.bodySmall.copyWith(color: SnColors.textSecondary),
          ),
        ),
      ],
    );
  }

  // ------------------------------------------------------------ buttons
  Widget _buttons() {
    return Column(
      children: [
        LimeButton(label: 'I Have a Magic Code', onPressed: () {}),
        const SizedBox(height: 10),
        LimeButton(
          label: 'Apply with Hanguk',
          hangul: '가입',
          icon: Icons.arrow_forward_rounded,
          onPressed: () {},
        ),
        const SizedBox(height: 10),
        const LimeButton(label: 'Disabled — enter 8 characters'),
        const SizedBox(height: 10),
        SnOutlineButton(
          label: 'Explore Universities',
          hangul: '탐색',
          onPressed: () {},
        ),
        const SizedBox(height: 10),
        const SnOutlineButton(label: 'Disabled outline'),
        const SizedBox(height: 10),
        Row(
          children: [
            LimeButton(label: 'Inline', expand: false, onPressed: () {}),
            const SizedBox(width: 10),
            SnOutlineButton(label: 'Inline', expand: false, onPressed: () {}),
          ],
        ),
      ],
    );
  }

  // ------------------------------------------------------------- hangul
  Widget _hangulSamples() {
    const pairs = <(String, String)>[
      ('Applications', '지원 현황'),
      ('Map', '대학 지도'),
      ('Docs', '서류 목록'),
      ('Interview', '면접 연습'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (en, kr) in pairs)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: HangulTag(title: en, hangul: kr),
          ),
        const SizedBox(height: 4),
        const HangulTag(
          title: 'Stacked',
          hangul: '세로 배치',
          axis: Axis.vertical,
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final g in ['서', '연', '고', '한'])
              HangulGlyphTile(glyph: g),
            const HangulGlyphTile(glyph: '완', active: true),
            HangulGlyphTile(
              glyph: HangulGlyphTile.glyphOf('서울대학교'),
              size: 40,
            ),
          ],
        ),
      ],
    );
  }

  // -------------------------------------------------------------- chips
  Widget _statusChips() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: const [
        StatusChip(label: 'Submitted', tone: SnStatusTone.lime),
        StatusChip(label: 'In Review', tone: SnStatusTone.warning),
        StatusChip(label: 'Docs', tone: SnStatusTone.info),
        StatusChip(label: 'Locked', tone: SnStatusTone.neutral),
        StatusChip(label: 'Open', tone: SnStatusTone.lime, hangul: '모집 중'),
        StatusChip(label: 'Closed', tone: SnStatusTone.neutral, hangul: '마감'),
        StatusChip(label: 'Done', tone: SnStatusTone.lime, hangul: '완료'),
        StatusChip(label: 'Pending', tone: SnStatusTone.neutral, hangul: '대기'),
        StatusChip(label: 'Open now', tone: SnStatusTone.lime, dot: true),
        StatusChip(label: 'Closed', tone: SnStatusTone.neutral, dot: true),
      ],
    );
  }

  Widget _filterChips() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('City · 도시', style: SnType.captionSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final c in _cities)
              SnFilterChip(
                label: c,
                selected: _city == c,
                onTap: () => setState(() => _city = c),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Text('Faculty · 학부 (multi-select)', style: SnType.captionSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final f in _facultyOptions)
              SnFilterChip(
                label: f,
                selected: _faculties.contains(f),
                onTap: () => setState(() {
                  _faculties.contains(f)
                      ? _faculties.remove(f)
                      : _faculties.add(f);
                }),
              ),
          ],
        ),
        const SizedBox(height: 16),
        SnFilterChip(
          label: 'Compare',
          hangul: '비교',
          count: '1/2',
          selected: true,
          onTap: () {},
        ),
      ],
    );
  }

  // ----------------------------------------------------------- progress
  Widget _progressSamples() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            ConicProgressRing(value: _progress, size: 88),
            const SizedBox(width: 16),
            ConicProgressRing(
              value: 0.5,
              size: 64,
              strokeWidth: 6,
              showPercentLabel: false,
              child: Text('3/6', style: SnType.inter(size: 14, weight: 800)),
            ),
            const SizedBox(width: 16),
            const ConicProgressRing(value: 0, size: 48, strokeWidth: 5),
            const SizedBox(width: 16),
            const ConicProgressRing(value: 1, size: 48, strokeWidth: 5),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          'Drag to drive every progress widget at once',
          style: SnType.captionSmall,
        ),
        Slider(
          value: _progress,
          activeColor: SnColors.lime,
          inactiveColor: SnColors.glass,
          onChanged: (v) => setState(() => _progress = v),
        ),
        const SizedBox(height: 12),
        GlowProgressBar(value: _progress, semanticLabel: 'Sample progress'),
        const SizedBox(height: 12),
        GlowProgressBar(value: _progress, height: 10),
        const SizedBox(height: 12),
        GlowProgressBar(value: _progress, glow: false),
        const SizedBox(height: 20),
        Text('JourneySegmentBar · 7 steps', style: SnType.captionSmall),
        const SizedBox(height: 8),
        JourneySegmentBar(total: 7, completed: (_progress * 7).floor()),
      ],
    );
  }

  Widget _motionNotes() {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _motionRow('base', '${SnMotion.base.inMilliseconds}ms', 'fades'),
          _motionRow('press', '${SnMotion.press.inMilliseconds}ms', 'tap down'),
          _motionRow(
            'stagger',
            '${SnMotion.stagger.inMilliseconds}ms',
            'dial items',
          ),
          _motionRow('pulse', '${SnMotion.pulse.inMilliseconds}ms', 'orb glow'),
          _motionRow('springy', 'cubic(0.2, 0.9, 0.3, 1.2)', 'nav only'),
          _motionRow('ease', 'easeOut', 'everything else'),
          _motionRow('pressScale', '${SnMotion.pressScale}', 'tappables'),
        ],
      ),
    );
  }

  Widget _motionRow(String name, String value, String use) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        SizedBox(
          width: 92,
          child: Text(name, style: SnType.inter(size: 13, weight: 700)),
        ),
        SizedBox(
          width: 150,
          child: Text(
            value,
            style: SnType.mono(size: 11, letterSpacing: 0),
          ),
        ),
        Expanded(child: Text(use, style: SnType.captionSmall)),
      ],
    ),
  );
}

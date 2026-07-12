import 'package:flutter/material.dart';

import '../seoul_night.dart';

/// Dev-only visual QA gallery for the Seoul Night design system.
///
/// Renders every token (colours, radii, shadows, gradients, motion,
/// type) and every core widget so a reviewer can eyeball the design
/// language on a real device. Registered only when
/// `kDesignGalleryEnabled` is true — it is not part of the product flow
/// and touches no feature screens.
class SeoulNightGalleryScreen extends StatelessWidget {
  const SeoulNightGalleryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SeoulNightScaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const HangulTag(
          title: 'Seoul Night',
          korean: '디자인',
          layout: HangulTagLayout.inline,
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: const [
          _Section('Typography · 타입'),
          _TypographySample(),
          SizedBox(height: 24),
          _Section('Colours · 색상'),
          _ColorSwatches(),
          SizedBox(height: 24),
          _Section('Gradients · 그라디언트'),
          _GradientSwatches(),
          SizedBox(height: 24),
          _Section('Radii · 반경'),
          _RadiiSamples(),
          SizedBox(height: 24),
          _Section('Shadows & Glow · 그림자'),
          _ShadowSamples(),
          SizedBox(height: 24),
          _Section('Buttons · 버튼'),
          _ButtonSamples(),
          SizedBox(height: 24),
          _Section('Glass Card · 글래스'),
          _GlassCardSample(),
          SizedBox(height: 24),
          _Section('Hero Card · 히어로'),
          _HeroCardSample(),
          SizedBox(height: 24),
          _Section('Hangul Tags · 한글 태그'),
          _HangulTagSamples(),
          SizedBox(height: 24),
          _Section('Status Chips · 상태'),
          _StatusChipSamples(),
          SizedBox(height: 24),
          _Section('Glow Progress · 진행'),
          _ProgressSamples(),
          SizedBox(height: 24),
          _Section('Conic Rings · 링'),
          _RingSamples(),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 4),
      child: Text(title, style: SNTypography.sectionTitle),
    );
  }
}

class _TypographySample extends StatelessWidget {
  const _TypographySample();

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Display 36/800', style: SNTypography.display),
          const SizedBox(height: 8),
          Text('Headline 32/800', style: SNTypography.headline),
          const SizedBox(height: 8),
          Text('Section title 20/800', style: SNTypography.sectionTitle),
          const SizedBox(height: 8),
          Text('Title 16/700', style: SNTypography.title),
          const SizedBox(height: 8),
          Text('Body 15/400 — the quick brown fox.', style: SNTypography.body),
          Text('Body small 14/400 — the quick brown fox.',
              style: SNTypography.bodySmall),
          const SizedBox(height: 8),
          Text('LABEL 13/600', style: SNTypography.label),
          Text('Caption 12/500', style: SNTypography.caption),
          Text('CAPTION SMALL 11/500', style: SNTypography.captionSmall),
          const SizedBox(height: 12),
          Text('한국어 액센트 · Noto Sans KR 700',
              style: SNTypography.hangul(fontSize: 16)),
          const SizedBox(height: 8),
          Text('A7X-9K2M', style: SNTypography.mono(fontSize: 22)),
        ],
      ),
    );
  }
}

class _ColorSwatches extends StatelessWidget {
  const _ColorSwatches();

  @override
  Widget build(BuildContext context) {
    const entries = <(String, Color)>[
      ('royalBlue', SNColors.royalBlue),
      ('lime', SNColors.lime),
      ('limeBright', SNColors.limeBright),
      ('limePressed', SNColors.limePressed),
      ('ink', SNColors.ink),
      ('glass', SNColors.glass),
      ('glassBorder', SNColors.glassBorder),
      ('text 100%', SNColors.textPrimary),
      ('text 55%', SNColors.textSecondary),
      ('text 40%', SNColors.textFaint),
      ('warning', SNColors.warning),
      ('info', SNColors.info),
    ];
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final e in entries)
          Column(
            children: [
              Container(
                width: 64,
                height: 44,
                decoration: BoxDecoration(
                  color: e.$2,
                  borderRadius: SNRadii.brSm,
                  border: Border.all(color: SNColors.glassBorder),
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                width: 64,
                child: Text(e.$1,
                    textAlign: TextAlign.center,
                    style: SNTypography.captionSmall),
              ),
            ],
          ),
      ],
    );
  }
}

class _GradientSwatches extends StatelessWidget {
  const _GradientSwatches();

  @override
  Widget build(BuildContext context) {
    Widget bar(String name, Gradient g) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: SNTypography.captionSmall),
              const SizedBox(height: 4),
              Container(
                height: 40,
                decoration: BoxDecoration(
                  gradient: g,
                  borderRadius: SNRadii.brSm,
                ),
              ),
            ],
          ),
        );
    return Column(
      children: [
        bar('appBackground 150°', SNGradients.appBackground),
        bar('heroCard 140°', SNGradients.heroCard),
        bar('limeButton 145°', SNGradients.limeButton),
      ],
    );
  }
}

class _RadiiSamples extends StatelessWidget {
  const _RadiiSamples();

  @override
  Widget build(BuildContext context) {
    const radii = <(String, double)>[
      ('14', SNRadii.sm),
      ('16', SNRadii.md),
      ('18', SNRadii.lg),
      ('22', SNRadii.xl),
      ('24', SNRadii.xxl),
    ];
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        for (final r in radii)
          Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: SNColors.glass,
                  borderRadius: BorderRadius.circular(r.$2),
                  border: Border.all(color: SNColors.glassBorder),
                ),
              ),
              const SizedBox(height: 4),
              Text(r.$1, style: SNTypography.captionSmall),
            ],
          ),
      ],
    );
  }
}

class _ShadowSamples extends StatelessWidget {
  const _ShadowSamples();

  @override
  Widget build(BuildContext context) {
    Widget chip(String name, List<BoxShadow> shadows, Color fill) => Column(
          children: [
            Container(
              width: 84,
              height: 56,
              decoration: BoxDecoration(
                color: fill,
                borderRadius: SNRadii.brMd,
                boxShadow: shadows,
              ),
            ),
            const SizedBox(height: 6),
            Text(name, style: SNTypography.captionSmall),
          ],
        );
    return Wrap(
      spacing: 18,
      runSpacing: 18,
      children: [
        chip('card', SNShadows.card, SNColors.royalBlue),
        chip('hero', SNShadows.hero, SNColors.royalBlue),
        chip('limeGlow', SNShadows.limeGlow, SNColors.lime),
      ],
    );
  }
}

class _ButtonSamples extends StatelessWidget {
  const _ButtonSamples();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LimeButton(
          label: 'I Have a Magic Code',
          icon: Icons.vpn_key_rounded,
          expand: true,
          onPressed: () {},
        ),
        const SizedBox(height: 12),
        OutlineButton(label: 'Learn More', expand: true, onPressed: () {}),
        const SizedBox(height: 12),
        Row(
          children: [
            LimeButton(label: 'Enabled', onPressed: () {}),
            const SizedBox(width: 12),
            const LimeButton(label: 'Disabled'),
          ],
        ),
      ],
    );
  }
}

class _GlassCardSample extends StatelessWidget {
  const _GlassCardSample();

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () {},
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: SNColors.glass,
              borderRadius: SNRadii.brLg,
              border: Border.all(color: SNColors.glassBorder),
            ),
            child: Text('서', style: SNTypography.hangul(fontSize: 22)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Seoul National University', style: SNTypography.title),
                const SizedBox(height: 2),
                Text('Seoul · 서울', style: SNTypography.caption),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: SNColors.textFaint),
        ],
      ),
    );
  }
}

class _HeroCardSample extends StatelessWidget {
  const _HeroCardSample();

  @override
  Widget build(BuildContext context) {
    return HeroCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Your Journey', style: SNTypography.sectionTitle),
                const SizedBox(height: 4),
                Text('Step 4 of 7', style: SNTypography.body),
                const SizedBox(height: 16),
                LimeButton(
                  label: 'Continue Journey',
                  onPressed: () {},
                ),
              ],
            ),
          ),
          ConicProgressRing(
            value: 0.57,
            size: 84,
            center: Text('57%', style: SNTypography.title),
          ),
        ],
      ),
    );
  }
}

class _HangulTagSamples extends StatelessWidget {
  const _HangulTagSamples();

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          HangulTag(title: 'Applications', korean: '지원 현황'),
          SizedBox(height: 12),
          HangulTag(title: 'Map', korean: '대학 지도'),
          SizedBox(height: 12),
          HangulTag(
            title: 'Documents',
            korean: '서류 목록',
            layout: HangulTagLayout.stacked,
          ),
        ],
      ),
    );
  }
}

class _StatusChipSamples extends StatelessWidget {
  const _StatusChipSamples();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        StatusChip.of(SNStatus.done),
        StatusChip.of(SNStatus.pending),
        StatusChip.of(SNStatus.locked),
        StatusChip.of(SNStatus.selected),
        StatusChip.of(SNStatus.todo),
        StatusChip.of(SNStatus.inReview),
        StatusChip.of(SNStatus.docs),
      ],
    );
  }
}

class _ProgressSamples extends StatelessWidget {
  const _ProgressSamples();

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: const [
          _LabeledBar('35%', 0.35),
          SizedBox(height: 14),
          _LabeledBar('70%', 0.70),
          SizedBox(height: 14),
          _LabeledBar('100%', 1.0),
        ],
      ),
    );
  }
}

class _LabeledBar extends StatelessWidget {
  const _LabeledBar(this.label, this.value);
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: SNTypography.captionSmall),
        const SizedBox(height: 6),
        GlowProgressBar(value: value),
      ],
    );
  }
}

class _RingSamples extends StatelessWidget {
  const _RingSamples();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 20,
      runSpacing: 20,
      alignment: WrapAlignment.center,
      children: [
        ConicProgressRing(
          value: 0.57,
          center: Text('57%', style: SNTypography.title),
        ),
        ConicProgressRing(
          value: 0.5,
          center: Text('3/6', style: SNTypography.title),
        ),
        const ConicProgressRing(value: 1.0),
      ],
    );
  }
}

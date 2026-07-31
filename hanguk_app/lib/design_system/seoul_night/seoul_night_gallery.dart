import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'seoul_night.dart';

/// Visual QA surface for the Seoul Night design system: every token and every
/// core widget on one scrollable page, so a change to a token can be eyeballed
/// without opening a feature screen.
///
/// Debug-only. [kSeoulGalleryEnabled] is false in release, and the route is
/// registered behind that flag — it can never ship to a student.
const bool kSeoulGalleryEnabled = kDebugMode;

/// Route path used by the router when the gallery is enabled.
const String kSeoulGalleryRoute = '/dev/seoul-night';

class SeoulNightGallery extends StatefulWidget {
  const SeoulNightGallery({super.key});

  @override
  State<SeoulNightGallery> createState() => _SeoulNightGalleryState();
}

class _SeoulNightGalleryState extends State<SeoulNightGallery> {
  String _filter = 'All';
  bool _selectedRow = false;

  @override
  Widget build(BuildContext context) {
    return SeoulNightScaffold(
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          SeoulSizes.screenPadding,
          16,
          SeoulSizes.screenPadding,
          64,
        ),
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              const Expanded(
                child: HangulTag(en: 'Seoul Night', ko: '디자인 시스템'),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── Colour ──────────────────────────────────────────────────────
          const _SectionTitle('Colour'),
          const Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _Swatch('royalBlue', SeoulColors.royalBlue),
              _Swatch('lime', SeoulColors.lime),
              _Swatch('limeBright', SeoulColors.limeBright),
              _Swatch('limePressed', SeoulColors.limePressed),
              _Swatch('ink', SeoulColors.ink),
              _Swatch('glass', SeoulColors.glass),
              _Swatch('warning', SeoulColors.warning),
              _Swatch('info', SeoulColors.info),
            ],
          ),
          const SizedBox(height: 28),

          // ── Type ────────────────────────────────────────────────────────
          const _SectionTitle('Type'),
          Text('Display 34/800', style: SeoulType.display),
          const SizedBox(height: 6),
          Text('Headline 26/800', style: SeoulType.headline),
          const SizedBox(height: 6),
          Text('Title 19/800', style: SeoulType.title),
          const SizedBox(height: 6),
          Text('Subtitle 16/700', style: SeoulType.subtitle),
          const SizedBox(height: 6),
          Text(
            'Body 15/400 — Oʻzbekcha, Русский, Tiếng Việt',
            style: SeoulType.body,
          ),
          const SizedBox(height: 6),
          Text('Secondary 14/400', style: SeoulType.bodySecondary),
          const SizedBox(height: 6),
          Text('Caption 12/500', style: SeoulType.caption),
          const SizedBox(height: 6),
          Text('EYEBROW 11/700', style: SeoulType.eyebrow),
          const SizedBox(height: 10),
          Text('한국 · 지원 현황 · 완료 · 대기', style: SeoulType.hangulLabel),
          const SizedBox(height: 8),
          Text('HANG-GUK1', style: SeoulType.codeInput),
          const SizedBox(height: 28),

          // ── Surfaces ────────────────────────────────────────────────────
          const _SectionTitle('Surfaces'),
          HeroCard(
            watermark: '한국',
            child: Row(
              children: [
                const Expanded(
                  child: HangulTag(en: 'Your Journey', ko: '나의 여정'),
                ),
                const ConicProgressRing(
                  value: 0.57,
                  label: '57%',
                  caption: 'Step 4 of 7',
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const GlassCard(
            child: Text(
              'GlassCard — blur 12, hairline border, soft shadow.',
              style: SeoulType.bodySecondary,
            ),
          ),
          const SizedBox(height: 10),
          GlassCard(
            onTap: () {},
            borderColor: SeoulColors.lime,
            fillColor: SeoulColors.limeFill,
            child: const Text(
              'GlassCard — selected state (tappable, presses to 0.97).',
              style: SeoulType.bodySecondary,
            ),
          ),
          const SizedBox(height: 28),

          // ── Buttons ─────────────────────────────────────────────────────
          const _SectionTitle('Buttons'),
          LimeButton(label: 'I Have a Magic Code', onPressed: () {}),
          const SizedBox(height: 10),
          LimeButton(
            label: 'With icon',
            icon: Icons.play_arrow_rounded,
            onPressed: () {},
          ),
          const SizedBox(height: 10),
          const LimeButton(label: 'Disabled'),
          const SizedBox(height: 10),
          const LimeButton(label: 'Loading', loading: true),
          const SizedBox(height: 10),
          SeoulOutlineButton(
            label: 'Explore Universities',
            onPressed: () {},
            trailing: const StatusChip(label: '탐색', dense: true),
          ),
          const SizedBox(height: 28),

          // ── Chips + tags ────────────────────────────────────────────────
          const _SectionTitle('Chips'),
          const Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusChip(label: 'Submitted', tone: StatusTone.lime, ko: '완료'),
              StatusChip(
                label: 'In Review',
                tone: StatusTone.warning,
                ko: '대기',
              ),
              StatusChip(label: 'Documents', tone: StatusTone.info),
              StatusChip(label: 'Locked', ko: '잠김'),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in const ['All', 'Seoul', 'Daejeon', 'Busan'])
                SeoulFilterChip(
                  label: f,
                  selected: _filter == f,
                  onTap: () => setState(() => _filter = f),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const HangulGlyphTile(glyph: '서'),
              const SizedBox(width: 10),
              const HangulGlyphTile(glyph: '연', active: true),
              const SizedBox(width: 10),
              HangulGlyphTile(glyph: HangulGlyphTile.firstSyllable('고려대학교')),
            ],
          ),
          const SizedBox(height: 28),

          // ── Progress ────────────────────────────────────────────────────
          const _SectionTitle('Progress'),
          const GlowProgressBar(value: 0.35),
          const SizedBox(height: 10),
          const GlowProgressBar(value: 0.8),
          const SizedBox(height: 16),
          const Row(
            children: [
              ConicProgressRing(value: 0.5, label: '3/6', caption: 'collected'),
              SizedBox(width: 20),
              ConicProgressRing(value: 1.0, label: '100%', size: 72),
            ],
          ),
          const SizedBox(height: 28),

          // ── Row pattern ─────────────────────────────────────────────────
          const _SectionTitle('List row (selectable)'),
          GlassCard(
            onTap: () => setState(() => _selectedRow = !_selectedRow),
            borderColor: _selectedRow ? SeoulColors.lime : null,
            fillColor: _selectedRow ? SeoulColors.limeFill : null,
            child: Row(
              children: [
                HangulGlyphTile(glyph: '연', active: _selectedRow),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Yonsei University', style: SeoulType.subtitle),
                      SizedBox(height: 2),
                      Text('Seoul · Tier 1', style: SeoulType.caption),
                    ],
                  ),
                ),
                if (_selectedRow)
                  const StatusChip(
                    label: 'Selected',
                    tone: StatusTone.lime,
                    ko: '선택',
                    dense: true,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(text.toUpperCase(), style: SeoulType.eyebrow),
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch(this.name, this.color);

  final String name;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 78,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 46,
            decoration: BoxDecoration(
              color: color,
              borderRadius: SeoulRadii.tileR,
              border: Border.all(color: SeoulColors.glassBorder),
            ),
          ),
          const SizedBox(height: 5),
          Text(name, style: SeoulType.caption.copyWith(fontSize: 10)),
        ],
      ),
    );
  }
}

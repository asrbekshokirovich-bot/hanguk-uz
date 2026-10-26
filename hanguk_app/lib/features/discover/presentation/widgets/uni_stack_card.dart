import 'package:flutter/material.dart';
import '../../../../core/analytics/tracked.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/presentation/widgets/sign_in_chrome.dart' show cssLinearGradient;
import '../../../catalog/data/campus_photos.dart';
import '../../../catalog/data/catalog_filters.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../../catalog/presentation/catalog_format.dart';
import '../../data/qs_ranking.dart';

/// The card of the stack (design screen 03): the campus photo with its
/// position tab; the name and "Xususiy universitet"; the QS block beside the
/// city, fee and language lines (the QS block only for a ranked university);
/// and the dashed "Qabul ehtimolim ?% →".
class UniStackCard extends StatelessWidget {
  const UniStackCard({
    super.key,
    required this.university,
    required this.guideline,
    required this.position,
    required this.isVisiting,
    required this.onAdmission,
    this.percent,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;

  /// 1-based place in the stack, written "05" on the photo's tab.
  final int position;

  /// The visiting delegation's university: "Hozir O'zbekistonda" on the photo.
  final bool isVisiting;

  /// "Qabul ehtimolim ?% →": the assessment for this university (screen 11).
  final VoidCallback onAdmission;

  /// The admission chance once the student has filled the assessment; null
  /// shows "?%".
  final int? percent;

  static const double height = 336;
  static const double _photo = 122;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = university;
    final g = guideline;
    final photo = campusPhotoAsset(u.institutionId);
    final qs = worldRankOf(u.institutionId);
    final price = priceOf(g);
    final topik = g.topikMin;
    final place = u.city == null ? null : splitCity(u.city!);

    final rows = <Widget>[
      if (place != null)
        _InfoRow(
          glyph: LucideIcons.mapPin,
          children: [
            Flexible(
              child: Text(
                place.city,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: fdText(13, FontWeight.w800, FdColors.ink),
              ),
            ),
            if (place.province != null) ...[
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  place.province!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(11, FontWeight.w400, FdColors.muted),
                ),
              ),
            ],
          ],
        ),
      if (price != null)
        _InfoRow(
          glyph: LucideIcons.banknote,
          children: [
            Flexible(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(5)),
                child: Text(
                  money(price, g.currency, locale: l.localeName),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(13, FontWeight.w800, FdColors.onLime),
                ),
              ),
            ),
            if (g.tuitionPeriod != null) ...[
              const SizedBox(width: 6),
              Text(
                g.tuitionPeriod == 'yil' ? l.fdPerYearShort : l.fdPerSemShort,
                style: fdText(11, FontWeight.w400, FdColors.muted),
              ),
            ],
          ],
        ),
      if (topik != null)
        _InfoRow(
          glyph: LucideIcons.languages,
          children: [
            Text('TOPIK ${scoreText(topik)}+', style: fdText(13, FontWeight.w800, FdColors.ink)),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                l.fdCellLanguage.toLowerCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: fdText(11, FontWeight.w400, FdColors.muted),
              ),
            ),
          ],
        ),
    ];

    return Container(
      height: height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: _photo,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (photo != null)
                  Image.asset(photo, fit: BoxFit.cover, cacheWidth: 720)
                else
                  NameCover(name: u.nameKoShort ?? u.displayName),
                if (isVisiting)
                  Positioned(
                    left: 10,
                    top: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: FdColors.lime,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: FdColors.ink, width: 1.5),
                      ),
                      child: Text(l.catalogGuestUniWhere, style: fdText(11, FontWeight.w800, FdColors.onLime)),
                    ),
                  ),
                // The ink rule under the photo, with the position tab sitting
                // on it.
                const Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: ColoredBox(color: FdColors.ink, child: SizedBox(height: 1.5)),
                ),
                Positioned(
                  right: 10,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(10, 4, 10, 4),
                    decoration: const BoxDecoration(
                      color: FdColors.card,
                      borderRadius: BorderRadius.vertical(top: Radius.circular(10)),
                      border: Border(
                        top: BorderSide(color: FdColors.ink, width: 1.5),
                        left: BorderSide(color: FdColors.ink, width: 1.5),
                        right: BorderSide(color: FdColors.ink, width: 1.5),
                      ),
                    ),
                    child: Text(
                      position.toString().padLeft(2, '0'),
                      style: fdText(12, FontWeight.w800, FdColors.ink),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    u.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(19, FontWeight.w800, FdColors.ink, height: 1.15, letterSpacing: -0.38),
                  ),
                  const SizedBox(height: 3),
                  _TypeLine(institutionType: g.institutionType),
                  const SizedBox(height: 10),
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (qs != null) ...[
                          _QsBlock(rank: qs),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              for (var i = 0; i < rows.length; i++) ...[
                                if (i > 0) const _DashedLine(),
                                Expanded(child: rows[i]),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  _OddsPill(percent: percent, onTap: tracked('uni_stack_card.admission', onAdmission)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "**Xususiy** universitet": the type's first word in its colour.
class _TypeLine extends StatelessWidget {
  const _TypeLine({required this.institutionType});

  final String? institutionType;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final label = typeLabel(l, institutionType);
    if (label == null) return const SizedBox(height: 15);
    final private = catalogType(institutionType) == CatalogType.private;
    final i = label.indexOf(' ');
    final head = i < 0 ? label : label.substring(0, i);
    final rest = i < 0 ? '' : label.substring(i);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: head,
            style: fdText(12, FontWeight.w800, private ? FdColors.privateBlue : FdColors.good),
          ),
          TextSpan(text: rest, style: fdText(12, FontWeight.w400, FdColors.muted)),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// The navy "QS WORLD" (or "THE WORLD") block: the position in lime, and "~1400 · jahon
/// reytingi" under it (for a band, its last place).
class _QsBlock extends StatelessWidget {
  const _QsBlock({required this.rank});

  final QsRank rank;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final caption = rank.to == null ? l.fdQsRanking : '~${rank.to} · ${l.fdQsRanking}';
    return Container(
      width: 96,
      padding: const EdgeInsets.fromLTRB(10, 9, 8, 9),
      decoration: BoxDecoration(
        color: FdColors.navy,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Lucide(LucideIcons.trophy, size: 11, color: FdColors.lime),
              const SizedBox(width: 4),
              Text(rank.source == RankSource.the ? 'THE WORLD' : 'QS WORLD', style: fdText(9, FontWeight.w800, FdColors.onNavyMuted, letterSpacing: 0.6)),
            ],
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              rank.label,
              style: fdText(34, FontWeight.w800, FdColors.lime, height: 1, letterSpacing: -1),
            ),
          ),
          const SizedBox(height: 5),
          Text(caption, maxLines: 2, style: fdText(9, FontWeight.w700, Colors.white, height: 1.25)),
        ],
      ),
    );
  }
}

/// One line of the card's facts: an icon, then its content.
class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.glyph, required this.children});

  final LucideGlyph glyph;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Lucide(glyph, size: 15, color: FdColors.muted),
        const SizedBox(width: 9),
        ...children,
      ],
    );
  }
}

/// `border-bottom: 1.5px dashed` between the facts.
class _DashedLine extends StatelessWidget {
  const _DashedLine();

  @override
  Widget build(BuildContext context) => const SizedBox(height: 1.5, child: CustomPaint(painter: _Dashes()));
}

class _Dashes extends CustomPainter {
  const _Dashes();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFD9DFE8)
      ..strokeWidth = size.height;
    final y = size.height / 2;
    for (var x = 0.0; x < size.width; x += 7) {
      canvas.drawLine(Offset(x, y), Offset((x + 4).clamp(0, size.width), y), paint);
    }
  }

  @override
  bool shouldRepaint(_Dashes old) => false;
}

/// The dashed "Qabul ehtimolim ?% →" pill, full width.
class _OddsPill extends StatelessWidget {
  const _OddsPill({required this.percent, required this.onTap});

  final int? percent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final p = percent;
    final color = p == null
        ? FdColors.navy
        : p >= 60
        ? FdColors.good
        : p >= 40
        ? FdColors.warn
        : FdColors.bad;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('uni_stack_card.odds_pill', onTap),
        behavior: HitTestBehavior.opaque,
        child: CustomPaint(
          painter: const DashedPillPainter(color: FdColors.navy, radius: 14),
          child: SizedBox(
            height: 28,
            child: Center(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: '${l.fdOddsLead} '),
                    TextSpan(text: p == null ? '?%' : '$p%', style: TextStyle(color: color)),
                    const TextSpan(text: ' →'),
                  ],
                ),
                style: fdText(11, FontWeight.w800, FdColors.navy),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// No campus photo: the design's placeholder gradient with the Korean name.
class NameCover extends StatelessWidget {
  const NameCover({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) => Container(
        decoration: BoxDecoration(
          gradient: cssLinearGradient(
            135,
            box.biggest,
            colors: const [FdColors.navy, Color(0xFF132A4D), Color(0xFF0F213D)],
            stops: const [0, 0.55, 1],
          ),
        ),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            name,
            maxLines: 1,
            style: SeoulType.hangulGlyph.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

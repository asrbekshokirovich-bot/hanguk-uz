import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/presentation/widgets/sign_in_chrome.dart' show cssLinearGradient;
import '../../../catalog/data/campus_photos.dart';
import '../../../catalog/data/catalog_filters.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../../catalog/presentation/catalog_format.dart';

/// The top card of the stack (design screen 03): the campus photo with its
/// position tab, the name, "city · type", the requirement cells, the fee and
/// "Qabul ?%". 288px tall in the design.
class UniStackCard extends StatelessWidget {
  const UniStackCard({
    super.key,
    required this.university,
    required this.guideline,
    required this.position,
    required this.deadline,
    required this.isVisiting,
    required this.onAdmission,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;

  /// 1-based place in the stack, written "01" on the photo's tab.
  final int position;

  /// The application window's last day (YYYY-MM-DD), when the Excel gives one.
  final String? deadline;

  /// The visiting delegation's university: "Hozir O'zbekistonda" on the photo.
  final bool isVisiting;

  /// "Qabul ?%": the assessment for this university (design screen 11).
  final VoidCallback onAdmission;

  static const double height = 288;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final photo = campusPhotoAsset(university.institutionId);
    final type = typeLabel(l, guideline.institutionType, short: true);
    final isPrivate = catalogType(guideline.institutionType) == CatalogType.private;
    final price = priceOf(guideline);
    final topik = guideline.topikMin;
    final cells = <(String, String)>[
      if (topik != null) (l.fdCellLanguage, 'TOPIK ${scoreText(topik)}+'),
      if (deadline != null) (l.fdCellDeadline, _shortDate(context, deadline!)),
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
            height: 140,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (photo != null)
                  Image.asset(photo, fit: BoxFit.cover, cacheWidth: 720)
                else
                  NameCover(name: university.nameKoShort ?? university.displayName),
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    university.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(19, FontWeight.w800, FdColors.ink, height: 1.15, letterSpacing: -0.38),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Lucide(LucideIcons.mapPin, size: 12, color: FdColors.muted),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text.rich(
                          TextSpan(
                            children: [
                              if (university.city != null) TextSpan(text: university.city),
                              if (university.city != null && type != null) const TextSpan(text: ' · '),
                              if (type != null)
                                TextSpan(
                                  text: type,
                                  style: fdText(12, FontWeight.w700, isPrivate ? FdColors.privateBlue : FdColors.good),
                                ),
                            ],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: fdText(12, FontWeight.w400, FdColors.muted),
                        ),
                      ),
                    ],
                  ),
                  if (cells.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    _Cells(cells: cells),
                  ],
                  const Spacer(),
                  Row(
                    children: [
                      // The fee takes the room the pill leaves, so it is not
                      // cut at half the row.
                      if (price != null)
                        Flexible(
                          fit: FlexFit.tight,
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(5)),
                            child: Text(
                              '${money(price, guideline.currency, locale: l.localeName)} ${periodSuffix(l, guideline.tuitionPeriod)}'
                                  .trim(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: fdText(13, FontWeight.w800, FdColors.onLime),
                            ),
                          ),
                          ),
                        )
                      else
                        const Spacer(),
                      const SizedBox(width: 8),
                      _AdmissionPill(label: l.fdAdmissionUnknown, onTap: onAdmission),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// "10-dek" — day and short month in the student's language.
  static String _shortDate(BuildContext context, String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    try {
      return DateFormat.MMMd(Localizations.localeOf(context).toLanguageTag()).format(d);
    } catch (_) {
      return iso;
    }
  }
}

/// The ruled row of requirement cells under the city line.
class _Cells extends StatelessWidget {
  const _Cells({required this.cells});

  final List<(String, String)> cells;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < cells.length; i++) ...[
              if (i > 0) const ColoredBox(color: FdColors.ink, child: SizedBox(width: 1.5)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(cells[i].$1, maxLines: 1, style: fdText(9, FontWeight.w700, FdColors.muted)),
                      const SizedBox(height: 1),
                      Text(
                        cells[i].$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: fdText(12, FontWeight.w800, FdColors.ink),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The dashed "Qabul ?%" pill.
class _AdmissionPill extends StatelessWidget {
  const _AdmissionPill({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: CustomPaint(
          painter: const DashedPillPainter(color: FdColors.navy),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            child: Text(label, style: fdText(11, FontWeight.w800, FdColors.navy)),
          ),
        ),
      ),
    );
  }
}

/// A 1.5px dashed pill outline (`border: 1.5px dashed`).
class DashedPillPainter extends CustomPainter {
  const DashedPillPainter({required this.color, this.radius});

  final Color color;

  /// Null for a full pill.
  final double? radius;

  @override
  void paint(Canvas canvas, Size size) {
    final r = radius ?? size.height / 2;
    final rect = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(r)).deflate(0.75);
    final path = Path()..addRRect(rect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, d + 4), paint);
        d += 7;
      }
    }
  }

  @override
  bool shouldRepaint(DashedPillPainter old) => old.color != color || old.radius != radius;
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

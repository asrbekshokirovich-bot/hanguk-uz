import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/data/auth_repository.dart' show signedInProvider;
import '../../../catalog/data/campus_photos.dart';
import '../../../catalog/data/catalog_filters.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../../assessment/presentation/assessment_widgets.dart';
import '../../../catalog/presentation/catalog_format.dart';
import '../discover_routes.dart';
import 'fd_bottom_nav.dart';
import 'uni_stack_card.dart';

/// A university's campus photo in an ink-bordered tile (80×48 in the lists),
/// or the navy cover with its Korean name when there is no photo.
class UniThumb extends StatelessWidget {
  const UniThumb({super.key, required this.university, this.width = 80, this.height = 48, this.radius = 10});

  final CatalogUniversity university;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final photo = campusPhotoAsset(university.institutionId);
    return Container(
      width: width,
      height: height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: photo != null
          ? Image.asset(photo, fit: BoxFit.cover, cacheWidth: (width * 3).round())
          : NameCover(name: university.nameKoShort ?? university.displayName),
    );
  }
}

/// "Gongju" from the Excel's "Gongju (Chungcheongnam-do)": the city alone,
/// as the design's short lines write it.
String shortCity(String city) {
  final i = city.indexOf(' (');
  return i > 0 ? city.substring(0, i) : city;
}

/// "Gongju · ₩1 734 000 · TOPIK 3+", the fee in bold ink.
Text uniMetaLine(
  AppLocalizations l,
  CatalogUniversity u,
  CatalogGuideline g, {
  bool topik = true,
  int? maxLines,
}) {
  final price = priceOf(g);
  final parts = <InlineSpan>[
    if (u.city != null) TextSpan(text: shortCity(u.city!)),
    if (price != null)
      TextSpan(text: money(price, g.currency, locale: l.localeName), style: fdText(11, FontWeight.w800, FdColors.ink)),
    if (topik && g.topikMin != null) TextSpan(text: 'TOPIK ${scoreText(g.topikMin!)}+'),
  ];
  return Text.rich(
    TextSpan(
      children: [
        for (var i = 0; i < parts.length; i++) ...[
          if (i > 0) const TextSpan(text: ' · '),
          parts[i],
        ],
      ],
    ),
    maxLines: maxLines,
    overflow: maxLines == null ? null : TextOverflow.ellipsis,
    style: fdText(11, FontWeight.w400, FdColors.muted, height: 1.35),
  );
}

/// The 36px back button, a title and a note on the right — the header of
/// screens 07, 08, 09 and 16.
class FdTitleBar extends StatelessWidget {
  const FdTitleBar({super.key, this.title, this.trailing});

  /// The title; a [Widget] so a part of it can be marked.
  final Widget? title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
      child: Row(
        children: [
          HardIconButton(
            glyph: LucideIcons.chevronLeft,
            semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
            onTap: () => context.canPop() ? context.pop() : context.go(kDiscoverPath),
          ),
          const SizedBox(width: 10),
          Expanded(child: title ?? const SizedBox.shrink()),
          if (trailing != null) Text(trailing!, style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
        ],
      ),
    );
  }
}

/// The title style of [FdTitleBar].
final TextStyle kFdTitleStyle = fdText(18, FontWeight.w800, FdColors.ink, letterSpacing: -0.36);

/// The big pale hangul behind a screen's title ("비교", "저장").
class GhostWord extends StatelessWidget {
  const GhostWord(this.text, {super.key, this.top = 34});

  final String text;
  final double top;

  @override
  Widget build(BuildContext context) => Positioned(
    right: -12,
    top: top,
    child: ExcludeSemantics(
      child: IgnorePointer(
        child: Text(text, style: fdText(104, FontWeight.w800, FdColors.ghost, height: 1, letterSpacing: -4)),
      ),
    ),
  );
}

/// The bottom nav on a screen pushed over the home: Universitetlar stays lit;
/// another tab goes back to the home (the guest's, or the signed-in
/// student's) with that tab open.
class GuestTabsBar extends ConsumerWidget {
  const GuestTabsBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final signedIn = ref.watch(signedInProvider);
    return FdBottomNav(
      current: 0,
      items: [
        (label: l.fdNavUniversities, glyph: LucideIcons.graduationCap),
        (label: l.fdNavMap, glyph: LucideIcons.map),
        (label: l.fdNavPrepare, glyph: LucideIcons.target),
      ],
      onSelect: (i) => context.go(signedIn ? '/?tab=$i' : discoverTabPath(i)),
    );
  }
}

/// How a slot is drawn: holding a university, empty, or with one dragged
/// over it.
enum SlotLook { filled, empty, drop }

/// One of the three slots (design screens 06–07): the campus photo with the
/// name on a lime band when filled; a dashed outline with "+" (or a trophy)
/// when empty; tinted with "Shu yerga" while a university hovers over it.
class SlotTile extends StatelessWidget {
  const SlotTile({
    super.key,
    required this.number,
    required this.look,
    this.university,
    this.height = 62,
    this.emptyGlyph,
  });

  final int number;
  final SlotLook look;
  final CatalogUniversity? university;
  final double height;

  /// Drawn in an empty slot instead of "+" (the duel's trophy).
  final LucideGlyph? emptyGlyph;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = university;
    final filled = look == SlotLook.filled && u != null;
    final photo = u == null ? null : campusPhotoAsset(u.institutionId);
    final box = Container(
      height: height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: look == SlotLook.drop ? FdColors.tint : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: filled ? Border.all(color: FdColors.ink, width: 1.5) : null,
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (filled) ...[
            if (photo != null)
              Image.asset(photo, fit: BoxFit.cover, cacheWidth: 360)
            else
              NameCover(name: u.nameKoShort ?? u.displayName),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: const BoxDecoration(
                  color: FdColors.lime,
                  border: Border(top: BorderSide(color: FdColors.ink, width: 1.5)),
                ),
                child: Text(
                  shortUniversityName(u.displayName),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(10, FontWeight.w800, FdColors.onLime),
                ),
              ),
            ),
          ] else
            Center(
              child: look == SlotLook.drop
                  ? Text(l.fdSlotDropHere, style: fdText(11, FontWeight.w800, FdColors.muted))
                  : emptyGlyph != null
                  ? Lucide(emptyGlyph!, size: 14, color: const Color(0xFFB9C5D8))
                  : Text('+', style: fdText(24, FontWeight.w800, FdColors.muted, height: 1)),
            ),
          Positioned(
            left: 5,
            top: 5,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              decoration: BoxDecoration(
                color: FdColors.card,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: FdColors.ink, width: 1.5),
              ),
              child: Text('$number', style: fdText(9, FontWeight.w800, FdColors.ink, height: 14 / 9)),
            ),
          ),
        ],
      ),
    );
    return Semantics(
      label: '${l.fdSlotNumber(number)}: ${filled ? u.displayName : l.fdSlotEmpty}',
      excludeSemantics: true,
      child: filled ? box : CustomPaint(foregroundPainter: const DashedPillPainter(color: FdColors.ink, radius: 12), child: box),
    );
  }
}

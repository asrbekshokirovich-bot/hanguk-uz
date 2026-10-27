import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/seen.dart';
import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../../catalog/data/campus_photos.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../data/chances.dart';
import '../data/slots.dart';
import 'discover_routes.dart';
import 'filter_board_screen.dart';
import 'widgets/fd_parts.dart';

/// "Universitetlar" (design 2026-10-21): the universities the filter leaves,
/// as cards two to a row — the photo or the blue tile with the Korean name and
/// the contract, the heart that picks it, then the type, the name and "city ·
/// TOPIK". The search narrows them by name or city; the button beside it
/// opens the filter. Best chance first. The bottom nav belongs to the shell.
class UniversitiesScreen extends ConsumerStatefulWidget {
  const UniversitiesScreen({super.key});

  @override
  ConsumerState<UniversitiesScreen> createState() => _UniversitiesScreenState();
}

class _UniversitiesScreenState extends ConsumerState<UniversitiesScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final book = ref.watch(chanceBookProvider);
    final slots = ref.watch(slotsProvider);
    final picked = slots.whereType<String>().length;

    var list = boardResults(ref, all, f);
    final q = _search.text.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = [
        for (final u in list)
          if ([
            u.displayName,
            u.nameKo,
            u.nameKoShort,
            u.city,
            guidelineFor(u, f)?.city,
          ].whereType<String>().any((s) => s.toLowerCase().contains(q)))
            u,
      ];
    }
    // Best chance first; the sort is stable, so ties keep the catalogue's order.
    list = [...list]..sort((a, b) => book.admission(b).compareTo(book.admission(a)));

    void pick(CatalogUniversity u) {
      final n = ref.read(slotsProvider.notifier);
      if (n.indexOf(u.institutionId) >= 0) {
        n.remove(u.institutionId);
      } else if (!n.add(u.institutionId)) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(l.fdSlotsFull)));
      }
    }

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
            child: Row(
              children: [
                const SignInLogoTile(size: 36, radius: 10, haloBleed: 0, shadowOffsetY: 2, shadowBlur: 6),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    l.ulTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(18, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.36),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(999)),
                  child: Text(l.ulCount(list.length), style: fdText(12, FontWeight.w800, FdColors.onLime)),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: FdColors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: FdColors.ink, width: 1.5),
                    ),
                    child: Row(
                      children: [
                        const Lucide(LucideIcons.search, size: 18, color: FdColors.ink),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _search,
                            onChanged: (_) => setState(() {}),
                            textInputAction: TextInputAction.search,
                            style: fdText(14, FontWeight.w600, FdColors.ink),
                            decoration: InputDecoration(
                              hintText: l.ulSearchHint,
                              hintStyle: fdText(14, FontWeight.w500, FdColors.muted),
                              isDense: true,
                              filled: false,
                              contentPadding: EdgeInsets.zero,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              disabledBorder: InputBorder.none,
                              errorBorder: InputBorder.none,
                              focusedErrorBorder: InputBorder.none,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Semantics(
                  button: true,
                  label: l.fltTitle,
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: tracked('universities.to_discover_filter', () => context.push(kDiscoverFilterPath)),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      width: 46,
                      height: 46,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: FdColors.blue,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: FdColors.ink, width: 1.5),
                      ),
                      child: const Lucide(LucideIcons.slidersHorizontal, size: 18, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 6),
            child: Text(l.ulSubtitle(list.length), style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
          ),
          Expanded(
            child: list.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        l.catalogEmptyTitle,
                        textAlign: TextAlign.center,
                        style: fdText(14, FontWeight.w600, FdColors.pageMuted),
                      ),
                    ),
                  )
                : SeenList(
                    name: 'universities',
                    child: GridView.builder(
                      padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        mainAxisExtent: 222,
                      ),
                      itemCount: list.length,
                      itemBuilder: (context, i) {
                        final u = list[i];
                        return Seen(
                          id: u.institutionId,
                          position: i + 1,
                          child: _Card(
                            university: u,
                            guideline: guidelineFor(u, f) ?? u.primary,
                            picked: slots.contains(u.institutionId),
                            onTap: tracked('universities.card', () => context.push(universityPath(u.institutionId)), props: {'institution_id': u.institutionId}),
                            onPick: tracked('universities.card_pick', () => pick(u), props: {'institution_id': u.institutionId}),
                          ),
                        );
                      },
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
            child: Align(
              alignment: Alignment.centerRight,
              child: Text('♥$picked/$kSlotCount', style: fdText(12, FontWeight.w800, FdColors.lime)),
            ),
          ),
        ],
      ),
    );
  }
}

/// One university's card (design 2026-10-21).
class _Card extends StatelessWidget {
  const _Card({
    required this.university,
    required this.guideline,
    required this.picked,
    required this.onTap,
    required this.onPick,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final bool picked;
  final VoidCallback onTap;
  final VoidCallback onPick;

  static const _privateTone = Color(0xFFA5B4FC);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final photo = campusPhotoAsset(university.institutionId);
    final price = priceOf(guideline);
    final state = catalogType(guideline.institutionType) == CatalogType.state;
    final need = guideline.topikMin;
    final meta = [
      if (university.city != null) shortCity(university.city!),
      need != null && need > 0 && guideline.koreanTrack != false ? 'TOPIK ${scoreText(need)}+' : l.ulNoRequirement,
    ].join(' · ');
    final hangul = university.nameKoShort ?? university.nameKo;

    return Semantics(
      button: true,
      label: university.displayName,
      child: GestureDetector(
        onTap: tracked('universities.card', onTap),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: const Color(0xFF1B2A6B),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0x33FFFFFF), width: 1.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 116,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (photo != null)
                        Image.asset(photo, fit: BoxFit.cover, cacheWidth: 500)
                      else
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [FdColors.blue, FdColors.blueDeep],
                            ),
                          ),
                          child: Center(child: Icon(Icons.apartment, size: 56, color: Color(0x26FFFFFF))),
                        ),
                      if (photo != null) const ColoredBox(color: Color(0x55060D2B)),
                      Positioned(
                        left: 6,
                        right: 6,
                        bottom: 8,
                        child: Column(
                          children: [
                            if (hangul != null)
                              Text(
                                hangul,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: fdText(15, FontWeight.w800, Colors.white, height: 1.2),
                              ),
                            if (price != null) ...[
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xCC0A1440),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: const Color(0x99FFFFFF)),
                                ),
                                child: Text(
                                  money(price, guideline.currency, locale: l.localeName),
                                  style: fdText(11, FontWeight.w800, Colors.white, height: 1.2),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Positioned(
                        right: 6,
                        top: 6,
                        child: Semantics(
                          button: true,
                          selected: picked,
                          label: l.fdUniAddPick(0),
                          excludeSemantics: true,
                          child: GestureDetector(
                            onTap: tracked('universities.card_pick', onPick),
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              width: 30,
                              height: 30,
                              alignment: Alignment.center,
                              decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                              child: Icon(
                                picked ? Icons.favorite : Icons.favorite_border,
                                size: 17,
                                color: picked ? FdColors.bad : FdColors.ink,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state ? l.ulState : l.ulPrivate,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(10, FontWeight.w800, state ? FdColors.lime : _privateTone),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      university.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(13, FontWeight.w800, Colors.white, height: 1.2),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 1),
                          child: Lucide(LucideIcons.mapPin, size: 12, color: FdColors.pageMuted),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            meta,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: fdText(11, FontWeight.w600, FdColors.pageMuted, height: 1.3),
                          ),
                        ),
                      ],
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

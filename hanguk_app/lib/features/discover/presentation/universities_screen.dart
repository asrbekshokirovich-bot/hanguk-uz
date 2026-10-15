import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night_tokens.dart' show SeoulColors;
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart' show HardButton;
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../map/data/map_repository.dart';
import '../../map/presentation/widgets/university_map_view.dart';
import '../data/chances.dart';
import '../data/list_mode.dart';
import '../data/slots.dart';
import 'discover_routes.dart';
import 'filter_board_screen.dart';
import 'widgets/chance_badge.dart';
import 'widgets/fd_parts.dart';

/// "Sizga mos N ta" (the prototype's list): what the filter board leaves, best
/// chance first, with the switch between the admission chance, the visa
/// chance and the map. Under it the colour key and how many of the three
/// places are taken. The bottom nav belongs to the shell.
class UniversitiesScreen extends ConsumerWidget {
  const UniversitiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final book = ref.watch(chanceBookProvider);
    final mode = ref.watch(uniModeProvider);
    final picked = ref.watch(slotsProvider).whereType<String>().length;

    var list = boardResults(ref, all, f);
    // Best chance first; the sort is stable, so ties keep the catalogue's order.
    list = [...list]..sort((a, b) => (book.admission(b) ?? 0).compareTo(book.admission(a) ?? 0));

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
                    l.fdListTitle(list.length),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(18, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.36),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
            child: FdSegments(
              labels: [l.fdModeAdmission, l.fdModeVisa, l.fdModeMap],
              selected: mode.index,
              onSelect: (i) => ref.read(uniModeProvider.notifier).set(UniMode.values[i]),
            ),
          ),
          Expanded(
            child: mode == UniMode.map
                ? const _RealMap()
                : list.isEmpty
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
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final u = list[i];
                      final percent = mode == UniMode.visa ? book.visa : book.admission(u);
                      return _Row(
                        university: u,
                        guideline: guidelineFor(u, f) ?? u.primary,
                        percent: percent,
                        onTap: () => context.push(universityPath(u.institutionId)),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
            child: _Key(picked: picked),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.university, required this.guideline, required this.percent, required this.onTap});

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final int? percent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            children: [
              UniThumb(university: university, width: 52, height: 38, radius: 8),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      university.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(13, FontWeight.w800, FdColors.ink),
                    ),
                    const SizedBox(height: 1),
                    uniMetaLine(l, university, guideline, maxLines: 1),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              ChanceBadge(percent: percent),
            ],
          ),
        ),
      ),
    );
  }
}

/// "80%+ · 50–80 · <50" with the colours, and "♥ 2/3" on the right.
class _Key extends StatelessWidget {
  const _Key({required this.picked});

  final int picked;

  @override
  Widget build(BuildContext context) {
    Widget swatch(Color c, String label, {bool ink = false}) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: c,
            borderRadius: BorderRadius.circular(3),
            border: ink ? Border.all(color: FdColors.ink) : null,
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
      ],
    );
    return Row(
      children: [
        swatch(FdColors.lime, '80%+', ink: true),
        const SizedBox(width: 10),
        swatch(FdColors.warn, '50–80'),
        const SizedBox(width: 10),
        swatch(FdColors.bad, '<50'),
        const Spacer(),
        Text('♥ $picked/$kSlotCount', style: fdText(11, FontWeight.w700, FdColors.lime)),
      ],
    );
  }
}

/// The "Xarita" mode: the app's own map of every university, pins and all.
class _RealMap extends ConsumerWidget {
  const _RealMap();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final unis = ref.watch(universitiesProvider);
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: SeoulColors.mapWater,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
        child: unis.when(
          loading: () => const Center(child: CircularProgressIndicator(color: FdColors.lime)),
          error: (_, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(l.uniDbLoadFailed, textAlign: TextAlign.center, style: fdText(14, FontWeight.w700, FdColors.onPage)),
                  const SizedBox(height: 14),
                  HardButton(label: l.commonRetry, onPressed: () => ref.invalidate(universitiesProvider)),
                ],
              ),
            ),
          ),
          data: (list) => UniversityMapView(universities: list),
        ),
      ),
    );
  }
}

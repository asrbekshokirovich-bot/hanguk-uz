import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../data/slots.dart';
import 'discover_routes.dart';
import 'filter_board_screen.dart';
import 'widgets/fd_parts.dart';

/// Design screen 06, "Natijalar + 3 slot": what the filter board leaves,
/// best match first, under the three slots. A university goes into a slot
/// by dragging it there (hold the row, or grab its handle) or with "+";
/// "Eng yaxshi 3 tasini tanlang" fills the rest two at a time (screen 07).
class ResultsScreen extends ConsumerStatefulWidget {
  const ResultsScreen({super.key});

  @override
  ConsumerState<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends ConsumerState<ResultsScreen> {
  void _toggle(String id) {
    final slots = ref.read(slotsProvider.notifier);
    if (slots.indexOf(id) >= 0) {
      slots.remove(id);
      return;
    }
    if (!slots.add(id)) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(AppLocalizations.of(context)!.fdSlotsFull)));
      return;
    }
    HapticFeedback.selectionClick();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final list = boardResults(ref, all, f);
    final slots = ref.watch(slotsProvider);
    final byId = {for (final u in all) u.institutionId: u};

    return Scaffold(
      backgroundColor: Colors.transparent,
      bottomNavigationBar: const GuestTabsBar(),
      body: FdPage(
        child: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
                    decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: FdColors.navRule, width: 1.5))),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _Header(summary: filterSummary(l, f) ?? l.fdSearchHint, active: f.activeCount),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            for (var i = 0; i < kSlotCount; i++) ...[
                              if (i > 0) const SizedBox(width: 8),
                              Expanded(
                                child: DragTarget<String>(
                                  onAcceptWithDetails: (d) {
                                    HapticFeedback.mediumImpact();
                                    ref.read(slotsProvider.notifier).place(i, d.data);
                                  },
                                  builder: (context, candidate, _) {
                                    final id = slots[i];
                                    final u = id == null ? null : byId[id];
                                    return SlotTile(
                                      number: i + 1,
                                      university: u,
                                      look: candidate.isNotEmpty
                                          ? SlotLook.drop
                                          : u != null
                                          ? SlotLook.filled
                                          : SlotLook.empty,
                                    );
                                  },
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Expanded(child: Text(l.fdResultsMatching(list.length), style: fdText(15, FontWeight.w800, FdColors.onPage))),
                        Text(l.fdResultsBestFirst, style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
                      ],
                    ),
                  ),
                  const ColoredBox(color: FdColors.navRule, child: SizedBox(height: 1.5)),
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
                        : ListView.builder(
                            padding: const EdgeInsets.only(bottom: 96),
                            itemCount: list.length,
                            itemBuilder: (context, i) {
                              final u = list[i];
                              return _DraggableRow(
                                university: u,
                                guideline: guidelineFor(u, f)!,
                                inSlot: slots.contains(u.institutionId),
                                onToggle: () => _toggle(u.institutionId),
                                onOpen: () => context.push(universityPath(u.institutionId)),
                              );
                            },
                          ),
                  ),
                ],
              ),
              if (list.isNotEmpty)
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 12,
                  child: _BestThreeBanner(
                    count: list.length,
                    onTap: () => context.push(
                      ref.read(slotsProvider.notifier).isFull ? kDiscoverChosenPath : kDiscoverDuelPath,
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

/// Back, the search field holding the board's choices, and the filter
/// button with how many are set.
class _Header extends StatelessWidget {
  const _Header({required this.summary, required this.active});

  final String summary;
  final int active;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Row(
      children: [
        HardIconButton(
          glyph: LucideIcons.chevronLeft,
          semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
          size: 48,
          radius: 14,
          iconSize: 18,
          shadow: 3,
          onTap: () => context.canPop() ? context.pop() : context.go(kDiscoverPath),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Semantics(
            button: true,
            label: l.fdSearchHint,
            child: GestureDetector(
              onTap: () => context.push(kDiscoverSearchPath),
              behavior: HitTestBehavior.opaque,
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: FdColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                  boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
                ),
                child: Row(
                  children: [
                    const Lucide(LucideIcons.search, size: 18, color: FdColors.ink),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        summary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: fdText(13, FontWeight.w700, FdColors.ink),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox.square(
          dimension: 48,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              HardIconButton(
                glyph: LucideIcons.slidersHorizontal,
                semanticLabel: l.catalogFilterTitle,
                size: 48,
                radius: 14,
                iconSize: 19,
                fill: FdColors.navy,
                iconColor: Colors.white,
                shadow: 3,
                onTap: () => context.canPop() ? context.pop() : context.push(kDiscoverFilterPath),
              ),
              if (active > 0)
                Positioned(
                  top: -7,
                  right: -7,
                  child: IgnorePointer(
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 20),
                      height: 20,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: FdColors.lime,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: FdColors.ink, width: 1.5),
                      ),
                      child: Text('$active', style: fdText(10, FontWeight.w800, FdColors.onLime)),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// One result, ready to be dragged into a slot: hold the row, or take it by
/// the handle at once.
class _DraggableRow extends StatelessWidget {
  const _DraggableRow({
    required this.university,
    required this.guideline,
    required this.inSlot,
    required this.onToggle,
    required this.onOpen,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final bool inSlot;
  final VoidCallback onToggle;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final id = university.institutionId;
    final feedback = _DragPill(name: university.displayName);
    final dimmed = _row(context, l, handle: const SizedBox(width: 14), faded: true);
    final handle = Draggable<String>(
      data: id,
      feedback: feedback,
      childWhenDragging: const SizedBox(width: 14, height: 14),
      onDragStarted: HapticFeedback.selectionClick,
      child: const Padding(
        padding: EdgeInsets.symmetric(vertical: 10),
        child: Lucide(LucideIcons.gripVertical, size: 14, color: Color(0xFFB9C5D8)),
      ),
    );
    return LongPressDraggable<String>(
      data: id,
      feedback: feedback,
      childWhenDragging: dimmed,
      hapticFeedbackOnStart: true,
      child: _row(context, l, handle: handle),
    );
  }

  Widget _row(BuildContext context, AppLocalizations l, {required Widget handle, bool faded = false}) {
    return Opacity(
      opacity: faded ? 0.4 : 1,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 12, 14, 12),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: FdColors.navRule, width: 1.5))),
        child: Row(
          children: [
            handle,
            const SizedBox(width: 10),
            Expanded(
              child: Semantics(
                button: true,
                child: GestureDetector(
                  onTap: onOpen,
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    children: [
                      UniThumb(university: university),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              university.displayName,
                              style: fdText(14, FontWeight.w800, FdColors.onPage, height: 1.2),
                            ),
                            const SizedBox(height: 2),
                            uniMetaLine(l, university, guideline),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Semantics(
              button: true,
              label: inSlot ? l.fdRemoveFromSlot : l.fdAddToSlot,
              excludeSemantics: true,
              child: GestureDetector(
                onTap: onToggle,
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: inSlot ? FdColors.lime : FdColors.card,
                    border: Border.all(color: FdColors.ink, width: 1.5),
                  ),
                  child: Lucide(inSlot ? LucideIcons.check : LucideIcons.plus, size: 18, color: FdColors.onLime),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// What follows the finger while a university is dragged: a tilted white
/// tag with the handle and the name.
class _DragPill extends StatelessWidget {
  const _DragPill({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: -5 * 3.14159 / 180,
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 220),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Lucide(LucideIcons.gripVertical, size: 12, color: FdColors.muted),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  shortUniversityTag(name),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(11, FontWeight.w800, FdColors.ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Chonnam National" from "Chonnam National University", as the drag tag
/// writes it.
String shortUniversityTag(String name) {
  final n = name.split(' — ').first.trim();
  return n.endsWith(' University') ? n.substring(0, n.length - ' University'.length) : n;
}

/// "Eng yaxshi 3 tasini tanlang": the navy banner over the list.
class _BestThreeBanner extends StatelessWidget {
  const _BestThreeBanner({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    Widget card(double left, double deg) => Positioned(
      left: left,
      top: 6,
      child: Transform.rotate(
        angle: deg * 3.14159 / 180,
        child: Container(
          width: 24,
          height: 32,
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(5),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
        ),
      ),
    );
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 11, 12, 11),
          decoration: BoxDecoration(
            color: FdColors.navy,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.lime, offset: Offset(4, 4))],
          ),
          child: Row(
            children: [
              SizedBox(
                width: 56,
                height: 44,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    card(2, -8),
                    card(30, 8),
                    Positioned(
                      left: 17,
                      top: 11,
                      child: Container(
                        width: 22,
                        height: 22,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: FdColors.lime,
                          shape: BoxShape.circle,
                          border: Border.all(color: FdColors.ink, width: 1.5),
                        ),
                        child: Text('VS', style: fdText(8, FontWeight.w800, FdColors.onLime)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.fdBestThreeTitle, style: fdText(14, FontWeight.w800, Colors.white)),
                    const SizedBox(height: 1),
                    Text(l.fdBestThreeBody(count), style: fdText(11, FontWeight.w400, FdColors.onNavyMuted)),
                  ],
                ),
              ),
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  shape: BoxShape.circle,
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: const Lucide(LucideIcons.arrowRight, size: 18, color: FdColors.onLime),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

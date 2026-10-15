import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/campus_photos.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../data/slots.dart';
import 'discover_routes.dart';
import 'filter_board_screen.dart';
import 'widgets/fd_parts.dart';
import 'widgets/uni_stack_card.dart';

/// Design screen 07, "Bu yoki bu? — chempionni tanlash": two of the results
/// at a time; the student taps the one they prefer. Two wins make a
/// champion, which drops into the next empty slot. When the slots are full
/// (or the list runs out) it moves on to screen 08.
class DuelScreen extends ConsumerStatefulWidget {
  const DuelScreen({super.key});

  @override
  ConsumerState<DuelScreen> createState() => _DuelScreenState();
}

class _DuelScreenState extends ConsumerState<DuelScreen> {
  Duel? _duel;

  /// The champion just crowned, flashed in its slot.
  String? _crowned;

  Duel _start() {
    final all = ref.read(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.read(catalogFilterProvider);
    final slots = ref.read(slotsProvider);
    final pool = [
      for (final u in boardResults(ref, all, f))
        if (!slots.contains(u.institutionId)) u.institutionId,
    ];
    return Duel.start(pool, open: slots.where((s) => s == null).length);
  }

  void _pick(bool first) {
    final d = _duel;
    if (d == null || d.done) return;
    HapticFeedback.selectionClick();
    AppEvents.track('duel_pick', props: {'institution_id': first ? d.a : d.b, 'other_id': first ? d.b : d.a});
    final next = d.pick(first: first);
    final slots = ref.read(slotsProvider.notifier);
    String? crowned;
    for (final c in next.champions.skip(d.champions.length)) {
      slots.add(c);
      crowned = c;
    }
    if (crowned != null) HapticFeedback.mediumImpact();
    setState(() {
      _duel = next;
      _crowned = crowned;
    });
    if (next.done) _finish();
  }

  Future<void> _finish() async {
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (mounted) context.pushReplacement(kDiscoverChosenPath);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value;
    final f = ref.watch(catalogFilterProvider);
    final slots = ref.watch(slotsProvider);
    if (all != null && _duel == null) {
      _duel = _start();
      // Nothing to choose between: straight on.
      if (_duel!.done) WidgetsBinding.instance.addPostFrameCallback((_) => _finish());
    }
    final d = _duel;
    final byId = {for (final u in all ?? const <CatalogUniversity>[]) u.institutionId: u};
    final a = d?.a == null ? null : byId[d!.a];
    final b = d?.b == null ? null : byId[d!.b];

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FdTitleBar(
                title: Row(
                  children: [
                    Text('${l.fdDuelTitleLead} ', style: kFdTitleStyle),
                    LimeMark(l.fdDuelTitleMark, style: kFdTitleStyle),
                  ],
                ),
                trailing: l.fdDuelCompared(d?.compared ?? 0),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                child: Row(
                  children: [
                    for (var i = 0; i < kSlotCount; i++) ...[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: AnimatedScale(
                          scale: slots[i] != null && slots[i] == _crowned ? 1.06 : 1,
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOutBack,
                          child: SlotTile(
                            number: i + 1,
                            height: 56,
                            university: slots[i] == null ? null : byId[slots[i]],
                            look: slots[i] == null ? SlotLook.empty : SlotLook.filled,
                            emptyGlyph: LucideIcons.trophy,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Slot(
                        university: a,
                        guideline: a == null ? null : guidelineFor(a, f) ?? a.primary,
                        wins: d?.winsA ?? 0,
                        fromRight: false,
                        onTap: () => _pick(true),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            const Expanded(child: ColoredBox(color: FdColors.navRule, child: SizedBox(height: 1.5))),
                            const SizedBox(width: 10),
                            Container(
                              width: 50,
                              height: 50,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: FdColors.lime,
                                shape: BoxShape.circle,
                                border: Border.all(color: FdColors.ink, width: 1.5),
                                boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
                              ),
                              child: Text(l.fdOr, style: fdText(13, FontWeight.w800, FdColors.onLime)),
                            ),
                            const SizedBox(width: 10),
                            const Expanded(child: ColoredBox(color: FdColors.navRule, child: SizedBox(height: 1.5))),
                          ],
                        ),
                      ),
                      _Slot(
                        university: b,
                        guideline: b == null ? null : guidelineFor(b, f) ?? b.primary,
                        wins: d?.winsB ?? 0,
                        fromRight: true,
                        onTap: () => _pick(false),
                      ),
                      const Spacer(),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(0, 10, 0, 14),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const _Pips(wins: kChampionWins),
                            const SizedBox(width: 6),
                            Text(l.fdDuelLegend, style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
                          ],
                        ),
                      ),
                    ],
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

/// One side of the duel; a new university slides in when the other side
/// won.
class _Slot extends StatelessWidget {
  const _Slot({
    required this.university,
    required this.guideline,
    required this.wins,
    required this.fromRight,
    required this.onTap,
  });

  final CatalogUniversity? university;
  final CatalogGuideline? guideline;
  final int wins;
  final bool fromRight;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = university;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 320),
      switchInCurve: Curves.easeOutBack,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, anim) => SlideTransition(
        position: Tween(begin: Offset(fromRight ? 1.1 : -1.1, 0), end: Offset.zero).animate(anim),
        child: FadeTransition(opacity: anim, child: child),
      ),
      child: u == null
          ? const SizedBox(key: ValueKey('none'), height: 200)
          : _DuelCard(key: ValueKey(u.institutionId), university: u, guideline: guideline!, wins: wins, onTap: onTap),
    );
  }
}

class _DuelCard extends StatelessWidget {
  const _DuelCard({super.key, required this.university, required this.guideline, required this.wins, required this.onTap});

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final int wins;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = university;
    final g = guideline;
    final photo = campusPhotoAsset(u.institutionId);
    final type = typeLabel(l, g.institutionType);
    final private = catalogType(g.institutionType) == CatalogType.private;
    final price = priceOf(g);
    final meta = [if (u.city != null) shortCity(u.city!), if (g.topikMin != null) 'TOPIK ${scoreText(g.topikMin!)}+'].join(' · ');
    return Semantics(
      button: true,
      label: u.displayName,
      hint: l.fdDuelPick,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 118,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (photo != null)
                      Image.asset(photo, fit: BoxFit.cover, cacheWidth: 720)
                    else
                      NameCover(name: u.nameKoShort ?? u.displayName),
                    const Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: ColoredBox(color: FdColors.ink, child: SizedBox(height: 1.5)),
                    ),
                    Positioned(
                      left: 10,
                      top: 10,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: FdColors.card,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: FdColors.ink, width: 1.5),
                        ),
                        child: _Pips(wins: wins),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (type != null)
                      Text(type, style: fdText(11, FontWeight.w700, private ? FdColors.privateBlue : FdColors.good)),
                    const SizedBox(height: 2),
                    Text(
                      u.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(16, FontWeight.w800, FdColors.ink, height: 1.2),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(12, FontWeight.w400, FdColors.muted)),
                        ),
                        if (price != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                            decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(5)),
                            child: Text(
                              money(price, g.currency, locale: l.localeName),
                              style: fdText(12, FontWeight.w800, FdColors.onLime),
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

/// Two circles, lime for each win.
class _Pips extends StatelessWidget {
  const _Pips({required this.wins});

  final int wins;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < kChampionWins; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < wins ? FdColors.lime : FdColors.card,
              border: Border.all(color: FdColors.ink, width: 1.5),
            ),
          ),
        ],
      ],
    );
  }
}

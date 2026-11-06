import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_detail_screen.dart' show catalogFirstStage;
import '../../catalog/presentation/catalog_format.dart';
import '../data/slots.dart';
import 'discover_routes.dart';

/// The ♥ universities as the app holds them in the catalogue, in slot order.
List<CatalogUniversity> heartedUniversities(List<String?> slots, List<CatalogUniversity> catalog) => [
  for (final id in slots.whereType<String>())
    ...catalog.where((u) => u.institutionId == id).take(1),
];

/// Days from [today] to [end] (YYYY-MM-DD), or null.
int? daysUntil(String? end, DateTime today) {
  final d = end == null ? null : DateTime.tryParse(end);
  if (d == null) return null;
  return DateTime(d.year, d.month, d.day).difference(DateTime(today.year, today.month, today.day)).inDays;
}

/// «Ariza yo'li» (ushlab qolish P20, Claude Design D5): a guest's ♥
/// universities, one at a time, with their first-stage steps and dates from
/// the guideline (v_app_university_rounds), the document list (D6) and the
/// way to apply with a consultant.
class GuestApplicationPathScreen extends ConsumerStatefulWidget {
  const GuestApplicationPathScreen({super.key, this.onDocuments});

  /// Opens the documents tab (the shell passes it).
  final VoidCallback? onDocuments;

  @override
  ConsumerState<GuestApplicationPathScreen> createState() => _GuestApplicationPathScreenState();
}

/// The chosen ♥ university, shared with the documents tab.
final guestPathSelectionProvider = NotifierProvider<GuestPathSelection, String?>(GuestPathSelection.new);

class GuestPathSelection extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String id) => state = id;
}

class _GuestApplicationPathScreenState extends ConsumerState<GuestApplicationPathScreen> {
  @override
  Widget build(BuildContext context) {
    final slots = ref.watch(slotsProvider);
    final catalog = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final hearted = heartedUniversities(slots, catalog);
    final picked = ref.watch(guestPathSelectionProvider);
    final u = hearted.where((x) => x.institutionId == picked).firstOrNull ?? hearted.firstOrNull;

    return Container(
      color: FdColors.page,
      child: SafeArea(
        bottom: false,
        child: u == null
            ? _Empty(onPick: tracked('guest_path.pick', () => context.go(kDiscoverPath)))
            : _Path(
                university: u,
                hearted: hearted,
                onSelect: (id) => ref.read(guestPathSelectionProvider.notifier).select(id),
                onDocuments: widget.onDocuments,
              ),
      ),
    );
  }
}

class _Path extends ConsumerWidget {
  const _Path({required this.university, required this.hearted, required this.onSelect, this.onDocuments});

  final CatalogUniversity university;
  final List<CatalogUniversity> hearted;
  final ValueChanged<String> onSelect;
  final VoidCallback? onDocuments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final g = university.forDegree(CatalogDegree.bachelor) ?? university.primary;
    final detail = ref.watch(catalogDetailProvider(g.id)).value;
    final rounds = catalogFirstStage(detail?.rounds ?? const []);
    final season = seasonLabel(l, g);
    final degree = g.degree == CatalogDegree.master ? l.guestPathMaster : l.guestPathBachelor;
    final today = DateTime.now();
    final firstOpen = rounds.indexWhere((r) => (daysUntil(r.endDate, today) ?? -1) >= 0);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 120),
      children: [
        Text([l.guestPathTitle, if (season != null) season, degree].join(' · '),
            style: fdText(12, FontWeight.w700, FdColors.pageMuted)),
        const SizedBox(height: 4),
        Text(university.displayName, style: fdText(24, FontWeight.w800, FdColors.onPage)),
        const SizedBox(height: 14),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final h in hearted) ...[
                _Chip(
                  label: '♥ ${h.displayName}',
                  selected: h.institutionId == university.institutionId,
                  onTap: tracked('guest_path.chip', () => onSelect(h.institutionId), props: {'institution_id': h.institutionId}),
                ),
                const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: _cardDecoration,
          child: rounds.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Text(l.guestPathNoDates, style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
                )
              : Column(
                  children: [
                    for (var i = 0; i < rounds.length; i++)
                      _Step(
                        n: i + 1,
                        round: rounds[i],
                        current: i == firstOpen,
                        daysLeft: i == firstOpen ? daysUntil(rounds[i].endDate, today) : null,
                        last: i == rounds.length - 1,
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 14),
        _Button(
          label: l.guestPathDocuments,
          color: FdColors.blue,
          fg: Colors.white,
          onTap: tracked('guest_path.documents', () => onDocuments?.call()),
        ),
        const SizedBox(height: 12),
        _Button(
          label: l.guestPathApply,
          color: FdColors.lime,
          fg: FdColors.onLime,
          onTap: tracked('guest_path.apply', () => context.push(kAssessmentLeadPath)),
        ),
      ],
    );
  }
}

const _cardDecoration = BoxDecoration(
  color: FdColors.card,
  borderRadius: BorderRadius.all(Radius.circular(22)),
  border: Border.fromBorderSide(BorderSide(color: FdColors.ink, width: 1.5)),
  boxShadow: [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
);

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.round, required this.current, required this.last, this.daysLeft});

  final int n;
  final CatalogRound round;
  final bool current;
  final bool last;
  final int? daysLeft;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final date = dateRangeLabel(context, round.startDate, round.endDate);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: FdColors.tint))),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: current ? FdColors.lime : FdColors.tint,
              shape: BoxShape.circle,
              border: current ? Border.all(color: FdColors.ink, width: 1.5) : null,
            ),
            child: Text('$n', style: fdText(12, FontWeight.w800, FdColors.ink)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(round.name ?? '', style: fdText(14, FontWeight.w800, FdColors.ink)),
                if (date != null) Text(date, style: fdText(12, FontWeight.w600, FdColors.muted)),
              ],
            ),
          ),
          if (daysLeft != null)
            Text('$daysLeft ${l.guestPathDays}', style: fdText(12, FontWeight.w800, FdColors.blueDeep)),
        ],
      ),
    );
  }
}

/// «9 – 20-noyabr», «27-noyabrgacha» — from the app's own date format.
String? dateRangeLabel(BuildContext context, String? start, String? end) {
  final l = AppLocalizations.of(context)!;
  final s = start == null ? null : DateTime.tryParse(start);
  final e = end == null ? null : DateTime.tryParse(end);
  if (e == null && s == null) return null;
  String day(DateTime d) => MaterialLocalizations.of(context).formatShortMonthDay(d);
  if (s != null && e != null && s != e) return '${day(s)} – ${day(e)}';
  if (e != null && s == null) return '${l.guestPathDeadline}: ${day(e)}';
  return day((e ?? s)!);
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: tracked('guest_path.chip_tap', onTap),
        child: Container(
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? FdColors.lime : const Color(0x14FFFFFF),
            borderRadius: BorderRadius.circular(999),
            border: selected ? Border.all(color: FdColors.ink, width: 1.5) : null,
          ),
          child: Text(label,
              style: fdText(13, selected ? FontWeight.w800 : FontWeight.w700, selected ? FdColors.onLime : FdColors.onPage)),
        ),
      );
}

class _Button extends StatelessWidget {
  const _Button({required this.label, required this.color, required this.fg, required this.onTap});

  final String label;
  final Color color;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        child: GestureDetector(
          onTap: tracked('guest_path.button', onTap),
          child: Container(
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: FdColors.ink, width: 1.5),
              boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
            ),
            child: Text(label, style: fdText(15, FontWeight.w800, fg)),
          ),
        ),
      );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.onPick});

  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.guestPathTitle, style: fdText(24, FontWeight.w800, FdColors.onPage)),
          const SizedBox(height: 8),
          Text(l.guestPathEmpty, style: fdText(13.5, FontWeight.w500, FdColors.pageMuted, height: 1.4)),
          const SizedBox(height: 16),
          _Button(label: l.guestPathPick, color: FdColors.lime, fg: FdColors.onLime, onTap: tracked('guest_path.empty_pick', onPick)),
        ],
      ),
    );
  }
}

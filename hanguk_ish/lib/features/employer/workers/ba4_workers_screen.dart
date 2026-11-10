import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/employer.dart';
import '../../../data/repositories/employer_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/pressable.dart';
import '../ko.dart';
import '../providers.dart';
import '../widgets.dart';

/// BA4 tab: 0 = 즐겨찾기, 1 = 최근 근무자.
final workersTabProvider = NotifierProvider<WorkersTab, int>(WorkersTab.new);

class WorkersTab extends Notifier<int> {
  @override
  int build() => 0;

  void select(int tab) => state = tab;
}

/// BA4 «근무자»: favourite and recent workers, searchable by name, with
/// «다시 요청» to invite one to a new shift.
class Ba4WorkersScreen extends ConsumerStatefulWidget {
  const Ba4WorkersScreen({super.key, required this.onRequestAgain});

  /// Opens BA2 to post a shift and invite [worker] to it.
  final void Function(WorkerCard worker) onRequestAgain;

  @override
  ConsumerState<Ba4WorkersScreen> createState() => _Ba4WorkersScreenState();
}

class _Ba4WorkersScreenState extends ConsumerState<Ba4WorkersScreen> {
  final _search = TextEditingController();
  final Map<String, bool> _favoriteOverride = {};

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _toggle(WorkerCard worker) async {
    final next = !(_favoriteOverride[worker.id] ?? worker.favorite);
    setState(() => _favoriteOverride[worker.id] = next);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final business = await ref.read(currentBusinessProvider.future);
      final saved = await ref.read(employerRepositoryProvider).toggleFavorite(business.id, worker.id);
      if (mounted) setState(() => _favoriteOverride[worker.id] = saved);
    } on Object catch (error) {
      if (mounted) setState(() => _favoriteOverride.remove(worker.id));
      (messenger..hideCurrentSnackBar()).showSnackBar(SnackBar(content: Text(Ko.error(error))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final tab = ref.watch(workersTabProvider);
    final loaded = ref.watch(businessWorkersProvider);
    final all = [
      for (final w in loaded.value ?? const <WorkerCard>[])
        _favoriteOverride.containsKey(w.id) ? w.copyWith(favorite: _favoriteOverride[w.id]) : w,
    ];
    // Favourites: the regulars first (우리 매장 N회), then by rating.
    final favorites = all.where((w) => w.favorite).toList()
      ..sort((a, b) {
        final byTimes = b.timesHere.compareTo(a.timesHere);
        return byTimes != 0 ? byTimes : (b.rating ?? 0).compareTo(a.rating ?? 0);
      });
    final source = tab == 0 ? favorites : all;
    final query = _search.text.trim().toLowerCase();
    final shown = query.isEmpty ? source : source.where((w) => w.fullName.toLowerCase().contains(query)).toList();
    final top = HiInsets.top(context, 56);
    final navSpace = MediaQuery.paddingOf(context).bottom;

    return HiBackdrop(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(18, top, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  child: HiText(Ko.workersTitle, style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
                ),
                const SizedBox(height: 12),
                HiSegmentedTabs(
                  labels: const [Ko.favorites, Ko.recentWorkers],
                  counts: ['${favorites.length}', '${all.length}'],
                  current: tab,
                  onSelect: ref.read(workersTabProvider.notifier).select,
                  semanticsLabel: Ko.workersTabs,
                ),
                const SizedBox(height: 12),
                _SearchField(controller: _search, onChanged: () => setState(() {})),
              ],
            ),
          ),
          // `top:234px; bottom:88px; overflow:hidden`: the list scrolls
          // between the header and the menu.
          Expanded(
            child: Padding(
              // The header ends at 219.6 px, the list starts at 234 px.
              padding: EdgeInsets.only(top: 14.4, bottom: navSpace - EmployerNav.rise),
              child: ClipRect(
                child: loaded.isLoading && !loaded.hasValue
                    ? const Center(child: CircularProgressIndicator(color: HiColors.lime))
                    : shown.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.fromLTRB(18, 40, 22, 0),
                            child: HiText(
                              query.isNotEmpty ? Ko.noResults : (tab == 0 ? Ko.noFavorites : Ko.noWorkers),
                              textAlign: TextAlign.center,
                              style: hiStyle(15, FontWeight.w600, color: HiColors.textSoft),
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(18, 0, 22, 20),
                            itemCount: shown.length,
                            itemBuilder: (context, i) => Padding(
                              padding: EdgeInsets.only(top: i == 0 ? 0 : 12),
                              child: _WorkerCardView(
                                worker: shown[i],
                                onStar: () => _toggle(shown[i]),
                                onRequestAgain: () => widget.onRequestAgain(shown[i]),
                              ),
                            ),
                          ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final text = hiStyle(16, FontWeight.w600, color: HiColors.ink);
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(HiRadii.field),
        border: const Border.fromBorderSide(HiBorders.ink),
      ),
      child: Row(
        children: [
          const SizedBox(width: 14 - 1),
          const HiIcon(HiIcons.search, size: 18, strokeWidth: 2, color: HiColors.inkMuted),
          const SizedBox(width: 42 - 14 - 18),
          Expanded(
            child: Semantics(
              label: Ko.searchLabel,
              textField: true,
              child: TextField(
                controller: controller,
                style: text,
                strutStyle: hiStrut(text),
                cursorColor: HiColors.ink,
                textInputAction: TextInputAction.search,
                onChanged: (_) => onChanged(),
                maxLines: 1,
                decoration: InputDecoration.collapsed(
                  hintText: Ko.searchPlaceholder,
                  hintStyle: text.copyWith(color: HiColors.inkMuted),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
        ],
      ),
    );
  }
}

class _WorkerCardView extends StatelessWidget {
  const _WorkerCardView({required this.worker, required this.onStar, required this.onRequestAgain});

  final WorkerCard worker;
  final VoidCallback onStar;
  final VoidCallback onRequestAgain;

  @override
  Widget build(BuildContext context) {
    final w = worker;
    return Semantics(
      container: true,
      label: w.fullName,
      child: EmployerCard(
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                WorkerAvatar(worker: w, size: 44),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      HiText(w.fullName, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          RatingMark(rating: w.rating, starSize: 14),
                          const SizedBox(width: 6),
                          Flexible(
                            child: HiText(
                              Ko.timesHere(w.timesHere, w.topik),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: hiStyle(14, FontWeight.w600, color: HiColors.inkMuted),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                HiPressable(
                  onTap: onStar,
                  selected: w.favorite,
                  semanticsLabel: w.favorite ? Ko.unfavorite(w.fullName) : Ko.favorite(w.fullName),
                  builder: (context, pressed) => Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: pressed ? HiColors.surface : null,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: HiIcon(
                      HiIcons.star,
                      size: 22,
                      strokeWidth: 1.5,
                      color: HiColors.ink,
                      fill: w.favorite ? HiColors.amber : null,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: HiText(
                    languageNamesKo(w.languages),
                    style: hiStyle(14, FontWeight.w600, height: 1.4, color: HiColors.inkMuted),
                  ),
                ),
                const SizedBox(width: 10),
                HiButton(
                  label: Ko.requestAgain,
                  style: HiButtonStyle.ink,
                  height: 44,
                  fontSize: 15,
                  horizontalPadding: 16,
                  onPressed: onRequestAgain,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

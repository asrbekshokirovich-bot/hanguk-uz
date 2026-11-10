import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../data/models/business.dart';
import '../../../data/models/shift.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../notifications/unread.dart';
import '../settings/app_language.dart';
import '../shift/shift_widgets.dart';
import 'feed_area.dart';
import 'feed_controller.dart';

/// Where the feed's actions lead (wired by the router).
class FeedActions {
  const FeedActions({
    required this.openShift,
    required this.takeShift,
    required this.openFeed,
    required this.openMap,
    required this.openNotifications,
  });

  final void Function(ShiftListing shift) openShift;
  final void Function(ShiftListing shift) takeShift;
  final VoidCallback openFeed;
  final VoidCallback openMap;
  final VoidCallback openNotifications;
}

/// A03 «Smenalar»: the shift feed with its loading, empty and offline states.
class FeedScreen extends ConsumerWidget {
  const FeedScreen({super.key, required this.actions});

  final FeedActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(feedProvider);
    final offline = !feed.isLoading && feed.hasError && feed.error is OfflineException;
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        watermark: '일',
        watermarkSize: 168,
        watermarkTop: 30,
        watermarkRight: -22,
        watermarkColor: HiColors.white08,
        child: offline ? _OfflineBody(actions: actions) : _FeedBody(feed: feed, actions: actions),
      ),
    );
  }
}

class _FeedBody extends ConsumerWidget {
  const _FeedBody({required this.feed, required this.actions});

  final AsyncValue<List<ShiftListing>> feed;
  final FeedActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    // Pull-to-refresh keeps the list on screen; a new filter or area, the
    // first load and a retry show the skeleton (A03 «Yuklanish»).
    final skeleton = feed is AsyncLoading || (feed.isLoading && feed.hasError);
    final failed = !skeleton && feed.hasError;
    final shifts = feed.value ?? const <ShiftListing>[];
    final Widget body;
    if (skeleton) {
      body = const _LoadingFeed();
    } else if (failed) {
      body = _ErrorRetry(onRetry: () => ref.invalidate(feedProvider));
    } else if (shifts.isEmpty) {
      body = _EmptyFeed(onChangeFilters: () => showFeedFilters(context, ref));
    } else {
      body = RefreshIndicator(
        color: HiColors.ink,
        backgroundColor: HiColors.lime,
        // A failure shows the error state instead of the list.
        onRefresh: () => ref.refresh(feedProvider.future).then<void>((_) {}, onError: (Object _) {}),
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(18, 0, 22, 24),
          itemCount: shifts.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, i) => ShiftCard(
            shift: shifts[i],
            lang: lang,
            now: now,
            onOpen: () => actions.openShift(shifts[i]),
            onTake: () => actions.takeShift(shifts[i]),
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FeedHeader(
          title: l10n.feedTitle,
          mapSelected: false,
          onList: () {},
          onMap: actions.openMap,
          onNotifications: actions.openNotifications,
          count: skeleton || failed ? null : shifts.length,
        ),
        const SizedBox(height: 6),
        Expanded(child: body),
      ],
    );
  }
}

/// Title row, location, day tabs and filters — shared by A03 and A04.
class FeedHeader extends ConsumerWidget {
  const FeedHeader({
    super.key,
    required this.title,
    required this.mapSelected,
    required this.onList,
    required this.onMap,
    required this.onNotifications,
    this.count,
    this.showLocation = true,
    this.chipBackground,
    this.offline = false,
  });

  final String title;
  final bool mapSelected;
  final VoidCallback onList;
  final VoidCallback onMap;
  final VoidCallback onNotifications;

  /// «· 12 ta smena»; null while loading.
  final int? count;
  final bool showLocation;

  /// Inactive chip fill (navy over the map).
  final Color? chipBackground;

  /// Adds the amber «Oflayn rejim» bar (the map keeps its pins meanwhile).
  final bool offline;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final filter = ref.watch(feedFilterProvider);
    final controller = ref.read(feedFilterProvider.notifier);
    final lang = ref.watch(appLanguageProvider).code;
    final area = ref.watch(feedAreaProvider).value;
    final unread = ref.watch(unreadNotificationsProvider);
    final shownCount = count;
    return Padding(
      padding: EdgeInsets.only(top: HiInsets.top(context, 56)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: HiText(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: hiStyle(28, FontWeight.w800, height: 1.15, letterSpacingEm: -0.02),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                HiViewToggle(
                  mapSelected: mapSelected,
                  onList: onList,
                  onMap: onMap,
                  listLabel: l10n.viewList,
                  mapLabel: l10n.viewMap,
                ),
                const SizedBox(width: 8),
                HiGlassIconButton(
                  icon: HiIcons.bell,
                  onTap: onNotifications,
                  semanticsLabel: unread > 0 ? l10n.notificationsUnread(unread) : l10n.notifications,
                  badge: unread > 0,
                ),
              ],
            ),
          ),
          if (showLocation) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: _LocationButton(
                  place: area?.place.name(lang) ?? '',
                  count: shownCount == null ? null : l10n.shiftCount(shownCount),
                  onTap: () => ref.invalidate(feedAreaProvider),
                ),
              ),
            ),
          ],
          if (offline) ...[
            const SizedBox(height: 12),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 18),
              child: OfflineBar(),
            ),
          ],
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: HiSegmentedTabs(
              labels: [l10n.dayToday, l10n.dayTomorrow, l10n.dayWeekend],
              current: filter.day.index,
              onSelect: (i) => controller.setDay(FeedDay.values[i]),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              children: [
                HiFilterAllButton(
                  onTap: () => showFeedFilters(context, ref),
                  semanticsLabel: l10n.allFilters,
                  background: chipBackground,
                ),
                const SizedBox(width: 8),
                HiFilterChip(
                  label: filter.minWage == null
                      ? l10n.filterPay
                      : l10n.filterPayValue(Won.worker(filter.minWage!)),
                  active: filter.minWage != null,
                  background: chipBackground,
                  onTap: () => _pickWage(context, ref),
                ),
                const SizedBox(width: 8),
                HiFilterChip(
                  label: filter.radiusKm == null ? l10n.filterDistance : l10n.filterDistanceValue(filter.radiusKm!),
                  active: filter.radiusKm != null,
                  background: chipBackground,
                  onTap: () => _pickRadius(context, ref),
                ),
                const SizedBox(width: 8),
                HiFilterChip(
                  label: l10n.filterCategory,
                  active: filter.categories.isNotEmpty,
                  background: chipBackground,
                  onTap: () => _pickCategories(context, ref),
                ),
                const SizedBox(width: 8),
                HiFilterChip(
                  label: l10n.filterTime,
                  active: filter.dayParts.isNotEmpty,
                  background: chipBackground,
                  onTap: () => _pickDayParts(context, ref),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The amber «Oflayn rejim» bar (A03).
class OfflineBar extends StatelessWidget {
  const OfflineBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: HiColors.amberSoft,
          borderRadius: BorderRadius.circular(HiRadii.button),
        ),
        child: Row(
          children: [
            const HiIcon(HiIcons.wifiOff, size: 18, strokeWidth: 2, color: HiColors.ink),
            const SizedBox(width: 10),
            Flexible(
              child: HiText(
                WorkerL10n.of(context).offlineBanner,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: hiStyle(15, FontWeight.w700, color: HiColors.ink),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationButton extends StatelessWidget {
  const _LocationButton({required this.place, required this.count, required this.onTap});

  final String place;
  final String? count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shown = count;
    return HiPressable(
      onTap: onTap,
      builder: (context, pressed) => Container(
        height: 44,
        padding: const EdgeInsets.only(left: 10, right: 12),
        decoration: BoxDecoration(
          color: pressed ? HiColors.white08 : null,
          borderRadius: BorderRadius.circular(HiRadii.button),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const HiIcon(HiIcons.mapPin, size: 18, strokeWidth: 2, color: HiColors.white),
            const SizedBox(width: 8),
            Flexible(
              child: HiText(
                place,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: hiStyle(15, FontWeight.w700),
              ),
            ),
            const SizedBox(width: 8),
            const HiIcon(HiIcons.chevronDown, size: 18, strokeWidth: 2, color: HiColors.white),
            if (shown != null) ...[
              const SizedBox(width: 8),
              HiText(shown, style: hiStyle(15, FontWeight.w600, color: HiColors.textMuted)),
            ],
          ],
        ),
      ),
    );
  }
}

class _LoadingFeed extends StatelessWidget {
  const _LoadingFeed();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: WorkerL10n.of(context).loadingShifts,
      liveRegion: true,
      child: ClipRect(
        child: OverflowBox(
          alignment: Alignment.topCenter,
          maxHeight: double.infinity,
          child: const Padding(
            padding: EdgeInsets.fromLTRB(18, 0, 22, 0),
            child: Column(
              children: [
                ShiftCardSkeleton(variant: 0),
                SizedBox(height: 16),
                ShiftCardSkeleton(variant: 1),
                SizedBox(height: 16),
                ShiftCardSkeleton(variant: 2, compact: true),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyFeed extends StatelessWidget {
  const _EmptyFeed({required this.onChangeFilters});

  final VoidCallback onChangeFilters;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 50, 22, 24),
      child: HiStatusMessage(
        icon: HiIcons.mapPinOff,
        title: l10n.emptyTitle,
        text: l10n.emptyText,
        action: l10n.emptyAction,
        actionIcon: HiIcons.slidersHorizontal,
        onAction: onChangeFilters,
      ),
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(18, 50, 22, 24),
      child: HiStatusMessage(
        icon: HiIcons.triangleAlert,
        title: l10n.errorGeneric,
        text: '',
        action: l10n.retry,
        actionIcon: HiIcons.refreshCw,
        onAction: onRetry,
      ),
    );
  }
}

/// A03 «Internet yo'q»: title and bell, the amber offline bar, the message.
class _OfflineBody extends ConsumerWidget {
  const _OfflineBody({required this.actions});

  final FeedActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final top = HiInsets.top(context, 56);
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(18, top, 18, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: HiText(
                    l10n.feedTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: hiStyle(28, FontWeight.w800, height: 1.15, letterSpacingEm: -0.02),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              HiGlassIconButton(
                icon: HiIcons.bell,
                onTap: actions.openNotifications,
                semanticsLabel: l10n.notifications,
              ),
            ],
          ),
          const SizedBox(height: 12),
          const OfflineBar(),
          // The message starts 300 px from the top of the prototype frame.
          const SizedBox(height: 300 - 56 - 50 - 12 - 44),
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: HiStatusMessage(
              icon: HiIcons.wifiOff,
              title: l10n.offlineTitle,
              text: l10n.offlineText,
              textMaxWidth: 300,
              action: l10n.retry,
              actionIcon: HiIcons.refreshCw,
              onAction: () {
                ref.invalidate(feedAreaProvider);
                ref.invalidate(feedProvider);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Filter sheets (the prototype shows the chips, not their menus)
// ---------------------------------------------------------------------------

Future<void> _pickWage(BuildContext context, WidgetRef ref) async {
  final l10n = WorkerL10n.of(context);
  final current = ref.read(feedFilterProvider).minWage;
  final value = await showHiPicker(
    context,
    title: l10n.filterPay,
    searchHint: l10n.search,
    searchable: false,
    selected: '${current ?? 0}',
    options: [
      HiPickerOption('0', l10n.filterAny),
      for (final w in FeedFilter.wageOptions) HiPickerOption('$w', '${Won.worker(w)}+'),
    ],
  );
  if (value == null) return;
  final wage = int.parse(value);
  ref.read(feedFilterProvider.notifier).setMinWage(wage == 0 ? null : wage);
}

Future<void> _pickRadius(BuildContext context, WidgetRef ref) async {
  final l10n = WorkerL10n.of(context);
  final current = ref.read(feedFilterProvider).radiusKm;
  final value = await showHiPicker(
    context,
    title: l10n.filterDistance,
    searchHint: l10n.search,
    searchable: false,
    selected: '${current ?? 0}',
    options: [
      HiPickerOption('0', l10n.filterAny),
      for (final km in FeedFilter.radiusOptions) HiPickerOption('$km', l10n.filterDistanceValue(km)),
    ],
  );
  if (value == null) return;
  final km = int.parse(value);
  ref.read(feedFilterProvider.notifier).setRadius(km == 0 ? null : km);
}

Future<void> _pickCategories(BuildContext context, WidgetRef ref) async {
  final l10n = WorkerL10n.of(context);
  final current = ref.read(feedFilterProvider).categories;
  final value = await showHiMultiPicker(
    context,
    title: l10n.filterCategory,
    apply: l10n.filterApply,
    reset: l10n.filterReset,
    selected: {for (final c in current) c.name},
    options: [
      for (final c in BusinessCategory.values) HiPickerOption(c.name, categoryLook(l10n, c).$2),
    ],
  );
  if (value == null) return;
  ref.read(feedFilterProvider.notifier).setCategories({for (final v in value) businessCategoryFrom(v)});
}

Future<void> _pickDayParts(BuildContext context, WidgetRef ref) async {
  final l10n = WorkerL10n.of(context);
  final current = ref.read(feedFilterProvider).dayParts;
  final labels = [
    '${l10n.slotMorning} 06–12',
    '${l10n.slotDay} 12–18',
    '${l10n.slotEvening} 18–24',
    '${l10n.slotNight} 00–06',
  ];
  final value = await showHiMultiPicker(
    context,
    title: l10n.filterTime,
    apply: l10n.filterApply,
    reset: l10n.filterReset,
    selected: {for (final p in current) '$p'},
    options: [for (var i = 0; i < 4; i++) HiPickerOption('$i', labels[i])],
  );
  if (value == null) return;
  ref.read(feedFilterProvider.notifier).setDayParts({for (final v in value) int.parse(v)});
}

/// «Barcha filtrlar»: the four filters one after another.
Future<void> showFeedFilters(BuildContext context, WidgetRef ref) async {
  final l10n = WorkerL10n.of(context);
  final choice = await showHiActions(context, actions: [
    (HiIcons.wallet, l10n.filterPay),
    (HiIcons.mapPin, l10n.filterDistance),
    (HiIcons.briefcase, l10n.filterCategory),
    (HiIcons.clock, l10n.filterTime),
  ]);
  if (choice == null || !context.mounted) return;
  switch (choice) {
    case 0:
      await _pickWage(context, ref);
    case 1:
      await _pickRadius(context, ref);
    case 2:
      await _pickCategories(context, ref);
    case 3:
      await _pickDayParts(context, ref);
  }
}

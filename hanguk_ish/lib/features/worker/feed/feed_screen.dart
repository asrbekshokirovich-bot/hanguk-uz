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
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/navigation.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../load_error.dart';
import '../me/free_dates.dart';
import '../monthly/monthly_jobs.dart';
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
    required this.openMonthly,
    required this.openNotifications,
  });

  final void Function(ShiftListing shift) openShift;
  final void Function(ShiftListing shift) takeShift;
  final VoidCallback openFeed;
  final VoidCallback openMonthly;
  final VoidCallback openNotifications;
}

/// A03 «Smenalar»: the shift feed with its loading, empty and offline states.
class FeedScreen extends ConsumerWidget {
  const FeedScreen({super.key, required this.actions});

  final FeedActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // «Oylik ishlar»: the same screen with jobs paid by the month — no day
    // tabs, the same filters.
    if (ref.watch(feedModeProvider) == FeedMode.monthly) {
      return Scaffold(
        backgroundColor: HiColors.navy,
        body: HiBackdrop(child: _MonthlyBody(actions: actions)),
      );
    }
    final feed = ref.watch(feedProvider);
    final offline = !feed.isLoading && feed.hasError && feed.error is OfflineException;
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        // No «일» watermark here: behind the header buttons only a cut-off
        // fragment of it showed, like stray letters.
        child: offline ? _OfflineBody(actions: actions) : _FeedBody(feed: feed, actions: actions),
      ),
    );
  }
}

/// A03 in «Oylik ishlar» mode: the monthly jobs the filters let through.
class _MonthlyBody extends ConsumerWidget {
  const _MonthlyBody({required this.actions});

  final FeedActions actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final jobs = ref.watch(visibleMonthlyJobsProvider);
    final Widget body = jobs.when(
      loading: () => const Center(child: CircularProgressIndicator(color: HiColors.lime)),
      error: (error, _) => WorkerLoadError(error: error, onRetry: () => ref.invalidate(monthlyJobsProvider)),
      data: (list) => list.isEmpty
          ? HiStatusMessage(
              icon: HiIcons.briefcase,
              title: l10n.monthlyJobsEmpty,
              text: l10n.monthlyJobsEmptyText,
              textMaxWidth: 300,
              action: l10n.emptyAction,
              actionIcon: HiIcons.slidersHorizontal,
              onAction: () => showFeedFilters(context, ref),
            )
          : RefreshIndicator(
              color: HiColors.ink,
              backgroundColor: HiColors.lime,
              onRefresh: () async => refreshOrSay(context, ref.refresh(monthlyJobsProvider.future)),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(18, 0, 22, 24),
                itemCount: list.length,
                separatorBuilder: (context, index) => const SizedBox(height: 16),
                itemBuilder: (context, i) => MonthlyJobCard(job: list[i], lang: lang),
              ),
            ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FeedHeader(title: l10n.monthlyJobsTitle, onNotifications: actions.openNotifications),
        const SizedBox(height: 6),
        Expanded(child: body),
      ],
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
          onNotifications: actions.openNotifications,
          count: skeleton || failed ? null : shifts.length,
        ),
        const SizedBox(height: 6),
        const _FreeDatesBanner(),
        Expanded(child: body),
      ],
    );
  }
}

/// The first step for a worker: post the free days. We search jobs for them.
class _FreeDatesBanner extends ConsumerWidget {
  const _FreeDatesBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final count = ref.watch(myFreeDatesProvider).value?.length ?? 0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 22, 12),
      child: HiButton(
        label: count == 0 ? l10n.freeDatesTitle : '${l10n.freeDatesTitle} · $count',
        height: 44,
        fontSize: 15,
        style: count == 0 ? HiButtonStyle.lime : HiButtonStyle.ghost,
        onPressed: () => showFreeDatesSheet(context),
      ),
    );
  }
}

/// Title row, location, day tabs and filters — shared by A03 and A04.
class FeedHeader extends ConsumerWidget {
  const FeedHeader({
    super.key,
    required this.title,
    this.onMonthly,
    required this.onNotifications,
    this.count,
    this.showLocation = true,
    this.chipBackground,
    this.offline = false,
  });

  final String title;
  /// The header pill: on the map it goes to the monthly jobs; on A03 (null)
  /// it switches the list between day shifts and monthly jobs.
  final VoidCallback? onMonthly;
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
    // On A03 the pill switches the list; on the map (it has onMonthly) the map
    // stays a day view.
    final mode = ref.watch(feedModeProvider);
    final monthly = onMonthly == null && mode == FeedMode.monthly;
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
                _MonthlyButton(
                  label: monthly ? l10n.feedTitle : l10n.monthlyJobsShort,
                  icon: monthly ? HiIcons.briefcase : HiIcons.calendarCheck,
                  onTap: onMonthly ??
                      () => ref.read(feedModeProvider.notifier).set(monthly ? FeedMode.daily : FeedMode.monthly),
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
                  place: area?.place.name(lang) ?? '–',
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
          if (!monthly) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: HiSegmentedTabs(
                labels: [l10n.dayToday, l10n.dayTomorrow, l10n.dayWeekend],
                current: filter.day.index,
                onSelect: (i) => controller.setDay(FeedDay.values[i]),
              ),
            ),
          ],
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
                  label: (monthly ? filter.monthlyMinWage : filter.minWage) == null
                      ? l10n.filterPay
                      : l10n.filterPayValue(Won.worker((monthly ? filter.monthlyMinWage : filter.minWage)!)),
                  active: (monthly ? filter.monthlyMinWage : filter.minWage) != null,
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

/// The header pill: «Oylik ishlar» (to the monthly jobs) / «Smenalar» (back).
class _MonthlyButton extends StatelessWidget {
  const _MonthlyButton({required this.label, required this.icon, required this.onTap});

  final String label;
  final HiIconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: label,
      builder: (context, pressed) => Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: pressed ? HiColors.white18 : HiColors.white12,
          borderRadius: BorderRadius.circular(HiRadii.pill),
          border: Border.all(color: HiColors.white20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            HiIcon(icon, size: 18, strokeWidth: 2, color: HiColors.white),
            const SizedBox(width: 8),
            Flexible(
              child: HiText(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: hiStyle(14, FontWeight.w700, color: HiColors.white),
              ),
            ),
          ],
        ),
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
  final monthly = ref.read(feedModeProvider) == FeedMode.monthly;
  final filter = ref.read(feedFilterProvider);
  final current = monthly ? filter.monthlyMinWage : filter.minWage;
  final value = await showHiPicker(
    context,
    title: l10n.filterPay,
    searchHint: l10n.search,
    searchable: false,
    selected: '${current ?? 0}',
    options: [
      HiPickerOption('0', l10n.filterAny),
      for (final w in monthly ? FeedFilter.monthlyWageOptions : FeedFilter.wageOptions)
        HiPickerOption('$w', '${Won.worker(w)}+'),
    ],
  );
  if (value == null) return;
  final wage = int.parse(value);
  final controller = ref.read(feedFilterProvider.notifier);
  monthly ? controller.setMonthlyMinWage(wage == 0 ? null : wage) : controller.setMinWage(wage == 0 ? null : wage);
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
  // Two choices: daytime (06–18: morning and afternoon) and night (18–06:
  // evening and night); the filter keeps the four 6-hour parts.
  final value = await showHiMultiPicker(
    context,
    title: l10n.filterTime,
    apply: l10n.filterApply,
    reset: l10n.filterReset,
    selected: {
      if (current.contains(0) || current.contains(1)) 'day',
      if (current.contains(2) || current.contains(3)) 'night',
    },
    options: [
      HiPickerOption('day', '${l10n.timeDaytime} 06–18'),
      HiPickerOption('night', '${l10n.timeNighttime} 18–06'),
    ],
  );
  if (value == null) return;
  ref.read(feedFilterProvider.notifier).setDayParts({
    if (value.contains('day')) ...const [0, 1],
    if (value.contains('night')) ...const [2, 3],
  });
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

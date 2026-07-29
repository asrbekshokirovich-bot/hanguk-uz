import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/uni_db_providers.dart';
import 'widgets/coming_soon_card.dart';
import '../../map/data/map_repository.dart';

/// `/notifications/settings` — per-tracked-university notification prefs.
///
/// Each row in `user_tracked_universities` carries four boolean flags:
///   notify_on_calendar_change  — dates on the cycle move
///   notify_on_correction       — 정정공고 published
///   notify_on_requirement_change — admission requirements changed
///   notify_on_scholarship_change — scholarship rules changed
///
/// This screen exposes them as a per-institution accordion. Edits write
/// straight to the row via updateNotificationPrefs() — RLS scopes by
/// auth.uid() so the user can only touch their own rows.
///
/// Seoul Night pass: glass rows with the 알림 hangul accent and token-styled
/// toggles (the same hand-rolled pill as the interview setup's Timed Mode —
/// a Material Switch cannot resolve every colour to a Seoul token).
class NotificationSettingsScreen extends ConsumerWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final asyncRows = ref.watch(notificationSettingsProvider);
    return SeoulNightScaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top bar — glass back circle + title with its hangul label,
          // matching the section headers elsewhere in the redesign.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              12,
              SeoulSizes.screenPadding,
              8,
            ),
            child: Row(
              children: [
                _GlassCircleButton(
                  icon: Icons.arrow_back_rounded,
                  tooltip: l10n.a11yTooltipBack,
                  onTap: () => Navigator.of(context).maybePop(),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: HangulTag(
                    en: l10n.notifSettingsTitle,
                    ko: '알림',
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: asyncRows.when(
              loading: () => const Center(
                child: CircularProgressIndicator(color: SeoulColors.lime),
              ),
              error: (e, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(SeoulSizes.screenPadding),
                  child: Text(
                    l10n.notifSettingsLoadError(e),
                    textAlign: TextAlign.center,
                    style: SeoulType.bodySecondary,
                  ),
                ),
              ),
              data: (rows) {
                if (rows.isEmpty) {
                  return ComingSoonCard(
                    title: l10n.notifSettingsEmptyTitle,
                    subtitle: l10n.notifSettingsEmptyBody,
                    icon: Icons.notifications_outlined,
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    SeoulSizes.screenPadding,
                    8,
                    SeoulSizes.screenPadding,
                    32,
                  ),
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _PrefsCard(row: rows[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _PrefsCard extends ConsumerStatefulWidget {
  const _PrefsCard({required this.row});
  final Map<String, dynamic> row;

  @override
  ConsumerState<_PrefsCard> createState() => _PrefsCardState();
}

class _PrefsCardState extends ConsumerState<_PrefsCard> {
  bool _busy = false;

  String get _institutionId => widget.row['institution_id'] as String;

  /// The university's name, not its primary key.
  ///
  /// This card heads a set of toggles that decide which alerts a student
  /// gets, so it has to say *which university* — it was rendering the raw
  /// UUID, leaving no way to tell one card from another. Falls back to the
  /// id only if the catalogue has not loaded or no longer has the row.
  String get _institutionName {
    final unis = ref.watch(universitiesProvider).value;
    if (unis == null) return _institutionId;
    for (final u in unis) {
      if (u.id == _institutionId) return u.name;
    }
    return _institutionId;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final calendar = (widget.row['notify_on_calendar_change'] as bool?) ?? true;
    final correction = (widget.row['notify_on_correction'] as bool?) ?? true;
    final requirement =
        (widget.row['notify_on_requirement_change'] as bool?) ?? true;
    final scholarship =
        (widget.row['notify_on_scholarship_change'] as bool?) ?? false;
    final preferredLang = (widget.row['preferred_lang'] as String?) ?? 'en';

    return GlassCard(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      // One saved layer per card would add up in a long tracked list.
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const HangulGlyphTile(glyph: '알'),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _institutionName,
                      style: SeoulType.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.notifSettingsPushLanguage(preferredLang),
                      style: SeoulType.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          _ToggleRow(
            title: l10n.notifSettingsCalendar,
            subtitle: l10n.notifSettingsCalendarDesc,
            value: calendar,
            onChanged: _busy ? null : (v) => _update(notifyOnCalendarChange: v),
          ),
          _ToggleRow(
            title: l10n.notifSettingsCorrection,
            subtitle: l10n.notifSettingsCorrectionDesc,
            value: correction,
            onChanged: _busy ? null : (v) => _update(notifyOnCorrection: v),
          ),
          _ToggleRow(
            title: l10n.notifSettingsRequirement,
            subtitle: l10n.notifSettingsRequirementDesc,
            value: requirement,
            onChanged: _busy
                ? null
                : (v) => _update(notifyOnRequirementChange: v),
          ),
          _ToggleRow(
            title: l10n.notifSettingsScholarship,
            subtitle: l10n.notifSettingsScholarshipDesc,
            value: scholarship,
            onChanged: _busy
                ? null
                : (v) => _update(notifyOnScholarshipChange: v),
          ),
        ],
      ),
    );
  }

  Future<void> _update({
    bool? notifyOnCalendarChange,
    bool? notifyOnCorrection,
    bool? notifyOnRequirementChange,
    bool? notifyOnScholarshipChange,
  }) async {
    setState(() => _busy = true);
    try {
      await updateNotificationPrefs(
        institutionId: _institutionId,
        notifyOnCalendarChange: notifyOnCalendarChange,
        notifyOnCorrection: notifyOnCorrection,
        notifyOnRequirementChange: notifyOnRequirementChange,
        notifyOnScholarshipChange: notifyOnScholarshipChange,
      );
      ref.invalidate(notificationSettingsProvider);
      ref.invalidate(institutionTrackingProvider(_institutionId));
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocalizations.of(context)!.notifSettingsUpdateError(err),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

/// One notification preference: title + description on the left, a Seoul
/// Night toggle on the right.
///
/// The whole row is the tap target, which is what the `SwitchListTile` this
/// replaced always did. Leaving only the 64px pill live meant tapping the
/// words "Correction notices" did nothing — a fifth of the row's width was
/// interactive and the rest looked identical.
class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final enabled = onChanged != null;
    return Semantics(
      toggled: value,
      enabled: enabled,
      label: title,
      child: GestureDetector(
        onTap: enabled ? () => onChanged!(!value) : null,
        behavior: HitTestBehavior.opaque,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: SeoulType.body),
                    const SizedBox(height: 2),
                    Text(subtitle, style: SeoulType.caption),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // The pill no longer needs its own semantics — the row above
              // announces the switch, and two nested toggles would be read
              // out twice.
              ExcludeSemantics(
                child: _SeoulToggle(
                  value: value,
                  semanticLabel: title,
                  onChanged: onChanged,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Seoul Night on/off switch — the same hand-rolled pill as the interview
/// setup's Timed Mode toggle, so every colour resolves to a token. The 44px
/// outer box is the tap target (spec §4); the pill is smaller. A null
/// [onChanged] disables it (dimmed, taps ignored) while a write is in flight.
class _SeoulToggle extends StatelessWidget {
  const _SeoulToggle({
    required this.value,
    required this.onChanged,
    required this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final enabled = onChanged != null;
    return Semantics(
      toggled: value,
      enabled: enabled,
      label: semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? () => onChanged!(!value) : null,
        child: SizedBox(
          width: 64,
          height: SeoulSizes.minTapTarget,
          child: Center(
            child: AnimatedOpacity(
              opacity: enabled ? 1.0 : 0.45,
              duration: SeoulMotion.fast,
              child: AnimatedContainer(
                duration: SeoulMotion.fast,
                curve: SeoulMotion.smooth,
                width: 52,
                height: 30,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: value ? SeoulColors.lime : SeoulColors.neutralFill,
                  borderRadius: BorderRadius.circular(SeoulRadii.pill),
                  border: Border.all(
                    color: value ? SeoulColors.lime : SeoulColors.glassBorder,
                  ),
                  boxShadow: value && enabled
                      ? SeoulShadows.limeGlowSmall
                      : null,
                ),
                child: AnimatedAlign(
                  duration: SeoulMotion.fast,
                  curve: SeoulMotion.smooth,
                  alignment: value
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: value
                          ? SeoulColors.ink
                          : SeoulColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Glass circle that pops the route — same idiom as the Account screen's
/// back button.
class _GlassCircleButton extends StatelessWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: SeoulColors.glass,
              border: Border.all(color: SeoulColors.glassBorder),
            ),
            child: Icon(icon, size: 20, color: SeoulColors.textPrimary),
          ),
        ),
      ),
    );
  }
}

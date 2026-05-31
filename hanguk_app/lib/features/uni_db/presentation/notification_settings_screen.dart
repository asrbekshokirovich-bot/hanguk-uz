import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/app_localizations.dart';
import '../data/uni_db_providers.dart';
import 'widgets/coming_soon_card.dart';

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
class NotificationSettingsScreen extends ConsumerWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final asyncRows = ref.watch(notificationSettingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.notifSettingsTitle)),
      body: asyncRows.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(l10n.notifSettingsLoadError(e))),
        data: (rows) {
          if (rows.isEmpty) {
            return ComingSoonCard(
              title: l10n.notifSettingsEmptyTitle,
              subtitle: l10n.notifSettingsEmptyBody,
              icon: Icons.notifications_outlined,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _PrefsCard(row: rows[i]),
          );
        },
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

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _institutionId,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.notifSettingsPushLanguage(preferredLang),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          SwitchListTile(
            title: Text(l10n.notifSettingsCalendar),
            subtitle: Text(l10n.notifSettingsCalendarDesc),
            value: calendar,
            onChanged: _busy ? null : (v) => _update(notifyOnCalendarChange: v),
          ),
          SwitchListTile(
            title: Text(l10n.notifSettingsCorrection),
            subtitle: Text(l10n.notifSettingsCorrectionDesc),
            value: correction,
            onChanged: _busy ? null : (v) => _update(notifyOnCorrection: v),
          ),
          SwitchListTile(
            title: Text(l10n.notifSettingsRequirement),
            subtitle: Text(l10n.notifSettingsRequirementDesc),
            value: requirement,
            onChanged: _busy
                ? null
                : (v) => _update(notifyOnRequirementChange: v),
          ),
          SwitchListTile(
            title: Text(l10n.notifSettingsScholarship),
            subtitle: Text(l10n.notifSettingsScholarshipDesc),
            value: scholarship,
            onChanged: _busy
                ? null
                : (v) => _update(notifyOnScholarshipChange: v),
          ),
          const SizedBox(height: 8),
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

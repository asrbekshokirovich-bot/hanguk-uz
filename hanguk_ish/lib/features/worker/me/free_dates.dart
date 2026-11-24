import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/pyol_repository.dart';
import '../../../data/repositories/shift_repository.dart' show OfflineException, ShiftActionException;
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../l10n/gen/worker_l10n.dart';

final myFreeDatesProvider = FutureProvider.autoDispose<List<FreeDate>>(
  (ref) => ref.watch(pyolRepositoryProvider).freeDates(),
  retry: (count, error) => null,
);

/// «My free days»: the worker picks the days (next 14) and the part of the
/// day, and one city; we search jobs for those days and send an alert.
Future<void> showFreeDatesSheet(BuildContext context) => showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: HiColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => const FreeDatesSheet(),
    );

class FreeDatesSheet extends ConsumerStatefulWidget {
  const FreeDatesSheet({super.key});

  @override
  ConsumerState<FreeDatesSheet> createState() => _FreeDatesSheetState();
}

class _FreeDatesSheetState extends ConsumerState<FreeDatesSheet> {
  /// Day (yyyy-mm-dd) → 'day' / 'night' / 'any'.
  final Map<String, String> _parts = {};
  final _district = TextEditingController();
  bool _loaded = false;
  bool _busy = false;

  static DateTime _koreaToday() {
    final k = DateTime.now().toUtc().add(const Duration(hours: 9));
    return DateTime(k.year, k.month, k.day);
  }

  static List<String> _weekdays(WorkerL10n l10n) => [
        l10n.dayShortMon, l10n.dayShortTue, l10n.dayShortWed, l10n.dayShortThu,
        l10n.dayShortFri, l10n.dayShortSat, l10n.dayShortSun,
      ];

  static String _key(DateTime d) => FreeDate(day: d, part: 'any', district: '').dayText;

  @override
  void dispose() {
    _district.dispose();
    super.dispose();
  }

  void _fill(List<FreeDate> dates) {
    if (_loaded) return;
    _loaded = true;
    for (final d in dates) {
      _parts[d.dayText] = d.part;
    }
    if (dates.isNotEmpty) _district.text = dates.last.district;
  }

  /// A tap on a day asks what the worker means: day, night, any time, or
  /// not free (no guessing from repeated taps).
  Future<void> _pick(DateTime d, String label) async {
    final l10n = WorkerL10n.of(context);
    final key = _key(d);
    final choice = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      backgroundColor: HiColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HiText(label, style: hiStyle(17, FontWeight.w800, color: HiColors.ink)),
              const SizedBox(height: 12),
              for (final (value, text) in [
                ('day', l10n.partDay),
                ('night', l10n.partNight),
                ('any', l10n.partAny),
              ]) ...[
                HiButton(
                  label: text,
                  height: 46,
                  fontSize: 16,
                  style: _parts[key] == value ? HiButtonStyle.lime : HiButtonStyle.outline,
                  onPressed: () => Navigator.of(context).pop(value),
                ),
                const SizedBox(height: 8),
              ],
              HiButton(
                label: l10n.freeDatesNotFree,
                height: 46,
                fontSize: 16,
                style: HiButtonStyle.text,
                textColor: HiColors.ink,
                onPressed: () => Navigator.of(context).pop(''),
              ),
            ],
          ),
        ),
      ),
    );
    if (choice == null || !mounted) return;
    setState(() {
      if (choice.isEmpty) {
        _parts.remove(key);
      } else {
        _parts[key] = choice;
      }
    });
  }

  Future<void> _save() async {
    final l10n = WorkerL10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final district = _district.text.trim();
    if (_parts.isNotEmpty && district.isEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.freeDatesCity)));
      return;
    }
    final keys = _parts.keys.toList()..sort();
    // A short check before saving: offers will come for these days.
    final weekdays = _weekdays(l10n);
    String partName(String p) => switch (p) { 'day' => l10n.partDay, 'night' => l10n.partNight, _ => l10n.partAny };
    final summary = [
      for (final k in keys)
        () {
          final d = DateTime.parse(k);
          return '${weekdays[d.weekday - 1]} ${d.day} (${partName(_parts[k]!)})';
        }(),
    ].join(', ');
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.freeDatesConfirmTitle),
        content: Text(keys.isEmpty ? l10n.freeDatesClearBody : l10n.freeDatesConfirmBody(summary, district)),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(l10n.back)),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: Text(l10n.freeDatesConfirmYes)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(pyolRepositoryProvider).setFreeDates([
        for (final k in keys) FreeDate(day: DateTime.parse(k), part: _parts[k]!, district: district),
      ]);
      ref.invalidate(myFreeDatesProvider);
      messenger.showSnackBar(SnackBar(content: Text(l10n.freeDatesSaved)));
      if (mounted) Navigator.of(context).pop();
    } on OfflineException {
      messenger.showSnackBar(SnackBar(content: Text(l10n.offlineTitle)));
    } on ShiftActionException catch (e) {
      messenger.showSnackBar(
          SnackBar(content: Text(e.code == 'DISTRICT_REQUIRED' ? l10n.freeDatesCity : l10n.errorGeneric)));
    } on Object {
      messenger.showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final saved = ref.watch(myFreeDatesProvider);
    final value = saved.value;
    if (value != null) _fill(value);
    final today = _koreaToday();
    final days = [for (var i = 0; i < 14; i++) today.add(Duration(days: i))];
    final weekdays = _weekdays(l10n);
    String partName(String p) => switch (p) { 'day' => l10n.partDay, 'night' => l10n.partNight, _ => l10n.partAny };
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HiText(l10n.freeDatesTitle, style: hiStyle(18, FontWeight.w800, color: HiColors.ink)),
              const SizedBox(height: 6),
              HiText(l10n.freeDatesHint, style: hiStyle(14, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
              const SizedBox(height: 14),
              if (saved.isLoading && !_loaded)
                const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final d in days)
                      FilterChip(
                        label: Text(
                          '${weekdays[d.weekday - 1]} ${d.day}'
                          '${_parts[_key(d)] == null ? '' : ' · ${partName(_parts[_key(d)]!)}'}',
                        ),
                        selected: _parts.containsKey(_key(d)),
                        onSelected: (_) => _pick(d, '${weekdays[d.weekday - 1]} ${d.day}'),
                      ),
                  ],
                ),
              const SizedBox(height: 14),
              TextField(
                controller: _district,
                maxLength: 60,
                decoration: InputDecoration(labelText: l10n.freeDatesCity, counterText: ''),
              ),
              const SizedBox(height: 8),
              if (_parts.isEmpty)
                HiText(l10n.freeDatesNone, style: hiStyle(13, FontWeight.w500, color: HiColors.inkMuted)),
              const SizedBox(height: 12),
              HiButton(label: l10n.freeDatesSave, height: 48, fontSize: 16, onPressed: _busy ? null : _save),
            ],
          ),
        ),
      ),
    );
  }
}

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/worker_app.dart' show WorkerRoutes;
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/catalog/places.dart';
import '../../../data/models/account.dart';
import '../../../data/repositories/account_repository.dart';
import '../../../data/repositories/auth_repository.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../coins/coins.dart';
import '../profile/worker_profile_draft.dart';
import '../profile/worker_profile_repository.dart';
import '../settings/app_language.dart';
import '../shift/shift_detail_screen.dart' show formatRating;

/// The worker's track record (A09, CRM).
final workerStatsProvider = FutureProvider.autoDispose<WorkerStats>(
  (ref) => ref.watch(accountRepositoryProvider).stats(),
  retry: (count, error) => null,
);

/// «Ishonch bali» (`my_trust`).
final workerTrustProvider = FutureProvider.autoDispose<WorkerTrust>(
  (ref) => ref.watch(accountRepositoryProvider).trust(),
  retry: (count, error) => null,
);

/// «Mapo-gu» from «Mapo-gu, Seul» / «서울 마포구» → «마포구».
String shortDistrict(String name, String lang) {
  if (lang == 'ko') return name.split(' ').last;
  return name.split(',').first.trim();
}

/// «+821055234417» → «+82 10-5523-4417»; [masked]: «+82 10-••••-4417».
String formatPhone(String? phone, {bool masked = false}) {
  final digits = (phone ?? '').replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.isEmpty) return '—';
  final local = digits.startsWith('82') ? digits.substring(2) : digits.replaceFirst(RegExp('^0'), '');
  if (local.length < 9) return phone!;
  final a = local.substring(0, 2);
  final b = local.substring(2, local.length - 4);
  final c = local.substring(local.length - 4);
  return '+82 $a-${masked ? '••••' : b}-$c';
}

/// «Azizbek K.»: the first name and the first letter of the last.
String shortName(WorkerProfileDraft d) {
  final first = d.firstName.trim();
  final last = d.lastName.trim();
  if (last.isEmpty) return first;
  return '$first ${last.characters.first}.'.trim();
}

/// The trust level of a score: Bronza < 80, Kumush 80–89, Oltin 90+.
String trustLevelName(WorkerL10n l10n, int score) =>
    score >= 90 ? l10n.trustGold : score >= 80 ? l10n.trustSilver : l10n.trustBronze;

/// What the next level brings, or the gold one's perk.
String trustPerkText(WorkerL10n l10n, int score) => score >= 90
    ? l10n.trustGoldPerk
    : l10n.trustNextPerk((score >= 80 ? 90 : 80) - score);

int _mask({required List<int> days, required List<int> slots}) {
  var mask = 0;
  for (final d in days) {
    for (final s in slots) {
      mask |= WorkerProfileDraft.bit(d, s);
    }
  }
  return mask;
}

/// The parts of the day of «Qachon ishlay olaman»: Kunduzi and Kechqurun
/// (the bits 1 and 2 of each day).
const scheduleSlots = [1, 2];

/// How many of the 14 cells are on.
int scheduleCount(int availability) {
  var n = 0;
  for (var d = 0; d < 7; d++) {
    for (final s in scheduleSlots) {
      if (availability & WorkerProfileDraft.bit(d, s) != 0) n++;
    }
  }
  return n;
}

const _cardDecoration = BoxDecoration(
  color: HiColors.white07,
  borderRadius: BorderRadius.all(Radius.circular(HiRadii.card)),
  border: Border.fromBorderSide(BorderSide(color: HiColors.white10)),
);

/// Saves the draft a moment after the last change; a failure says so.
mixin _SavesSoon<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  Timer? _saveTimer;

  void saveSoon() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 900), () async {
      final repo = ref.read(workerProfileRepositoryProvider);
      final draft = ref.read(workerProfileDraftProvider);
      try {
        await repo.save(draft);
      } on Object {
        if (!mounted) return;
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(WorkerL10n.of(context).errorGeneric)));
      }
    });
  }

  @override
  void dispose() {
    // Leaving within the delay must not drop the last tap: save it now.
    if (_saveTimer?.isActive ?? false) {
      _saveTimer!.cancel();
      ref.read(workerProfileRepositoryProvider).save(ref.read(workerProfileDraftProvider)).catchError((Object _) {});
    }
    super.dispose();
  }
}

/// «Qachon ishlay olaman»: days across, Kunduzi / Kechqurun down;
/// a tap turns a cell on or off; three presets under it.
class _ScheduleSection extends ConsumerStatefulWidget {
  const _ScheduleSection();

  @override
  ConsumerState<_ScheduleSection> createState() => _ScheduleSectionState();
}

class _ScheduleSectionState extends ConsumerState<_ScheduleSection> with _SavesSoon {
  void _toggle(int day, int slot) {
    ref.read(workerProfileDraftProvider.notifier).toggleSlot(day, slot);
    saveSoon();
  }

  void _preset(int mask) {
    ref.read(workerProfileDraftProvider.notifier).setAvailability(mask);
    saveSoon();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final draft = ref.watch(workerProfileDraftProvider);
    final today = Kst.wallClock(ref.watch(clockProvider)()).weekday - 1;
    final days = [
      l10n.dayShortMon, l10n.dayShortTue, l10n.dayShortWed, l10n.dayShortThu,
      l10n.dayShortFri, l10n.dayShortSat, l10n.dayShortSun,
    ];
    final dayNames = [l10n.dayMon, l10n.dayTue, l10n.dayWed, l10n.dayThu, l10n.dayFri, l10n.daySat, l10n.daySun];
    final slots = {1: l10n.slotDay, 2: l10n.slotEvening};
    // Only the two parts shown count (an old morning or night bit is not one).
    final shown = draft.availability & _mask(days: const [0, 1, 2, 3, 4, 5, 6], slots: scheduleSlots);
    final presets = [
      (l10n.presetWeekends, _mask(days: const [5, 6], slots: scheduleSlots)),
      (l10n.presetEvenings, _mask(days: const [0, 1, 2, 3, 4, 5, 6], slots: const [2])),
      (l10n.presetAll, _mask(days: const [0, 1, 2, 3, 4, 5, 6], slots: scheduleSlots)),
    ];
    Widget cell(int d, int s) => HiPressable(
          onTap: () => _toggle(d, s),
          selected: draft.isAvailable(d, s),
          semanticsLabel: '${dayNames[d]}, ${slots[s]!}',
          // The whole column is the target (40 px and more); the square inside.
          builder: (context, pressed) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
            child: Container(
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: draft.isAvailable(d, s) ? HiColors.lime : (pressed ? HiColors.white14 : HiColors.white08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: draft.isAvailable(d, s)
                  ? const HiIcon(HiIcons.check, size: 16, strokeWidth: 3, color: HiColors.onLime)
                  : null,
            ),
          ),
        );
    Widget label(int s, double width) => SizedBox(
          width: width,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: HiText(slots[s]!, maxLines: 1, style: hiStyle(12, FontWeight.w800)),
          ),
        );
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 14),
      decoration: _cardDecoration,
      child: LayoutBuilder(builder: (context, box) {
        const lead = 50.0;
        // The parts of the day at the left as drawn; on a narrow phone, where
        // the cells would get under 40 px, the names go above each row.
        final side = (box.maxWidth - lead) / 7 >= 40;
        final dayRow = Row(
          children: [
            if (side) const SizedBox(width: lead),
            for (var d = 0; d < 7; d++)
              Expanded(
                child: HiText(days[d],
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    style: hiStyle(12, FontWeight.w800, color: d == today ? HiColors.lime : HiColors.textMuted)),
              ),
          ],
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(
                  child: Semantics(header: true, child: HiText(l10n.scheduleTitle, style: hiStyle(17, FontWeight.w800))),
                ),
                HiText(l10n.scheduleCount(scheduleCount(draft.availability)),
                    style: hiStyle(13, FontWeight.w600, color: HiColors.textMuted)),
              ],
            ),
            const SizedBox(height: 6),
            HiText(l10n.scheduleHint, style: hiStyle(13, FontWeight.w500, height: 1.4, color: HiColors.textMuted)),
            const SizedBox(height: 12),
            dayRow,
            for (final s in scheduleSlots) ...[
              if (!side) ...[const SizedBox(height: 6), label(s, box.maxWidth)],
              Row(
                children: [
                  if (side) label(s, lead),
                  for (var d = 0; d < 7; d++) Expanded(child: cell(d, s)),
                ],
              ),
            ],
          const SizedBox(height: 12),
          Row(
            children: [
              for (var i = 0; i < presets.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: HiPressable(
                    onTap: () => _preset(presets[i].$2),
                    semanticsLabel: presets[i].$1,
                    selected: shown == presets[i].$2,
                    builder: (context, pressed) => Container(
                      height: 40,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                        color: shown == presets[i].$2 ? HiColors.white10 : (pressed ? HiColors.white08 : null),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: HiColors.white20),
                      ),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: HiText(presets[i].$1, maxLines: 1, style: hiStyle(12, FontWeight.w700)),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          ],
        );
      }),
    );
  }
}

/// «Profil»: who, the puyl, when they can work, the trust score, the app
/// language and the settings (the «10 qadam» design).
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final language = ref.watch(appLanguageProvider);
    final lang = language.code;
    final draft = ref.watch(workerProfileDraftProvider);
    final trust = ref.watch(workerTrustProvider).value;
    final wallet = ref.watch(coinsProvider).value;
    final initials = [draft.firstName, draft.lastName]
        .where((p) => p.trim().isNotEmpty)
        .map((p) => p.trim().characters.first.toUpperCase())
        .join();
    final area = draft.district == null ? '' : shortDistrict(placeName(workAreas, draft.district, lang), lang);
    final subtitle = [if (draft.phone != null) formatPhone(draft.phone, masked: true), if (area.isNotEmpty) area].join(' · ');
    final photo = draft.photoPath;

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: ListView(
          padding: EdgeInsets.fromLTRB(16, HiInsets.top(context, 56), 16, 24),
          children: [
            Semantics(
              container: true,
              explicitChildNodes: true,
              label: l10n.personalInfo,
              child: Row(
                children: [
                  ExcludeSemantics(
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: const BoxDecoration(
                        color: HiColors.blueDeep,
                        shape: BoxShape.circle,
                        border: Border.fromBorderSide(BorderSide(color: HiColors.white14)),
                      ),
                      clipBehavior: Clip.antiAlias,
                      alignment: Alignment.center,
                      child: photo != null
                          ? Image(image: profilePhoto(photo), width: 56, height: 56, fit: BoxFit.cover)
                          : HiText(initials, style: hiStyle(20, FontWeight.w800)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: HiText(shortName(draft), maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: hiStyle(21, FontWeight.w800, height: 1.2)),
                        ),
                        if (subtitle.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          HiText(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: hiStyle(13, FontWeight.w600, color: HiColors.textMuted)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  HiPressable(
                    onTap: () => context.push(WorkerRoutes.profileEdit),
                    semanticsLabel: l10n.profileEditTitle,
                    builder: (context, pressed) => Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: pressed ? HiColors.white14 : HiColors.white07,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: HiColors.white20),
                      ),
                      child: const HiIcon(HiIcons.pencil, size: 18, strokeWidth: 2.2, color: HiColors.lime),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // «Puyl balansi» and «+ To'ldirish».
            Semantics(
              container: true,
              label: l10n.coinsTitle,
              child: Container(
                padding: const EdgeInsets.fromLTRB(18, 16, 16, 16),
                decoration: BoxDecoration(color: HiColors.lime, borderRadius: BorderRadius.circular(HiRadii.card)),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          HiText(l10n.coinsTitle, style: hiStyle(15, FontWeight.w700, color: HiColors.onLime)),
                          const SizedBox(height: 2),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              HiText(wallet == null ? '—' : '${wallet.balance}',
                                  style: hiStyle(44, FontWeight.w800, height: 1.1, color: HiColors.onLime, family: HiFamily.mono)),
                              const SizedBox(width: 6),
                              HiText('P', style: hiStyle(20, FontWeight.w800, color: HiColors.onLime)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    HiPressable(
                      onTap: () => _topUp(context),
                      semanticsLabel: l10n.topUp,
                      builder: (context, pressed) => Container(
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: pressed ? HiColors.ink : HiColors.onLime,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: HiText(l10n.topUp, style: hiStyle(14, FontWeight.w800, color: HiColors.white)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const _ScheduleSection(),
            const SizedBox(height: 16),
            _TrustCard(trust: trust, lang: lang),
            const SizedBox(height: 18),
            HiText(l10n.appLanguage, style: hiStyle(13, FontWeight.w700, color: HiColors.textMuted)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: HiColors.white07, borderRadius: BorderRadius.circular(14)),
              child: Row(
                children: [
                  for (final l in AppLanguage.profileOrder)
                    Expanded(
                      child: HiPressable(
                        onTap: () => ref.read(appLanguageProvider.notifier).select(l),
                        selected: l == language,
                        semanticsLabel: l.label,
                        builder: (context, pressed) => Container(
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: l == language ? HiColors.white : (pressed ? HiColors.white10 : null),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: HiText(l.short,
                              style: hiStyle(14, FontWeight.w800, color: l == language ? HiColors.ink : HiColors.white)),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Container(
              decoration: _cardDecoration,
              child: Column(
                children: [
                  _SettingRow(
                    label: l10n.fieldHomeAddress,
                    value: (draft.homeAddress ?? '').isNotEmpty ? draft.homeAddress! : (area.isEmpty ? '—' : area),
                    onTap: () => context.push(WorkerRoutes.profileEdit),
                  ),
                  const _Divider(),
                  _SettingRow(
                    label: l10n.fieldMaxKm,
                    value: l10n.kmValue(draft.maxKm),
                    onTap: () => context.push(WorkerRoutes.profileEdit),
                  ),
                  const _Divider(),
                  _SettingRow(label: l10n.coinHistoryRow, value: '', onTap: () => _coinHistory(context, lang)),
                  const _Divider(),
                  _SettingRow(label: l10n.help, value: '', onTap: () => _help(context)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _topUp(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
      builder: (context) => _Sheet(
        title: l10n.topUpSoonTitle,
        children: [
          HiText(l10n.topUpSoonText, style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
          const SizedBox(height: 20),
          HiButton(label: l10n.close, onPressed: () => Navigator.of(context).pop()),
        ],
      ),
    );
  }

  Future<void> _coinHistory(BuildContext context, String lang) => showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
        builder: (context) => _Sheet(
          title: WorkerL10n.of(context).coinHistoryRow,
          children: [CoinCard(lang: lang)],
        ),
      );

  Future<void> _help(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
        builder: (context) => const _HelpSheet(),
      );
}

/// «Ishonch bali»: the ring, the level and what the next one brings, then
/// what the score is made of. Numbers that did not load are «—».
class _TrustCard extends StatelessWidget {
  const _TrustCard({required this.trust, required this.lang});

  final WorkerTrust? trust;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final t = trust;
    final score = t?.reliability;
    final rows = [
      (l10n.trustWent, t == null ? '—' : l10n.trustWentValue(t.went), HiColors.white),
      (
        l10n.trustOnTime,
        t?.onTimePercent == null ? '—' : '${t!.onTimePercent}%',
        (t?.onTimePercent ?? 0) >= 90 ? const Color(0xFF7BE0A8) : HiColors.white,
      ),
      (l10n.trustRating, t?.rating == null ? '—' : '${formatRating(t!.rating!, lang)} ★', const Color(0xFFFFD36A)),
      (
        l10n.trustNoShows,
        t == null ? '—' : l10n.trustNoShowsValue(t.noShows),
        (t?.noShows ?? 1) == 0 ? const Color(0xFF7BE0A8) : const Color(0xFFFF8A7A),
      ),
    ];
    return Semantics(
      container: true,
      label: l10n.trustTitle,
      value: score == null ? '—' : '$score',
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
        decoration: _cardDecoration,
        child: Column(
          children: [
            Row(
              children: [
                SizedBox(
                  width: 84,
                  height: 84,
                  child: CustomPaint(
                    painter: _RingPainter((score ?? 0) / 100),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          HiText(score == null ? '—' : '$score',
                              style: hiStyle(26, FontWeight.w800, height: 1.1, family: HiFamily.mono)),
                          HiText(l10n.outOf100, style: hiStyle(10, FontWeight.w700, color: HiColors.textMuted)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      HiText(l10n.trustTitle, style: hiStyle(17, FontWeight.w800)),
                      if (score != null) ...[
                        const SizedBox(height: 2),
                        HiText(trustLevelName(l10n, score), style: hiStyle(14, FontWeight.w800, color: HiColors.lime)),
                        const SizedBox(height: 4),
                        HiText(trustPerkText(l10n, score),
                            style: hiStyle(12, FontWeight.w500, height: 1.4, color: HiColors.textMuted)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            for (final (label, value, color) in rows) ...[
              const _Divider(),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 11),
                child: Row(
                  children: [
                    Expanded(child: HiText(label, style: hiStyle(14, FontWeight.w600, color: HiColors.textSoft))),
                    HiText(value, style: hiStyle(14, FontWeight.w800, color: color)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.fraction);

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 8.0;
    final rect = Offset.zero & size;
    final arc = rect.deflate(stroke / 2);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = HiColors.white10;
    canvas.drawArc(arc, 0, math.pi * 2, false, base);
    final value = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = HiColors.lime;
    canvas.drawArc(arc, -math.pi / 2, math.pi * 2 * fraction.clamp(0.0, 1.0), false, value);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction;
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) => Container(height: 1, color: HiColors.white10);
}

/// A settings row: the label, the value and «›».
class _SettingRow extends StatelessWidget {
  const _SettingRow({required this.label, required this.value, required this.onTap});

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      semanticsLabel: value.isEmpty ? label : '$label: $value',
      builder: (context, pressed) => Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: pressed ? HiColors.white07 : null,
        child: Row(
          children: [
            Expanded(child: HiText(label, style: hiStyle(15, FontWeight.w700))),
            const SizedBox(width: 12),
            Flexible(
              child: HiText(value.isEmpty ? '›' : '$value ›',
                  textAlign: TextAlign.end,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted)),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _report(BuildContext context, WorkerAccountRepository account) async {
  final l10n = WorkerL10n.of(context);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final result = await showModalBottomSheet<(ReportSubject, String)>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
    builder: (context) => const _ReportSheet(),
  );
  if (result == null) return;
  try {
    await account.report(result.$1, result.$2);
    messenger?.showSnackBar(SnackBar(content: Text(l10n.reportSent)));
  } on Object catch (error) {
    messenger?.showSnackBar(SnackBar(content: Text(switch (error) {
      ShiftActionException(code: 'TOO_MANY_REQUESTS') => l10n.errTooManyRequests,
      OfflineException() => l10n.errOffline,
      _ => l10n.errorGeneric,
    })));
  }
}

/// White sheet frame used by the report and help sheets.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: media.size.height * 0.88),
        child: Container(
          decoration: const BoxDecoration(
            color: HiColors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            border: Border(top: HiBorders.ink),
          ),
          padding: EdgeInsets.fromLTRB(18, 10, 22, HiInsets.bottom(context, 30)),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 5,
                    decoration: BoxDecoration(color: const Color(0xFFC9D3E6), borderRadius: BorderRadius.circular(HiRadii.pill)),
                  ),
                ),
                const SizedBox(height: 16),
                Semantics(
                  header: true,
                  child: HiText(title, style: hiStyle(24, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02, color: HiColors.ink)),
                ),
                const SizedBox(height: 16),
                ...children,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ReportSheet extends StatefulWidget {
  const _ReportSheet();

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  ReportSubject? _subject;
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final subjects = {
      ReportSubject.employer: l10n.reportEmployer,
      ReportSubject.payment: l10n.reportPayment,
      ReportSubject.safety: l10n.reportSafety,
      ReportSubject.other: l10n.reportOther,
    };
    final ready = _subject != null && _text.text.trim().isNotEmpty;
    return _Sheet(
      title: l10n.reportTitle,
      children: [
        HiText(l10n.reportAbout, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final entry in subjects.entries)
              HiPressable(
                onTap: () => setState(() => _subject = entry.key),
                selected: _subject == entry.key,
                builder: (context, pressed) => Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: _subject == entry.key ? HiColors.ink : (pressed ? HiColors.surface : HiColors.white),
                    borderRadius: BorderRadius.circular(HiRadii.pill),
                    border: Border.fromBorderSide(HiBorders.ink),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      HiText(
                        entry.value,
                        style: hiStyle(15, FontWeight.w800, color: _subject == entry.key ? HiColors.white : HiColors.ink),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: HiColors.white,
            borderRadius: BorderRadius.circular(HiRadii.field),
            border: Border.fromBorderSide(HiBorders.ink),
          ),
          child: TextField(
            controller: _text,
            minLines: 3,
            maxLines: 6,
            maxLength: 1000,
            style: hiStyle(16, FontWeight.w500, color: HiColors.ink),
            cursorColor: HiColors.ink,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration.collapsed(
              hintText: l10n.reportHint,
              hintStyle: hiStyle(16, FontWeight.w500, color: HiColors.inkMuted),
            ),
          ),
        ),
        const SizedBox(height: 16),
        HiButton(
          label: l10n.reportSend,
          onPressed: ready ? () => Navigator.of(context).pop((_subject!, _text.text.trim())) : null,
        ),
        const SizedBox(height: 8),
        HiButton(
          label: l10n.back,
          style: HiButtonStyle.text,
          textColor: HiColors.ink,
          height: 48,
          fontSize: 16,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

class _HelpSheet extends ConsumerWidget {
  const _HelpSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final items = [
      (l10n.helpShiftsQ, l10n.helpShiftsA),
      (l10n.helpQrQ, l10n.helpQrA),
      (l10n.helpPayQ, l10n.helpPayA),
      (l10n.helpCancelQ, l10n.cancelPolicyText),
    ];
    return _Sheet(
      title: l10n.helpTitle,
      children: [
        for (final (q, a) in items) ...[
          HiText(q, style: hiStyle(16, FontWeight.w800, color: HiColors.ink)),
          const SizedBox(height: 6),
          HiText(a, style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
          const SizedBox(height: 16),
        ],
        HiButton(
          label: l10n.report,
          style: HiButtonStyle.outline,
          icon: HiIcons.flag,
          iconSize: 19,
          iconStroke: 2,
          iconGap: 8,
          onPressed: () {
            // The sheet closes; the report sheet opens over the profile.
            final root = Navigator.of(context, rootNavigator: true).context;
            final account = ref.read(accountRepositoryProvider);
            Navigator.of(context).pop();
            _report(root, account);
          },
        ),
        const SizedBox(height: 10),
        HiButton(label: l10n.close, onPressed: () => Navigator.of(context).pop()),
        const SizedBox(height: 8),
        // Google Play's account-deletion rule: reachable from inside the app.
        HiButton(
          label: l10n.deleteAccount,
          style: HiButtonStyle.text,
          textColor: HiColors.redInk,
          fontSize: 15,
          height: 44,
          onPressed: () => _deleteAccount(context, ref),
        ),
      ],
    );
  }

  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final l10n = WorkerL10n.of(context);
    final navigator = Navigator.of(context);
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.maybeOf(context);
    final sure = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
      builder: (context) => _Sheet(
        title: l10n.deleteAccountTitle,
        children: [
          HiText(l10n.deleteAccountText, style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
          const SizedBox(height: 20),
          HiButton(
            label: l10n.deleteAccountConfirm,
            style: HiButtonStyle.danger,
            onPressed: () => Navigator.of(context).pop(true),
          ),
          const SizedBox(height: 10),
          HiButton(label: l10n.back, style: HiButtonStyle.outline, onPressed: () => Navigator.of(context).pop(false)),
        ],
      ),
    );
    if (sure != true) return;
    try {
      await ref.read(authRepositoryProvider).deleteAccount();
      if (navigator.canPop()) navigator.pop();
      messenger?.showSnackBar(SnackBar(content: Text(l10n.deleteAccountDone)));
      router.go(WorkerRoutes.login);
    } on Object catch (error) {
      messenger?.showSnackBar(SnackBar(content: Text(switch (error) {
        OfflineException() => l10n.errOffline,
        _ => l10n.errorGeneric,
      })));
    }
  }
}

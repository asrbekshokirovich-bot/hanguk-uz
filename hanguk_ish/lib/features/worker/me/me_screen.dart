import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/catalog/places.dart';
import '../../../data/models/account.dart';
import '../../../data/repositories/account_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/picker_sheet.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../profile/profile_screens.dart';
import '../profile/worker_profile_draft.dart';
import '../settings/app_language.dart';
import '../shift/shift_detail_screen.dart';

/// The worker's track record (A11).
final workerStatsProvider = FutureProvider.autoDispose<WorkerStats>(
  (ref) => ref.watch(accountRepositoryProvider).stats(),
  retry: (count, error) => null,
);

/// «Mapo-gu» from «Mapo-gu, Seul» / «서울 마포구» → «마포구».
String shortDistrict(String name, String lang) {
  if (lang == 'ko') return name.split(' ').last;
  return name.split(',').first.trim();
}

/// A11 «Profil».
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final language = ref.watch(appLanguageProvider);
    final lang = language.code;
    final draft = ref.watch(workerProfileDraftProvider);
    final stats = ref.watch(workerStatsProvider).value;
    final name = '${draft.firstName} ${draft.lastName}'.trim();
    final initials = [draft.firstName, draft.lastName]
        .where((p) => p.trim().isNotEmpty)
        .map((p) => p.trim()[0].toUpperCase())
        .join();
    final place = [
      if (draft.university != null && draft.university != notAStudentCode)
        placeName(seoulUniversities, draft.university, lang),
      if (draft.district != null) shortDistrict(placeName(seoulDistricts, draft.district, lang), lang),
    ].where((s) => s.isNotEmpty).join(' · ');
    final spoken = [for (final code in WorkerProfileDraft.languageCodes) if (draft.languages.contains(code)) code];
    final photo = draft.photoPath;

    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: ListView(
          padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 22, 24),
          children: [
            Semantics(
              header: true,
              child: HiText(l10n.navProfile, style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02)),
            ),
            const SizedBox(height: 14),
            Semantics(
              container: true,
              label: l10n.personalInfo,
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: HiColors.blue,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.fromBorderSide(HiBorders.ink),
                  boxShadow: HiShadows.hard,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        ExcludeSemantics(
                          child: Container(
                            width: 68,
                            height: 68,
                            decoration: const BoxDecoration(
                              color: HiColors.white,
                              shape: BoxShape.circle,
                              border: Border.fromBorderSide(HiBorders.ink),
                            ),
                            clipBehavior: Clip.antiAlias,
                            alignment: Alignment.center,
                            child: photo != null
                                ? Image(image: profilePhoto(photo), width: 68, height: 68, fit: BoxFit.cover)
                                : HiText(initials, style: hiStyle(24, FontWeight.w800, color: HiColors.ink)),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              HiText(name, style: hiStyle(21, FontWeight.w800, height: 1.2)),
                              if (place.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                HiText(place, style: hiStyle(14, FontWeight.w600, color: HiColors.textSoft)),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(height: 1, color: HiColors.white22),
                    const SizedBox(height: 14),
                    HiText(l10n.reliability, style: hiStyle(14, FontWeight.w700, color: HiColors.textSoft)),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        HiText(
                          '${stats?.reliability ?? 100}',
                          style: hiStyle(40, FontWeight.w800, height: 1.1, family: HiFamily.mono),
                        ),
                        const SizedBox(width: 4),
                        HiText(l10n.outOf100, style: hiStyle(16, FontWeight.w700, color: HiColors.textSoft)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Semantics(
                      label: l10n.reliability,
                      value: '${stats?.reliability ?? 100}',
                      child: Container(
                        height: 10,
                        decoration: BoxDecoration(color: HiColors.white18, borderRadius: BorderRadius.circular(HiRadii.pill)),
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: ((stats?.reliability ?? 100) / 100).clamp(0.0, 1.0),
                          child: Container(
                            decoration: BoxDecoration(color: HiColors.lime, borderRadius: BorderRadius.circular(HiRadii.pill)),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _StatCard(
                    label: l10n.completedShiftsLabel,
                    value: HiText('${stats?.completedShifts ?? 0}', style: hiStyle(28, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    label: l10n.ratingsCount(stats?.ratingCount ?? 0),
                    value: Row(
                      children: [
                        HiText(
                          stats?.ratingAverage == null ? '—' : formatRating(stats!.ratingAverage!, lang),
                          style: hiStyle(28, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono),
                        ),
                        const SizedBox(width: 6),
                        const HiIcon(HiIcons.star, size: 22, strokeWidth: 1.5, color: HiColors.ink, fill: HiColors.amber),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: HiColors.white,
                borderRadius: BorderRadius.circular(HiRadii.card),
                border: Border.fromBorderSide(HiBorders.ink),
                boxShadow: HiShadows.hard,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: HiText(l10n.languagesTitle, style: hiStyle(16, FontWeight.w800, color: HiColors.ink))),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (var i = 0; i < spoken.length; i++)
                        _LanguageChip(
                          label: switch (spoken[i]) {
                            _ when i == 0 => l10n.nativeLanguage(spokenLanguageName(l10n, spoken[i])),
                            'ko' when draft.topik > 0 => l10n.koreanTopik(spokenLanguageName(l10n, 'ko'), draft.topik),
                            final code => spokenLanguageName(l10n, code),
                          },
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            HiPressable(
              onTap: () => _pickLanguage(context, ref),
              builder: (context, pressed) => Container(
                height: 56,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: pressed ? HiColors.surface : HiColors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.fromBorderSide(HiBorders.ink),
                  boxShadow: HiShadows.hard,
                ),
                child: Row(
                  children: [
                    const HiIcon(HiIcons.globe, size: 20, strokeWidth: 2, color: HiColors.ink),
                    const SizedBox(width: 12),
                    Expanded(child: HiText(l10n.appLanguage, style: hiStyle(16, FontWeight.w800, color: HiColors.ink))),
                    const SizedBox(width: 12),
                    HiText(language.label, style: hiStyle(15, FontWeight.w600, color: HiColors.inkMuted)),
                    const SizedBox(width: 12),
                    const HiIcon(HiIcons.chevronRight, size: 18, strokeWidth: 2.2, color: HiColors.inkMuted),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: HiButton(
                    label: l10n.report,
                    style: HiButtonStyle.ghost,
                    icon: HiIcons.flag,
                    iconSize: 19,
                    iconStroke: 2,
                    iconGap: 8,
                    fontSize: 16,
                    onPressed: () => _report(context, ref),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: HiButton(
                    label: l10n.help,
                    style: HiButtonStyle.white,
                    icon: HiIcons.circleHelp,
                    iconSize: 19,
                    iconStroke: 2,
                    iconGap: 8,
                    fontSize: 16,
                    onPressed: () => _help(context),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickLanguage(BuildContext context, WidgetRef ref) async {
    final l10n = WorkerL10n.of(context);
    final current = ref.read(appLanguageProvider);
    final value = await showHiPicker(
      context,
      title: l10n.appLanguage,
      searchHint: l10n.search,
      searchable: false,
      selected: current.code,
      options: [for (final l in AppLanguage.values) HiPickerOption(l.code, l.label)],
    );
    if (value != null) ref.read(appLanguageProvider.notifier).select(AppLanguage.fromCode(value));
  }

  Future<void> _report(BuildContext context, WidgetRef ref) async {
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
      await ref.read(accountRepositoryProvider).report(result.$1, result.$2);
      messenger?.showSnackBar(SnackBar(content: Text(l10n.reportSent)));
    } on Object {
      messenger?.showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
    }
  }

  Future<void> _help(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        barrierColor: const Color.fromRGBO(6, 13, 43, 0.74),
        builder: (context) => const _HelpSheet(),
      );
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.fromBorderSide(HiBorders.ink),
        boxShadow: HiShadows.hard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HiText(label, style: hiStyle(13, FontWeight.w700, color: HiColors.inkMuted)),
          const SizedBox(height: 4),
          value,
        ],
      ),
    );
  }
}

class _LanguageChip extends StatelessWidget {
  const _LanguageChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(HiRadii.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [HiText(label, style: hiStyle(14, FontWeight.w700, color: HiColors.ink))],
      ),
    );
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

class _HelpSheet extends StatelessWidget {
  const _HelpSheet();

  @override
  Widget build(BuildContext context) {
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
        HiButton(label: l10n.close, onPressed: () => Navigator.of(context).pop()),
      ],
    );
  }
}

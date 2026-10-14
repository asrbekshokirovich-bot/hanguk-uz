import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../data/university_choices_repository.dart';
import '../domain/university_choice.dart';

const kUniversityChoicesPath = '/university-choices';

/// "Universitet tanlovi": the universities the consultant offered, by rank.
/// For each one still waiting the student taps "Roziman" or "O'zgartirish
/// so'rayman" (with a reason); after that the consultant gives the final
/// confirmation in the CRM, and the card says so.
class UniversityChoicesScreen extends ConsumerWidget {
  const UniversityChoicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final async = ref.watch(myUniversityChoicesProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: () => context.canPop() ? context.pop() : context.go('/'),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l.ucTitle, style: fdText(22, FontWeight.w800, FdColors.ink, height: 1.1)),
                          Text(l.ucSubtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(11, FontWeight.w400, FdColors.muted)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: async.when(
                  loading: () => const Center(child: CircularProgressIndicator(color: FdColors.navy)),
                  error: (_, _) => _Message(
                    text: l.appsLoadError,
                    action: HardChoice(
                      label: l.commonRetry,
                      selected: false,
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      onTap: () => ref.invalidate(myUniversityChoicesProvider),
                    ),
                  ),
                  data: (choices) {
                    if (choices.isEmpty) return _Message(text: l.ucEmpty);
                    final waiting = choices.where((c) => c.canAnswer).length;
                    return RefreshIndicator(
                      color: FdColors.navy,
                      onRefresh: () => ref.refresh(myUniversityChoicesProvider.future),
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        children: [
                          if (waiting > 0) ...[
                            _NeedsAnswerBanner(count: waiting),
                            const SizedBox(height: 12),
                          ],
                          for (final c in choices) ...[
                            UniversityChoiceCard(choice: c),
                            const SizedBox(height: 12),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, this.action});

  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(text, textAlign: TextAlign.center, style: fdText(14, FontWeight.w700, FdColors.ink)),
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    ),
  );
}

class _NeedsAnswerBanner extends StatelessWidget {
  const _NeedsAnswerBanner({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FdColors.warn, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.ucNeedsAnswerTitle, style: fdText(14, FontWeight.w800, FdColors.ink)),
          const SizedBox(height: 4),
          Text(l.ucBannerPending(count), style: fdText(12, FontWeight.w700, FdColors.ink)),
          const SizedBox(height: 2),
          Text(l.ucNeedsAnswerBody, style: fdText(12, FontWeight.w400, FdColors.muted, height: 1.4)),
        ],
      ),
    );
  }
}

/// One offered university: rank, status, name, city, the score / tuition /
/// deadline chips, and — while it waits for an answer — the two buttons.
class UniversityChoiceCard extends ConsumerStatefulWidget {
  const UniversityChoiceCard({super.key, required this.choice});

  final UniversityChoice choice;

  @override
  ConsumerState<UniversityChoiceCard> createState() => _UniversityChoiceCardState();
}

class _UniversityChoiceCardState extends ConsumerState<UniversityChoiceCard> {
  bool _sending = false;

  Future<void> _answer({required bool accept, ChangeReason? reason, String? note}) async {
    final l = AppLocalizations.of(context)!;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _sending = true);
    try {
      await respondToUniversityChoice(choiceId: widget.choice.id, accept: accept, reason: reason, note: note);
      ref.invalidate(myUniversityChoicesProvider);
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l.ucSendError)));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _askForChange() async {
    final result = await showModalBottomSheet<({ChangeReason reason, String note})>(
      context: context,
      isScrollControlled: true,
      backgroundColor: FdColors.page,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => ChangeRequestSheet(universityName: widget.choice.name),
    );
    if (result != null) await _answer(accept: false, reason: result.reason, note: result.note);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final c = widget.choice;
    final locale = Localizations.localeOf(context).toString();
    final status = _statusStyle(c.status, l);
    final contract = c.contractMin == null ? null : formatMoney(c.contractMin!, c.currency, locale);

    return HardShadowBox(
      radius: 16,
      offset: c.canAnswer ? 4 : 0,
      border: c.status == UniversityChoiceStatus.confirmed ? FdColors.good : FdColors.ink,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _Pill(text: l.ucRank(c.rank), fill: c.rank == 1 ? FdColors.navy : FdColors.muted, fg: Colors.white),
              if (c.isPartner) ...[const SizedBox(width: 6), _Pill(text: l.ucPartner, fill: FdColors.tint, fg: FdColors.navy)],
              const SizedBox(width: 6),
              // The status gives way on a narrow phone rather than overflow.
              Expanded(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: _Pill(text: status.label, fill: status.fill, fg: status.fg),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(c.name, style: fdText(16, FontWeight.w800, FdColors.ink)),
          if ((c.city ?? '').isNotEmpty || (c.nameKo ?? '').isNotEmpty)
            Text(
              [c.city, c.nameKo].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
              style: fdText(12, FontWeight.w400, FdColors.muted),
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (c.fit == LanguageFit.ok) _Pill(text: '✓ ${l.ucFitOk}', fill: const Color(0xFFE5F6EC), fg: FdColors.good),
              if (c.fit == LanguageFit.gap) _Pill(text: l.ucFitGap, fill: const Color(0xFFFDECEA), fg: FdColors.bad),
              if (contract != null) _Pill(text: l.ucContract(contract), fill: FdColors.tint, fg: FdColors.navy),
              if (c.onlineDeadline != null)
                _Pill(text: l.ucDeadline(DateFormat.MMMd(locale).format(c.onlineDeadline!)), fill: FdColors.tint, fg: FdColors.navy),
            ],
          ),
          if (c.canAnswer) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: HardChoice(
                    label: l.ucRequestChange,
                    selected: false,
                    height: 48,
                    fontSize: 12,
                    onTap: _sending ? null : _askForChange,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: HardButton(
                    label: l.ucAccept,
                    loading: _sending,
                    onPressed: _sending ? null : () => _answer(accept: true),
                  ),
                ),
              ],
            ),
          ],
          if (c.status == UniversityChoiceStatus.confirmed) ...[
            const SizedBox(height: 8),
            Text(l.ucConfirmedNote, style: fdText(12, FontWeight.w600, FdColors.good)),
          ],
          if (c.status == UniversityChoiceStatus.changeRequested) ...[
            const SizedBox(height: 8),
            Text(l.ucChangeSentNote, style: fdText(12, FontWeight.w400, FdColors.muted)),
          ],
        ],
      ),
    );
  }
}

({String label, Color fill, Color fg}) _statusStyle(UniversityChoiceStatus s, AppLocalizations l) => switch (s) {
  UniversityChoiceStatus.offered => (label: l.ucStatusOffered, fill: const Color(0xFFFFF4E2), fg: const Color(0xFF9A5B00)),
  UniversityChoiceStatus.accepted => (label: l.ucStatusAccepted, fill: FdColors.tint, fg: FdColors.navy),
  UniversityChoiceStatus.changeRequested => (label: l.ucStatusChangeRequested, fill: const Color(0xFFFDECEA), fg: FdColors.bad),
  UniversityChoiceStatus.confirmed => (label: l.ucStatusConfirmed, fill: const Color(0xFFE5F6EC), fg: FdColors.good),
};

/// "₩2,100,000" — the guideline's currency in front of the amount.
String formatMoney(double amount, String? currency, String locale) {
  final n = NumberFormat.decimalPattern(locale).format(amount.round());
  final sign = switch ((currency ?? '').toUpperCase()) {
    'KRW' || 'WON' || '₩' => '₩',
    'USD' || r'$' => r'$',
    _ => '',
  };
  return sign.isEmpty ? '$n ${currency ?? ''}'.trim() : '$sign$n';
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.fill, required this.fg});

  final String text;
  final Color fill;
  final Color fg;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(999)),
    child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(10, FontWeight.w800, fg)),
  );
}

/// The "O'zgartirish so'rayman" sheet: why (one reason) and an optional note.
/// Pops with the answer, or null when dismissed.
class ChangeRequestSheet extends StatefulWidget {
  const ChangeRequestSheet({super.key, required this.universityName});

  final String universityName;

  @override
  State<ChangeRequestSheet> createState() => _ChangeRequestSheetState();
}

class _ChangeRequestSheetState extends State<ChangeRequestSheet> {
  ChangeReason? _reason;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final labels = {
      ChangeReason.city: l.ucReasonCity,
      ChangeReason.price: l.ucReasonPrice,
      ChangeReason.major: l.ucReasonMajor,
      ChangeReason.other: l.ucReasonOther,
    };
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 18, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.ucRequestChange, style: fdText(18, FontWeight.w800, FdColors.ink)),
            Text(widget.universityName, style: fdText(12, FontWeight.w400, FdColors.muted)),
            const SizedBox(height: 14),
            Text(l.ucChangeQuestion, style: fdText(13, FontWeight.w700, FdColors.ink)),
            const SizedBox(height: 10),
            for (final entry in labels.entries) ...[
              HardChoice(
                label: entry.value,
                selected: _reason == entry.key,
                height: 44,
                onTap: () => setState(() => _reason = entry.key),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 4),
            Text(l.ucChangeNote, style: fdText(12, FontWeight.w600, FdColors.muted)),
            const SizedBox(height: 6),
            TextField(
              controller: _note,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 8),
            HardButton(
              label: l.ucChangeSend,
              onPressed: _reason == null
                  ? null
                  : () => Navigator.of(context).pop((reason: _reason!, note: _note.text.trim())),
            ),
          ],
        ),
      ),
    );
  }
}

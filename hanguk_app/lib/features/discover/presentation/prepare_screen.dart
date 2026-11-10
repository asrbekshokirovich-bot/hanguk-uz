import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/device_code.dart';
import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/seoul_night.dart' show SeoulGradients, SeoulColors, SeoulRadii, SeoulType;
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/data/auth_repository.dart' show ensureTestSession;
import '../../chat/presentation/chat_tab.dart';
import '../../training/data/plan_sections.dart' show kPlanStepCount;
import '../../training/presentation/interview_screen.dart';
import '../../training/presentation/study_plan_builder_screen.dart';
import '../data/guest_ai_usage.dart';
import '../data/prepare_progress.dart';
import 'widgets/app_nav.dart';

/// The guest's test user for the interview (one per phone). Tests replace it.
@visibleForTesting
Future<bool> Function() prepareGuestSession = ensureTestSession;

/// The screen the interview row opens. Tests replace it.
@visibleForTesting
Widget Function() prepareInterviewScreen = () => const InterviewScreen();

/// "Tayyorgarlik": Study Plan, the interview practice and Hanguk AI. The
/// guest's page is Claude Design D4 (approved 2026-11-06) with its loading
/// and failure states (canvas «Tayyorgarlik», boards 2–3); the student's is
/// design screen 18 with what they have done (board 4, variant A).
class PrepareScreen extends StatelessWidget {
  const PrepareScreen({super.key, this.signedIn = false});

  final bool signedIn;

  @override
  Widget build(BuildContext context) => signedIn ? const _StudentPrepare() : const _GuestPrepare();
}

void _signIn(BuildContext context) =>
    context.push('/login', extra: {'magic_code': true, 'notice': AppLocalizations.of(context)!.fdPrepareNeedsCode});

Future<void> _push(BuildContext context, Widget screen, String name) => Navigator.of(context).push(
  MaterialPageRoute<void>(
    settings: RouteSettings(name: name),
    // The home's nav stays under every page opened from here.
    builder: (_) => NavScaffold(current: AppTab.prepare, child: screen),
  ),
);

Future<void> _openChat(BuildContext context) {
  AppEvents.overlayOpened('ai_chat');
  const corners = BorderRadius.vertical(top: Radius.circular(SeoulRadii.hero));
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: const BoxDecoration(
        gradient: SeoulGradients.appBackground,
        borderRadius: corners,
        border: Border(top: BorderSide(color: SeoulColors.glassBorder)),
      ),
      child: const ClipRRect(borderRadius: corners, child: ChatTab()),
    ),
  ).whenComplete(() => AppEvents.overlayClosed('ai_chat'));
}

/// The title; seven taps on it show the device code (test devices, S10).
Widget _title(String text) => DeviceCodeTaps(
  child: Text(text, style: fdText(24, FontWeight.w800, FdColors.onPage, height: 1.15, letterSpacing: -0.5)),
);

// ── The guest's page (D4) ──────────────────────────────────────────────────

/// The interview row while the guest's test user is being had (board 2) or
/// could not be (board 3).
enum _Interview { ready, opening, failed }

class _GuestPrepare extends StatefulWidget {
  const _GuestPrepare();

  @override
  State<_GuestPrepare> createState() => _GuestPrepareState();
}

class _GuestPrepareState extends State<_GuestPrepare> {
  _Interview _interview = _Interview.ready;

  /// The guest's interview runs on the guest test account; interview-ai
  /// lets it start one a week (P18). The row says it is being prepared at
  /// once — the wait was 2.6 s with nothing on screen, and the guests tapped
  /// again and again — and a second tap meanwhile does nothing.
  Future<void> _openInterview() async {
    if (_interview == _Interview.opening) return;
    setState(() => _interview = _Interview.opening);
    // `data_ready` prepare.guest_interview: the tap to the screen opening
    // (Tayyorgarlik T0).
    final clock = Stopwatch()..start();
    final ok = await prepareGuestSession();
    AppEvents.track(
      'data_ready',
      props: {'name': 'prepare.guest_interview', 'source': ok ? 'ok' : 'failed', 'ms': clock.elapsedMilliseconds},
    );
    if (!mounted) return;
    setState(() => _interview = ok ? _Interview.ready : _Interview.failed);
    // Only while this page is still the one in front: a guest who went to
    // another tab or screen meanwhile is not pulled back into the interview.
    if (ok && Visibility.of(context) && (ModalRoute.of(context)?.isCurrent ?? true)) {
      _push(context, prepareInterviewScreen(), 'interview');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final muted = fdText(13, FontWeight.w500, FdColors.muted);
    return SafeArea(
      bottom: false,
      child: CustomScrollView(
        slivers: [
          // Board 1: the title 8px under the status bar, 24px under the
          // sign-in button. Those 24px are in the column, not padding under
          // the fill: the fill is as tall as the page, so padding under it
          // only made the page scroll by 24px, and the round button covered
          // the bottom of the sign-in button. When the content does not fit,
          // it scrolls, and the button stays at its end.
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
            sliver: SliverFillRemaining(
              hasScrollBody: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _title(l.fdNavPrepare),
                  const SizedBox(height: 14),
                  Text(l.prepGuestIntro, style: fdText(13.5, FontWeight.w500, FdColors.pageMuted, height: 1.4)),
                  const SizedBox(height: 14),
                  _GuestRow(
                    icon: const Lucide(LucideIcons.messageCircle, size: 22, color: FdColors.blueDeep),
                    title: l.prepGuestAi,
                    sub: const _GuestAiLeft(),
                    onTap: tracked('prepare.guest_ai', () => _openChat(context)),
                  ),
                  const SizedBox(height: 14),
                  _interviewRow(l, muted),
                  const SizedBox(height: 14),
                  _GuestRow(
                    locked: true,
                    icon: const Lucide(LucideIcons.lock, size: 22, color: FdColors.muted),
                    title: l.fdPlanTitle,
                    sub: Text(l.prepGuestStudyLocked, style: muted),
                  ),
                  const SizedBox(height: 14),
                  const Spacer(),
                  const SizedBox(height: 14),
                  Semantics(
                    button: true,
                    child: GestureDetector(
                      onTap: tracked('prepare.guest_sign_in', () => _signIn(context)),
                      child: Container(
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: FdColors.lime,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: FdColors.ink, width: 1.5),
                          boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
                        ),
                        child: Text(l.prepGuestSignIn, style: fdText(15, FontWeight.w800, FdColors.onLime)),
                      ),
                    ),
                  ),
                  // The round button rises 8px into the page: it stays 16px
                  // clear of the sign-in button.
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _interviewRow(AppLocalizations l, TextStyle muted) {
    const mic = Lucide(LucideIcons.mic, size: 22, color: FdColors.blueDeep);
    switch (_interview) {
      case _Interview.ready:
        return _GuestRow(
          icon: mic,
          title: l.interviewPracticeTitle,
          sub: const _GuestInterviewWeek(),
          onTap: tracked('prepare.guest_interview', _openInterview),
        );
      case _Interview.opening:
        return _GuestRow(
          busy: true,
          icon: const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.5, color: FdColors.blueDeep),
          ),
          title: l.interviewPracticeTitle,
          sub: Semantics(
            liveRegion: true,
            child: Text(l.interviewSettingUp, style: fdText(13, FontWeight.w600, FdColors.blueDeep)),
          ),
        );
      case _Interview.failed:
        return _GuestRow(
          busy: true,
          top: true,
          icon: mic,
          title: l.interviewPracticeTitle,
          sub: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                liveRegion: true,
                child: Text(l.entryErrorNetwork, style: fdText(13, FontWeight.w600, FdColors.bad, height: 1.4)),
              ),
              const SizedBox(height: 10),
              Semantics(
                button: true,
                child: GestureDetector(
                  onTap: tracked('prepare.guest_interview_retry', _openInterview),
                  behavior: HitTestBehavior.opaque,
                  // As wide as its label, at the left (board 3), not the row.
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      color: FdColors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: FdColors.ink, width: 1.5),
                      boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
                    ),
                    child: Center(
                      widthFactor: 1,
                      child: Text(l.commonRetry, style: fdText(14, FontWeight.w800, FdColors.ink)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
    }
  }
}

/// A row of the guest's page (D4): an icon tile, a title over a line, and a
/// chevron 12px from them when it opens something. A [locked] row is the pale
/// one with no shadow; a [busy] row (preparing, or failed) is not a button
/// itself and keeps the chevron's room empty, so its texts keep their width
/// and the page does not move when the row changes; [top] aligns the tile
/// with the title for a taller line.
class _GuestRow extends StatelessWidget {
  const _GuestRow({
    required this.icon,
    required this.title,
    required this.sub,
    this.onTap,
    this.locked = false,
    this.busy = false,
    this.top = false,
  });

  final Widget icon;
  final String title;
  final Widget sub;
  final VoidCallback? onTap;
  final bool locked;
  final bool busy;
  final bool top;

  @override
  Widget build(BuildContext context) {
    final opens = onTap != null && !locked && !busy;
    final card = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: locked ? FdColors.tint : FdColors.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: locked ? null : const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Row(
        crossAxisAlignment: top ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: locked ? FdColors.card : FdColors.tint, borderRadius: BorderRadius.circular(14)),
            child: icon,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: fdText(16, FontWeight.w800, FdColors.ink)),
                const SizedBox(height: 2),
                sub,
              ],
            ),
          ),
          if (opens || busy) ...[
            const SizedBox(width: 12),
            if (opens)
              const Lucide(LucideIcons.chevronRight, size: 18, color: FdColors.muted)
            else
              const SizedBox.square(dimension: 18),
          ],
        ],
      ),
    );
    if (!opens) return card;
    return Semantics(
      button: true,
      child: GestureDetector(onTap: tracked('prepare.guest_row', onTap), behavior: HitTestBehavior.opaque, child: card),
    );
  }
}

/// «Bugun 10 ta savoldan 7 tasi qoldi» (D4): the count left is the server's,
/// set in the mono face; until it is known, the plain «Kuniga 10 ta savol».
class _GuestAiLeft extends ConsumerWidget {
  const _GuestAiLeft();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final style = fdText(13, FontWeight.w500, FdColors.muted);
    final u = ref.watch(guestAiUsageProvider).value;
    if (u == null) return Text(l.prepGuestAiLimit, style: style);
    const mark = '\u0000';
    final parts = l.prepGuestAiLeft('${u.aiLimit}', mark).split(mark);
    return Text.rich(
      TextSpan(
        style: style,
        children: [
          TextSpan(text: parts.first),
          TextSpan(
            text: '${u.aiLeft}',
            style: const TextStyle(fontFamily: SeoulType.mono, fontWeight: FontWeight.w600, color: FdColors.ink),
          ),
          if (parts.length > 1) TextSpan(text: parts.sublist(1).join()),
        ],
      ),
    );
  }
}

/// «Haftasiga 1 ta · bu hafta bo'sh» (D4), from the server's weekly count.
class _GuestInterviewWeek extends ConsumerWidget {
  const _GuestInterviewWeek();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final u = ref.watch(guestAiUsageProvider).value;
    final text = u == null
        ? l.prepGuestInterviewLimit
        : u.interviewFree
        ? l.prepGuestInterviewFree
        : l.prepGuestInterviewUsed;
    return Text(text, style: fdText(13, FontWeight.w500, FdColors.muted));
  }
}

// ── The student's page (screen 18, board 4 — variant A) ──────────────────

class _StudentPrepare extends ConsumerWidget {
  const _StudentPrepare();

  /// Opens a tool; back on this page its numbers are read again.
  void _open(BuildContext context, WidgetRef ref, Widget screen, String name) {
    _push(context, screen, name).whenComplete(() {
      if (context.mounted) ref.invalidate(prepareProgressProvider);
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    // No number and no meter until it is known (it used to say «0 / 4» and
    // «Yangi» to every student — 21 accounts had a plan written).
    final done = ref.watch(prepareProgressProvider).value;
    final interviewTag = done == null
        ? ''
        : done.interviews > 0
        ? l.fdPrepareInterviewDone(done.interviews)
        : l.fdPrepareNew;
    return SafeArea(
      bottom: false,
      child: ListView(
        // Board 4: the title 8px under the status bar.
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
        children: [
          _title('${l.fdPrepareEyebrow} ${l.fdPrepareTitle}'),
          const SizedBox(height: 14),
          _ToolCard(
            blue: true,
            kicker: l.fdPrepareStudyKicker,
            tag: done == null ? '' : l.fdPrepareStudyPlanSteps(done.planParts, kPlanStepCount),
            title: l.fdPrepareStudyPlanTitle,
            body: l.fdPrepareStudyPlanBody,
            meter: true,
            progress: done?.planParts,
            onTap: tracked('prepare.study_plan_title', () => _open(context, ref, const StudyPlanBuilderScreen(), 'study_plan')),
          ),
          const SizedBox(height: 14),
          _ToolCard(
            blue: false,
            kicker: l.fdPrepareInterviewKicker,
            tag: interviewTag,
            title: l.fdPrepareInterviewTitle,
            body: l.fdPrepareInterviewBody,
            onTap: tracked('prepare.interview_title', () => _open(context, ref, const InterviewScreen(), 'interview')),
          ),
          const SizedBox(height: 14),
          _AskRow(
            title: l.fdPrepareAskTitle,
            body: l.fdPrepareAskBody,
            onTap: tracked('prepare.ask_title', () => _openChat(context)),
          ),
        ],
      ),
    );
  }
}

/// A tool card (prototype 11): a kicker line, the title, a line under it.
/// The first is blue with a lime shadow, the second white with an ink one.
class _ToolCard extends StatelessWidget {
  const _ToolCard({
    required this.blue,
    required this.kicker,
    required this.tag,
    required this.title,
    required this.body,
    required this.onTap,
    this.meter = false,
    this.progress,
  });

  final bool blue;
  final String kicker;
  final String tag;
  final String title;
  final String body;
  final VoidCallback onTap;

  /// The card has the four-step meter under its text (the Study Plan's).
  final bool meter;

  /// Steps done of four. Null while unknown: no meter is drawn (an empty one
  /// reads as «0 / 4»), but its room is kept, so the card does not grow when
  /// the number comes.
  final int? progress;

  @override
  Widget build(BuildContext context) {
    final fg = blue ? Colors.white : FdColors.ink;
    final muted = blue ? FdColors.onNavyMuted : FdColors.muted;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('prepare.tool_card', onTap),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
          decoration: BoxDecoration(
            color: blue ? FdColors.blue : FdColors.card,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: [BoxShadow(color: blue ? FdColors.lime : FdColors.ink, offset: const Offset(4, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(kicker, style: fdText(12, FontWeight.w800, blue ? FdColors.lime : FdColors.muted, letterSpacing: 0.3))),
                  // Board 4: 8px between them, so a kicker that wraps never
                  // runs into the tag.
                  const SizedBox(width: 8),
                  Text(tag, style: fdText(12, FontWeight.w800, blue ? FdColors.lime : FdColors.blue)),
                ],
              ),
              const SizedBox(height: 4),
              Text(title, style: fdText(22, FontWeight.w800, fg, height: 1.2, letterSpacing: -0.3)),
              const SizedBox(height: 6),
              Text(body, style: fdText(14, FontWeight.w400, muted, height: 1.4)),
              if (meter) ...[
                const SizedBox(height: 12),
                if (progress case final done?)
                  Row(
                    children: [
                      for (var i = 0; i < kPlanStepCount; i++) ...[
                        if (i > 0) const SizedBox(width: 4),
                        Expanded(
                          child: Container(
                            height: 6,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(3),
                              color: i < done ? FdColors.lime : const Color(0x4DFFFFFF),
                            ),
                          ),
                        ),
                      ],
                    ],
                  )
                else
                  const SizedBox(height: 6),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AskRow extends StatelessWidget {
  const _AskRow({required this.title, required this.body, required this.onTap});

  final String title;
  final String body;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('prepare.ask_row', onTap),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(12)),
                child: const Lucide(LucideIcons.bot, size: 18, color: FdColors.navy),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: fdText(14, FontWeight.w800, FdColors.ink)),
                    const SizedBox(height: 2),
                    Text(body, style: fdText(12, FontWeight.w400, FdColors.muted)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Lucide(LucideIcons.chevronRight, size: 18, color: FdColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

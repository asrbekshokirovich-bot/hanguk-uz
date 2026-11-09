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
import '../../training/presentation/interview_screen.dart';
import '../../training/presentation/study_plan_builder_screen.dart';
import '../data/guest_ai_usage.dart';
import 'widgets/app_nav.dart';

/// Design screen 18, "Tayyorgarlik": Study Plan, the interview practice and
/// "Hanguk AI ga savol bering". All three are a student's tools: for a guest
/// each one opens the client-code sign-in, for a signed-in student each one
/// opens the tool itself.
class PrepareScreen extends StatelessWidget {
  const PrepareScreen({super.key, this.signedIn = false});

  final bool signedIn;

  void _signIn(BuildContext context) =>
      context.push('/login', extra: {'magic_code': true, 'notice': AppLocalizations.of(context)!.fdPrepareNeedsCode});

  void _push(BuildContext context, Widget screen, String name) =>
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          settings: RouteSettings(name: name),
          // The home's nav stays under every page opened from here.
          builder: (_) => NavScaffold(current: AppTab.prepare, child: screen),
        ),
      );

  void _openChat(BuildContext context) {
    AppEvents.overlayOpened('ai_chat');
    const corners = BorderRadius.vertical(top: Radius.circular(SeoulRadii.hero));
    showModalBottomSheet<void>(
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

  /// A guest's interview runs on the guest test account (one per phone);
  /// interview-ai lets it start one a week (P18).
  Future<void> _guestInterview(BuildContext context) async {
    final ok = await ensureTestSession();
    if (!context.mounted) return;
    if (ok) {
      _push(context, const InterviewScreen(), 'interview');
      return;
    }
    // The guest's interview needs no code: a failure is the network or the
    // server, so say that and offer to try again (it used to open the
    // client-code screen, which a guest has no code for).
    final l = AppLocalizations.of(context)!;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(l.entryErrorNetwork),
        action: SnackBarAction(label: l.commonRetry, onPressed: tracked('prepare.guest_interview_retry', () => _guestInterview(context))),
      ));
  }

  @override
  Widget build(BuildContext context) {
    if (!signedIn) return _guest(context);
    final l = AppLocalizations.of(context)!;
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 2, 18, 24),
        children: [
          // Seven taps on the title show the device code (test devices, S10).
          DeviceCodeTaps(
            child: Text(
              '${l.fdPrepareEyebrow} ${l.fdPrepareTitle}',
              style: fdText(24, FontWeight.w800, FdColors.onPage, height: 1.15, letterSpacing: -0.5),
            ),
          ),
          const SizedBox(height: 14),
          _ToolCard(
            blue: true,
            kicker: l.fdPrepareStudyKicker,
            tag: l.fdPrepareStudyPlanSteps(0, 4),
            title: l.fdPrepareStudyPlanTitle,
            body: l.fdPrepareStudyPlanBody,
            progress: 0,
            onTap: tracked('prepare.study_plan_title', () => signedIn ? _push(context, const StudyPlanBuilderScreen(), 'study_plan') : _signIn(context)),
          ),
          const SizedBox(height: 14),
          _ToolCard(
            blue: false,
            kicker: l.fdPrepareInterviewKicker,
            tag: l.fdPrepareNew,
            title: l.fdPrepareInterviewTitle,
            body: l.fdPrepareInterviewBody,
            onTap: tracked('prepare.interview_title', () => signedIn ? _push(context, const InterviewScreen(), 'interview') : _signIn(context)),
          ),
          const SizedBox(height: 14),
          _AskRow(
            title: l.fdPrepareAskTitle,
            body: l.fdPrepareAskBody,
            onTap: tracked('prepare.ask_title', () => signedIn ? _openChat(context) : _signIn(context)),
          ),
          if (!signedIn) ...[
            const SizedBox(height: 14),
            CustomPaint(
              foregroundPainter: const DashedPillPainter(color: FdColors.blue, radius: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                decoration: BoxDecoration(color: FdColors.card, borderRadius: BorderRadius.circular(16)),
                child: Text(l.fdPrepareLocked, style: fdText(14, FontWeight.w800, FdColors.blue, height: 1.45)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A tool card (prototype 11): a kicker line, the title, a line under it.
/// The first is blue with a lime shadow, the second white with an ink one.
extension on PrepareScreen {
  /// Tayyorgarlik for a guest (ushlab qolish P19, Claude Design D4): the AI
  /// (10 questions a day) and the interview (one a week) open without a
  /// code; Study Plan stays for clients.
  Widget _guest(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    Widget row({LucideGlyph? glyph, required String title, required Widget sub, VoidCallback? onTap}) {
      final locked = onTap == null;
      final card = Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: locked ? FdColors.tint : FdColors.card,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: FdColors.ink, width: 1.5),
          boxShadow: locked ? null : const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: locked ? FdColors.card : FdColors.tint, borderRadius: BorderRadius.circular(14)),
              child: Center(
                child: glyph == null
                    ? const Icon(Icons.lock_outline_rounded, size: 22, color: FdColors.muted)
                    : Lucide(glyph, size: 22, color: locked ? FdColors.muted : FdColors.blueDeep),
              ),
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
            if (!locked) Lucide(LucideIcons.chevronRight, size: 18, color: FdColors.muted),
          ],
        ),
      );
      return locked ? card : GestureDetector(onTap: tracked('prepare.guest_row', onTap), child: card);
    }

    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 2, 18, 24),
        children: [
          DeviceCodeTaps(
            child: Text(l.fdPrepareTitle, style: fdText(24, FontWeight.w800, FdColors.onPage, height: 1.15, letterSpacing: -0.5)),
          ),
          const SizedBox(height: 8),
          Text(l.prepGuestIntro, style: fdText(13.5, FontWeight.w500, FdColors.pageMuted, height: 1.4)),
          const SizedBox(height: 14),
          row(
            glyph: LucideIcons.bot,
            title: l.prepGuestAi,
            sub: const _GuestAiLeft(),
            onTap: tracked('prepare.guest_ai', () => _openChat(context)),
          ),
          const SizedBox(height: 14),
          row(
            glyph: LucideIcons.mic,
            title: l.fdPrepareInterviewTitle,
            sub: const _GuestInterviewWeek(),
            onTap: tracked('prepare.guest_interview', () => _guestInterview(context)),
          ),
          const SizedBox(height: 14),
          row(title: l.fdPrepareStudyPlanTitle, sub: Text(l.prepGuestStudyLocked, style: fdText(13, FontWeight.w500, FdColors.muted))),
          const SizedBox(height: 24),
          GestureDetector(
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
        ],
      ),
    );
  }
}

class _ToolCard extends StatelessWidget {
  const _ToolCard({
    required this.blue,
    required this.kicker,
    required this.tag,
    required this.title,
    required this.body,
    required this.onTap,
    this.progress,
  });

  final bool blue;
  final String kicker;
  final String tag;
  final String title;
  final String body;
  final VoidCallback onTap;

  /// Steps done of four; null for no progress bar.
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
                  Text(tag, style: fdText(12, FontWeight.w800, blue ? FdColors.lime : FdColors.blue)),
                ],
              ),
              const SizedBox(height: 4),
              Text(title, style: fdText(22, FontWeight.w800, fg, height: 1.2, letterSpacing: -0.3)),
              const SizedBox(height: 6),
              Text(body, style: fdText(14, FontWeight.w400, muted, height: 1.4)),
              if (progress != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    for (var i = 0; i < 4; i++) ...[
                      if (i > 0) const SizedBox(width: 4),
                      Expanded(
                        child: Container(
                          height: 6,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            color: i < progress! ? FdColors.lime : const Color(0x4DFFFFFF),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
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
              Text('→', style: fdText(18, FontWeight.w800, FdColors.ink)),
            ],
          ),
        ),
      ),
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

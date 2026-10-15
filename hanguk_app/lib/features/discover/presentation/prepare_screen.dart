import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/seoul_night.dart' show SeoulGradients, SeoulColors, SeoulRadii;
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../chat/presentation/chat_tab.dart';
import '../../training/presentation/interview_screen.dart';
import '../../training/presentation/study_plan_builder_screen.dart';

/// Design screen 18, "Tayyorgarlik": Study Plan, the interview practice and
/// "Hanguk AI ga savol bering". All three are a student's tools: for a guest
/// each one opens the client-code sign-in, for a signed-in student each one
/// opens the tool itself.
class PrepareScreen extends StatelessWidget {
  const PrepareScreen({super.key, this.signedIn = false});

  final bool signedIn;

  void _signIn(BuildContext context) => context.push('/login', extra: const {'magic_code': true});

  void _push(BuildContext context, Widget screen, String name) =>
      Navigator.of(context).push(MaterialPageRoute<void>(settings: RouteSettings(name: name), builder: (_) => screen));

  void _openChat(BuildContext context) {
    AppEvents.track('screen_view', screen: 'ai_chat');
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 2, 18, 24),
        children: [
          Text(
            '${l.fdPrepareEyebrow} ${l.fdPrepareTitle}',
            style: fdText(24, FontWeight.w800, FdColors.onPage, height: 1.15, letterSpacing: -0.5),
          ),
          const SizedBox(height: 14),
          _ToolCard(
            blue: true,
            kicker: l.fdPrepareStudyKicker,
            tag: l.fdPrepareStudyPlanSteps(0, 4),
            title: l.fdPrepareStudyPlanTitle,
            body: l.fdPrepareStudyPlanBody,
            progress: 0,
            onTap: () => signedIn ? _push(context, const StudyPlanBuilderScreen(), 'study_plan') : _signIn(context),
          ),
          const SizedBox(height: 14),
          _ToolCard(
            blue: false,
            kicker: l.fdPrepareInterviewKicker,
            tag: l.fdPrepareNew,
            title: l.fdPrepareInterviewTitle,
            body: l.fdPrepareInterviewBody,
            onTap: () => signedIn ? _push(context, const InterviewScreen(), 'interview') : _signIn(context),
          ),
          const SizedBox(height: 14),
          _AskRow(
            title: l.fdPrepareAskTitle,
            body: l.fdPrepareAskBody,
            onTap: () => signedIn ? _openChat(context) : _signIn(context),
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
        onTap: onTap,
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
        onTap: onTap,
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

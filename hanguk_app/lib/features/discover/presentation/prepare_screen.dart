import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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

  void _push(BuildContext context, Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

  void _openChat(BuildContext context) {
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
      child: Stack(
        children: [
          // The ghost word behind the title ("preparation").
          Positioned(
            right: -12,
            top: -14,
            child: ExcludeSemantics(
              child: Text(
                '준비',
                style: fdText(104, FontWeight.w800, FdColors.ghost, height: 1, letterSpacing: -4),
              ),
            ),
          ),
          ListView(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 24),
            children: [
              Text(l.fdPrepareEyebrow, style: fdText(12, FontWeight.w700, FdColors.pageMuted)),
              const SizedBox(height: 2),
              Align(
                alignment: Alignment.centerLeft,
                child: LimeMark(
                  l.fdPrepareTitle,
                  style: fdText(26, FontWeight.w800, FdColors.ink, height: 1, letterSpacing: -0.78),
                ),
              ),
              const SizedBox(height: 22),
              _ToolCard(
                dark: false,
                glyph: LucideIcons.fileText,
                tag: l.fdPrepareStudyPlanSteps(0, 4),
                title: l.fdPrepareStudyPlanTitle,
                body: l.fdPrepareStudyPlanBody,
                progress: 0,
                onTap: () => signedIn ? _push(context, const StudyPlanBuilderScreen()) : _signIn(context),
              ),
              const SizedBox(height: 14),
              _ToolCard(
                dark: true,
                glyph: LucideIcons.mic,
                tag: l.fdPrepareNew,
                title: l.fdPrepareInterviewTitle,
                body: l.fdPrepareInterviewBody,
                onTap: () => signedIn ? _push(context, const InterviewScreen()) : _signIn(context),
              ),
              const SizedBox(height: 14),
              _AskRow(
                title: l.fdPrepareAskTitle,
                body: l.fdPrepareAskBody,
                onTap: () => signedIn ? _openChat(context) : _signIn(context),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ToolCard extends StatelessWidget {
  const _ToolCard({
    required this.dark,
    required this.glyph,
    required this.tag,
    required this.title,
    required this.body,
    required this.onTap,
    this.progress,
  });

  final bool dark;
  final LucideGlyph glyph;
  final String tag;
  final String title;
  final String body;
  final VoidCallback onTap;

  /// Steps done of four; null for no progress bar.
  final int? progress;

  @override
  Widget build(BuildContext context) {
    final fg = dark ? Colors.white : FdColors.ink;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: dark ? FdColors.navy : FdColors.card,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: [BoxShadow(color: dark ? FdColors.lime : FdColors.ink, offset: const Offset(4, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: FdColors.lime,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: FdColors.ink, width: 1.5),
                    ),
                    child: Lucide(glyph, size: 22, color: FdColors.onLime),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: dark ? FdColors.lime : null,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: FdColors.ink, width: 1.5),
                    ),
                    child: Text(tag, style: fdText(11, FontWeight.w800, dark ? FdColors.onLime : FdColors.ink)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(title, style: fdText(19, FontWeight.w800, fg, letterSpacing: -0.19)),
              const SizedBox(height: 10),
              Text(body, style: fdText(13, FontWeight.w400, dark ? FdColors.onNavyMuted : FdColors.muted, height: 1.45)),
              if (progress != null) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    for (var i = 0; i < 4; i++) ...[
                      if (i > 0) const SizedBox(width: 4),
                      Expanded(
                        child: Container(
                          height: 6,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            color: i < progress! ? FdColors.ink : const Color(0xFFD9DFE8),
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
                    Text(title, style: fdText(13, FontWeight.w800, FdColors.ink)),
                    const SizedBox(height: 2),
                    Text(body, style: fdText(11, FontWeight.w400, FdColors.muted)),
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

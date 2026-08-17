import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../moderation/data/ai_report_repository.dart';
import '../../../moderation/presentation/ai_report_sheet.dart';
import '../../domain/chat_message.dart';

/// One turn of the Hanguk AI conversation.
///
/// Seoul Night (DESIGN_SPEC §3.7): the AI speaks from plain glass behind a
/// lime 한 avatar; the student speaks from lime-tinted glass. Both keep white
/// body text — lime here is a tint and an outline, never a text background.
class ChatMessageBubble extends StatelessWidget {
  final ChatMessage message;

  const ChatMessageBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final bool isUser = message.role == 'user';

    // A squared corner on the avatar side reads as the bubble's tail.
    const tail = Radius.zero;
    const round = Radius.circular(SeoulRadii.tile);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        mainAxisAlignment: isUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            // The brand 한 mark doubles as the AI avatar (spec §1).
            const HangulGlyphTile(
              glyph: '한',
              size: 32,
              active: true,
              radius: 999,
            ),
            const SizedBox(width: 12),
          ],

          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isUser ? SeoulColors.limeFill : SeoulColors.glass,
                    borderRadius: BorderRadius.only(
                      topLeft: round,
                      topRight: round,
                      bottomLeft: isUser ? round : tail,
                      bottomRight: isUser ? tail : round,
                    ),
                    border: Border.all(
                      color: isUser
                          ? SeoulColors.lime.withValues(alpha: 0.35)
                          : SeoulColors.glassBorder,
                      width: 1,
                    ),
                  ),
                  child: Text(message.content, style: SeoulType.body),
                ),

                // Reporting an AI answer (App Store guideline 1.2). Visible
                // rather than hidden behind a long-press: a mechanism review
                // cannot find is a mechanism that does not count, and a
                // student who has just been told something wrong should not
                // have to discover a gesture.
                if (!isUser)
                  _ReportAction(
                    text: message.content,
                    messageId: message.id,
                  ),
              ],
            ),
          ),

          if (isUser) ...[
            const SizedBox(width: 12),
            const HangulGlyphTile(glyph: '나', size: 32, radius: 999),
          ],
        ],
      ),
    );
  }
}

/// "Report" under an AI answer.
///
/// Faint on purpose — it has to be findable without competing with the answer
/// itself. Tapping opens [showAiReportSheet], which is where the student can
/// say what is wrong; nothing is sent by the tap alone.
class _ReportAction extends StatelessWidget {
  const _ReportAction({required this.text, this.messageId});

  final String text;

  /// The persisted row id when there is one. Carried into `context` so a
  /// triaged report can be traced back to the conversation.
  final String? messageId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: const EdgeInsets.only(top: 4, left: 4),
      child: InkWell(
        onTap: () => showAiReportSheet(
          context,
          surface: AiSurface.chat,
          reportedText: text,
          reportContext: {
            if (messageId != null) 'message_id': messageId,
            'locale': Localizations.localeOf(context).languageCode,
          },
        ),
        borderRadius: BorderRadius.circular(SeoulRadii.control),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.outlined_flag,
                size: 13,
                color: SeoulColors.textFaint,
              ),
              const SizedBox(width: 4),
              Text(
                l10n.aiReportAction,
                style: SeoulType.caption.copyWith(
                  color: SeoulColors.textFaint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

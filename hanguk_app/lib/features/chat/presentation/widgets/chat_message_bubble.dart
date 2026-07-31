import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
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
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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

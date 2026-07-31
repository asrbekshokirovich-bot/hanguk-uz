import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/chat_repository.dart';
import 'widgets/chat_message_bubble.dart';

/// The Hanguk AI conversation (DESIGN_SPEC §3.7).
///
/// Presented from `home_screen.dart` as a modal sheet whose container already
/// paints the dark surface and the rounded top, so everything here stays
/// transparent and the sheet reads as one continuous pane. The orb sits
/// behind the sheet, so no orb clearance is reserved.
class ChatTab extends ConsumerStatefulWidget {
  const ChatTab({super.key});

  @override
  ConsumerState<ChatTab> createState() => _ChatTabState();
}

class _ChatTabState extends ConsumerState<ChatTab> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: SeoulMotion.base,
        curve: SeoulMotion.smooth,
      );
    }
  }

  void _handleSend() {
    final text = _textController.text;
    if (text.trim().isEmpty) return;

    _textController.clear();
    FocusScope.of(context).unfocus();

    ref.read(chatProvider.notifier).sendMessage(text);
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);
    final l = AppLocalizations.of(context)!;

    ref.listen(chatProvider, (previous, next) {
      if (previous?.messages.length != next.messages.length ||
          (previous?.isLoading == true && next.isLoading == false)) {
        // Not a design duration — one frame's grace so the new bubble is
        // laid out before we measure maxScrollExtent.
        Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
      }
    });

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Column(
        children: [
          _buildHeader(l),

          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              itemCount:
                  chatState.messages.length + (chatState.isLoading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == chatState.messages.length && chatState.isLoading) {
                  // A real request is in flight — never a fake typing delay.
                  return const _AiThinkingRow();
                }
                return ChatMessageBubble(message: chatState.messages[index]);
              },
            ),
          ),

          if (chatState.error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: SeoulColors.dangerFill,
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    size: 16,
                    color: SeoulColors.dangerText,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      chatState.error!,
                      style: SeoulType.caption.copyWith(
                        fontSize: 13,
                        color: SeoulColors.dangerText,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: SeoulColors.glassBorder)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      style: SeoulType.body,
                      cursorColor: SeoulColors.lime,
                      decoration: InputDecoration(
                        hintText: l.chatInputHint,
                        hintStyle: SeoulType.bodySecondary,
                        filled: true,
                        fillColor: SeoulColors.glass,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 14,
                        ),
                        border: const OutlineInputBorder(
                          borderRadius: SeoulRadii.controlR,
                          borderSide: BorderSide(
                            color: SeoulColors.glassBorder,
                          ),
                        ),
                        enabledBorder: const OutlineInputBorder(
                          borderRadius: SeoulRadii.controlR,
                          borderSide: BorderSide(
                            color: SeoulColors.glassBorder,
                          ),
                        ),
                        focusedBorder: const OutlineInputBorder(
                          borderRadius: SeoulRadii.controlR,
                          borderSide: BorderSide(color: SeoulColors.lime),
                        ),
                      ),
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _handleSend(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  _SendButton(
                    tooltip: l.a11yTooltipSendMessage,
                    onPressed: chatState.isLoading ? null : _handleSend,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Sheet grab handle + the AI's identity, in place of an AppBar so the
  /// handle and the title share one surface.
  Widget _buildHeader(AppLocalizations l) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 8, 6),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: SeoulColors.glassBorder,
              // 999 is the design system's pill idiom (see StatusChip).
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const HangulGlyphTile(glyph: '한', size: 40, active: true),
              const SizedBox(width: 12),
              const Expanded(
                child: HangulTag(
                  // Product name — intentionally not localized.
                  en: 'Hanguk AI',
                  ko: 'AI 도우미',
                  titleStyle: SeoulType.subtitle,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_sweep_outlined),
                color: SeoulColors.textSecondary,
                tooltip: l.a11yTooltipClearChat,
                constraints: const BoxConstraints(
                  minWidth: SeoulSizes.minTapTarget,
                  minHeight: SeoulSizes.minTapTarget,
                ),
                onPressed: () {
                  ref.read(chatProvider.notifier).clearChat();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Shown only while a real Edge Function call is in flight.
class _AiThinkingRow extends StatelessWidget {
  const _AiThinkingRow();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          HangulGlyphTile(glyph: '한', size: 32, active: true, radius: 999),
          SizedBox(width: 12),
          SizedBox(
            height: 16,
            width: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
            ),
          ),
        ],
      ),
    );
  }
}

/// The one lime action in the sheet (spec §4: lime is rare).
class _SendButton extends StatefulWidget {
  const _SendButton({required this.tooltip, this.onPressed});

  final String tooltip;
  final VoidCallback? onPressed;

  @override
  State<_SendButton> createState() => _SendButtonState();
}

class _SendButtonState extends State<_SendButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.tooltip,
      child: Tooltip(
        message: widget.tooltip,
        child: GestureDetector(
          onTap: widget.onPressed,
          onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
          onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
          onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
          child: AnimatedScale(
            scale: _pressed ? SeoulMotion.pressScale : 1.0,
            duration: SeoulMotion.fast,
            curve: SeoulMotion.smooth,
            child: AnimatedOpacity(
              opacity: enabled ? 1.0 : 0.45,
              duration: SeoulMotion.fast,
              child: Container(
                width: SeoulSizes.buttonHeight,
                height: SeoulSizes.buttonHeight,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: SeoulGradients.limeButton,
                  boxShadow: enabled ? SeoulShadows.limeGlowSmall : null,
                ),
                child: const Icon(
                  Icons.send_rounded,
                  color: SeoulColors.ink,
                  size: 22,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

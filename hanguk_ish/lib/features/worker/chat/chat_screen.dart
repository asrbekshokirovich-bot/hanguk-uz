import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../core/time/clock.dart';
import '../../../core/time/kst.dart';
import '../../../data/models/account.dart';
import '../../../data/repositories/live_updates.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/forms.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../my_shifts/my_shifts_providers.dart';
import '../my_shifts/my_shifts_screen.dart';
import '../settings/app_language.dart';
import '../shift/shift_widgets.dart';

/// One application's chat (A10).
final chatProvider = FutureProvider.autoDispose.family<List<ChatMessage>, String>(
  (ref, applicationId) {
    ref.watch(liveTickProvider);
    return ref.watch(shiftRepositoryProvider).messages(applicationId);
  },
  retry: (count, error) => null,
);

/// Whether [text] is written in Hangul (shown in Noto Sans KR first).
bool isKorean(String text) => RegExp('[가-힣]').hasMatch(text);

/// A10 «Chat» with the business of one shift; Korean messages come with
/// their translation into the app language.
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.applicationId, required this.onBack});

  final String applicationId;
  final VoidCallback onBack;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _text = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final l10n = WorkerL10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(shiftRepositoryProvider).sendMessage(widget.applicationId, text);
      _text.clear();
      ref.invalidate(chatProvider(widget.applicationId));
    } on Object catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(myShiftError(l10n, error))));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final app = ref.watch(myShiftProvider(widget.applicationId)).value;
    final messages = ref.watch(chatProvider(widget.applicationId)).value ?? const <ChatMessage>[];
    final top = HiInsets.top(context, 56);
    final bottom = HiInsets.bottom(context, 30);
    final showNote = lang != 'ko';

    return Scaffold(
      backgroundColor: HiColors.navy,
      resizeToAvoidBottomInset: true,
      body: Column(
        children: [
          // Header.
          Container(
            padding: EdgeInsets.fromLTRB(18, top, 18, 12),
            decoration: const BoxDecoration(
              color: HiColors.navy,
              border: Border(bottom: BorderSide(color: HiColors.white10)),
            ),
            child: Row(
              children: [
                HiBackButton(onPressed: widget.onBack),
                const SizedBox(width: 12),
                if (app != null) ...[
                  BusinessAvatar(business: app.shift.business, size: 40),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        header: true,
                        child: HiText(
                          app?.shift.business.nameWithArea(lang) ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: hiStyle(16, FontWeight.w800),
                        ),
                      ),
                      const SizedBox(height: 1),
                      if (app != null)
                        HiText(
                          '${HiDates.dayName(app.shift.startsAt, now, lang)} · '
                          '${HiDates.timeRange(app.shift.startsAt, app.shift.endsAt)}',
                          style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // The prototype pins the note 124 px and the message log 186 px from
          // the top of the screen: 10.5 px under its 113.5 px header and 2.2 px
          // under the two-line note. The log is clipped there.
          if (showNote)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 10.5, 22, 2.2),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF16205A),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: HiColors.white14),
                ),
                child: Row(
                  children: [
                    const HiIcon(HiIcons.languages, size: 20, strokeWidth: 2, color: HiColors.lime),
                    const SizedBox(width: 10),
                    Expanded(
                      child: HiText(
                        l10n.chatTranslateNote,
                        style: hiStyle(14, FontWeight.w600, height: 1.35, color: HiColors.textSoft),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: Semantics(
              label: l10n.messages,
              child: messages.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: HiText(
                          l10n.chatEmpty,
                          textAlign: TextAlign.center,
                          style: hiStyle(15, FontWeight.w600, color: HiColors.textMuted),
                        ),
                      ),
                    )
                  : ListView.builder(
                      reverse: true,
                      // The prototype's log ends 3 px above the composer, plus its 10 px padding.
                      padding: EdgeInsets.fromLTRB(18, showNote ? 0 : 12, 18, 13),
                      itemCount: messages.length,
                      itemBuilder: (context, index) {
                        final i = messages.length - 1 - index;
                        final m = messages[i];
                        final next = i + 1 < messages.length ? messages[i + 1] : null;
                        // A time under the last of a run from the same
                        // sender in the same minute (as in the prototype).
                        final showTime = next == null ||
                            next.fromMe != m.fromMe ||
                            Kst.hm(next.createdAt) != Kst.hm(m.createdAt);
                        return Padding(
                          padding: EdgeInsets.only(top: i == 0 ? 0 : 12),
                          child: _Bubble(message: m, lang: lang, showTime: showTime),
                        );
                      },
                    ),
            ),
          ),
          // Composer.
          Container(
            padding: EdgeInsets.fromLTRB(18, 12, 22, bottom),
            decoration: const BoxDecoration(
              color: HiColors.navy,
              border: Border(top: BorderSide(color: HiColors.white10)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Semantics(
                    label: l10n.messageLabel,
                    textField: true,
                    child: Container(
                      height: 52,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: HiColors.white,
                        borderRadius: BorderRadius.circular(HiRadii.field),
                        border: Border.fromBorderSide(HiBorders.ink),
                      ),
                      alignment: Alignment.centerLeft,
                      child: TextField(
                        controller: _text,
                        style: hiStyle(16, FontWeight.w500, color: HiColors.ink),
                        strutStyle: hiStrut(hiStyle(16, FontWeight.w500, color: HiColors.ink)),
                        cursorColor: HiColors.ink,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        maxLines: 1,
                        decoration: InputDecoration.collapsed(
                          hintText: l10n.messageHint,
                          hintStyle: hiStyle(16, FontWeight.w500, color: HiColors.inkMuted),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                HiPressable(
                  onTap: _sending ? null : _send,
                  semanticsLabel: l10n.send,
                  builder: (context, pressed) => Transform.translate(
                    offset: pressed ? const Offset(2, 2) : Offset.zero,
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: HiColors.lime,
                        borderRadius: BorderRadius.circular(HiRadii.button),
                        border: Border.fromBorderSide(HiBorders.ink),
                        boxShadow: [BoxShadow(color: HiColors.ink, offset: pressed ? const Offset(2, 2) : const Offset(4, 4))],
                      ),
                      alignment: Alignment.center,
                      child: const HiIcon(HiIcons.send, size: 22, strokeWidth: 2.2, color: HiColors.onLime),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.lang, required this.showTime});

  final ChatMessage message;
  final String lang;
  final bool showTime;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final mine = message.fromMe;
    final korean = message.lang == 'ko' || isKorean(message.body);
    final style = hiStyle(
      16,
      FontWeight.w500,
      height: 1.5,
      color: mine ? HiColors.white : HiColors.ink,
      family: korean ? HiFamily.korean : HiFamily.inter,
    );
    // `<p lang="ko">`: Korean glyphs for the punctuation and spaces (the
    // font's KOR forms), so a line is as wide as in the prototype; screen
    // readers also read it as Korean.
    final bodyStyle = korean ? style.copyWith(locale: const Locale('ko')) : style;
    final translation = !mine && message.lang != lang ? message.translations[lang] : null;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: mine ? 280 : 300),
        child: Column(
          crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: mine ? HiColors.blue : HiColors.white,
                border: Border.fromBorderSide(HiBorders.ink),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(mine ? 18 : 6),
                  bottomRight: Radius.circular(mine ? 6 : 18),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  HiText(message.body, style: bodyStyle),
                  if (translation != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.only(top: 8),
                      decoration: const BoxDecoration(border: Border(top: BorderSide(color: HiColors.surface))),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const HiIcon(HiIcons.languages, size: 14, strokeWidth: 2.2, color: HiColors.blue),
                              const SizedBox(width: 5),
                              HiText(l10n.translation, style: hiStyle(12, FontWeight.w800, color: HiColors.blue)),
                            ],
                          ),
                          const SizedBox(height: 2),
                          HiText(translation, style: hiStyle(15, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (showTime) ...[
              const SizedBox(height: 4),
              Padding(
                padding: EdgeInsets.only(left: mine ? 0 : 6, right: mine ? 6 : 0),
                child: HiText(Kst.hm(message.createdAt), style: hiStyle(12, FontWeight.w600, color: HiColors.textMuted)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

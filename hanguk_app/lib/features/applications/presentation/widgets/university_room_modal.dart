// `show ImageFilter` only: an unrestricted `dart:ui` import would make
// `Image` ambiguous elsewhere; the sheet only needs the blur filter.
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/university_announcements_repository.dart';
import '../../data/university_chat_repository.dart';
import '../../data/university_events_repository.dart';
import '../../domain/application.dart';
import 'process_tracker.dart';

/// Matches a string that opens with a hangul syllable (U+AC00–U+D7A3).
final RegExp _hangulStart = RegExp(r'^[가-힣]');

/// The university room bottom sheet, restyled for Seoul Night.
///
/// Glass over the app gradient (DESIGN_SPEC §1 Surfaces): backdrop blur, a
/// deep translucent wash, hero-radius top corners and a grab handle — the same
/// recipe as `UniversityDetailSheet`. Four tabs (Status · Discussion · News ·
/// Calendar) presented as a `SeoulFilterChip` row that drives the existing
/// `DefaultTabController`; the realtime chat, events, announcements and
/// ProcessTracker behaviour is unchanged — visual pass only.
class UniversityRoomModal extends StatefulWidget {
  final StudentApplication application;
  final int initialTabIndex;

  const UniversityRoomModal({
    super.key,
    required this.application,
    this.initialTabIndex = 0,
  });

  static void show(
    BuildContext context,
    StudentApplication app, {
    int initialTabIndex = 0,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => UniversityRoomModal(
        application: app,
        initialTabIndex: initialTabIndex,
      ),
    );
  }

  @override
  State<UniversityRoomModal> createState() => _UniversityRoomModalState();
}

class _UniversityRoomModalState extends State<UniversityRoomModal> {
  final TextEditingController _msgController = TextEditingController();
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  // `late` rather than `late final`: the error states carry a retry button,
  // and each controller fetches on construction — retry is a rebuild.
  late UniversityChatController _chatController;
  late UniversityEventsController _eventsController;
  late UniversityAnnouncementsController _announcementsController;

  /// The signed-in student, so their own messages read as "mine" (lime-tinted
  /// glass, right-aligned) like the Hanguk AI chat. Display only.
  String? _myUserId;

  @override
  void initState() {
    super.initState();
    _myUserId = Supabase.instance.client.auth.currentUser?.id;
    _chatController = UniversityChatController(widget.application.universityId);
    _chatController.addListener(_onStateChanged);
    _eventsController = UniversityEventsController(
      widget.application.universityId,
    );
    _eventsController.addListener(_onStateChanged);
    _announcementsController = UniversityAnnouncementsController(
      widget.application.universityId,
    );
    _announcementsController.addListener(_onStateChanged);
  }

  void _onStateChanged() {
    if (mounted) setState(() {});
  }

  // ── Retry: each controller fetches in its constructor, so retrying is
  //    disposing the failed one and constructing a fresh one. The repository
  //    code itself is untouched.

  void _retryChat() {
    _chatController.removeListener(_onStateChanged);
    _chatController.dispose();
    setState(() {
      _chatController = UniversityChatController(
        widget.application.universityId,
      );
      _chatController.addListener(_onStateChanged);
    });
  }

  void _retryEvents() {
    _eventsController.removeListener(_onStateChanged);
    _eventsController.dispose();
    setState(() {
      _eventsController = UniversityEventsController(
        widget.application.universityId,
      );
      _eventsController.addListener(_onStateChanged);
    });
  }

  void _retryAnnouncements() {
    _announcementsController.removeListener(_onStateChanged);
    _announcementsController.dispose();
    setState(() {
      _announcementsController = UniversityAnnouncementsController(
        widget.application.universityId,
      );
      _announcementsController.addListener(_onStateChanged);
    });
  }

  Future<void> _openAnnouncement(String url) async {
    final uri = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  void dispose() {
    _chatController.removeListener(_onStateChanged);
    _chatController.dispose();
    _eventsController.removeListener(_onStateChanged);
    _eventsController.dispose();
    _announcementsController.removeListener(_onStateChanged);
    _announcementsController.dispose();
    _msgController.dispose();
    super.dispose();
  }

  // ── Header identity ───────────────────────────────────────────────────────

  /// First hangul syllable of the Korean name, then of the city — never a
  /// stray Latin letter in a hangul tile (same rule as the detail sheet).
  String get _glyph {
    final u = widget.application.university;
    for (final candidate in <String?>[u?.nameKoShort, u?.nameKo, u?.location]) {
      final trimmed = (candidate ?? '').trim();
      if (_hangulStart.hasMatch(trimmed)) {
        return HangulGlyphTile.firstSyllable(trimmed);
      }
    }
    return '한';
  }

  /// Korean accent under the name; the decorative 대학 when the institution
  /// has no Korean name (or the display name already is it).
  String get _koLabel {
    final u = widget.application.university;
    for (final candidate in <String?>[u?.nameKoShort, u?.nameKo]) {
      final trimmed = (candidate ?? '').trim();
      if (trimmed.isNotEmpty && trimmed != u?.name) return trimmed;
    }
    return '대학';
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  Widget _buildMessageBubble(ChannelMessage msg, AppLocalizations l) {
    final isMine = _myUserId != null && msg.senderId == _myUserId;

    // A squared corner on the sender's side reads as the bubble's tail —
    // matching `ChatMessageBubble` in the Hanguk AI chat.
    const tail = Radius.zero;
    const round = Radius.circular(SeoulRadii.tile);

    final bubble = Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isMine ? SeoulColors.limeFill : SeoulColors.glass,
        borderRadius: BorderRadius.only(
          topLeft: round,
          topRight: round,
          bottomLeft: isMine ? round : tail,
          bottomRight: isMine ? tail : round,
        ),
        border: Border.all(
          color: isMine
              ? SeoulColors.lime.withValues(alpha: 0.35)
              : SeoulColors.glassBorder,
          width: 1,
        ),
      ),
      child: Text(msg.content, style: SeoulType.body),
    );

    // `.toLocal()`, and a padded 24h format: these timestamps come from a
    // `Z` string, so rendering them raw showed every message 5 hours early in
    // Tashkent and 9 in Seoul — and `9:05` unpadded read as a broken clock.
    final timestamp = DateFormat.Hm().format(msg.createdAt.toLocal());

    if (isMine) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(timestamp, style: SeoulType.caption),
                  const SizedBox(height: 4),
                  bubble,
                ],
              ),
            ),
            const SizedBox(width: 12),
            const HangulGlyphTile(glyph: '나', size: 32, radius: 999),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SenderAvatar(name: msg.senderName, avatarUrl: msg.senderAvatar),
          const SizedBox(width: 12),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Flexible(
                      child: Text(
                        msg.senderName ?? l.roomChatSenderFallback,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SeoulType.caption.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(timestamp, style: SeoulType.caption),
                  ],
                ),
                const SizedBox(height: 4),
                bubble,
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildComposer(UniversityChatState chatState, AppLocalizations l) {
    final canSend = !chatState.isLoading && chatState.channelId != null;

    void send(String text) {
      if (chatState.channelId == null) return;
      _chatController.sendMessage(text);
      _msgController.clear();
    }

    return SafeArea(
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
                controller: _msgController,
                enabled: canSend,
                style: SeoulType.body,
                cursorColor: SeoulColors.lime,
                decoration: InputDecoration(
                  hintText: l.roomChatHint,
                  hintStyle: SeoulType.bodySecondary,
                  filled: true,
                  fillColor: SeoulColors.glass,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  border: const OutlineInputBorder(
                    borderRadius: SeoulRadii.controlR,
                    borderSide: BorderSide(color: SeoulColors.glassBorder),
                  ),
                  enabledBorder: const OutlineInputBorder(
                    borderRadius: SeoulRadii.controlR,
                    borderSide: BorderSide(color: SeoulColors.glassBorder),
                  ),
                  disabledBorder: const OutlineInputBorder(
                    borderRadius: SeoulRadii.controlR,
                    borderSide: BorderSide(color: SeoulColors.glassBorder),
                  ),
                  focusedBorder: const OutlineInputBorder(
                    borderRadius: SeoulRadii.controlR,
                    borderSide: BorderSide(color: SeoulColors.lime),
                  ),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: send,
              ),
            ),
            const SizedBox(width: 12),
            _SendButton(
              tooltip: l.a11yTooltipSendMessage,
              onPressed: canSend ? () => send(_msgController.text) : null,
            ),
          ],
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final uniName = widget.application.university?.name ?? l.unknownUniversity;
    final chatState = _chatController.state;
    final eventsState = _eventsController.state;
    final announcementsState = _announcementsController.state;

    List<UniversityEvent> getEventsForDay(DateTime day) {
      if (eventsState.isLoading || eventsState.error != null) return [];
      return eventsState.events.where((e) {
        return e.eventDate.year == day.year &&
            e.eventDate.month == day.month &&
            e.eventDate.day == day.day;
      }).toList();
    }

    final selectedEvents = _selectedDay != null
        ? getEventsForDay(_selectedDay!)
        : getEventsForDay(_focusedDay);

    return DefaultTabController(
      length: 4,
      initialIndex: widget.initialTabIndex,
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(SeoulRadii.hero),
        ),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: Container(
            height: MediaQuery.of(context).size.height * 0.9,
            decoration: BoxDecoration(
              // Glass over the app gradient: deep enough for body copy,
              // sheer enough that the blur behind still reads as glass
              // (same recipe as UniversityDetailSheet).
              color: SeoulColors.mapWater.withValues(alpha: 0.92),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(SeoulRadii.hero),
              ),
              border: Border.all(color: SeoulColors.glassBorder, width: 1),
            ),
            child: Column(
              children: [
                // Grab handle
                Padding(
                  padding: const EdgeInsets.only(top: 12, bottom: 14),
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: SeoulColors.glassBorder,
                      // 999 is the design system's pill idiom.
                      borderRadius: BorderRadius.circular(SeoulRadii.pill),
                    ),
                  ),
                ),

                // Header: glyph tile + name with its Korean accent.
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: SeoulSizes.screenPadding,
                  ),
                  child: Row(
                    children: [
                      HangulGlyphTile(glyph: _glyph),
                      const SizedBox(width: 13),
                      Expanded(
                        child: HangulTag(
                          en: uniName,
                          ko: _koLabel,
                          titleStyle: SeoulType.subtitle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        color: SeoulColors.textSecondary,
                        tooltip: l.a11yTooltipClose,
                        constraints: const BoxConstraints(
                          minWidth: SeoulSizes.minTapTarget,
                          minHeight: SeoulSizes.minTapTarget,
                        ),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // Tab strip: filter chips driving the same DefaultTabController
                // the TabBarView reads — swipe still syncs both ways.
                _TabChips(
                  labels: [
                    (en: l.roomTabStatus, ko: '현황'),
                    (en: l.roomTabDiscussion, ko: '대화'),
                    (en: l.roomTabNews, ko: '소식'),
                    (en: l.roomTabCalendar, ko: '일정'),
                  ],
                ),

                const SizedBox(height: 12),
                const Divider(height: 1, color: SeoulColors.glassBorder),

                // Tab views — same order as before: Status, Discussion, News,
                // Calendar, so `initialTabIndex` callers keep working.
                Expanded(
                  child: TabBarView(
                    children: [
                      // ── Status ──────────────────────────────────────────
                      ListView(
                        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
                        children: [
                          Text(
                            l.roomApplicationProgress,
                            style: SeoulType.title,
                          ),
                          const SizedBox(height: 16),
                          ProcessTracker(status: widget.application.status),
                        ],
                      ),

                      // ── Discussion ──────────────────────────────────────
                      Column(
                        children: [
                          Expanded(
                            child: chatState.isLoading
                                ? const _LimeSpinner()
                                : chatState.error != null
                                ? _StateMessage(
                                    icon: Icons.forum_outlined,
                                    message: chatState.error!,
                                    isError: true,
                                    retryLabel: l.commonRetry,
                                    onRetry: _retryChat,
                                  )
                                : chatState.messages.isEmpty
                                ? _StateMessage(
                                    icon: Icons.forum_outlined,
                                    message: l.roomChatEmpty,
                                  )
                                : ListView.builder(
                                    // Optimizes large chat history scaling
                                    // natively.
                                    reverse: true,
                                    padding: const EdgeInsets.all(16),
                                    itemCount: chatState.messages.length,
                                    itemBuilder: (context, index) {
                                      return _buildMessageBubble(
                                        chatState.messages[index],
                                        l,
                                      );
                                    },
                                  ),
                          ),
                          _buildComposer(chatState, l),
                        ],
                      ),

                      // ── News: official admission notices from
                      //    v_institution_announcements. ─────────────────────
                      announcementsState.isLoading
                          ? const _LimeSpinner()
                          : announcementsState.error != null
                          ? _StateMessage(
                              icon: Icons.campaign_outlined,
                              message: announcementsState.error!,
                              isError: true,
                              retryLabel: l.commonRetry,
                              onRetry: _retryAnnouncements,
                            )
                          : announcementsState.announcements.isEmpty
                          ? _StateMessage(
                              icon: Icons.campaign_outlined,
                              message: l.roomNewsEmpty,
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount:
                                  announcementsState.announcements.length,
                              itemBuilder: (context, index) {
                                final ann =
                                    announcementsState.announcements[index];
                                return _AnnouncementRow(
                                  announcement: ann,
                                  onTap: ann.url != null
                                      ? () => _openAnnouncement(ann.url!)
                                      : null,
                                );
                              },
                            ),

                      // ── Calendar ────────────────────────────────────────
                      Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16.0,
                            ),
                            child: TableCalendar<UniversityEvent>(
                              firstDay: DateTime.now().subtract(
                                const Duration(days: 365),
                              ),
                              lastDay: DateTime.now().add(
                                const Duration(days: 365),
                              ),
                              focusedDay: _focusedDay,
                              selectedDayPredicate: (day) =>
                                  isSameDay(_selectedDay, day),
                              eventLoader: getEventsForDay,
                              startingDayOfWeek: StartingDayOfWeek.monday,
                              calendarStyle: CalendarStyle(
                                defaultTextStyle: SeoulType.body,
                                weekendTextStyle: SeoulType.bodySecondary,
                                outsideTextStyle: SeoulType.body.copyWith(
                                  color: SeoulColors.textFaint,
                                ),
                                todayDecoration: BoxDecoration(
                                  color: SeoulColors.limeFill,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: SeoulColors.lime.withValues(
                                      alpha: 0.35,
                                    ),
                                    width: 1,
                                  ),
                                ),
                                selectedDecoration: const BoxDecoration(
                                  color: SeoulColors.lime,
                                  shape: BoxShape.circle,
                                  boxShadow: SeoulShadows.limeGlowSmall,
                                ),
                                selectedTextStyle: SeoulType.body.copyWith(
                                  color: SeoulColors.ink,
                                  fontWeight: FontWeight.w700,
                                ),
                                markersMaxCount: 3,
                                markerDecoration: const BoxDecoration(
                                  color: SeoulColors.warning,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              headerStyle: const HeaderStyle(
                                formatButtonVisible: false,
                                titleCentered: true,
                                titleTextStyle: SeoulType.subtitle,
                                leftChevronIcon: Icon(
                                  Icons.chevron_left,
                                  color: SeoulColors.textSecondary,
                                ),
                                rightChevronIcon: Icon(
                                  Icons.chevron_right,
                                  color: SeoulColors.textSecondary,
                                ),
                              ),
                              daysOfWeekStyle: const DaysOfWeekStyle(
                                weekdayStyle: SeoulType.caption,
                                weekendStyle: SeoulType.caption,
                              ),
                              onDaySelected: (selectedDay, focusedDay) {
                                if (!isSameDay(_selectedDay, selectedDay)) {
                                  setState(() {
                                    _selectedDay = selectedDay;
                                    _focusedDay = focusedDay;
                                  });
                                }
                              },
                              onPageChanged: (focusedDay) {
                                _focusedDay = focusedDay;
                              },
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Divider(
                            height: 1,
                            color: SeoulColors.glassBorder,
                          ),
                          Expanded(
                            child: eventsState.isLoading
                                ? const _LimeSpinner()
                                : eventsState.error != null
                                ? _StateMessage(
                                    icon: Icons.event_busy,
                                    message: eventsState.error!,
                                    isError: true,
                                    retryLabel: l.commonRetry,
                                    onRetry: _retryEvents,
                                  )
                                : selectedEvents.isEmpty
                                ? _StateMessage(
                                    icon: Icons.event_busy,
                                    message: l.roomEventsEmpty,
                                  )
                                : ListView.builder(
                                    padding: const EdgeInsets.all(16),
                                    itemCount: selectedEvents.length,
                                    itemBuilder: (context, index) {
                                      return _EventRow(
                                        event: selectedEvents[index],
                                      );
                                    },
                                  ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The chip strip that stands in for the Material TabBar. Reads and drives
/// the ambient [DefaultTabController], so the TabBarView's own swipe
/// behaviour is untouched.
class _TabChips extends StatelessWidget {
  const _TabChips({required this.labels});

  final List<({String en, String ko})> labels;

  @override
  Widget build(BuildContext context) {
    final controller = DefaultTabController.of(context);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
            horizontal: SeoulSizes.screenPadding,
          ),
          child: Row(
            children: [
              for (var i = 0; i < labels.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                SeoulFilterChip(
                  label: labels[i].en,
                  ko: labels[i].ko,
                  selected: controller.index == i,
                  onTap: () => controller.animateTo(i),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// One official announcement (title is Korean — the crawled source language).
class _AnnouncementRow extends StatelessWidget {
  const _AnnouncementRow({required this.announcement, this.onTap});

  final UniversityAnnouncement announcement;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      radius: SeoulRadii.tile,
      // A blur per row is a saved layer per row (GlassCard's own guidance).
      blur: false,
      onTap: onTap,
      child: Row(
        children: [
          const _RowIconTile(icon: Icons.campaign_outlined),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  announcement.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle,
                ),
                if (announcement.postedAt != null) ...[
                  const SizedBox(height: 6),
                  StatusChip(
                    label: DateFormat(
                      'yyyy-MM-dd',
                    ).format(announcement.postedAt!.toLocal()),
                    dense: true,
                  ),
                ],
              ],
            ),
          ),
          if (announcement.url != null) ...[
            const SizedBox(width: 10),
            const Icon(
              Icons.open_in_new_rounded,
              size: 18,
              color: SeoulColors.textFaint,
            ),
          ],
        ],
      ),
    );
  }
}

/// One calendar event for the selected day.
class _EventRow extends StatelessWidget {
  const _EventRow({required this.event});

  final UniversityEvent event;

  @override
  Widget build(BuildContext context) {
    final isDeadline = event.eventType == 'deadline';
    final description = event.description;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      radius: SeoulRadii.tile,
      blur: false,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _RowIconTile(icon: isDeadline ? Icons.timer_outlined : Icons.event),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle,
                ),
                if (description != null && description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(description, style: SeoulType.bodySecondary),
                ],
                const SizedBox(height: 6),
                StatusChip(
                  label: DateFormat.Hm().format(event.eventDate.toLocal()),
                  tone: isDeadline ? StatusTone.warning : StatusTone.neutral,
                  dense: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Glass square holding a row's leading icon.
class _RowIconTile extends StatelessWidget {
  const _RowIconTile({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: SeoulSizes.glyphTile,
      height: SeoulSizes.glyphTile,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: SeoulColors.glass,
        borderRadius: SeoulRadii.tileR,
        border: Border.all(color: SeoulColors.glassBorder, width: 1),
      ),
      child: Icon(icon, size: 22, color: SeoulColors.textSecondary),
    );
  }
}

/// Another member's avatar: their photo when they have one, otherwise the
/// first character of their name in a glass circle.
class _SenderAvatar extends StatelessWidget {
  const _SenderAvatar({this.name, this.avatarUrl});

  final String? name;
  final String? avatarUrl;

  static const double _size = 32;

  @override
  Widget build(BuildContext context) {
    final url = avatarUrl;
    if (url != null && url.isNotEmpty) {
      return Container(
        width: _size,
        height: _size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: SeoulColors.glassBorder, width: 1),
          color: SeoulColors.glass,
          image: DecorationImage(image: NetworkImage(url), fit: BoxFit.cover),
        ),
      );
    }

    final trimmed = (name ?? '').trim();
    return HangulGlyphTile(
      glyph: trimmed.isEmpty ? '한' : trimmed.characters.first,
      size: _size,
      radius: 999,
    );
  }
}

/// Centered lime spinner for a tab still loading.
class _LimeSpinner extends StatelessWidget {
  const _LimeSpinner();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
      ),
    );
  }
}

/// Token-styled empty / error state. Error states carry a retry button.
class _StateMessage extends StatelessWidget {
  const _StateMessage({
    required this.icon,
    required this.message,
    this.isError = false,
    this.retryLabel,
    this.onRetry,
  });

  final IconData icon;
  final String message;
  final bool isError;
  final String? retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 40,
              color: isError ? SeoulColors.dangerText : SeoulColors.textFaint,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: isError
                  ? SeoulType.bodySecondary.copyWith(
                      color: SeoulColors.dangerText,
                    )
                  : SeoulType.bodySecondary,
            ),
            if (onRetry != null && retryLabel != null) ...[
              const SizedBox(height: 16),
              SeoulOutlineButton(
                label: retryLabel!,
                icon: Icons.refresh,
                expand: false,
                height: SeoulSizes.minTapTarget,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The tab's one lime action (spec §4) — mirrors the AI chat's send button.
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
                  Icons.arrow_upward_rounded,
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

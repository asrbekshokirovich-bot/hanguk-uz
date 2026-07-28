import 'package:flutter/material.dart';
import '../../domain/application.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';
import 'process_tracker.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';
import '../../data/university_chat_repository.dart';
import '../../data/university_events_repository.dart';
import '../../data/university_announcements_repository.dart';
import 'package:url_launcher/url_launcher.dart';

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
  late final UniversityChatController _chatController;
  late final UniversityEventsController _eventsController;
  late final UniversityAnnouncementsController _announcementsController;

  @override
  void initState() {
    super.initState();
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

  Widget _buildMessageBubble(ChannelMessage msg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: AppColors.vibrantLime.withValues(alpha: 0.2),
            radius: 16,
            backgroundImage: msg.senderAvatar != null
                ? NetworkImage(msg.senderAvatar!)
                : null,
            child: msg.senderAvatar == null
                ? Text(
                    (msg.senderName ?? 'U').isNotEmpty
                        ? (msg.senderName ?? 'U')[0]
                        : 'U',
                    style: const TextStyle(
                      color: AppColors.vibrantLime,
                      fontSize: 12,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      msg.senderName ?? 'User',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${msg.createdAt.hour}:${msg.createdAt.minute.toString().padLeft(2, '0')}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(
                      12,
                    ).copyWith(topLeft: const Radius.circular(0)),
                  ),
                  child: Text(
                    msg.content,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final uniName = widget.application.university?.name ?? 'Unknown University';
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
      child: Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: const BoxDecoration(
          color: Color(0xFF0F213D),
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          children: [
            // Modal Handle
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 20),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.vibrantLime.withValues(
                      alpha: 0.1,
                    ),
                    radius: 20,
                    child: Text(
                      uniName.isNotEmpty ? uniName[0] : 'U',
                      style: const TextStyle(
                        color: AppColors.vibrantLime,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          uniName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const Row(
                          children: [
                            Icon(
                              Icons.hub_outlined,
                              size: 12,
                              color: Colors.white54,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'University Room',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white54,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.close_rounded,
                      color: Colors.white54,
                    ),
                    tooltip: l.a11yTooltipClose,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // TabBar
            const TabBar(
              isScrollable: true,
              tabs: [
                Tab(icon: Icon(Icons.info_outline, size: 20), text: 'Status'),
                Tab(
                  icon: Icon(Icons.forum_outlined, size: 20),
                  text: 'Discussion',
                ),
                Tab(
                  icon: Icon(Icons.announcement_outlined, size: 20),
                  text: 'News',
                ),
                Tab(
                  icon: Icon(Icons.event_note_outlined, size: 20),
                  text: 'Calendar',
                ),
              ],
            ),

            const Divider(height: 1, color: AppColors.borderGlass),

            // Tab Views
            Expanded(
              child: TabBarView(
                children: [
                  // Status Tab
                  Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Application Progress',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 24),
                        ProcessTracker(status: widget.application.status),
                      ],
                    ),
                  ),

                  // Discussion Tab
                  Column(
                    children: [
                      Expanded(
                        child: chatState.isLoading
                            ? const Center(
                                child: CircularProgressIndicator(
                                  color: AppColors.vibrantLime,
                                ),
                              )
                            : chatState.error != null
                            ? Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Text(
                                    chatState.error!,
                                    style: const TextStyle(
                                      color: Colors.redAccent,
                                    ),
                                  ),
                                ),
                              )
                            : chatState.messages.isEmpty
                            ? Center(
                                child: Text(
                                  'No messages yet. Start the conversation!',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.5),
                                  ),
                                ),
                              )
                            : ListView.builder(
                                reverse:
                                    true, // Optimizes large chat history scaling natively
                                padding: const EdgeInsets.all(16),
                                itemCount: chatState.messages.length,
                                itemBuilder: (context, index) {
                                  return _buildMessageBubble(
                                    chatState.messages[index],
                                  );
                                },
                              ),
                      ),
                      SafeArea(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF132A4D),
                            border: Border(
                              top: BorderSide(
                                color: Colors.white.withValues(alpha: 0.05),
                              ),
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _msgController,
                                  enabled:
                                      !chatState.isLoading &&
                                      chatState.channelId != null,
                                  decoration: InputDecoration(
                                    hintText: 'Message room...',
                                    hintStyle: const TextStyle(
                                      color: Colors.white70,
                                    ),
                                    filled: true,
                                    fillColor: Colors.white.withValues(
                                      alpha: 0.05,
                                    ),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(24),
                                      borderSide: BorderSide.none,
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 10,
                                    ),
                                  ),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                  ),
                                  onSubmitted: (val) {
                                    if (chatState.channelId != null) {
                                      _chatController.sendMessage(val);
                                      _msgController.clear();
                                    }
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              // CircleAvatar bumped from radius 20 (40dp)
                              // to radius 24 so the IconButton tap target
                              // hits the WCAG 2.2 / Material 48dp minimum.
                              // Visual icon size unchanged.
                              CircleAvatar(
                                backgroundColor:
                                    (!chatState.isLoading &&
                                        chatState.channelId != null)
                                    ? AppColors.vibrantLime
                                    : Colors.white24,
                                radius: 24,
                                child: IconButton(
                                  padding: EdgeInsets.zero,
                                  icon: const Icon(
                                    Icons.arrow_upward,
                                    color: AppColors.pureBlack,
                                    size: 20,
                                  ),
                                  tooltip: l.a11yTooltipSendMessage,
                                  constraints: const BoxConstraints(
                                    minWidth: 48,
                                    minHeight: 48,
                                  ),
                                  onPressed:
                                      (!chatState.isLoading &&
                                          chatState.channelId != null)
                                      ? () {
                                          final text = _msgController.text;
                                          _chatController.sendMessage(text);
                                          _msgController.clear();
                                        }
                                      : null,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Announcements (News) Tab — official admission notices for
                  // this institution, from v_institution_announcements.
                  announcementsState.isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: AppColors.vibrantLime,
                          ),
                        )
                      : announcementsState.error != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Text(
                              announcementsState.error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.redAccent),
                            ),
                          ),
                        )
                      : announcementsState.announcements.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.campaign_outlined,
                                size: 48,
                                color: Colors.white.withValues(alpha: 0.1),
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'No active announcements.',
                                style: TextStyle(color: Colors.white70),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: announcementsState.announcements.length,
                          itemBuilder: (context, index) {
                            final ann =
                                announcementsState.announcements[index];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.05),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: ListTile(
                                leading: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: AppColors.vibrantLime.withValues(
                                      alpha: 0.2,
                                    ),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.campaign_outlined,
                                    color: AppColors.vibrantLime,
                                    size: 20,
                                  ),
                                ),
                                title: Text(
                                  ann.title,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                                subtitle: ann.postedAt != null
                                    ? Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Text(
                                          DateFormat(
                                            'yyyy-MM-dd',
                                          ).format(ann.postedAt!),
                                          style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 12,
                                          ),
                                        ),
                                      )
                                    : null,
                                trailing: ann.url != null
                                    ? const Icon(
                                        Icons.open_in_new_rounded,
                                        color: Colors.white38,
                                        size: 18,
                                      )
                                    : null,
                                onTap: ann.url != null
                                    ? () => _openAnnouncement(ann.url!)
                                    : null,
                              ),
                            );
                          },
                        ),

                  // Calendar Tab
                  Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
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
                            defaultTextStyle: const TextStyle(
                              color: Colors.white,
                            ),
                            weekendTextStyle: const TextStyle(
                              color: Colors.white70,
                            ),
                            outsideTextStyle: const TextStyle(
                              color: Colors.white38,
                            ),
                            todayDecoration: BoxDecoration(
                              color: AppColors.vibrantLime.withValues(
                                alpha: 0.3,
                              ),
                              shape: BoxShape.circle,
                            ),
                            selectedDecoration: const BoxDecoration(
                              color: AppColors.vibrantLime,
                              shape: BoxShape.circle,
                            ),
                            selectedTextStyle: const TextStyle(
                              color: AppColors.pureBlack,
                              fontWeight: FontWeight.bold,
                            ),
                            markersMaxCount: 3,
                            markerDecoration: const BoxDecoration(
                              color: Colors.redAccent,
                              shape: BoxShape.circle,
                            ),
                          ),
                          headerStyle: const HeaderStyle(
                            formatButtonVisible: false,
                            titleCentered: true,
                            titleTextStyle: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                            leftChevronIcon: Icon(
                              Icons.chevron_left,
                              color: Colors.white,
                            ),
                            rightChevronIcon: Icon(
                              Icons.chevron_right,
                              color: Colors.white,
                            ),
                          ),
                          daysOfWeekStyle: const DaysOfWeekStyle(
                            weekdayStyle: TextStyle(color: Colors.white54),
                            weekendStyle: TextStyle(color: Colors.white54),
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
                      const Divider(height: 1, color: AppColors.borderGlass),
                      Expanded(
                        child: eventsState.isLoading
                            ? const Center(
                                child: CircularProgressIndicator(
                                  color: AppColors.vibrantLime,
                                ),
                              )
                            : selectedEvents.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.event_busy,
                                      size: 36,
                                      color: Colors.white.withValues(
                                        alpha: 0.1,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    const Text(
                                      'No events to display on this date.',
                                      style: TextStyle(color: Colors.white70),
                                    ),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: selectedEvents.length,
                                itemBuilder: (context, index) {
                                  final evt = selectedEvents[index];
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(
                                        alpha: 0.05,
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: ListTile(
                                      leading: Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: AppColors.vibrantLime
                                              .withValues(alpha: 0.2),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          evt.eventType == 'deadline'
                                              ? Icons.timer
                                              : Icons.event,
                                          color: AppColors.vibrantLime,
                                          size: 20,
                                        ),
                                      ),
                                      title: Text(
                                        evt.title,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                      subtitle: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          if (evt.description != null &&
                                              evt.description!.isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              evt.description!,
                                              style: const TextStyle(
                                                color: Colors.white70,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ],
                                          const SizedBox(height: 6),
                                          Text(
                                            DateFormat(
                                              'hh:mm a',
                                            ).format(evt.eventDate),
                                            style: const TextStyle(
                                              color: Colors.white70,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
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
    );
  }
}

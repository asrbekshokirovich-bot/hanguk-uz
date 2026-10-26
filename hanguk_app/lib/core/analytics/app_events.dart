import 'dart:async';
import 'dart:convert';
import 'dart:io' show File, Platform;
import 'dart:math';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/build_config.dart';

/// One event as the app records it; what [AppEvents.debugOnTrack] sees.
@immutable
class TrackedEvent {
  const TrackedEvent(this.event, {this.screen, this.element, this.props, this.durationMs});

  final String event;
  final String? screen;
  final String? element;
  final Map<String, Object?>? props;
  final int? durationMs;

  @override
  String toString() => 'TrackedEvent($event, screen: $screen, element: $element, props: $props)';
}

/// What a person does in the app — every screen they open (and how long they
/// stay), every button they press, what they saw and chose — sent to
/// `app_events` (through `app_events_log_v2`) so the CRM can show the app's
/// use as a whole and a lead's or a student's own path through it.
///
/// Only *what was done* is recorded: an event name, the screen, the element
/// pressed and small non-personal details (a university id, a tab, an answer's
/// band). Never typed text (a search is cleaned, see the search screen),
/// passwords, client codes, phone numbers or documents. The server keeps only
/// the props keys its registry allows for each event.
///
/// Every event carries a unique id (a retry is never stored twice), the visit
/// it belongs to and its place in it. The queue is kept on disk, so events of
/// an app that is closed or crashes go out on the next launch.
///
/// Until [AppEvents.start] runs (from `main`), nothing is sent, so widget
/// tests and previews never touch the network or leave timers behind; the
/// screen bookkeeping still runs, and [debugOnTrack] sees every event.
abstract final class AppEvents {
  static _Sink? _sink;
  static final _Surfaces _surfaces = _Surfaces();
  static String? _language;
  static final Stopwatch _launch = Stopwatch();

  /// Starts recording. Called once from `main`, after Supabase is ready.
  static Future<void> start() async {
    if (_sink != null) return;
    final sink = _Sink();
    _sink = sink;
    await sink.init();
  }

  /// Tests only: sees every tracked event, whether recording has started or not.
  @visibleForTesting
  static void Function(TrackedEvent e)? debugOnTrack;

  /// Tests only: forgets the screens, tabs, taps and errors seen so far.
  @visibleForTesting
  static void debugReset() {
    _surfaces.reset();
    _taps.clear();
    _recent.clear();
    _rageAt = null;
    _settleScheduled = false;
    _errors = 0;
  }

  /// The screen the person is on: a route pattern ("/university/:id"), a
  /// shell route with its tab ("/guest#universities"), or an open sheet.
  static String? get screen => _surfaces.current ?? _surfaces.compute();

  /// The code staff type into the CRM to mark this phone as a test device:
  /// the first 8 characters of the installation id, as "XXXX-XXXX".
  static String? get deviceCode {
    final id = _sink?._installId;
    if (id == null || id.length < 8) return null;
    final c = id.replaceAll('-', '').substring(0, 8).toUpperCase();
    return '${c.substring(0, 4)}-${c.substring(4)}';
  }

  /// Records [event] (lower_snake_case, in the server's registry) on [screen]
  /// (the current one when not given). [element] is what was pressed,
  /// [durationMs] how long something took.
  static void track(
    String event, {
    String? screen,
    String? element,
    Map<String, Object?>? props,
    int? durationMs,
  }) {
    final s = screen ?? AppEvents.screen;
    debugOnTrack?.call(TrackedEvent(event, screen: s, element: element, props: props, durationMs: durationMs));
    _sink?.add(event, screen: s, element: element, props: props, durationMs: durationMs);
  }

  /// The app's interface language, sent with every batch.
  static void setLanguage(String? code) => _language = code;

  // ── Screens ──────────────────────────────────────────────────────────────

  /// The navigator showed [routeName] (its GoRouter path pattern).
  static void routeChanged(String? routeName) {
    if (routeName == null || routeName.isEmpty) return;
    _surfaces.route = routeName;
    _settleSoon();
  }

  /// A shell ('/guest' for the guest, '/' for the signed-in student) shows
  /// [tab]. The first tab of a shell is told with [initial]; switching tabs
  /// also sends `tab_open`.
  static void tabChanged(String shellRoute, String tab, {bool initial = false}) {
    final before = _surfaces.tabs[shellRoute];
    _surfaces.tabs[shellRoute] = tab;
    if (!initial && before != tab) {
      track('tab_open', screen: shellRoute == '/guest' ? 'guest' : 'client', props: {'tab': tab});
    }
    _settleSoon();
  }

  /// A sheet or dialog [name] opened over the screen; [overlayClosed] when it
  /// is gone. Time on it is counted as a screen of its own.
  static void overlayOpened(String name) {
    _surfaces.overlays.add(name);
    track('sheet_open', props: {'name': name});
    _settle();
  }

  static void overlayClosed(String name) {
    final i = _surfaces.overlays.lastIndexOf(name);
    if (i < 0) return;
    _surfaces.overlays.removeAt(i);
    track('sheet_close', screen: name, props: {'name': name});
    _settle();
  }

  /// The furthest the person scrolled the current screen, 0..1.
  static void scrolled(double fraction) {
    if (fraction.isNaN) return;
    _surfaces.maxScroll = max(_surfaces.maxScroll, fraction.clamp(0.0, 1.0));
  }

  static bool _settleScheduled = false;

  static void _settleSoon() {
    if (_settleScheduled) return;
    _settleScheduled = true;
    void run() {
      _settleScheduled = false;
      _settle();
    }

    try {
      // After the frame: a shell pushed with the route has told its tab by then.
      SchedulerBinding.instance.addPostFrameCallback((_) => run());
      SchedulerBinding.instance.scheduleFrame();
    } catch (_) {
      Timer.run(run);
    }
  }

  static void _settle() {
    final next = _surfaces.compute();
    final prev = _surfaces.current;
    if (next == null || next == prev) return;
    _leave();
    _surfaces.current = next;
    _surfaces.since = DateTime.now();
    _surfaces.maxScroll = 0;
    track('screen_view', screen: next, props: {'from': ?prev});
  }

  /// Ends the time on the current screen (a new screen, or the app leaving
  /// the foreground).
  static void _leave() {
    final prev = _surfaces.current;
    final since = _surfaces.since;
    if (prev == null || since == null) return;
    final ms = DateTime.now().difference(since).inMilliseconds;
    track(
      'screen_leave',
      screen: prev,
      durationMs: ms,
      props: {'scroll_pct': (_surfaces.maxScroll * 20).round() * 5},
    );
    _surfaces.since = null;
  }

  // ── Taps ─────────────────────────────────────────────────────────────────

  static final List<_PendingTap> _taps = [];

  /// The root listener saw a tap at [x], [y] (fractions of the screen). It
  /// becomes one `tap` event: named, when a [tracked] callback runs for it,
  /// or unnamed (a tap on nothing, or on something not instrumented yet).
  ///
  /// The callback of a tap runs in the same pointer dispatch as the root
  /// listener (the gesture arena is swept on the up), so the tap is recorded
  /// right after it, in a microtask.
  static void pointerTap(double x, double y, Offset at) {
    final tap = _PendingTap(
      x: (x * 1000).round() / 1000,
      y: (y * 1000).round() / 1000,
      at: at,
      screen: screen,
      time: DateTime.now(),
    );
    _taps.add(tap);
    scheduleMicrotask(() => _commitTap(tap));
    _rage(tap);
  }

  /// A [tracked] callback ran: names the tap the root listener just saw, or
  /// records a tap without position (a keyboard, a screen reader, a delayed
  /// recognizer).
  static void tap(String element, {Map<String, Object?>? props}) {
    final pending = _taps.where((t) => t.element == null).toList();
    if (pending.isNotEmpty) {
      final t = pending.last
        ..element = element
        ..props = props;
      _commitTap(t);
    } else {
      track('tap', element: element, props: props);
    }
  }

  /// A [tracked] long-press callback ran.
  static void longPress(String element, {Map<String, Object?>? props}) =>
      track('long_press', element: element, props: props);

  static void _commitTap(_PendingTap t) {
    if (!_taps.remove(t)) return;
    track('tap', screen: t.screen, element: t.element, props: {'x': t.x, 'y': t.y, ...?t.props});
  }

  static final List<_PendingTap> _recent = [];
  static DateTime? _rageAt;

  /// Three taps or more within a second, close together: someone pressing
  /// something that does not respond.
  static void _rage(_PendingTap t) {
    _recent.add(t);
    _recent.removeWhere((r) => t.time.difference(r.time).inMilliseconds > 1000);
    final near = _recent.where((r) => (r.at - t.at).distance < 40).length;
    final last = _rageAt;
    if (near >= 3 && (last == null || t.time.difference(last).inMilliseconds > 1000)) {
      _rageAt = t.time;
      track('rage_tap', screen: t.screen, props: {'x': t.x, 'y': t.y, 'count': near});
    }
  }

  // ── Errors, speed ────────────────────────────────────────────────────────

  static int _errors = 0;

  /// Sends `app_error` for Flutter and platform errors (the type only), on top
  /// of whatever handled them before (Sentry, the console).
  static void installErrorHooks() {
    final previous = FlutterError.onError;
    FlutterError.onError = (details) {
      _error(details.exception, details.library, fatal: false);
      previous?.call(details);
    };
    final dispatcher = PlatformDispatcher.instance;
    final before = dispatcher.onError;
    dispatcher.onError = (error, stack) {
      _error(error, 'platform', fatal: true);
      return before?.call(error, stack) ?? false;
    };
  }

  static void _error(Object error, String? library, {required bool fatal}) {
    if (++_errors > 20) return;
    final type = error.runtimeType.toString();
    track('app_error', props: {
      'type': type.length > 60 ? type.substring(0, 60) : type,
      'lib': ?library,
      'fatal': fatal,
    });
  }

  /// The first line of `main`: the launch is timed from here to [ready].
  static void launching() => _launch
    ..reset()
    ..start();

  /// The app's first frame is up: how long the launch took.
  static void ready() {
    if (!_launch.isRunning) return;
    _launch.stop();
    track('app_ready', props: {'cold_ms': _launch.elapsedMilliseconds});
  }

  // ── Identity ─────────────────────────────────────────────────────────────

  /// Ties this installation to the lead the guest just created; [linkCode] is
  /// what `app_quiz_submit` returned.
  static void linkLead(String? linkCode) {
    if (linkCode == null || linkCode.isEmpty) return;
    _sink?.linkLead(linkCode);
  }

  /// Sends what is queued now (the app going to the background).
  static void flush() => _sink?.flush();
}

class _PendingTap {
  _PendingTap({required this.x, required this.y, required this.at, required this.screen, required this.time});

  final double x;
  final double y;
  final Offset at;
  final String? screen;
  final DateTime time;
  String? element;
  Map<String, Object?>? props;
}

/// Which screen is showing: the navigator's route, a shell's tab, a sheet.
class _Surfaces {
  String? route;
  final Map<String, String> tabs = {};
  final List<String> overlays = [];
  String? current;
  DateTime? since;
  double maxScroll = 0;

  String? compute() {
    if (overlays.isNotEmpty) return overlays.last;
    final r = route;
    if (r == null) return null;
    final t = tabs[r];
    return t == null ? r : '$r#$t';
  }

  void reset() {
    route = null;
    tabs.clear();
    overlays.clear();
    current = null;
    since = null;
    maxScroll = 0;
  }
}

/// Every named route the app's navigator shows: the GoRouter routes are named
/// by their path pattern ("/university/:id"), so no id or query ever travels
/// in the name.
class AppEventsNavigatorObserver extends NavigatorObserver {
  void _view(Route<dynamic>? route) {
    final name = route?.settings.name;
    if (name == null || name.isEmpty) return;
    AppEvents.routeChanged(name);
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _view(route);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _view(newRoute);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _view(previousRoute);
}

/// The queue, the visit, the device's context and the sending.
class _Sink with WidgetsBindingObserver {
  static const _storage = FlutterSecureStorage();
  static const _key = 'app_install_id_v1';
  static const _maxQueue = 1000;
  static const _batch = 100;
  static const _sendAt = 25;
  static const _idle = Duration(minutes: 30);

  String? _installId;
  final Map<String, Object?> _context = {};
  final List<Map<String, Object?>> _queue = [];
  final List<String> _pendingLinks = [];
  Timer? _timer;
  Timer? _saveTimer;
  bool _sending = false;
  bool _v1Only = false;
  Duration _backoff = const Duration(seconds: 10);
  DateTime? _sendAfter;

  String _sessionId = _newUuid();
  int _seq = 0;
  DateTime? _lastAt;
  DateTime? _backgroundAt;
  bool _ready = false;
  final List<Map<String, Object?>> _early = [];

  Future<void> init() async {
    try {
      var id = await _storage.read(key: _key);
      if (id == null || !_uuid.hasMatch(id)) {
        id = _newUuid();
        await _storage.write(key: _key, value: id);
      }
      _installId = id;
    } catch (e) {
      // No secure storage: a per-launch id still groups this session.
      _installId = _newUuid();
      debugPrint('[AppEvents] install id not stored: $e');
    }
    await _readContext();
    final saved = await _QueueFile.load();
    _queue.insertAll(0, saved);
    _ready = true;
    WidgetsBinding.instance.addObserver(this);
    _startSession('launch');
    // What was tracked while the id and the file were being read.
    for (final e in _early) {
      _enqueue(e);
    }
    _early.clear();
    _schedule();
    for (final code in List.of(_pendingLinks)) {
      unawaited(linkLead(code));
    }
    _pendingLinks.clear();
  }

  Future<void> _readContext() async {
    try {
      _context['platform'] = kIsWeb
          ? 'web'
          : Platform.isAndroid
          ? 'android'
          : Platform.isIOS
          ? 'ios'
          : 'other';
    } catch (_) {
      _context['platform'] = 'other';
    }
    try {
      final info = await PackageInfo.fromPlatform();
      _context['app_version'] = info.version;
      _context['app_build'] = int.tryParse(info.buildNumber);
    } catch (_) {}
    _context['build_channel'] = kIsStoreBuild
        ? 'store'
        : kReleaseMode
        ? 'test'
        : 'dev';
    try {
      final device = DeviceInfoPlugin();
      if (kIsWeb) {
        final web = await device.webBrowserInfo;
        _context['os'] = 'web';
        _context['model'] = web.browserName.name;
      } else if (Platform.isAndroid) {
        final a = await device.androidInfo;
        _context['os'] = 'android';
        _context['os_version'] = a.version.release;
        _context['model'] = '${a.manufacturer} ${a.model}';
      } else if (Platform.isIOS) {
        final i = await device.iosInfo;
        _context['os'] = 'ios';
        _context['os_version'] = i.systemVersion;
        _context['model'] = i.utsname.machine;
      }
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
        AppEvents._leave();
        _backgroundAt = DateTime.now();
        add('app_background', screen: AppEvents.screen);
        unawaited(flush());
        _saveNow();
      case AppLifecycleState.resumed:
        final away = _backgroundAt == null ? null : DateTime.now().difference(_backgroundAt!);
        _backgroundAt = null;
        if (away == null) return;
        final rolled = away >= _idle;
        if (rolled) _startSession('resume');
        add('app_resume', screen: AppEvents.screen, props: {'away_s': away.inSeconds});
        AppEvents._surfaces.since = DateTime.now();
        AppEvents._surfaces.maxScroll = 0;
        // A new visit opens on the screen it resumes on.
        final s = AppEvents._surfaces.current;
        if (rolled && s != null) add('screen_view', screen: s, props: {'from': '(background)'});
      case AppLifecycleState.detached:
        unawaited(flush());
        _saveNow();
      default:
        break;
    }
  }

  void _startSession(String reason) {
    _sessionId = _newUuid();
    _seq = 0;
    _lastAt = DateTime.now();
    _enqueue(_record('session_start', props: {'reason': reason}));
  }

  Map<String, Object?> _record(
    String event, {
    String? screen,
    String? element,
    Map<String, Object?>? props,
    int? durationMs,
  }) {
    final clean = <String, Object?>{
      for (final e in (props ?? const {}).entries)
        if (e.value != null)
          e.key: e.value is String && (e.value as String).length > 120 ? (e.value as String).substring(0, 120) : e.value,
    };
    return {
      'id': _newUuid(),
      'event': event,
      'screen': ?screen,
      'element': ?element,
      if (clean.isNotEmpty) 'props': clean,
      'duration_ms': ?durationMs,
      'at': DateTime.now().toUtc().toIso8601String(),
    };
  }

  void add(String event, {String? screen, String? element, Map<String, Object?>? props, int? durationMs}) {
    final record = _record(event, screen: screen, element: element, props: props, durationMs: durationMs);
    if (!_ready) {
      _early.add(record);
      return;
    }
    final last = _lastAt;
    if (last != null && DateTime.now().difference(last) >= _idle && _backgroundAt == null) {
      _startSession('idle');
    }
    _enqueue(record);
  }

  void _enqueue(Map<String, Object?> record) {
    record['session'] = _sessionId;
    record['seq'] = ++_seq;
    _lastAt = DateTime.now();
    _queue.add(record);
    if (_queue.length > _maxQueue) _queue.removeRange(0, _queue.length - _maxQueue);
    _saveSoon();
    if (_queue.length >= _sendAt) {
      unawaited(flush());
    } else {
      _schedule();
    }
  }

  void _schedule() {
    if (_timer?.isActive ?? false) return;
    _timer = Timer(const Duration(seconds: 10), () => unawaited(flush()));
  }

  void _saveSoon() {
    if (_saveTimer?.isActive ?? false) return;
    _saveTimer = Timer(const Duration(seconds: 2), _saveNow);
  }

  void _saveNow() {
    _saveTimer?.cancel();
    unawaited(_QueueFile.save(List.of(_queue)));
  }

  Map<String, Object?> _contextNow() => {
    ..._context,
    'ui_lang': ?AppEvents._language,
    'sent_at': DateTime.now().toUtc().toIso8601String(),
  };

  Future<void> flush() async {
    _timer?.cancel();
    final id = _installId;
    if (_sending || id == null || _queue.isEmpty) return;
    final wait = _sendAfter;
    if (wait != null && DateTime.now().isBefore(wait)) {
      _schedule();
      return;
    }
    _sending = true;
    final batch = _queue.take(_batch).toList();
    var sent = false;
    try {
      if (_v1Only) {
        await _sendV1(id, batch);
      } else {
        final res = await Supabase.instance.client.rpc(
          'app_events_log_v2',
          params: {'p_install_id': id, 'p_context': _contextNow(), 'p_events': batch},
        );
        if (res is Map && res['error'] == 'rate_limited') throw StateError('rate_limited');
      }
      sent = true;
    } on PostgrestException catch (e) {
      // The server has no v2 yet (the migration is not applied): the old way.
      if (!_v1Only && (e.code == 'PGRST202' || e.message.contains('app_events_log_v2'))) {
        _v1Only = true;
        try {
          await _sendV1(id, batch);
          sent = true;
        } catch (e2) {
          debugPrint('[AppEvents] v1 send failed: $e2');
        }
      } else {
        debugPrint('[AppEvents] send failed: ${e.message}');
      }
    } catch (e) {
      // Offline or the like: keep the queue and try again later.
      debugPrint('[AppEvents] send failed: $e');
    } finally {
      _sending = false;
    }
    if (sent) {
      // The queue may have been trimmed while this batch was out.
      for (final r in batch) {
        _queue.remove(r);
      }
      _backoff = const Duration(seconds: 10);
      _sendAfter = null;
      _saveSoon();
    } else {
      _sendAfter = DateTime.now().add(_backoff);
      _backoff = _backoff * 2 > const Duration(minutes: 5) ? const Duration(minutes: 5) : _backoff * 2;
    }
    if (_queue.isNotEmpty) _schedule();
  }

  /// `app_events_log` (v1) takes {event, screen, props, at}; what v2 adds
  /// rides in props so it is not lost.
  Future<void> _sendV1(String id, List<Map<String, Object?>> batch) async {
    final legacy = [
      for (final r in batch)
        {
          'event': r['event'],
          'screen': ?r['screen'],
          'props': {
            ...?(r['props'] as Map<String, Object?>?),
            'element': ?r['element'],
            'duration_ms': ?r['duration_ms'],
          },
          'at': r['at'],
        },
    ];
    await Supabase.instance.client.rpc(
      'app_events_log',
      params: {
        'p_install_id': id,
        'p_platform': _context['platform'],
        'p_app_version': '${_context['app_version'] ?? ''}+${_context['app_build'] ?? ''}',
        'p_events': legacy,
      },
    );
  }

  Future<void> linkLead(String code) async {
    final id = _installId;
    if (id == null) {
      _pendingLinks.add(code);
      return;
    }
    // The installation row is created by the first send; send first.
    await flush();
    try {
      await Supabase.instance.client.rpc('app_install_link_lead', params: {'p_install_id': id, 'p_link_code': code});
    } catch (e) {
      debugPrint('[AppEvents] lead link failed: $e');
    }
  }

  static final _uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
}

String _newUuid() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

/// The queue on disk, so a closed or crashed app loses nothing. The web keeps
/// it in memory only.
abstract final class _QueueFile {
  static const _name = 'analytics_queue_v2.json';

  static Future<File?> _file() async {
    if (kIsWeb) return null;
    try {
      final dir = await getApplicationSupportDirectory();
      return File('${dir.path}/$_name');
    } catch (_) {
      return null;
    }
  }

  static Future<List<Map<String, Object?>>> load() async {
    try {
      final f = await _file();
      if (f == null || !await f.exists()) return const [];
      final raw = jsonDecode(await f.readAsString());
      if (raw is! List) return const [];
      return [
        for (final r in raw)
          if (r is Map && r['event'] is String && r['id'] is String) r.cast<String, Object?>(),
      ];
    } catch (_) {
      return const [];
    }
  }

  static Future<void> save(List<Map<String, Object?>> queue) async {
    try {
      final f = await _file();
      if (f == null) return;
      await f.writeAsString(jsonEncode(queue), flush: true);
    } catch (_) {}
  }
}

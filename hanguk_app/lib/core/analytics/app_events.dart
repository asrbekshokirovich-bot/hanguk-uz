import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// What a person does in the app — the screens they open and the buttons
/// they press — sent to `app_events` (through `app_events_log`) so the CRM can
/// show a lead's or a student's path through the app.
///
/// Only *what was done* is recorded: an event name, the screen, and small
/// non-personal details (a university id, a tab, a choice made). Never typed
/// text, passwords, client codes, phone numbers or the assessment's figures.
///
/// Until [AppEvents.start] runs (from `main`), every call is a no-op, so
/// widget tests and previews never touch the network or leave timers behind.
abstract final class AppEvents {
  static _Sink? _sink;

  /// Starts recording. Called once from `main`, after Supabase is ready.
  static Future<void> start() async {
    if (_sink != null) return;
    final sink = _Sink();
    _sink = sink;
    await sink.init();
  }

  /// Tests only: sees every tracked event, whether recording has started or not.
  @visibleForTesting
  static void Function(String event, String? screen, Map<String, Object?>? props)? debugOnTrack;

  /// Records [event] (lower_snake_case) on [screen] with [props].
  static void track(String event, {String? screen, Map<String, Object?>? props}) {
    debugOnTrack?.call(event, screen, props);
    _sink?.add(event, screen: screen, props: props);
  }

  /// Ties this installation to the lead the guest just created; [linkCode] is
  /// what `app_quiz_submit` returned.
  static void linkLead(String? linkCode) {
    if (linkCode == null || linkCode.isEmpty) return;
    _sink?.linkLead(linkCode);
  }

  /// Sends what is queued now (the app going to the background).
  static void flush() => _sink?.flush();
}

/// The `screen_view` of every named route the app's navigator shows: the
/// GoRouter routes are named by their path pattern ("/guest/university/:id"),
/// so no id or query ever travels in the name.
class AppEventsNavigatorObserver extends NavigatorObserver {
  void _view(Route<dynamic>? route) {
    final name = route?.settings.name;
    if (name == null || name.isEmpty) return;
    AppEvents.track('screen_view', screen: name);
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _view(route);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _view(newRoute);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _view(previousRoute);
}

class _Sink with WidgetsBindingObserver {
  static const _storage = FlutterSecureStorage();
  static const _key = 'app_install_id_v1';
  static const _maxQueue = 300;
  static const _batch = 50;

  String? _installId;
  String _platform = 'other';
  String? _version;
  final List<Map<String, Object?>> _queue = [];
  Timer? _timer;
  bool _sending = false;
  final List<String> _pendingLinks = [];

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
    try {
      _platform = kIsWeb
          ? 'web'
          : Platform.isAndroid
          ? 'android'
          : Platform.isIOS
          ? 'ios'
          : 'other';
    } catch (_) {}
    try {
      final info = await PackageInfo.fromPlatform();
      _version = '${info.version}+${info.buildNumber}';
    } catch (_) {}
    WidgetsBinding.instance.addObserver(this);
    _schedule();
    for (final code in List.of(_pendingLinks)) {
      linkLead(code);
    }
    _pendingLinks.clear();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) flush();
  }

  void add(String event, {String? screen, Map<String, Object?>? props}) {
    final clean = <String, Object?>{
      for (final e in (props ?? const {}).entries)
        if (e.value != null)
          e.key: e.value is String && (e.value as String).length > 120
              ? (e.value as String).substring(0, 120)
              : e.value,
    };
    _queue.add({
      'event': event,
      'screen': ?screen,
      if (clean.isNotEmpty) 'props': clean,
      'at': DateTime.now().toUtc().toIso8601String(),
    });
    if (_queue.length > _maxQueue) _queue.removeRange(0, _queue.length - _maxQueue);
    if (_queue.length >= 20) {
      flush();
    } else {
      _schedule();
    }
  }

  void _schedule() {
    if (_timer?.isActive ?? false) return;
    _timer = Timer(const Duration(seconds: 8), flush);
  }

  Future<void> flush() async {
    _timer?.cancel();
    final id = _installId;
    if (_sending || id == null || _queue.isEmpty) return;
    _sending = true;
    final batch = _queue.take(_batch).toList();
    try {
      await Supabase.instance.client.rpc(
        'app_events_log',
        params: {'p_install_id': id, 'p_platform': _platform, 'p_app_version': _version, 'p_events': batch},
      );
      _queue.removeRange(0, batch.length);
    } catch (e) {
      // Offline or the like: keep the queue and try again later.
      debugPrint('[AppEvents] send failed: $e');
    } finally {
      _sending = false;
    }
    if (_queue.isNotEmpty) _schedule();
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

  static String _newUuid() {
    final r = Random.secure();
    final b = List<int>.generate(16, (_) => r.nextInt(256));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
  }
}

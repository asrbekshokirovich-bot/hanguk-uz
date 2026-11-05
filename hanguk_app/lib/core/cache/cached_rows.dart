import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';

/// Where [CachedRows] keeps its copy: a file on the phone, and the copy
/// shipped in the app. Tests pass their own.
class CachedRowsStore {
  const CachedRowsStore({required this.read, required this.write, required this.bundled});

  /// The saved copy's JSON, or null.
  final Future<String?> Function(String name) read;
  final Future<void> Function(String name, String json) write;

  /// The shipped asset's JSON, or null.
  final Future<String?> Function(String asset) bundled;

  static const device = CachedRowsStore(read: _readFile, write: _writeFile, bundled: _readAsset);

  static Future<File?> _file(String name) async {
    if (kIsWeb) return null;
    try {
      final dir = await getApplicationSupportDirectory();
      return File('${dir.path}/data_cache/$name.json');
    } catch (_) {
      return null;
    }
  }

  static Future<String?> _readFile(String name) async {
    try {
      final f = await _file(name);
      if (f == null || !await f.exists()) return null;
      return await f.readAsString();
    } catch (_) {
      return null;
    }
  }

  static Future<void> _writeFile(String name, String json) async {
    try {
      final f = await _file(name);
      if (f == null) return;
      await f.parent.create(recursive: true);
      await f.writeAsString(json, flush: true);
    } catch (_) {}
  }

  static Future<String?> _readAsset(String asset) async {
    try {
      return await rootBundle.loadString(asset);
    } catch (_) {
      return null;
    }
  }
}

/// The rows of one public read (the catalogue, the map's universities, the
/// assessment's rules), kept so the screen shows them at once — from the last
/// read saved on the phone or, on a first launch, the copy shipped in the
/// app — while the network brings the current rows, instead of a spinner on
/// a slow first launch.
///
/// [load] answers:
/// - rows read less than [fresh] ago: those, with no request;
/// - otherwise a kept copy, at once, and the network in the background;
///   [onFresh] runs when its rows arrive, so the screen reads them;
/// - nothing kept: the network's answer, its error included.
class CachedRows {
  CachedRows(
    this.name, {
    required this.query,
    this.asset,
    this.fresh = const Duration(minutes: 10),
    CachedRowsStore? store,
    DateTime Function()? now,
  }) : _store = store ?? CachedRowsStore.device,
       _now = now ?? DateTime.now;

  /// The saved file's name.
  final String name;

  /// What was asked for; a copy saved for another query is not used.
  final String query;

  /// The copy shipped in the app (assets/data/), or null.
  final String? asset;
  final Duration fresh;
  final CachedRowsStore _store;
  final DateTime Function() _now;

  List<dynamic>? _rows;
  DateTime? _at;
  Future<void>? _restoring;
  Zone? _restoringZone;
  bool _restored = false;
  Future<List<dynamic>>? _inFlight;

  Future<List<dynamic>> load(Future<List<dynamic>> Function() fetch, {void Function()? onFresh}) async {
    if (!_restored) {
      // A look started in another zone (a finished test's) may never end.
      if (_restoring == null || _restoringZone != Zone.current) {
        _restoringZone = Zone.current;
        _restoring = _restore().whenComplete(() => _restored = true);
      }
      await _restoring;
    }
    final rows = _rows;
    if (rows == null) return _fetch(fetch);
    final at = _at;
    if (at == null || _now().difference(at) >= fresh) {
      unawaited(
        _fetch(fetch).then<void>(
          (_) => onFresh?.call(),
          onError: (Object e) => debugPrint('[CachedRows] $name refresh failed: $e'),
        ),
      );
    }
    return rows;
  }

  /// One request at a time; its rows are kept and saved.
  Future<List<dynamic>> _fetch(Future<List<dynamic>> Function() fetch) {
    return _inFlight ??= () async {
      try {
        final rows = await fetch();
        _rows = rows;
        _at = _now();
        unawaited(
          _store.write(name, jsonEncode({'v': 1, 'q': query, 'at': _at!.toUtc().toIso8601String(), 'rows': rows})),
        );
        return rows;
      } finally {
        _inFlight = null;
      }
    }();
  }

  Future<void> _restore() async {
    try {
      final saved = await _store.read(name);
      if (saved != null) {
        final m = jsonDecode(saved);
        if (m is Map && m['v'] == 1 && m['q'] == query && m['rows'] is List) {
          if (_rows == null) {
            _rows = m['rows'] as List;
            _at = DateTime.tryParse('${m['at']}');
          }
          return;
        }
      }
    } catch (e) {
      debugPrint('[CachedRows] $name saved copy unreadable: $e');
    }
    final asset = this.asset;
    if (asset == null) return;
    try {
      final shipped = await _store.bundled(asset);
      if (shipped == null) return;
      final rows = jsonDecode(shipped);
      // An empty list is the placeholder a build without a snapshot ships.
      if (rows is List && rows.isNotEmpty) _rows ??= rows;
    } catch (e) {
      debugPrint('[CachedRows] $asset unreadable: $e');
    }
  }

  @visibleForTesting
  void reset() {
    _rows = null;
    _at = null;
    _restoring = null;
    _restoringZone = null;
    _restored = false;
    _inFlight = null;
  }
}

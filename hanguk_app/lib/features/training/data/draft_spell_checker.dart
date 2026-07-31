import 'dart:ui' show Locale;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'local_dictionary.dart';

/// Whether this device can spell check at all.
///
/// Worth reporting rather than hiding: not every phone can. Android only
/// spell checks through a spell checker *service*, and plenty of shipped ROMs
/// have none installed or none for the language being written — Flutter's own
/// engine logs "TextServicesManager not supported by device, spell check
/// disabled" and moves on. A student on such a phone needs to be told their
/// device cannot do this, not left typing at a checker that silently never
/// answers.
enum SpellCheckAvailability {
  /// No verdict yet — nothing has been checked so far.
  unknown,

  /// The platform has answered at least once.
  available,

  /// This device cannot spell check, and asking again will not change that.
  unavailable,
}

/// One misspelled word the device dictionary rejected.
@immutable
class Misspelling {
  const Misspelling({
    required this.start,
    required this.end,
    required this.word,
    required this.suggestions,
  });

  final int start;
  final int end;

  /// The text actually flagged, sliced from the draft the check ran against.
  final String word;

  /// Replacements offered by the platform, best first. Can be empty — the
  /// dictionary may know a word is wrong without knowing what was meant.
  final List<String> suggestions;

  @override
  String toString() => 'Misspelling($start-$end, "$word", $suggestions)';
}

/// Checks a draft as the student writes it.
///
/// The drafting workspace already had AI supervision, but it is network-bound,
/// debounced by a second, and rate-capped to one call every six — it cannot
/// tell a student that the word they just typed is misspelled. This can.
///
/// English — the track nearly every student writes in — is checked against
/// the app's own bundled [LocalDictionary]: offline, in microseconds, and
/// identical on every phone. It does NOT use the device's spell checker,
/// because Android only spell checks through a spell checker service and many
/// shipped ROMs have none — on those the platform fails every call, forever,
/// and the essay goes unchecked depending on which phone the student owns.
/// That is exactly what field testing showed.
///
/// Korean falls back to the device service via [SpellCheckService] — a Korean
/// wordlist cannot be meaningfully bundled (agglutination makes plain lookup
/// wrong), so there the device's own checker is genuinely the only option,
/// and its absence is reported rather than hidden.
///
/// Wraps [SpellCheckService] rather than [TextField.spellCheckConfiguration]
/// on purpose. Handing the configuration to the field makes `EditableText`
/// render the text itself and bypass `TextEditingController.buildTextSpan`
/// entirely — which is where this app draws its AI grammar underlines and its
/// ghost-text suggestion. Turning the built-in on would have silently deleted
/// both. Calling the service directly keeps the rendering ours.
class DraftSpellChecker {
  DraftSpellChecker({SpellCheckService? service})
    : _service = service ?? DefaultSpellCheckService();

  final SpellCheckService _service;

  SpellCheckAvailability _availability = SpellCheckAvailability.unknown;

  /// What this device turned out to be capable of. Starts
  /// [SpellCheckAvailability.unknown] and settles on the first real answer.
  SpellCheckAvailability get availability => _availability;

  /// Whether checking has been given up on for this session.
  @visibleForTesting
  bool get isUnsupported =>
      _availability == SpellCheckAvailability.unavailable;

  /// Consecutive platform failures. A device with no spell checker service
  /// installed fails *every* call, so after a few in a row we stop asking and
  /// say so instead of retrying forever on every keystroke.
  int _consecutiveFailures = 0;
  static const int _failureLimit = 3;

  /// True while a request is out. The Android implementation rejects a second
  /// request while one is pending ("Previous spell check request still
  /// pending") and, worse, only clears that pending slot on success — so
  /// overlapping our own requests both wastes calls and makes a genuine
  /// wedge indistinguishable from ordinary contention. One at a time.
  bool _inFlight = false;

  /// Spell checks [text] for [locale].
  ///
  /// Returns an empty list when everything is spelled correctly, and `null`
  /// when no verdict could be obtained — this device has no spell checker,
  /// the call failed, or another request was already in flight. `null` means
  /// "unknown", and the caller must leave the existing marks alone rather
  /// than clearing them, or a dropped request would flash every underline off
  /// the screen. Callers should keep a timer behind an immediate check so a
  /// declined request is retried.
  Future<List<Misspelling>?> check(Locale locale, String text) async {
    if (text.trim().isEmpty) return const <Misspelling>[];

    // English: the bundled dictionary, never the platform. Deterministic on
    // every device, no service to be missing, no settings to enable.
    if (locale.languageCode == 'en') {
      final dict = await LocalDictionary.load();
      if (dict != null) {
        _availability = SpellCheckAvailability.available;
        return dict.check(text);
      }
      // The asset failed to load — a broken build. Fall through and give the
      // platform a chance rather than doing nothing at all.
    }

    return _platformCheck(locale, text);
  }

  /// The device-service path — Korean, or English on a build whose dictionary
  /// asset is unreadable.
  Future<List<Misspelling>?> _platformCheck(Locale locale, String text) async {
    if (_availability == SpellCheckAvailability.unavailable) return null;
    if (_inFlight) return null;

    _inFlight = true;

    List<SuggestionSpan>? spans;
    try {
      spans = await _service.fetchSpellCheckSuggestions(locale, text);
      _consecutiveFailures = 0;
      _availability = SpellCheckAvailability.available;
    } on MissingPluginException {
      // No implementation at all — web, desktop. Nothing to retry.
      _availability = SpellCheckAvailability.unavailable;
      return null;
    } on PlatformException catch (e) {
      // On Android this is also what a device with no spell checker service
      // produces: the native session comes back null, the call throws, and
      // because the engine only frees its pending slot on success every later
      // request is refused too. That state never recovers, so stop asking —
      // and let the caller say why rather than looking broken in silence.
      _consecutiveFailures++;
      debugPrint(
        'Spell check failed ($_consecutiveFailures in a row): $e',
      );
      if (_consecutiveFailures >= _failureLimit) {
        _availability = SpellCheckAvailability.unavailable;
      }
      return null;
    } finally {
      _inFlight = false;
    }

    // The service returns null both for "request cancelled" and for "this
    // platform has no spell checker". Neither is a clean bill of health.
    if (spans == null) return null;

    final out = <Misspelling>[];
    for (final span in spans) {
      // Ranges are computed against the text we passed in, but that text can
      // already be stale by the time we get here. Clamp, and drop anything
      // that no longer describes a real slice.
      final start = span.range.start;
      final end = span.range.end > text.length ? text.length : span.range.end;
      if (start < 0 || end <= start) continue;

      out.add(
        Misspelling(
          start: start,
          end: end,
          word: text.substring(start, end),
          suggestions: List<String>.unmodifiable(span.suggestions),
        ),
      );
    }
    return out;
  }
}

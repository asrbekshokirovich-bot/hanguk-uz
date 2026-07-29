import 'dart:ui' show Locale;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

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

/// Checks a draft against the device's own dictionary.
///
/// The drafting workspace already had AI supervision, but it is network-bound,
/// debounced by a second, and rate-capped to one call every six — it cannot
/// tell a student that the word they just typed is misspelled. This does, from
/// the same dictionary the keyboard uses: offline, in milliseconds, per word.
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

  /// Set once the platform has told us it cannot spell check, so a device
  /// without a dictionary stops being asked on every keystroke.
  bool _unsupported = false;

  /// Whether checking has been given up on for this session.
  @visibleForTesting
  bool get isUnsupported => _unsupported;

  /// Guards against an older, slower response overwriting a newer one — with
  /// per-keystroke checks the replies do not necessarily come back in order.
  int _requestCounter = 0;

  /// Spell checks [text] for [locale].
  ///
  /// Returns an empty list when everything is spelled correctly, and `null`
  /// when no verdict could be obtained at all — the platform has no spell
  /// checker (web, desktop, an Android build without one), the request was
  /// superseded, or the call failed. `null` means "unknown", and the caller
  /// must leave the existing marks alone rather than clearing them, or a
  /// dropped request would flash every underline off the screen.
  Future<List<Misspelling>?> check(Locale locale, String text) async {
    if (_unsupported) return null;
    if (text.trim().isEmpty) return const <Misspelling>[];

    final int request = ++_requestCounter;

    List<SuggestionSpan>? spans;
    try {
      spans = await _service.fetchSpellCheckSuggestions(locale, text);
    } on MissingPluginException {
      // No implementation on this platform — stop asking.
      _unsupported = true;
      return null;
    } on PlatformException catch (e) {
      debugPrint('Spell check failed: $e');
      return null;
    }

    // A newer request has been issued since; its answer is the current one.
    if (request != _requestCounter) return null;

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

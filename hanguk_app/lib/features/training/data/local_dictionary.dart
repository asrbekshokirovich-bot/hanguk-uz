import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;

import 'draft_spell_checker.dart' show Misspelling;

/// The app's own English dictionary, bundled as an asset.
///
/// This exists because the platform cannot be trusted with the job. Android
/// spell checks only through a spell checker *service*, and a large share of
/// shipped ROMs have none installed — on those devices every request fails,
/// permanently, and the essay a student is writing for a Korean university
/// goes unchecked depending on which phone they happen to own. The wordlist
/// (~370k English words) rides inside the app instead: offline, identical on
/// every device, nothing to enable in system settings.
///
/// Layout: the asset is lowercase a–z words, one per line, LF-terminated,
/// C-sorted. It is kept as raw bytes and binary-searched in place — no
/// per-word String objects, no Set of 370k entries. Lookup is ~19 byte-wise
/// comparisons; whole-draft checks run comfortably between keystrokes.
class LocalDictionary {
  LocalDictionary._(this._bytes, this._lineStarts, this._frequencyRank);

  final Uint8List _bytes;

  /// Start offset of every line, plus one sentinel equal to `_bytes.length`.
  /// Line `i` spans `[_lineStarts[i], _lineStarts[i+1] - 1)` — the `-1`
  /// drops the `\n` the generator guarantees on every line.
  final Uint32List _lineStarts;

  /// word → rank among the 10k most common English words (0 = most common).
  /// Only used to order suggestions; empty if the ranks asset is unreadable,
  /// in which case suggestions still work but in discovery order.
  final Map<String, int> _frequencyRank;

  static Future<LocalDictionary?>? _loading;

  /// Loads the dictionary once; every later call returns the same future.
  /// Resolves to null only if the asset itself cannot be read — a broken
  /// build, not a runtime condition worth retrying.
  static Future<LocalDictionary?> load() => _loading ??= _load();

  static Future<LocalDictionary?> _load() async {
    try {
      final data = await rootBundle.load('assets/dictionaries/en_words.txt');
      final bytes = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );

      var lines = 0;
      for (var i = 0; i < bytes.length; i++) {
        if (bytes[i] == 0x0A) lines++;
      }

      final starts = Uint32List(lines + 1);
      var idx = 0;
      starts[idx++] = 0;
      for (var i = 0; i < bytes.length - 1; i++) {
        if (bytes[i] == 0x0A) starts[idx++] = i + 1;
      }
      starts[lines] = bytes.length;

      // Best-effort: a missing ranks file degrades suggestion order, not
      // detection.
      var ranks = const <String, int>{};
      try {
        final rankLines = (await rootBundle.loadString(
          'assets/dictionaries/en_ranks.txt',
        )).split('\n');
        ranks = {
          for (var i = 0; i < rankLines.length; i++)
            if (rankLines[i].isNotEmpty) rankLines[i]: i,
        };
      } catch (e) {
        debugPrint('LocalDictionary: ranks asset unreadable: $e');
      }

      return LocalDictionary._(bytes, starts, ranks);
    } catch (e) {
      debugPrint('LocalDictionary: asset load failed: $e');
      return null;
    }
  }

  /// Whether [word] — pure lowercase a–z — is in the dictionary.
  bool contains(String word) {
    if (word.isEmpty) return false;
    var lo = 0;
    var hi = _lineStarts.length - 2;
    while (lo <= hi) {
      final mid = (lo + hi) >> 1;
      final c = _compare(word, mid);
      if (c == 0) return true;
      if (c < 0) {
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return false;
  }

  int _compare(String word, int line) {
    final s = _lineStarts[line];
    final e = _lineStarts[line + 1] - 1; // strip the terminating '\n'
    final lineLen = e - s;
    final wordLen = word.length;
    final n = wordLen < lineLen ? wordLen : lineLen;
    for (var i = 0; i < n; i++) {
      final d = word.codeUnitAt(i) - _bytes[s + i];
      if (d != 0) return d;
    }
    return wordLen - lineLen;
  }

  // ── Checking a draft ─────────────────────────────────────────────────────

  /// One token per run of letters. Includes both apostrophes so "don't"
  /// arrives whole instead of as "don" + "t", and matches any Unicode letter
  /// so a Korean or Uzbek word ("oʻqish" — the ʻ is a modifier letter) forms
  /// a single token that the non-ASCII rule can then skip in one piece.
  static final RegExp _token = RegExp("[\\p{L}'’]+", unicode: true);

  static final RegExp _asciiWord = RegExp(r"^[A-Za-z'’]+$");

  /// Words that are wrong everywhere, essay or not. Checked before apostrophe
  /// stripping; everything else with an apostrophe falls back to its stripped
  /// form, which the wordlist happens to carry for the common contractions
  /// ("dont", "cant", "im").
  static const Set<String> _contractions = {
    "aren't", "can't", "couldn't", "didn't", "doesn't", "don't", "hadn't",
    "hasn't", "haven't", "he'd", "he'll", "he's", "i'd", "i'll", "i'm",
    "i've", "isn't", "it'd", "it'll", "it's", "let's", "mustn't", "shan't",
    "she'd", "she'll", "she's", "shouldn't", "that's", "there's", "they'd",
    "they'll", "they're", "they've", "wasn't", "we'd", "we'll", "we're",
    "we've", "weren't", "what's", "who's", "won't", "wouldn't", "you'd",
    "you'll", "you're", "you've",
  };

  /// Spell checks [text] and returns every word the dictionary rejects.
  ///
  /// Deliberately conservative — a false alarm on a correct word teaches the
  /// student the checker cannot be trusted, so anything not clearly a
  /// lowercase English word is left alone:
  ///
  ///  * tokens with any non-ASCII letter (Korean, Uzbek oʻ/gʻ) are skipped;
  ///  * tokens with any uppercase letter are skipped — "Tashkent", "Yonsei",
  ///    "TOPIK" and every other proper noun or acronym, which no fixed
  ///    wordlist could ever enumerate;
  ///  * single letters are never flagged ("a", "I");
  ///  * possessives are judged by their base word ("university's").
  List<Misspelling> check(String text) {
    final out = <Misspelling>[];

    for (final m in _token.allMatches(text)) {
      var start = m.start;
      var end = m.end;
      var token = m.group(0)!;

      if (!_asciiWord.hasMatch(token)) continue;

      // Trim stray quote characters that rode along ("'hello'").
      while (token.isNotEmpty && _isApostrophe(token.codeUnitAt(0))) {
        token = token.substring(1);
        start++;
      }
      while (token.isNotEmpty &&
          _isApostrophe(token.codeUnitAt(token.length - 1))) {
        token = token.substring(0, token.length - 1);
        end--;
      }
      if (token.length <= 1) continue;

      final lower = token.toLowerCase();
      if (_contractions.contains(lower.replaceAll('’', "'"))) continue;

      // Anything with an uppercase letter is a name, a place, an acronym —
      // out of a wordlist's jurisdiction.
      if (token != lower) continue;

      var probe = lower.replaceAll("'", '').replaceAll('’', '');
      // Possessive: judge the base word.
      if (lower.endsWith("'s") || lower.endsWith('’s')) {
        probe = lower.substring(0, lower.length - 2);
      }
      if (probe.isEmpty || contains(probe)) continue;

      out.add(
        Misspelling(
          start: start,
          end: end,
          word: text.substring(start, end),
          suggestions: suggest(probe),
        ),
      );
    }
    return out;
  }

  static bool _isApostrophe(int codeUnit) =>
      codeUnit == 0x27 || codeUnit == 0x2019;

  // ── Suggestions ──────────────────────────────────────────────────────────

  static const int _maxSuggestions = 3;
  static const int _maxSuggestWordLength = 20;

  /// Dictionary words one edit away from [word]: a deleted, swapped,
  /// replaced, or inserted letter. Covers the great majority of real typos
  /// ("tashkrnt" → "tashkent"); a word mangled further than one edit gets an
  /// underline with no chip, which is honest — guessing would put a wrong
  /// "fix" one tap away from an admission essay.
  ///
  /// Every candidate is collected first and the winners are picked by how
  /// common the word is. Stopping at the first three finds junk: "frend" has
  /// many one-edit neighbours ("arend", "trend", "fiend"...), and discovery
  /// order would fill all three chip slots before ever reaching "friend" —
  /// the one the student meant.
  List<String> suggest(String word) {
    if (word.length > _maxSuggestWordLength) return const [];

    final found = <String>{};
    final n = word.length;

    void tryWord(String candidate) {
      if (candidate == word) return;
      if (contains(candidate)) found.add(candidate);
    }

    // Transpositions.
    for (var i = 0; i < n - 1; i++) {
      tryWord(
        word.substring(0, i) +
            word[i + 1] +
            word[i] +
            word.substring(i + 2),
      );
    }
    // Substitutions.
    for (var i = 0; i < n; i++) {
      for (var c = 0x61; c <= 0x7A; c++) {
        tryWord(
          word.substring(0, i) +
              String.fromCharCode(c) +
              word.substring(i + 1),
        );
      }
    }
    // Insertions.
    for (var i = 0; i <= n; i++) {
      for (var c = 0x61; c <= 0x7A; c++) {
        tryWord(
          word.substring(0, i) +
              String.fromCharCode(c) +
              word.substring(i),
        );
      }
    }
    // Deletions.
    for (var i = 0; i < n; i++) {
      tryWord(word.substring(0, i) + word.substring(i + 1));
    }

    const unranked = 1 << 20;
    final ordered = found.toList()
      ..sort((a, b) {
        final ra = _frequencyRank[a] ?? unranked;
        final rb = _frequencyRank[b] ?? unranked;
        if (ra != rb) return ra - rb;
        // Neither is a common word — prefer the one that kept the typo's
        // first letter, which people rarely get wrong.
        final fa = a.isNotEmpty && a.codeUnitAt(0) == word.codeUnitAt(0);
        final fb = b.isNotEmpty && b.codeUnitAt(0) == word.codeUnitAt(0);
        if (fa != fb) return fa ? -1 : 1;
        return a.compareTo(b);
      });

    return List.unmodifiable(ordered.take(_maxSuggestions));
  }

  /// Number of words loaded. Exposed for tests and diagnostics.
  int get wordCount => _lineStarts.length - 1;
}

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// An invite code that came with the link that opened the web app / mini
/// app (t.me/<bot>?start=<code> → the bot's button → `?ref=<code>`), kept
/// until the newcomer has a profile, then filled in for them (2026-11-27).
class PendingReferral {
  PendingReferral(this._prefs);

  final SharedPreferences _prefs;
  static const _key = 'ish.pending_referral';

  /// A code as the bot passes it: 4–16 letters and digits.
  static String? clean(String? raw) {
    final code = (raw ?? '').trim().toUpperCase();
    return RegExp(r'^[A-Z0-9]{4,16}$').hasMatch(code) ? code : null;
  }

  String? get code => clean(_prefs.getString(_key));

  /// Keeps [raw] when it is a code (a later link replaces an earlier one).
  Future<void> remember(String? raw) async {
    final code = clean(raw);
    if (code != null) await _prefs.setString(_key, code);
  }

  Future<void> clear() => _prefs.remove(_key);
}

/// Null on phones (codes are typed there).
final pendingReferralProvider = Provider<PendingReferral?>((ref) => null);

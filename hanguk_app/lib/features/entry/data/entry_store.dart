import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The four languages offered on the first screen, in the order the owner
/// gave them: Uzbek, English, Korean, Russian.
const List<String> kEntryLanguages = ['uz', 'en', 'ko', 'ru'];

/// Each language's name in itself — what someone who reads only that
/// language recognises on the picker.
const Map<String, String> kEntryLanguageNames = {
  'uz': 'O‘zbekcha',
  'en': 'English',
  'ko': '한국어',
  'ru': 'Русский',
};

/// What the app remembers before anyone signs in: the language chosen on the
/// first screen, and the phone number given in S04 ("Viza imkoniyatim"), so
/// the form is filled in next time.
@immutable
class EntryState {
  const EntryState({this.languageCode, this.phone});

  final String? languageCode;

  /// `+998XXXXXXXXX` once given in S04.
  final String? phone;

  bool get hasLanguage => languageCode != null;
  bool get isRegistered => phone != null;

  Locale? get locale => languageCode == null ? null : Locale(languageCode!);

  EntryState copyWith({String? languageCode, String? phone}) => EntryState(
    languageCode: languageCode ?? this.languageCode,
    phone: phone ?? this.phone,
  );
}

/// Secure storage behind [EntryState], the same store the first-run
/// orientation uses (`OnboardingStore`).
class EntryStore {
  const EntryStore._();

  static const _languageKey = 'app_language_v1';
  static const _phoneKey = 'app_account_phone_v1';
  static const _storage = FlutterSecureStorage();

  /// Read once in `main` before the app is built, so the first frame already
  /// knows which screen and which language to show.
  static EntryState initial = const EntryState();

  static Future<EntryState> load() async {
    try {
      final language = await _storage.read(key: _languageKey);
      final phone = await _storage.read(key: _phoneKey);
      return EntryState(
        languageCode: kEntryLanguages.contains(language) ? language : null,
        phone: (phone == null || phone.isEmpty) ? null : phone,
      );
    } catch (_) {
      // Unreadable storage: ask again rather than guess.
      return const EntryState();
    }
  }

  static Future<void> saveLanguage(String code) async {
    try {
      await _storage.write(key: _languageKey, value: code);
    } catch (_) {
      /* non-fatal: worst case the picker shows again next launch */
    }
  }

  static Future<void> savePhone(String phone) async {
    try {
      await _storage.write(key: _phoneKey, value: phone);
    } catch (_) {
      /* non-fatal: worst case sign-in is asked again next launch */
    }
  }
}

class EntryNotifier extends Notifier<EntryState> {
  @override
  EntryState build() => EntryStore.initial;

  Future<void> setLanguage(String code) async {
    if (!kEntryLanguages.contains(code)) return;
    state = state.copyWith(languageCode: code);
    await EntryStore.saveLanguage(code);
  }

  Future<void> setRegistered(String phone) async {
    state = state.copyWith(phone: phone);
    await EntryStore.savePhone(phone);
  }
}

final entryProvider = NotifierProvider<EntryNotifier, EntryState>(
  EntryNotifier.new,
);

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/analytics/app_events.dart';
import '../../../core/country/app_country.dart';
import '../../../core/money/fx_rates.dart';

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
/// first screen, the country chosen after it (plan KG2), and the phone number
/// given in S04 ("Viza imkoniyatim"), so the form is filled in next time.
@immutable
class EntryState {
  const EntryState({this.languageCode, this.phone, this.country});

  final String? languageCode;

  /// `+998XXXXXXXXX` once given in S04.
  final String? phone;

  /// Null only on a first launch, between the language and the country screen.
  final AppCountry? country;

  bool get hasLanguage => languageCode != null;
  bool get hasCountry => country != null;
  bool get isRegistered => phone != null;

  Locale? get locale => languageCode == null ? null : Locale(languageCode!);

  EntryState copyWith({String? languageCode, String? phone, AppCountry? country}) => EntryState(
    languageCode: languageCode ?? this.languageCode,
    phone: phone ?? this.phone,
    country: country ?? this.country,
  );
}

/// Secure storage behind [EntryState], the same store the first-run
/// orientation uses (`OnboardingStore`).
class EntryStore {
  const EntryStore._();

  static const _languageKey = 'app_language_v1';
  static const _phoneKey = 'app_account_phone_v1';

  /// `UZ` / `KG`; an empty value means "ask": the language was picked on this
  /// build's first screen and the country screen has not been answered yet.
  static const _countryKey = 'app_country_v1';
  static const _storage = FlutterSecureStorage();

  /// Read once in `main` before the app is built, so the first frame already
  /// knows which screen and which language to show.
  static EntryState initial = const EntryState();

  static Future<EntryState> load() async {
    try {
      final language = await _storage.read(key: _languageKey);
      final phone = await _storage.read(key: _phoneKey);
      final savedCountry = await _storage.read(key: _countryKey);
      final languageCode = kEntryLanguages.contains(language) ? language : null;
      var country = AppCountry.fromCode(savedCountry);
      // An install from before the country screen chose its language and was
      // never asked: it is not stopped on a new screen after the update — it
      // takes the phone's country (Uzbekistan when the phone says nothing),
      // which the account screen can change.
      if (country == null && savedCountry == null && languageCode != null) {
        country = phoneCountry() ?? AppCountry.uz;
        await saveCountry(country);
      }
      return EntryState(
        languageCode: languageCode,
        phone: (phone == null || phone.isEmpty) ? null : phone,
        country: country,
      );
    } catch (_) {
      // Unreadable storage: ask again rather than guess.
      return const EntryState();
    }
  }

  /// The country this phone's settings point to ([guessCountry]), or null.
  static AppCountry? phoneCountry() {
    try {
      return guessCountry(
        WidgetsBinding.instance.platformDispatcher.locale,
        DateTime.now().timeZoneOffset,
      );
    } catch (_) {
      return null;
    }
  }

  static Future<void> saveCountry(AppCountry country) async {
    try {
      await _storage.write(key: _countryKey, value: country.code);
    } catch (_) {
      /* non-fatal: worst case the phone's country is taken again next launch */
    }
  }

  /// The language was just picked on the first screen: the country screen
  /// comes next, also after a restart in between.
  static Future<void> markCountryToAsk() async {
    try {
      if (await _storage.read(key: _countryKey) == null) {
        await _storage.write(key: _countryKey, value: '');
      }
    } catch (_) {
      /* non-fatal: the next launch takes the phone's country instead */
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

  /// [source] is where it was chosen: 'first_run' (the first screen, sent even
  /// when the phone's own language is kept) or 'settings'. [deviceDefault] says
  /// whether it is the phone's language, which the first screen pre-selects.
  Future<void> setLanguage(String code, {String source = 'settings', bool? deviceDefault}) async {
    if (!kEntryLanguages.contains(code)) return;
    if (state.languageCode != code || source == 'first_run') {
      AppEvents.track('language_set', props: {'language': code, 'source': source, 'device_default': deviceDefault});
    }
    AppEvents.setLanguage(code);
    final askCountry = source == 'first_run' && state.country == null;
    state = state.copyWith(languageCode: code);
    if (askCountry) await EntryStore.markCountryToAsk();
    await EntryStore.saveLanguage(code);
  }

  /// The country picked on the screen after the language, or later in the
  /// account screen / the guest's Universitetlar header. It goes with every
  /// analytics batch (`app_installs.country`).
  Future<void> setCountry(AppCountry country) async {
    AppEvents.setCountry(country.code);
    // Fees in som for Kyrgyzstan (plan KG4); the fee screens redraw.
    FxRates.setCountry(country.code);
    state = state.copyWith(country: country);
    await EntryStore.saveCountry(country);
  }

  Future<void> setRegistered(String phone) async {
    state = state.copyWith(phone: phone);
    await EntryStore.savePhone(phone);
  }
}

final entryProvider = NotifierProvider<EntryNotifier, EntryState>(
  EntryNotifier.new,
);

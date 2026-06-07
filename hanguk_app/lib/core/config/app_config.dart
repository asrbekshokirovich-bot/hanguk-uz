/// Centralized app configuration constants.
/// All credentials and environment-specific values should live here,
/// not scattered inline throughout the codebase.
class AppConfig {
  AppConfig._(); // Prevent instantiation

  // ── Supabase ─────────────────────────────────────────────────────────────
  static const String supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';

  /// The Supabase anonymous key. This is intentionally a public key — it is
  /// safe to ship in the client, but should never be a service_role key.
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTUxMDYsImV4cCI6MjA4ODQzMTEwNn0.p-WlK-r4xqRk63N6zc_8JCIV53FVmjwAcqK7Lx25GJs';

  // ── Vapi (WebRTC voice AI) ────────────────────────────────────────────────
  /// Public key for the Vapi WebRTC service. Safe to include in client builds.
  static const String vapiPublicKey = '5eb3a0e0-0b4a-4b75-bd3e-18cc95b90b46';

  // ── ElevenLabs voice IDs ─────────────────────────────────────────────────
  // Korean-native voices from the ElevenLabs shared voice library (verified
  // against the public Korean voice catalog). Override at build time with
  // --dart-define=VOICE_ID_KO_<PERSONA>=<id> if you want to swap. If a default
  // ID 404s on your ElevenLabs project (free-tier limits, voice removed),
  // Vapi returns silent dead air rather than a clean error — swap and rebuild.
  //
  // - friendly  → JiYoung   (warm, clear, friendly female)
  // - strict    → Hyun Bin  (cool, professional corporate male)
  // - impatient → KKC       (bright, stable male — clipped delivery)
  static const String voiceIdKoFriendly = String.fromEnvironment(
    'VOICE_ID_KO_FRIENDLY',
    defaultValue: 'AW5wrnG1jVizOYY7R1Oo',
  );
  static const String voiceIdKoStrict = String.fromEnvironment(
    'VOICE_ID_KO_STRICT',
    defaultValue: 's07IwTCOrCDCaETjUVjx',
  );
  static const String voiceIdKoImpatient = String.fromEnvironment(
    'VOICE_ID_KO_IMPATIENT',
    defaultValue: '1W00IGEmNmwmsDeYy7ag',
  );
  // English voices — kept as-is, they work correctly.
  static const String voiceIdEnFriendly = 'nPczCjzI2devNBz1zQrb';
  static const String voiceIdEnStrict = 'pNInz6obbfdqIjc9VDzA';
  static const String voiceIdEnImpatient = 'MF3mGyEYCl7XYWbV9V6O';

  // ── Kakao Maps JavaScript SDK ────────────────────────────────────────────
  // Audit K2 (2026-05-11): the Kakao Maps JS key was hardcoded in three
  // places (`university_map_html.dart`, `roadview_html.dart`, and an
  // orphan `test_map.html`). Centralised here and made overridable at
  // build time via `--dart-define=KAKAO_JS_KEY=<key>`.
  //
  // This is a *JavaScript* key (not an admin/REST key): per Kakao's
  // security guideline it is bound to a JavaScript-SDK domain
  // allowlist in the developer console, so leaking it from the APK is
  // less catastrophic than leaking the admin key — but rotating it is
  // still a normal hygiene step. The default below mirrors the value
  // that was in source before the audit so existing builds keep
  // working without the build flag.
  //
  // For Roadview the same key is used. If we ever shard keys per
  // surface, add `KAKAO_JS_KEY_ROADVIEW` separately.
  //
  // See docs/audits/kakaotalk_audit_2026-05-11.md §3 K2.
  static const String kakaoJsKey = String.fromEnvironment(
    'KAKAO_JS_KEY',
    defaultValue: 'c695b428933e192ca1d8582e3aab14a4',
  );

  // Legal URLs - Privacy Policy and Terms of Service.
  // Required for App Store + Play Store submissions (audit S3).
  // Point at the domain-owned, localized web pages (hanguk-uz exposes
  // /privacy and /terms; canonical domain per STORE_METADATA.md).
  // Override at build time with --dart-define=PRIVACY_POLICY_URL=... .
  static const String privacyPolicyUrl = String.fromEnvironment(
    'PRIVACY_POLICY_URL',
    defaultValue: 'https://hanguk.uz/privacy',
  );

  static const String termsOfServiceUrl = String.fromEnvironment(
    'TERMS_OF_SERVICE_URL',
    defaultValue: 'https://hanguk.uz/terms',
  );
}

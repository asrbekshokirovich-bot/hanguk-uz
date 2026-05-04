/**
 * ElevenLabs voice IDs for the interview practice TTS pipeline.
 *
 * The Korean voice MUST be a native Korean speaker (not a multilingual English
 * voice with KR pronunciation). Pronunciation of `안녕하세요` should sound
 * natively Korean, not anglicized.
 *
 * To swap a voice:
 * 1. Open ElevenLabs Voice Library and find a Korean native voice.
 * 2. Copy its voice ID (the long alphanumeric string).
 * 3. Replace the value below.
 *
 * Avoid hardcoding voice IDs anywhere else in the codebase — always import
 * from this module so the change lives in one place.
 */
export const VOICES = {
  // Yuna — Korean native, multilingual_v2 compatible.
  // Previous value (`cgSgspJ2msm6clMCkdW9`) was "Jessica", a US-English voice,
  // which is why the Korean speaker had an English accent.
  ko: 'xi3rF0t7dg7uN2M0WUhr',
  // English — current production voice (kept as-is).
  en: 'nPczCjzI2devNBz1zQrb',
} as const;

export type SupportedLang = keyof typeof VOICES;

export const getVoiceId = (lang: string): string =>
  VOICES[lang as SupportedLang] ?? VOICES.ko;

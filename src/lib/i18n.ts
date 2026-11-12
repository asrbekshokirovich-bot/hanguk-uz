import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import uz from '@/locales/uz.json';

export const languages = [
  { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
] as const;

export type LanguageCode = typeof languages[number]['code'];

type LocaleModule = { default: Record<string, unknown> };

// Uzbek — the default and the fallback — ships with the page. The other three
// (about 150 KB each) used to as well, for every visitor; now a language is
// fetched the first time somebody needs it.
const loaders: Record<Exclude<LanguageCode, 'uz'>, () => Promise<LocaleModule>> = {
  ko: () => import('@/locales/ko.json'),
  ru: () => import('@/locales/ru.json'),
  en: () => import('@/locales/en.json'),
};

// Tests are written against all four being there at once, as they always
// were. The branch is dropped from a production build.
const preloaded: Record<string, Record<string, unknown>> =
  import.meta.env.MODE === 'test'
    ? (import.meta.glob('../locales/{ko,ru,en}.json', { eager: true, import: 'default' }) as Record<
        string,
        Record<string, unknown>
      >)
    : {};

const resources: Record<string, { translation: Record<string, unknown> }> = { uz: { translation: uz } };
for (const [path, bundle] of Object.entries(preloaded)) {
  const code = /\/([a-z]{2})\.json$/.exec(path)?.[1];
  if (code) resources[code] = { translation: bundle };
}

const baseLanguage = (lng: string | null | undefined): string => lng?.split('-')[0]?.toLowerCase() ?? '';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'uz', // Uzbek is default
    supportedLngs: ['uz', 'ko', 'ru', 'en'],
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    // Texts that arrive after the first render (loadLanguage) redraw the page.
    react: { bindI18nStore: 'added' },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'hanguk-language',
      convertDetectedLanguage: (lng) => {
        // Convert any variant to base language (e.g., ru-RU -> ru)
        const baseLang = baseLanguage(lng);
        // Only return if it's a supported language, otherwise default to Uzbek
        if (['uz', 'ko', 'ru', 'en'].includes(baseLang)) {
          return baseLang;
        }
        return 'uz';
      },
    },
  });

const inFlight = new Map<string, Promise<void>>();

/**
 * Make a language's texts available; resolves once they are (at once for
 * Uzbek and for a language already fetched). A failed download is logged and
 * the page stays in Uzbek — the fallback — rather than showing keys.
 */
export function loadLanguage(lng: string | null | undefined): Promise<void> {
  const code = baseLanguage(lng);
  if (!(code in loaders) || i18n.hasResourceBundle(code, 'translation')) return Promise.resolve();
  let pending = inFlight.get(code);
  if (!pending) {
    pending = loaders[code as keyof typeof loaders]()
      .then((mod) => {
        i18n.addResourceBundle(code, 'translation', mod.default, true, true);
      })
      .catch((error) => {
        console.error(`i18n: could not load "${code}"`, error);
      })
      .finally(() => {
        inFlight.delete(code);
      });
    inFlight.set(code, pending);
  }
  return pending;
}

/** Switch the interface language once its texts are there (no flash of Uzbek in between). */
export async function setLanguage(code: LanguageCode): Promise<void> {
  await loadLanguage(code);
  await i18n.changeLanguage(code);
}

// However the language changes (the detector, a direct changeLanguage), its texts follow.
i18n.on('languageChanged', (lng) => {
  void loadLanguage(lng);
});

/** Resolves when the texts of the language the page opens in are available. */
export const i18nReady: Promise<void> = loadLanguage(i18n.language);

export default i18n;

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import uz from '@/locales/uz.json';
import ko from '@/locales/ko.json';
import ru from '@/locales/ru.json';
import en from '@/locales/en.json';

export const languages = [
  { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
] as const;

export type LanguageCode = typeof languages[number]['code'];

const resources = {
  uz: { translation: uz },
  ko: { translation: ko },
  ru: { translation: ru },
  en: { translation: en },
};

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
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'hanguk-language',
      convertDetectedLanguage: (lng) => {
        // Convert any variant to base language (e.g., ru-RU -> ru)
        const baseLang = lng?.split('-')[0]?.toLowerCase();
        // Only return if it's a supported language, otherwise default to Uzbek
        if (['uz', 'ko', 'ru', 'en'].includes(baseLang)) {
          return baseLang;
        }
        return 'uz';
      },
    },
  });

export default i18n;
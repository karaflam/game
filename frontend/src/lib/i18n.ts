import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from '../locales/fr/translation.json';
import en from '../locales/en/translation.json';

export const LANGUAGE_STORAGE_KEY = 'game:language';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en }
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false
    }
  });

// Keeps the <html lang> attribute in sync with the active language, both for the very first
// render (once i18next has resolved which language it actually landed on — detection can involve
// async plugins, so we wait for the 'initialized' event rather than reading resolvedLanguage
// synchronously right after .init()) and for every later switch via the header's LanguageToggle.
// Assistive tech relies on this attribute to pick the right pronunciation/voice rules.
i18n.on('initialized', () => {
  document.documentElement.lang = i18n.resolvedLanguage ?? 'fr';
});
i18n.on('languageChanged', lng => {
  document.documentElement.lang = lng;
});

export default i18n;

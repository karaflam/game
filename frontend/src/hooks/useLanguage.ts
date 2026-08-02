import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export type LanguageId = 'fr' | 'en';

export default function useLanguage() {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? 'fr') as LanguageId;

  const setLanguage = useCallback(
    (lang: LanguageId) => {
      i18n.changeLanguage(lang);
    },
    [i18n]
  );

  return { language, setLanguage } as const;
}

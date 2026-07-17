import { useEffect, useState } from 'react';

export type ThemeId = 'clair' | 'sombre' | 'luxueux' | 'romantique';

export const themes: { id: ThemeId; name: string }[] = [
  { id: 'clair', name: 'Clair' },
  { id: 'sombre', name: 'Sombre' },
  { id: 'luxueux', name: 'Luxueux' },
  { id: 'romantique', name: 'Romantique' }
];

const STORAGE_KEY = 'game:theme';

export default function useTheme(initial?: ThemeId) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored as ThemeId) || initial || 'clair';
    } catch (e) {
      return (initial as ThemeId) || 'clair';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  const setTheme = (t: ThemeId) => setThemeState(t);

  return { theme, setTheme, themes } as const;
}

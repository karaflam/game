import { useEffect, useState } from 'react';

export type ThemeId = 'clair' | 'sombre' | 'luxueux' | 'romantique';

const STORAGE_KEY = 'game:theme';
// Every useTheme() call keeps its own local state (no shared store), so a
// change made through one instance (e.g. the header toggle) previously never
// reached any other instance already mounted elsewhere (e.g. a game page) —
// those screens only picked up the new theme after a full reload. Broadcast
// changes on this same-tab event so every instance stays in sync live.
const THEME_CHANGE_EVENT = 'game:theme-change';

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

  useEffect(() => {
    const handleExternalChange = (event: Event) => {
      const next = (event as CustomEvent<ThemeId>).detail;
      if (next && next !== theme) {
        setThemeState(next);
      }
    };
    window.addEventListener(THEME_CHANGE_EVENT, handleExternalChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleExternalChange);
  }, [theme]);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    window.dispatchEvent(new CustomEvent<ThemeId>(THEME_CHANGE_EVENT, { detail: t }));
  };

  return { theme, setTheme } as const;
}

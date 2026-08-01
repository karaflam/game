# English Language Switch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users toggle the app's UI language between French and English via a switcher in the header, with the choice persisted across reloads.

**Architecture:** `react-i18next` + `i18next-browser-languagedetector`, initialized once in `frontend/src/lib/i18n.ts` and imported at app startup. All UI strings move into two parallel JSON resource files (`frontend/src/locales/fr/translation.json`, `frontend/src/locales/en/translation.json`) and are looked up via `useTranslation()`'s `t()` in components, replacing hardcoded French JSX text. A `LanguageToggle` component (modeled on the existing `ThemeToggle`) sits in the `Header` next to the theme switcher.

**Tech Stack:** React 18, TypeScript, Vite, react-i18next, i18next, i18next-browser-languagedetector.

## Global Constraints

- New frontend dependencies: `react-i18next`, `i18next`, `i18next-browser-languagedetector` (frontend only — backend is untouched, it sends no display text to the client).
- Every component that renders translated text imports `useTranslation` from `react-i18next` and calls `t('namespace.key')`. Interpolated values use i18next's `{{variableName}}` syntax, e.g. `t('footer.contact', { name: AUTHOR_NAME })`.
- The two resource files (`frontend/src/locales/fr/translation.json`, `frontend/src/locales/en/translation.json`) must always contain the exact same set of keys — every task adds the same keys to both files, French value in `fr`, English value in `en`.
- Language persistence uses `localStorage` key `game:language` (mirrors the existing `game:theme` key used by `frontend/src/hooks/useTheme.ts`), with detection order `localStorage` → browser language → fallback `fr`.
- **Out of scope, do not touch:** `frontend/src/data/soloPrompts.ts` game-content arrays (`soloTruthOrDarePrompts`, `wouldYouRatherPrompts`, word lists, lie triplets) and `backend/src/gamePrompts.ts` — these are gameplay content, translated in a separate future effort. The only part of `soloPrompts.ts` touched by this plan is *reading* `TRUTH_OR_DARE_CATEGORIES` (its `id` field) from the two components that render category labels — the data file itself is not modified.
- **Confirmed dead code — do not translate:** `frontend/src/components/Lobby.tsx`, `ControlPanel.tsx`, `ScoreBoard.tsx`, `GameSelection.tsx`, `ModeSelection.tsx`, `ThemeSelection.tsx` are not imported anywhere in `frontend/src` (verified via grep for `from '.*ComponentName'` — zero matches for each). They're leftovers from an earlier version of the app superseded by `HomePage` → `GameModePage` → `RoomLobbyPage` → `RoomWaitingPage` → `GamePlayPage` → `ResultsPage`. Translating unused files would be wasted work.
- No new automated tests are written for translated text (the existing `*.test.ts` suite covers game logic, not rendered copy — per the design spec, verification is manual). Every task's "test" step is: `npx tsc --noEmit` (frontend type-check must stay clean) run from `frontend/`, plus `npm test` (vitest) to confirm existing logic tests still pass untouched.
- `GameTheme` and `UiTheme` (in `frontend/src/types/game.ts`) currently require `title`/`description` string fields populated with French text in `frontend/src/data/gameThemes.ts` and `frontend/src/data/uiThemes.ts`. This plan removes those two fields from both types and both data files, and updates every render site that read `.title`/`.description` on a `GameTheme`/`UiTheme` to instead call `t()` keyed by the object's `id`. This keeps a single source of truth (the JSON files) instead of duplicating copy in data files nobody reads for display anymore.

---

### Task 1: i18n setup, dependencies, and the language switcher

**Files:**
- Modify: `frontend/package.json` (add dependencies)
- Create: `frontend/src/locales/fr/translation.json`
- Create: `frontend/src/locales/en/translation.json`
- Create: `frontend/src/lib/i18n.ts`
- Create: `frontend/src/hooks/useLanguage.ts`
- Create: `frontend/src/components/LanguageToggle.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/components/layout/Footer.tsx`

**Interfaces:**
- Produces: `useLanguage()` hook returning `{ language: 'fr' | 'en', setLanguage: (lang: 'fr' | 'en') => void, languages: { id: 'fr' | 'en'; label: string }[] }` from `frontend/src/hooks/useLanguage.ts` — used by `LanguageToggle` and available to any later task.
- Produces: `frontend/src/lib/i18n.ts` default export (the configured `i18next` instance) — imported once, for side effects, in `main.tsx`.
- Produces: the `translation.json` key namespaces `header.*` and `footer.*` — later tasks add their own namespaces to the same two files.

- [ ] **Step 1: Install dependencies**

Run from `frontend/`:
```bash
npm install react-i18next i18next i18next-browser-languagedetector
```

- [ ] **Step 2: Create the initial translation resource files**

`frontend/src/locales/fr/translation.json`:
```json
{
  "header": {
    "home": "Accueil",
    "leaderboard": "Classement",
    "profile": "Profil"
  },
  "footer": {
    "contact": "Contacter {{name}}"
  }
}
```

`frontend/src/locales/en/translation.json`:
```json
{
  "header": {
    "home": "Home",
    "leaderboard": "Leaderboard",
    "profile": "Profile"
  },
  "footer": {
    "contact": "Contact {{name}}"
  }
}
```

- [ ] **Step 3: Create the i18n bootstrap module**

`frontend/src/lib/i18n.ts`:
```ts
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

export default i18n;
```

- [ ] **Step 4: Import the bootstrap module in `main.tsx`**

Edit `frontend/src/main.tsx` — add the import before `App`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './lib/i18n';
import App from './App';
import './index.css';
```
(Everything else in the file stays the same.)

- [ ] **Step 5: Create `useLanguage` hook**

`frontend/src/hooks/useLanguage.ts`:
```ts
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export type LanguageId = 'fr' | 'en';

export const languages: { id: LanguageId; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' }
];

export default function useLanguage() {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? 'fr') as LanguageId;

  const setLanguage = useCallback(
    (lang: LanguageId) => {
      i18n.changeLanguage(lang);
    },
    [i18n]
  );

  return { language, setLanguage, languages } as const;
}
```

Note: language names ("Français" / "English") are shown in their own language regardless of the active UI language — this is intentional, a standard pattern for language pickers, and is not routed through `t()`.

- [ ] **Step 6: Create `LanguageToggle` component**

`frontend/src/components/LanguageToggle.tsx` (styled like the existing `ThemeToggle.tsx`):
```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Languages } from 'lucide-react';
import useLanguage from '../hooks/useLanguage';

export default function LanguageToggle() {
  const { language, setLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const activeLanguage = languages.find(item => item.id === language) ?? languages[0];

  return (
    <div className="relative inline-flex text-left">
      <Button
        variant="secondary"
        size="sm"
        className="inline-flex items-center gap-2"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{activeLanguage.label}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="absolute right-0 left-auto z-50 mt-2 w-40 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="p-2">
            {languages.map(lang => (
              <button
                key={lang.id}
                type="button"
                onClick={() => {
                  setLanguage(lang.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-muted ${
                  language === lang.id ? 'bg-muted' : ''
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7: Wire `LanguageToggle` and translated nav labels into `Header.tsx`**

Replace the full contents of `frontend/src/components/layout/Header.tsx`:
```tsx
import { Link, NavLink } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../ThemeToggle';
import LanguageToggle from '../LanguageToggle';
import { uiThemes } from '../../data/uiThemes';
import useTheme from '../../hooks/useTheme';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const activeTheme = uiThemes.find(item => item.id === theme);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 text-xl font-semibold text-foreground">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <span>GameHub</span>
        </Link>

        <nav className="hidden items-center gap-4 sm:flex">
          <NavLink to="/" className={({ isActive }) =>
            `rounded-2xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            {t('header.home')}
          </NavLink>
          <NavLink to="/classement" className={({ isActive }) =>
            `rounded-2xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            {t('header.leaderboard')}
          </NavLink>
          <NavLink to="/profil" className={({ isActive }) =>
            `rounded-2xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            {t('header.profile')}
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle themes={uiThemes} selectedTheme={activeTheme ?? uiThemes[0]} onSelectTheme={theme => setTheme(theme.id)} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 8: Translate the `Footer.tsx` aria-label**

Edit `frontend/src/components/layout/Footer.tsx`:
```tsx
import { useTranslation } from 'react-i18next';

const AUTHOR_NAME = 'Marc Landry Fangue';
const AUTHOR_EMAIL = 'landryfangue2@gmail.com';

export function Footer() {
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-3 right-4 z-40">
      <a
        href={`mailto:${AUTHOR_EMAIL}`}
        aria-label={t('footer.contact', { name: AUTHOR_NAME })}
        className="group flex items-center whitespace-nowrap text-xs"
      >
        <span className="max-w-0 overflow-hidden text-primary opacity-0 transition-all duration-300 ease-out group-hover:mr-2 group-hover:max-w-[220px] group-hover:opacity-100">
          {AUTHOR_EMAIL}
        </span>
        <span className="font-serif italic tracking-wide text-muted-foreground/40 transition-colors duration-300 ease-out group-hover:text-foreground">
          {AUTHOR_NAME}
        </span>
      </a>
    </div>
  );
}
```

- [ ] **Step 9: Type-check**

Run from `frontend/`: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Manual check**

Run `npm run dev` in `frontend/`, open the app. Confirm the language button appears next to the theme button in the header, defaults to French, and clicking English switches the nav labels (Accueil/Classement/Profil → Home/Leaderboard/Profile) and updates the footer's contact aria-label (inspect via devtools or a screen reader). Confirm the choice survives a page reload.

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/locales frontend/src/lib/i18n.ts frontend/src/hooks/useLanguage.ts frontend/src/components/LanguageToggle.tsx frontend/src/main.tsx frontend/src/components/layout/Header.tsx frontend/src/components/layout/Footer.tsx
git commit -m "feat: add i18n infrastructure and language switcher"
```

---

### Task 2: Home page, game selection, and theme data

**Files:**
- Modify: `frontend/src/types/game.ts` (drop `title`/`description` from `GameTheme` and `UiTheme`)
- Modify: `frontend/src/data/gameThemes.ts` (drop `title`/`description` values)
- Modify: `frontend/src/data/uiThemes.ts` (drop `title`/`description` values)
- Modify: `frontend/src/hooks/useTheme.ts` (delete unused duplicate `themes` name list)
- Modify: `frontend/src/components/ThemeToggle.tsx`
- Modify: `frontend/src/components/GameCard.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/pages/GameModePage.tsx`
- Modify: `frontend/src/locales/fr/translation.json`, `frontend/src/locales/en/translation.json`

**Interfaces:**
- Consumes: `useLanguage`/`i18n` setup from Task 1 (already wired app-wide via `main.tsx`).
- Produces: `games.*` and `themes.*` translation namespaces, keyed by `GameId` (`rps`, `truth-or-dare`, `odd-or-even`, `would-you-rather`, `20-questions`, `two-truths-one-lie`) and `UiTheme['id']` (`clair`, `sombre`, `luxueux`, `romantique`) respectively — every later task that renders a game name/description or theme name/description reads these same keys, e.g. `t(\`games.${game.id}.title\`)`.

- [ ] **Step 1: Add `games.*` and `themes.*` keys to both translation files**

Add to `frontend/src/locales/fr/translation.json` (merge into existing object):
```json
{
  "games": {
    "rps": { "title": "Pierre, Feuille, Ciseau", "description": "Affrontez un adversaire en devinant la main gagnante." },
    "truth-or-dare": { "title": "Action ou Vérité", "description": "Une roue choisit un joueur. L’autre valide l’action ou la vérité." },
    "odd-or-even": { "title": "Pair ou Impair", "description": "Chacun choisit un chiffre et prédit si la somme sera paire ou impaire." },
    "would-you-rather": { "title": "Tu Préfères ?", "description": "Choisissez entre deux dilemmes amusants ou surprenants." },
    "20-questions": { "title": "20 Questions", "description": "Un joueur pense à quelque chose, l’autre a 20 essais pour deviner." },
    "two-truths-one-lie": { "title": "2 Vérités, 1 Mensonge", "description": "Un joueur propose 3 faits, les autres votent pour le mensonge." }
  },
  "themes": {
    "clair": { "title": "Clair", "description": "Une palette lumineuse et moderne pour des sessions vives et fluides." },
    "sombre": { "title": "Sombre", "description": "Un style contrasté et immersif, idéal pour les soirées de jeu." },
    "luxueux": { "title": "Luxueux", "description": "Une esthétique soignée et premium pour un jeu haut de gamme." },
    "romantique": { "title": "Romantique", "description": "Un univers tendre et inspirant pour des parties conviviales." }
  },
  "gameCard": {
    "playerCount": "2 joueurs"
  },
  "home": {
    "eyebrow": "Bienvenue",
    "title": "Choisissez un jeu et lancez une partie.",
    "subtitle": "Sélectionnez votre jeu favori, choisissez Solo ou Multijoueur, puis rejoignez un salon en ligne avec un code unique."
  },
  "gameModePage": {
    "notFoundTitle": "Jeu introuvable",
    "notFoundMessage": "Le jeu demandé n’existe pas. Revenez à l’accueil pour en choisir un autre.",
    "soloEyebrow": "Solo",
    "soloTitle": "Mode Solo",
    "soloDescription": "Entraînez-vous contre l’IA ou devinez un mot aléatoire dans un environnement convivial.",
    "multiplayerEyebrow": "Multijoueur",
    "multiplayerTitle": "Mode Multijoueur",
    "multiplayerDescription": "Créez ou rejoignez un salon, invitez vos amis, et jouez en temps réel avec scores partagés."
  }
}
```

Add the matching English block to `frontend/src/locales/en/translation.json`:
```json
{
  "games": {
    "rps": { "title": "Rock, Paper, Scissors", "description": "Face off against an opponent by guessing the winning hand." },
    "truth-or-dare": { "title": "Truth or Dare", "description": "A wheel picks a player. The other one validates the action or the truth." },
    "odd-or-even": { "title": "Odd or Even", "description": "Each player picks a digit and predicts whether the sum will be odd or even." },
    "would-you-rather": { "title": "Would You Rather?", "description": "Choose between two fun or surprising dilemmas." },
    "20-questions": { "title": "20 Questions", "description": "One player thinks of something, the other has 20 tries to guess it." },
    "two-truths-one-lie": { "title": "2 Truths, 1 Lie", "description": "One player states 3 facts, the others vote for the lie." }
  },
  "themes": {
    "clair": { "title": "Light", "description": "A bright, modern palette for lively, fluid sessions." },
    "sombre": { "title": "Dark", "description": "A high-contrast, immersive style, perfect for game nights." },
    "luxueux": { "title": "Luxurious", "description": "A polished, premium look for an upscale game experience." },
    "romantique": { "title": "Romantic", "description": "A warm, inspiring vibe for cozy game sessions." }
  },
  "gameCard": {
    "playerCount": "2 players"
  },
  "home": {
    "eyebrow": "Welcome",
    "title": "Choose a game and start a match.",
    "subtitle": "Pick your favorite game, choose Solo or Multiplayer, then join an online room with a unique code."
  },
  "gameModePage": {
    "notFoundTitle": "Game not found",
    "notFoundMessage": "The requested game doesn’t exist. Head back home to pick another one.",
    "soloEyebrow": "Solo",
    "soloTitle": "Solo Mode",
    "soloDescription": "Practice against the AI or guess a random word in a friendly setting.",
    "multiplayerEyebrow": "Multiplayer",
    "multiplayerTitle": "Multiplayer Mode",
    "multiplayerDescription": "Create or join a room, invite your friends, and play in real time with shared scores."
  }
}
```

- [ ] **Step 2: Drop `title`/`description` from the type definitions**

Edit `frontend/src/types/game.ts`:
```ts
export type GameMode = 'solo' | 'multi';

export type GameTheme = {
  id: GameId;
};

export type UiTheme = {
  id: 'clair' | 'sombre' | 'luxueux' | 'romantique';
  accent: string;
};

export type GameId =
  | 'rps'
  | 'truth-or-dare'
  | 'odd-or-even'
  | 'would-you-rather'
  | '20-questions'
  | 'two-truths-one-lie';

export type ScoreState = {
  player1: number;
  player2: number;
};

export type AppState = {
  selectedGame: GameTheme | null;
  mode: GameMode;
  score: ScoreState;
  gameEnded: boolean;
};
```

- [ ] **Step 3: Strip text from the data files**

Edit `frontend/src/data/gameThemes.ts`:
```ts
import type { GameTheme } from '../types/game';

export const gameThemes: GameTheme[] = [
  { id: 'rps' },
  { id: 'truth-or-dare' },
  { id: 'odd-or-even' },
  { id: 'would-you-rather' },
  { id: '20-questions' },
  { id: 'two-truths-one-lie' }
];
```

Edit `frontend/src/data/uiThemes.ts`:
```ts
import type { UiTheme } from '../types/game';

export const uiThemes: UiTheme[] = [
  { id: 'clair', accent: '#4F6BFF' },
  { id: 'sombre', accent: '#5EEAD4' },
  { id: 'luxueux', accent: '#D4AF37' },
  { id: 'romantique', accent: '#C97FA0' }
];
```

- [ ] **Step 4: Delete the unused duplicate theme-name list in `useTheme.ts`**

Edit `frontend/src/hooks/useTheme.ts` — this hook's `themes` return value is never consumed anywhere (only `theme`/`setTheme` are destructured by callers), so delete the dead `themes` constant and stop returning it:
```ts
import { useEffect, useState } from 'react';

export type ThemeId = 'clair' | 'sombre' | 'luxueux' | 'romantique';

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

  return { theme, setTheme } as const;
}
```

- [ ] **Step 5: Update `ThemeToggle.tsx` to translate theme title/description**

Edit `frontend/src/components/ThemeToggle.tsx` — add `useTranslation` and replace `activeTheme.title`, `theme.title`, `theme.description`:
```tsx
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Gamepad2, Heart, Moon, Sparkles, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UiTheme } from '../types/game';

type Props = {
  themes: UiTheme[];
  selectedTheme: UiTheme | null;
  onSelectTheme: (theme: UiTheme) => void;
};

const themeIcon = {
  clair: Sun,
  sombre: Moon,
  luxueux: Sparkles,
  romantique: Heart
};

export default function ThemeToggle({ themes, selectedTheme, onSelectTheme }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const activeTheme = selectedTheme ?? themes[0];
  const Icon = useMemo(() => themeIcon[activeTheme.id], [activeTheme]);

  return (
    <div className="relative inline-flex text-left">
      <Button
        variant="secondary"
        size="sm"
        className="inline-flex items-center gap-2"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{t(`themes.${activeTheme.id}.title`)}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="absolute right-0 left-auto z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="p-2">
            {themes.map(theme => {
              const ThemeIcon = themeIcon[theme.id];
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(theme);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-muted ${
                    selectedTheme?.id === theme.id ? 'bg-muted' : ''
                  }`}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
                    <ThemeIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t(`themes.${theme.id}.title`)}</div>
                    <p className="text-xs text-muted-foreground">{t(`themes.${theme.id}.description`)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Update `GameCard.tsx`**

Edit `frontend/src/components/GameCard.tsx` — add `useTranslation`, replace `game.title`/`game.description` and the hardcoded `2 joueurs`:
```tsx
import { Heart, HelpCircle, Scissors, Shuffle, Sparkles, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameTheme } from '../types/game';

type GameCardProps = {
  game: GameTheme;
  selected: boolean;
  onSelect: (game: GameTheme) => void;
};

const icons = {
  'rps': Scissors,
  'truth-or-dare': Sparkles,
  'odd-or-even': Shuffle,
  'would-you-rather': Heart,
  '20-questions': HelpCircle,
  'two-truths-one-lie': Users
};

export function GameCard({ game, selected, onSelect }: GameCardProps) {
  const { t } = useTranslation();
  const Icon = icons[game.id] ?? Sparkles;

  return (
    <button
      type="button"
      onClick={() => onSelect(game)}
      className={`group w-full rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        selected ? 'ring-2 ring-offset-2 ring-primary' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <span className="rounded-full bg-secondary px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-secondary-foreground">
          {t('gameCard.playerCount')}
        </span>
      </div>
      <div className="mt-6 space-y-3 text-left">
        <h3 className="text-xl font-semibold text-foreground">{t(`games.${game.id}.title`)}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{t(`games.${game.id}.description`)}</p>
      </div>
    </button>
  );
}
```

- [ ] **Step 7: Update `HomePage.tsx`**

Edit `frontend/src/pages/HomePage.tsx` — add `useTranslation` and replace the three hardcoded strings:
```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameThemes } from '../data/gameThemes';
import { GameCard } from '../components/GameCard';
import type { GameTheme } from '../types/game';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/useGameStore';
import { getActiveRoom } from '../lib/playerSession';

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useSocket();
  const roomCode = useGameStore(state => state.roomCode);
  const status = useGameStore(state => state.status);

  useEffect(() => {
    const session = getActiveRoom();
    if (!session || roomCode !== session.roomCode) {
      return;
    }
    navigate(
      status === 'in-game'
        ? `/jeu/${session.gameId}/salon/${session.roomCode}/partie`
        : `/jeu/${session.gameId}/salon/${session.roomCode}`
    );
  }, [roomCode, status, navigate]);

  const handleSelectGame = (game: GameTheme) => {
    navigate(`/jeu/${game.id}/mode`);
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
    >
      <section className="mb-10 rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">{t('home.eyebrow')}</p>
            <h1 className="mt-4 text-4xl font-bold text-foreground sm:text-5xl">{t('home.title')}</h1>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">{t('home.subtitle')}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {gameThemes.map(game => (
          <GameCard key={game.id} game={game} selected={false} onSelect={handleSelectGame} />
        ))}
      </section>
    </motion.main>
  );
}
```

- [ ] **Step 8: Update `GameModePage.tsx`**

Edit `frontend/src/pages/GameModePage.tsx`:
```tsx
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { gameThemes } from '../data/gameThemes';

export function GameModePage() {
  const { gameId } = useParams();
  const { t } = useTranslation();
  const game = gameThemes.find(item => item.id === gameId);

  if (!game) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground">{t('gameModePage.notFoundTitle')}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{t('gameModePage.notFoundMessage')}</p>
      </motion.div>
    );
  }

  return (
    <motion.main initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="mb-10 rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-foreground">{t(`games.${game.id}.title`)}</h1>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{t(`games.${game.id}.description`)}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link to={`/jeu/${gameId}/salon/solo`} className="rounded-3xl border border-border bg-background p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t('gameModePage.soloEyebrow')}</span>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">{t('gameModePage.soloTitle')}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('gameModePage.soloDescription')}</p>
        </Link>

        <Link to={`/jeu/${gameId}/salon/creer`} className="rounded-3xl border border-border bg-background p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t('gameModePage.multiplayerEyebrow')}</span>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">{t('gameModePage.multiplayerTitle')}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('gameModePage.multiplayerDescription')}</p>
        </Link>
      </div>
    </motion.main>
  );
}
```

- [ ] **Step 9: Type-check and test**

Run from `frontend/`: `npx tsc --noEmit` then `npm test`.
Expected: both pass. `tsc` will immediately flag any remaining `.title`/`.description` read on a `GameTheme`/`UiTheme` outside this task's files — if it does, note the file/line for a later task (RoomLobbyPage, GamePlayPage, SoloPlayPage still read `game.title`/`game.description` and are fixed in Tasks 3–5, so those errors are expected until then; if `tsc` blocks on them, temporarily suppress by finishing this task's manual check without a full `tsc` gate and revisit at the end of Task 5, noting this in the task's completion notes).

- [ ] **Step 10: Manual check**

`npm run dev`, browse the home page and click into a game's mode page in both languages. Confirm game titles/descriptions and theme names switch correctly, no French leaks through in English mode on these two pages.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/types/game.ts frontend/src/data/gameThemes.ts frontend/src/data/uiThemes.ts frontend/src/hooks/useTheme.ts frontend/src/components/ThemeToggle.tsx frontend/src/components/GameCard.tsx frontend/src/pages/HomePage.tsx frontend/src/pages/GameModePage.tsx frontend/src/locales
git commit -m "feat: translate home page, game mode page, and theme/game data"
```

---

### Task 3: Room creation and waiting room

**Files:**
- Modify: `frontend/src/pages/RoomLobbyPage.tsx`
- Modify: `frontend/src/pages/RoomWaitingPage.tsx`
- Modify: `frontend/src/locales/fr/translation.json`, `frontend/src/locales/en/translation.json`

**Interfaces:**
- Consumes: `games.*` namespace from Task 2 (`RoomLobbyPage` still reads `game.title`/`game.description`, now via `t(\`games.${game.id}.title\`)`).
- Produces: `truthOrDareCategories.*` namespace, keyed by the 9 `TruthOrDareCategoryId` values (`general`, `amis`, `couple`, `famille`, `audacieux`, `nostalgie`, `vie`, `desir`, `intimite`) from `frontend/src/data/soloPrompts.ts`. Task 5 (`TruthOrDareSolo.tsx`) reuses these same keys.

- [ ] **Step 1: Add translation keys**

Add to `frontend/src/locales/fr/translation.json`:
```json
{
  "common": {
    "gameNotFoundTitle": "Jeu introuvable"
  },
  "truthOrDareCategories": {
    "general": { "label": "Général", "description": "Questions et gages fun, pour tout le monde." },
    "amis": { "label": "Entre amis", "description": "Souvenirs, anecdotes et complicité de groupe." },
    "couple": { "label": "Couple / Flirt", "description": "Romantique et tendre, sans être explicite." },
    "famille": { "label": "Famille", "description": "Souvenirs et traditions familiales, tout public." },
    "audacieux": { "label": "Audacieux", "description": "Plus embarrassant, mais toujours bon enfant." },
    "nostalgie": { "label": "Nostalgie", "description": "Enfance et souvenirs d’avant." },
    "vie": { "label": "Vie & Ambitions", "description": "Objectifs, regrets et rêves pour l’avenir." },
    "desir": { "label": "Désir & Fantasmes", "description": "Attirance et fantasmes, en toute pudeur." },
    "intimite": { "label": "Confidences intimes", "description": "Vulnérabilité et intimité de couple." }
  },
  "roomLobbyPage": {
    "notFoundMessage": "Retournez à l’accueil et choisissez un jeu pour commencer.",
    "errorPseudoRequired": "Veuillez saisir un pseudo.",
    "errorNoServerConnection": "Connexion serveur non disponible.",
    "errorRoomCodeRequired": "Veuillez saisir un code de salon.",
    "pseudoLabel": "Votre pseudo",
    "pseudoHelp": "C’est ce nom qui sera affiché aux autres joueurs pendant la partie.",
    "pseudoPlaceholder": "Ex : Alex",
    "createRoomTitle": "Créer un salon",
    "createRoomDescription": "Générez un code unique et invitez vos amis pour rejoindre votre partie.",
    "createRoomButton": "Créer un salon",
    "joinRoomTitle": "Rejoindre un salon",
    "joinRoomDescription": "Entrez le code du salon que vous avez reçu pour intégrer la partie.",
    "roomCodePlaceholder": "Code du salon",
    "joinRoomButton": "Rejoindre"
  },
  "roomWaitingPage": {
    "unknownPlayerFallback": "L’autre joueur",
    "categoriesValidatedToast": "✅ {{name}} a validé la sélection de catégories.",
    "categoriesEditedToast": "⚠️ {{name}} a modifié la sélection de catégories après votre validation — vérifiez avant de revalider.",
    "notFoundTitle": "Salle introuvable",
    "notFoundMessage": "Le salon demandé est introuvable. Revenez à l’accueil pour en créer un autre.",
    "hostFallback": "Hôte",
    "eyebrow": "Salle d’attente",
    "title": "Salon {{roomCode}}",
    "subtitle": "Partagez ce code avec vos amis et préparez-vous à lancer la partie.",
    "copyCodeLabel": "Code du salon : ",
    "opponentLeftBanner": "🚪 {{name}} a quitté la partie précédente. Vous pouvez relancer une nouvelle partie dès que tout le monde est prêt.",
    "categoriesHeading": "Catégories de la partie",
    "categoriesHelp": "Cochez les catégories à inclure. Dès que l’un de vous change une case, les deux validations sont annulées — il faut que chacun reclique sur « Valider » pour se remettre d’accord.",
    "youTag": " (vous)",
    "validatedStatus": "a validé cette sélection",
    "notValidatedStatus": "n’a pas encore validé",
    "bothValidatedStatus": "✅ Les deux joueurs ont validé — l’hôte peut maintenant démarrer la partie ci-dessous.",
    "waitingValidationStatus": "➜ Une fois validé par les deux, le bouton « Démarrer la partie » se débloquera.",
    "validatedButton": "Validé ✓",
    "validateButton": "Valider ces catégories",
    "connectedPlayersHeading": "Joueurs connectés",
    "hostTag": "{{name}} (hôte)",
    "noPlayersConnected": "Aucun joueur connecté pour le moment.",
    "roomStatusHeading": "Statut de la salle",
    "statusReady": "Prêt à démarrer.",
    "statusWaitingPlayers": "En attente de joueurs...",
    "statusWaitingValidation": "En attente de la validation des catégories...",
    "startButtonWaitingHost": "En attente de l’hôte",
    "startButtonWaitingValidation": "Validez les catégories pour démarrer",
    "startButtonReady": "Démarrer la partie",
    "leaveRoomButton": "Quitter le salon"
  }
}
```

Add the matching English block to `frontend/src/locales/en/translation.json`:
```json
{
  "common": {
    "gameNotFoundTitle": "Game not found"
  },
  "truthOrDareCategories": {
    "general": { "label": "General", "description": "Fun questions and dares, for everyone." },
    "amis": { "label": "Among Friends", "description": "Memories, stories, and group camaraderie." },
    "couple": { "label": "Couple / Flirty", "description": "Romantic and sweet, without being explicit." },
    "famille": { "label": "Family", "description": "Family memories and traditions, all ages." },
    "audacieux": { "label": "Bold", "description": "More embarrassing, but always good-natured." },
    "nostalgie": { "label": "Nostalgia", "description": "Childhood and memories from way back." },
    "vie": { "label": "Life & Ambitions", "description": "Goals, regrets, and dreams for the future." },
    "desir": { "label": "Desire & Fantasies", "description": "Attraction and fantasies, kept tasteful." },
    "intimite": { "label": "Intimate Confessions", "description": "Vulnerability and closeness as a couple." }
  },
  "roomLobbyPage": {
    "notFoundMessage": "Head back home and pick a game to get started.",
    "errorPseudoRequired": "Please enter a nickname.",
    "errorNoServerConnection": "No server connection available.",
    "errorRoomCodeRequired": "Please enter a room code.",
    "pseudoLabel": "Your nickname",
    "pseudoHelp": "This is the name shown to other players during the match.",
    "pseudoPlaceholder": "E.g.: Alex",
    "createRoomTitle": "Create a room",
    "createRoomDescription": "Generate a unique code and invite your friends to join your match.",
    "createRoomButton": "Create a room",
    "joinRoomTitle": "Join a room",
    "joinRoomDescription": "Enter the room code you received to join the match.",
    "roomCodePlaceholder": "Room code",
    "joinRoomButton": "Join"
  },
  "roomWaitingPage": {
    "unknownPlayerFallback": "The other player",
    "categoriesValidatedToast": "✅ {{name}} approved the category selection.",
    "categoriesEditedToast": "⚠️ {{name}} changed the category selection after your approval — double-check before approving again.",
    "notFoundTitle": "Room not found",
    "notFoundMessage": "The requested room could not be found. Head back home to create another one.",
    "hostFallback": "Host",
    "eyebrow": "Waiting Room",
    "title": "Room {{roomCode}}",
    "subtitle": "Share this code with your friends and get ready to start the match.",
    "copyCodeLabel": "Room code: ",
    "opponentLeftBanner": "🚪 {{name}} left the previous match. You can start a new one as soon as everyone is ready.",
    "categoriesHeading": "Match categories",
    "categoriesHelp": "Check the categories to include. As soon as either of you changes a box, both approvals are cleared — everyone needs to click “Approve” again to agree.",
    "youTag": " (you)",
    "validatedStatus": "approved this selection",
    "notValidatedStatus": "hasn’t approved yet",
    "bothValidatedStatus": "✅ Both players approved — the host can now start the match below.",
    "waitingValidationStatus": "➜ Once both of you approve, the “Start match” button will unlock.",
    "validatedButton": "Approved ✓",
    "validateButton": "Approve these categories",
    "connectedPlayersHeading": "Connected players",
    "hostTag": "{{name}} (host)",
    "noPlayersConnected": "No players connected yet.",
    "roomStatusHeading": "Room status",
    "statusReady": "Ready to start.",
    "statusWaitingPlayers": "Waiting for players...",
    "statusWaitingValidation": "Waiting for category approval...",
    "startButtonWaitingHost": "Waiting for the host",
    "startButtonWaitingValidation": "Approve the categories to start",
    "startButtonReady": "Start match",
    "leaveRoomButton": "Leave room"
  }
}
```

- [ ] **Step 2: Update `RoomLobbyPage.tsx`**

Read `frontend/src/pages/RoomLobbyPage.tsx` first to see the full component (it wasn't reproduced above to keep this plan focused — the file has a not-found guard, a create-room form, and a join-room form). Add `import { useTranslation } from 'react-i18next';` and `const { t } = useTranslation();` at the top of the component, then apply this exact substitution table (every replacement is a straight swap of the literal string for the `t(...)` call shown — no logic changes):

| Line | Old | New |
|---|---|---|
| 30 | `Jeu introuvable` | `{t('common.gameNotFoundTitle')}` |
| 31 | `Retournez à l'accueil et choisissez un jeu pour commencer.` | `{t('roomLobbyPage.notFoundMessage')}` |
| 45 | `'Veuillez saisir un pseudo.'` | `t('roomLobbyPage.errorPseudoRequired')` |
| 50 | `'Connexion serveur non disponible.'` | `t('roomLobbyPage.errorNoServerConnection')` |
| 70 | `'Veuillez saisir un pseudo.'` | `t('roomLobbyPage.errorPseudoRequired')` |
| 76 | `'Veuillez saisir un code de salon.'` | `t('roomLobbyPage.errorRoomCodeRequired')` |
| 81 | `'Connexion serveur non disponible.'` | `t('roomLobbyPage.errorNoServerConnection')` |
| 107 | `{game.title}` | `{t(\`games.${game.id}.title\`)}` |
| 108 | `{game.description}` | `{t(\`games.${game.id}.description\`)}` |
| 114 | `Votre pseudo` | `{t('roomLobbyPage.pseudoLabel')}` |
| 116 | `C'est ce nom qui sera affiché aux autres joueurs pendant la partie.` | `{t('roomLobbyPage.pseudoHelp')}` |
| 127 | `placeholder="Ex : Alex"` | `placeholder={t('roomLobbyPage.pseudoPlaceholder')}` |
| 140 | `Créer un salon` | `{t('roomLobbyPage.createRoomTitle')}` |
| 141 | `Générez un code unique et invitez vos amis pour rejoindre votre partie.` | `{t('roomLobbyPage.createRoomDescription')}` |
| 143 | `Créer un salon` | `{t('roomLobbyPage.createRoomButton')}` |
| 147 | `Rejoindre un salon` | `{t('roomLobbyPage.joinRoomTitle')}` |
| 148 | `Entrez le code du salon que vous avez reçu pour intégrer la partie.` | `{t('roomLobbyPage.joinRoomDescription')}` |
| 158 | `placeholder="Code du salon"` | `placeholder={t('roomLobbyPage.roomCodePlaceholder')}` |
| 162 | `Rejoindre` | `{t('roomLobbyPage.joinRoomButton')}` |

For lines 45/50/70/76/81, the French text is currently the argument to a toast/error-setter function call (e.g. `setError('Veuillez saisir un pseudo.')`) — replace the string literal argument with the `t(...)` call, keep the surrounding function call unchanged.

- [ ] **Step 3: Update `RoomWaitingPage.tsx`**

Read `frontend/src/pages/RoomWaitingPage.tsx` first (it's the largest page in the app — a not-found guard, category checklist synced with `TRUTH_OR_DARE_CATEGORIES`, player list, and room status/start button). Add `import { useTranslation } from 'react-i18next';` and `const { t } = useTranslation();` at the top of the component, then apply this substitution table:

| Line(s) | Old | New |
|---|---|---|
| 66, 73 | `'L'autre joueur'` fallback | `t('roomWaitingPage.unknownPlayerFallback')` |
| 67 | `` `✅ ${name} a validé la sélection de catégories.` `` | `t('roomWaitingPage.categoriesValidatedToast', { name })` |
| 74 | `` `⚠️ ${name} a modifié la sélection de catégories après votre validation — vérifiez avant de revalider.` `` | `t('roomWaitingPage.categoriesEditedToast', { name })` |
| 95 | `Salle introuvable` | `{t('roomWaitingPage.notFoundTitle')}` |
| 96 | `Le salon demandé est introuvable. Revenez à l'accueil pour en créer un autre.` | `{t('roomWaitingPage.notFoundMessage')}` |
| 103 | `'Hôte'` fallback | `t('roomWaitingPage.hostFallback')` |
| 173 | `Salle d'attente` | `{t('roomWaitingPage.eyebrow')}` |
| 174 | `` `Salon ${roomCode}` `` | `{t('roomWaitingPage.title', { roomCode })}` |
| 175 | `Partagez ce code avec vos amis et préparez-vous à lancer la partie.` | `{t('roomWaitingPage.subtitle')}` |
| 183 | `Code du salon : ` | `{t('roomWaitingPage.copyCodeLabel')}` (keep the following `<strong>{roomCode}</strong>` as-is) |
| 191 | `` `🚪 ${opponentLeftName} a quitté la partie précédente. Vous pouvez relancer une nouvelle partie dès que tout le monde est prêt.` `` | `t('roomWaitingPage.opponentLeftBanner', { name: opponentLeftName })` |
| 197 | `Catégories de la partie` | `{t('roomWaitingPage.categoriesHeading')}` |
| 199-200 | `Cochez les catégories à inclure. ...` | `{t('roomWaitingPage.categoriesHelp')}` |
| 215 | `{category.label}` | `{t(\`truthOrDareCategories.${category.id}.label\`)}` |
| 216 | `{category.description}` | `{t(\`truthOrDareCategories.${category.id}.description\`)}` |
| 231 | `' (vous)'` | `t('roomWaitingPage.youTag')` |
| 233 | `'a validé cette sélection'` / `"n'a pas encore validé"` | `t('roomWaitingPage.validatedStatus')` / `t('roomWaitingPage.notValidatedStatus')` (keep the existing ternary condition) |
| 241-243 | `'✅ Les deux joueurs ont validé...'` / `'➜ Une fois validé par les deux...'` | `t('roomWaitingPage.bothValidatedStatus')` / `t('roomWaitingPage.waitingValidationStatus')` (keep the existing ternary) |
| 246 | `'Validé ✓'` / `'Valider ces catégories'` | `t('roomWaitingPage.validatedButton')` / `t('roomWaitingPage.validateButton')` (keep the existing ternary) |
| 254 | `Joueurs connectés` | `{t('roomWaitingPage.connectedPlayersHeading')}` |
| 259 | `` `${player.name} (hôte)` `` | `t('roomWaitingPage.hostTag', { name: player.name })` (keep the existing ternary that only applies this when the player is host) |
| 263 | `Aucun joueur connecté pour le moment.` | `{t('roomWaitingPage.noPlayersConnected')}` |
| 269 | `Statut de la salle` | `{t('roomWaitingPage.roomStatusHeading')}` |
| 272-277 | nested ternary of 3 status strings | replace `'Prêt à démarrer.'` → `t('roomWaitingPage.statusReady')`, `'En attente de joueurs...'` → `t('roomWaitingPage.statusWaitingPlayers')`, `'En attente de la validation des catégories...'` → `t('roomWaitingPage.statusWaitingValidation')`; keep the existing ternary structure (note the same "ready" string appears twice in the original nested ternary — use `statusReady` in both spots) |
| 282-285 | nested ternary of 3 button-label strings | `'En attente de l'hôte'` → `t('roomWaitingPage.startButtonWaitingHost')`, `'Validez les catégories pour démarrer'` → `t('roomWaitingPage.startButtonWaitingValidation')`, `'Démarrer la partie'` → `t('roomWaitingPage.startButtonReady')`; keep the existing ternary structure |
| 287 | `Quitter le salon` | `{t('roomWaitingPage.leaveRoomButton')}` |

- [ ] **Step 4: Type-check**

Run from `frontend/`: `npx tsc --noEmit`.
Expected: no errors from these two files (some pre-existing expected errors from files not yet migrated may remain per the note in Task 2 Step 9 — confirm any remaining errors are only in `GamePlayPage.tsx` / `SoloPlayPage.tsx`, which Task 4 fixes).

- [ ] **Step 5: Manual check**

`npm run dev`, create a room, confirm the lobby form (pseudo/join/create) and the waiting room (categories, player list, status, start button, toasts when a second browser tab validates categories) all read correctly in both languages.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/RoomLobbyPage.tsx frontend/src/pages/RoomWaitingPage.tsx frontend/src/locales
git commit -m "feat: translate room creation and waiting room pages"
```

---

### Task 4: Gameplay shell, results, and remaining pages

**Files:**
- Modify: `frontend/src/pages/GamePlayPage.tsx`
- Modify: `frontend/src/pages/ResultsPage.tsx`
- Modify: `frontend/src/pages/ClassementPage.tsx`
- Modify: `frontend/src/pages/ProfilPage.tsx`
- Modify: `frontend/src/pages/SoloPlayPage.tsx`
- Modify: `frontend/src/components/ReconnectingOverlay.tsx`
- Modify: `frontend/src/locales/fr/translation.json`, `frontend/src/locales/en/translation.json`

**Interfaces:**
- Consumes: `common.gameNotFoundTitle` (Task 3), `games.*` (Task 2).

- [ ] **Step 1: Add translation keys**

Add to `frontend/src/locales/fr/translation.json`:
```json
{
  "gamePlayPage": {
    "notFoundMessage": "Retournez à l'accueil pour sélectionner un jeu.",
    "eyebrow": "Partie en cours",
    "title": "{{gameTitle}} — Salon {{roomCode}}",
    "playerCount": "{{count}} joueur(s) dans la salle.",
    "viewResultsButton": "Voir résultats",
    "leaveMatchButton": "Quitter la partie",
    "notImplemented": "Ce jeu est en cours de développement. Revenez bientôt pour plus d'options."
  },
  "resultsPage": {
    "backAriaLabel": "Retour à l'écran précédent",
    "eyebrow": "Résultats",
    "title": "Classement final",
    "summary": "Récapitulatif du salon {{roomCode}} pour {{gameName}}.",
    "summaryFallbackGame": "le jeu",
    "empty": "Aucun score enregistré pour l'instant.",
    "youTag": " (vous)",
    "scoreLabel": "{{score}} point(s)",
    "backHomeButton": "Retour à l'accueil",
    "playAgainButton": "Rejouer"
  },
  "leaderboardPage": {
    "title": "Classement global",
    "subtitle": "Les scores sont affichés ici une fois la partie terminée.",
    "emptyTitle": "Aucune donnée pour le moment. Le classement sera mis à jour après les parties multijoueur.",
    "emptySubtitle": "Un tableau de top joueurs arrivera ici dès que les scores sont disponibles."
  },
  "profilePage": {
    "title": "Profil joueur",
    "subtitle": "Cette page affichera bientôt les statistiques du joueur, l'historique de parties et les préférences de thème."
  },
  "soloPlayPage": {
    "title": "Mode solo — {{gameName}}",
    "subtitle": "Entraînez-vous contre l'IA.",
    "notImplemented": "Ce jeu n'est pas encore disponible en solo."
  },
  "reconnectingOverlay": {
    "title": "Un instant...",
    "message": "On restaure votre partie. Ça ne prend que quelques secondes — inutile de recharger la page.",
    "slowHint": "Ça prend plus de temps que prévu. Vérifiez votre connexion — vous pouvez recharger la page si ça persiste."
  }
}
```

Add the matching English block to `frontend/src/locales/en/translation.json`:
```json
{
  "gamePlayPage": {
    "notFoundMessage": "Head back home to pick a game.",
    "eyebrow": "Match in progress",
    "title": "{{gameTitle}} — Room {{roomCode}}",
    "playerCount": "{{count}} player(s) in the room.",
    "viewResultsButton": "View results",
    "leaveMatchButton": "Leave match",
    "notImplemented": "This game is still under development. Check back soon for more options."
  },
  "resultsPage": {
    "backAriaLabel": "Back to the previous screen",
    "eyebrow": "Results",
    "title": "Final standings",
    "summary": "Summary for room {{roomCode}} — {{gameName}}.",
    "summaryFallbackGame": "the game",
    "empty": "No scores recorded yet.",
    "youTag": " (you)",
    "scoreLabel": "{{score}} point(s)",
    "backHomeButton": "Back to home",
    "playAgainButton": "Play again"
  },
  "leaderboardPage": {
    "title": "Global leaderboard",
    "subtitle": "Scores are shown here once a match is over.",
    "emptyTitle": "No data yet. The leaderboard will update after multiplayer matches.",
    "emptySubtitle": "A top-players table will show up here as soon as scores are available."
  },
  "profilePage": {
    "title": "Player profile",
    "subtitle": "This page will soon show player stats, match history, and theme preferences."
  },
  "soloPlayPage": {
    "title": "Solo mode — {{gameName}}",
    "subtitle": "Practice against the AI.",
    "notImplemented": "This game isn't available in solo mode yet."
  },
  "reconnectingOverlay": {
    "title": "One moment...",
    "message": "We're restoring your match. It only takes a few seconds — no need to reload the page.",
    "slowHint": "This is taking longer than expected. Check your connection — you can reload the page if it persists."
  }
}
```

- [ ] **Step 2: Update `GamePlayPage.tsx`**

Read the file first. Add `useTranslation`, `const { t } = useTranslation();`, then apply:

| Line | Old | New |
|---|---|---|
| 55 | `Jeu introuvable` | `{t('common.gameNotFoundTitle')}` |
| 56 | `Retournez à l'accueil pour sélectionner un jeu.` | `{t('gamePlayPage.notFoundMessage')}` |
| 66 | `Partie en cours` | `{t('gamePlayPage.eyebrow')}` |
| 67 | `` `{game.title} — Salon ${roomCode}` `` | `{t('gamePlayPage.title', { gameTitle: t(\`games.${game.id}.title\`), roomCode })}` |
| 68 | `` `${players.length} joueur(s) dans la salle.` `` | `{t('gamePlayPage.playerCount', { count: players.length })}` |
| 72 | `Voir résultats` | `{t('gamePlayPage.viewResultsButton')}` |
| 75 | `Quitter la partie` | `{t('gamePlayPage.leaveMatchButton')}` |
| 95 | `Ce jeu est en cours de développement. Revenez bientôt pour plus d'options.` | `{t('gamePlayPage.notImplemented')}` |

- [ ] **Step 3: Update `ResultsPage.tsx`**

Read the file first. Add `useTranslation`, `const { t } = useTranslation();`, then apply:

| Line | Old | New |
|---|---|---|
| 28 | `aria-label="Retour à l'écran précédent"` | `aria-label={t('resultsPage.backAriaLabel')}` |
| 34 | `Résultats` | `{t('resultsPage.eyebrow')}` |
| 35 | `Classement final` | `{t('resultsPage.title')}` |
| 36 | `` `Récapitulatif du salon ${roomCode} pour ${gameId?.replace(/-/g, ' ') ?? 'le jeu'}.` `` | `{t('resultsPage.summary', { roomCode, gameName: gameId ? gameId.replace(/-/g, ' ') : t('resultsPage.summaryFallbackGame') })}` |
| 43 | `Aucun score enregistré pour l'instant.` | `{t('resultsPage.empty')}` |
| 49 | `' (vous)'` | `t('resultsPage.youTag')` |
| 51 | `` `${player.score} point(s)` `` | `t('resultsPage.scoreLabel', { score: player.score })` |
| 58 | `Retour à l'accueil` | `{t('resultsPage.backHomeButton')}` |
| 60 | `Rejouer` | `{t('resultsPage.playAgainButton')}` |

- [ ] **Step 4: Update `ClassementPage.tsx`, `ProfilPage.tsx`, `SoloPlayPage.tsx`, `ReconnectingOverlay.tsx`**

Read each file first, add `useTranslation`, `const { t } = useTranslation();`, then apply:

`frontend/src/pages/ClassementPage.tsx`:
| Line | Old | New |
|---|---|---|
| 7 | `Classement global` | `{t('leaderboardPage.title')}` |
| 8 | `Les scores sont affichés ici une fois la partie terminée.` | `{t('leaderboardPage.subtitle')}` |
| 11 | `Aucune donnée pour le moment. Le classement sera mis à jour après les parties multijoueur.` | `{t('leaderboardPage.emptyTitle')}` |
| 14 | `Un tableau de top joueurs arrivera ici dès que les scores sont disponibles.` | `{t('leaderboardPage.emptySubtitle')}` |

`frontend/src/pages/ProfilPage.tsx`:
| Line | Old | New |
|---|---|---|
| 7 | `Profil joueur` | `{t('profilePage.title')}` |
| 8 | `Cette page affichera bientôt les statistiques du joueur, l'historique de parties et les préférences de thème.` | `{t('profilePage.subtitle')}` |

`frontend/src/pages/SoloPlayPage.tsx`:
| Line | Old | New |
|---|---|---|
| 18 | `` `Mode solo — ${game?.title ?? gameId?.replace(/-/g, ' ')}` `` | `{t('soloPlayPage.title', { gameName: game ? t(\`games.${game.id}.title\`) : gameId?.replace(/-/g, ' ') })}` |
| 19 | `Entraînez-vous contre l'IA.` | `{t('soloPlayPage.subtitle')}` |
| 36 | `Ce jeu n'est pas encore disponible en solo.` | `{t('soloPlayPage.notImplemented')}` |

`frontend/src/components/ReconnectingOverlay.tsx`:
| Line | Old | New |
|---|---|---|
| 38 | `Un instant...` | `{t('reconnectingOverlay.title')}` |
| 40 | `On restaure votre partie. Ça ne prend que quelques secondes — inutile de recharger la page.` | `{t('reconnectingOverlay.message')}` |
| 43-45 | `Ça prend plus de temps que prévu. Vérifiez votre connexion — vous pouvez recharger la page si ça persiste.` | `{t('reconnectingOverlay.slowHint')}` |

- [ ] **Step 5: Type-check**

Run from `frontend/`: `npx tsc --noEmit`.
Expected: no errors — this is the last task touching `GameTheme`/`UiTheme` consumers, so the type change from Task 2 should now be fully resolved everywhere.

- [ ] **Step 6: Manual check**

`npm run dev`. Play a full solo round and a full multiplayer round (two browser tabs) through to the results page, visit the leaderboard and profile pages, and trigger the reconnecting overlay (e.g. by refreshing mid-match). Confirm everything reads correctly in both languages, including the interpolated room codes/scores/counts.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/GamePlayPage.tsx frontend/src/pages/ResultsPage.tsx frontend/src/pages/ClassementPage.tsx frontend/src/pages/ProfilPage.tsx frontend/src/pages/SoloPlayPage.tsx frontend/src/components/ReconnectingOverlay.tsx frontend/src/locales
git commit -m "feat: translate gameplay shell, results, and remaining pages"
```

---

### Task 5: Solo games and shared solo UI

**Files:**
- Modify: `frontend/src/components/solo/ScorePill.tsx`
- Modify: `frontend/src/components/solo/MatchEndOverlay.tsx`
- Modify: `frontend/src/components/solo/reveals/DuelReveal.tsx`
- Modify: `frontend/src/components/solo/reveals/FlipReveal.tsx`
- Modify: `frontend/src/components/solo/reveals/BurstReveal.tsx`
- Modify: `frontend/src/games/solo/RpsSolo.tsx`
- Modify: `frontend/src/games/solo/OddOrEvenSolo.tsx`
- Modify: `frontend/src/games/solo/TruthOrDareSolo.tsx`
- Modify: `frontend/src/games/solo/WouldYouRatherSolo.tsx`
- Modify: `frontend/src/games/solo/TwentyQuestionsSolo.tsx`
- Modify: `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx`
- Modify: `frontend/src/locales/fr/translation.json`, `frontend/src/locales/en/translation.json`

**Interfaces:**
- Consumes: `truthOrDareCategories.*` from Task 3 (reused as-is in `TruthOrDareSolo.tsx`).

- [ ] **Step 1: Add translation keys**

Add to `frontend/src/locales/fr/translation.json`:
```json
{
  "solo": {
    "reveals": { "continueHint": "Cliquez pour continuer", "vsLabel": "VS" },
    "scorePill": { "you": "Vous", "ai": "IA", "reset": "Réinitialiser" },
    "matchEnd": {
      "won": "Vous avez gagné la partie !",
      "draw": "Égalité !",
      "lost": "{{opponent}} a gagné cette fois...",
      "opponentFallback": "L'IA",
      "detailWon": "Belle performance face à {{opponent}}.",
      "detailWonFallback": "la machine",
      "detailDraw": "Personne ne prend l'avantage, belle partie serrée.",
      "detailLost": "Retentez votre chance pour prendre votre revanche.",
      "newMatchButton": "Nouvelle partie"
    },
    "rps": {
      "moves": { "pierre": "Pierre", "feuille": "Feuille", "ciseau": "Ciseau" },
      "instructions": "Choisissez pierre, feuille ou ciseau.",
      "outcomeDraw": "Égalité : vous avez joué {{playerMove}}, l'IA aussi.",
      "outcomeWin": "Vous gagnez la manche ! {{playerMove}} bat {{machineMove}}.",
      "outcomeLose": "Vous perdez la manche... {{machineMove}} bat {{playerMove}}.",
      "duelOutcomeWin": "Vous gagnez la manche !",
      "duelOutcomeLose": "Vous perdez la manche...",
      "duelOutcomeDraw": "Égalité !"
    },
    "oddOrEven": {
      "instructions": "Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme.",
      "outcome": "Vous avez joué {{playerNumber}}, l'IA a joué {{machineNumber}}. Somme {{sum}} ({{parity}}). {{result}}",
      "outcomeWin": "Vous gagnez la manche !",
      "outcomeLose": "Vous perdez la manche...",
      "sumLabel": "Somme {{sum}} ({{parity}})",
      "odd": "Impair",
      "even": "Pair",
      "playButton": "Jouer la manche"
    },
    "truthOrDare": {
      "categoriesHeading": "Catégories",
      "spinInstruction": "Faites tourner la roue pour désigner qui doit relever le défi.",
      "spinButton": "Tourner la roue",
      "playerName": "Vous",
      "promptSuffix": " doit choisir : Action ou Vérité ?",
      "truthButton": "Vérité",
      "dareButton": "Action",
      "revealTruth": "Vérité",
      "revealDare": "Action"
    },
    "wouldYouRather": {
      "yourChoice": "Vous : « {{choice}} »",
      "aiSame": "IA : « {{choice}} » — même longueur d'onde !",
      "aiDifferent": "IA : « {{choice}} » — pas d'accord cette fois.",
      "instructions": "Tu préfères...",
      "nextDilemmaButton": "Prochain dilemme",
      "newDilemmaButton": "Nouveau dilemme"
    },
    "twentyQuestions": {
      "instructions": "Devinez le mot en 20 essais maximum.",
      "newRound": "Nouveau mot ! Devinez-le en 20 essais maximum.",
      "wrongGuess": "Non, ce n'est pas ça. Essai {{attempt}}/{{max}}.",
      "won": "Bravo, c'était bien \"{{answer}}\" !",
      "lost": "Essais épuisés. Le mot était \"{{answer}}\".",
      "revealWon": "Trouvé : {{answer}} !",
      "revealLost": "Le mot était : {{answer}}",
      "revealDetail": "En {{tries}} essai(s).",
      "hintLabel": "Indice :",
      "guessPlaceholder": "Votre proposition",
      "submitButton": "Valider",
      "nextRoundButton": "Manche suivante"
    },
    "twoTruthsOneLie": {
      "won": "Bien joué, vous avez trouvé le mensonge !",
      "lost": "Perdu, ce n'était pas le mensonge.",
      "detail": "Le mensonge était : \"{{lie}}\"",
      "instructions": "L'IA affirme 3 choses sur elle. Trouvez le mensonge.",
      "nextSetButton": "Série suivante"
    }
  }
}
```

Add the matching English block to `frontend/src/locales/en/translation.json`:
```json
{
  "solo": {
    "reveals": { "continueHint": "Click to continue", "vsLabel": "VS" },
    "scorePill": { "you": "You", "ai": "AI", "reset": "Reset" },
    "matchEnd": {
      "won": "You won the match!",
      "draw": "It's a draw!",
      "lost": "{{opponent}} won this time...",
      "opponentFallback": "The AI",
      "detailWon": "Great performance against {{opponent}}.",
      "detailWonFallback": "the machine",
      "detailDraw": "Nobody takes the lead, a close and fun match.",
      "detailLost": "Try again for your revenge.",
      "newMatchButton": "New match"
    },
    "rps": {
      "moves": { "pierre": "Rock", "feuille": "Paper", "ciseau": "Scissors" },
      "instructions": "Choose rock, paper, or scissors.",
      "outcomeDraw": "Draw: you played {{playerMove}}, so did the AI.",
      "outcomeWin": "You win the round! {{playerMove}} beats {{machineMove}}.",
      "outcomeLose": "You lose the round... {{machineMove}} beats {{playerMove}}.",
      "duelOutcomeWin": "You win the round!",
      "duelOutcomeLose": "You lose the round...",
      "duelOutcomeDraw": "Draw!"
    },
    "oddOrEven": {
      "instructions": "Pick a digit from 1 to 9 and predict whether the sum will be odd or even.",
      "outcome": "You played {{playerNumber}}, the AI played {{machineNumber}}. Sum {{sum}} ({{parity}}). {{result}}",
      "outcomeWin": "You win the round!",
      "outcomeLose": "You lose the round...",
      "sumLabel": "Sum {{sum}} ({{parity}})",
      "odd": "Odd",
      "even": "Even",
      "playButton": "Play the round"
    },
    "truthOrDare": {
      "categoriesHeading": "Categories",
      "spinInstruction": "Spin the wheel to pick who takes the challenge.",
      "spinButton": "Spin the wheel",
      "playerName": "You",
      "promptSuffix": " must choose: Truth or Dare?",
      "truthButton": "Truth",
      "dareButton": "Dare",
      "revealTruth": "Truth",
      "revealDare": "Dare"
    },
    "wouldYouRather": {
      "yourChoice": "You: “{{choice}}”",
      "aiSame": "AI: “{{choice}}” — same wavelength!",
      "aiDifferent": "AI: “{{choice}}” — not on the same page this time.",
      "instructions": "Would you rather...",
      "nextDilemmaButton": "Next dilemma",
      "newDilemmaButton": "New dilemma"
    },
    "twentyQuestions": {
      "instructions": "Guess the word in 20 tries or fewer.",
      "newRound": "New word! Guess it in 20 tries or fewer.",
      "wrongGuess": "Nope, not that. Try {{attempt}}/{{max}}.",
      "won": "Well done, it was \"{{answer}}\"!",
      "lost": "Out of tries. The word was \"{{answer}}\".",
      "revealWon": "Found it: {{answer}}!",
      "revealLost": "The word was: {{answer}}",
      "revealDetail": "In {{tries}} tr(ies).",
      "hintLabel": "Hint:",
      "guessPlaceholder": "Your guess",
      "submitButton": "Submit",
      "nextRoundButton": "Next round"
    },
    "twoTruthsOneLie": {
      "won": "Nice, you found the lie!",
      "lost": "Nope, that wasn't the lie.",
      "detail": "The lie was: \"{{lie}}\"",
      "instructions": "The AI states 3 things about itself. Find the lie.",
      "nextSetButton": "Next set"
    }
  }
}
```

- [ ] **Step 2: Update the shared solo components**

Read each file first, add `useTranslation`, `const { t } = useTranslation();`, then apply:

`frontend/src/components/solo/ScorePill.tsx`:
| Line | Old | New |
|---|---|---|
| 49 | default prop `playerLabel = 'Vous'` | `playerLabel = t('solo.scorePill.you')` — since this is a default parameter value (evaluated per-render, not a hoisted constant), move the `useTranslation()` call inside the component body and change the destructured default to reference `t(...)` in the function body instead of a literal default; if the prop is destructured in the parameter list, give it a `?:` optional type, default to `undefined`, and compute `const label = playerLabel ?? t('solo.scorePill.you');` inside the function body. |
| 50 | default prop `machineLabel = 'IA'` | same pattern: `const aiLabel = machineLabel ?? t('solo.scorePill.ai');` |
| 58 | `Réinitialiser` | `{t('solo.scorePill.reset')}` |

`frontend/src/components/solo/MatchEndOverlay.tsx`:
| Line | Old | New |
|---|---|---|
| 59-63 | `'Vous avez gagné la partie !'` / `'Égalité !'` / `` `${opponentLabel ?? 'L'IA'} a gagné cette fois...` `` | `t('solo.matchEnd.won')` / `t('solo.matchEnd.draw')` / `t('solo.matchEnd.lost', { opponent: opponentLabel ?? t('solo.matchEnd.opponentFallback') })` — keep the existing nested-ternary structure, only swap the three leaf values |
| 67-71 | `` `Belle performance face à ${opponentLabel ?? 'la machine'}.` `` / `'Personne ne prend l'avantage...'` / `'Retentez votre chance...'` | `t('solo.matchEnd.detailWon', { opponent: opponentLabel ?? t('solo.matchEnd.detailWonFallback') })` / `t('solo.matchEnd.detailDraw')` / `t('solo.matchEnd.detailLost')` |
| 74 | `Nouvelle partie` | `{t('solo.matchEnd.newMatchButton')}` |

`frontend/src/components/solo/reveals/DuelReveal.tsx`:
| Line | Old | New |
|---|---|---|
| 16-18 | `outcomeText` map values `'Vous gagnez la manche !'` / `'Vous perdez la manche...'` / `'Égalité !'` | `t('solo.rps.duelOutcomeWin')` / `t('solo.rps.duelOutcomeLose')` / `t('solo.rps.duelOutcomeDraw')` — note this map is built at module or render scope; if it's outside the component (no hook access), move it inside the component body where `t` is in scope |
| 46 | `VS` | `{t('solo.reveals.vsLabel')}` |

`frontend/src/components/solo/reveals/FlipReveal.tsx` (line 79) and `frontend/src/components/solo/reveals/BurstReveal.tsx` (line 90):
| Old | New |
|---|---|
| `Cliquez pour continuer` | `{t('solo.reveals.continueHint')}` |

- [ ] **Step 3: Update the 6 solo game files**

Read each file first, add `useTranslation`, `const { t } = useTranslation();`, then apply:

`frontend/src/games/solo/RpsSolo.tsx`:
| Line | Old | New |
|---|---|---|
| 12-14 | `moveLabels` map `pierre: 'Pierre'`, etc. | build the map from `t()` instead: `const moveLabels = { pierre: t('solo.rps.moves.pierre'), feuille: t('solo.rps.moves.feuille'), ciseau: t('solo.rps.moves.ciseau') };` inside the component body (move it there if it's currently module-level) |
| 27 | `Choisissez pierre, feuille ou ciseau.` | `t('solo.rps.instructions')` |
| 46 | `` `Égalité : vous avez joué ${moveLabels[round.player]}, l'IA aussi.` `` | `t('solo.rps.outcomeDraw', { playerMove: moveLabels[round.player] })` |
| 48 | `` `Vous gagnez la manche ! ${moveLabels[round.player]} bat ${moveLabels[round.machine]}.` `` | `t('solo.rps.outcomeWin', { playerMove: moveLabels[round.player], machineMove: moveLabels[round.machine] })` |
| 50 | `` `Vous perdez la manche... ${moveLabels[round.machine]} bat ${moveLabels[round.player]}.` `` | `t('solo.rps.outcomeLose', { playerMove: moveLabels[round.player], machineMove: moveLabels[round.machine] })` |

`frontend/src/games/solo/OddOrEvenSolo.tsx`:
| Line | Old | New |
|---|---|---|
| 19 | `Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme.` | `t('solo.oddOrEven.instructions')` |
| 40-42 | template literal embedding `'Vous gagnez la manche !'` / `'Vous perdez la manche...'` | `t('solo.oddOrEven.outcome', { playerNumber: round.playerNumber, machineNumber: round.machineNumber, sum, parity: actualParity, result: <win condition> ? t('solo.oddOrEven.outcomeWin') : t('solo.oddOrEven.outcomeLose') })` — keep the existing win/lose condition, just source the two leaf strings from `t()` |
| 59 | `` `Somme ${round.playerNumber + round.machineNumber} (${getParity(...)})` `` | `t('solo.oddOrEven.sumLabel', { sum: round.playerNumber + round.machineNumber, parity: getParity(...) })` |
| 77 | `'Pair'` / `'Impair'` | `t('solo.oddOrEven.even')` / `t('solo.oddOrEven.odd')` (keep the existing ternary) |
| 83 | `Jouer la manche` | `{t('solo.oddOrEven.playButton')}` |

`frontend/src/games/solo/TruthOrDareSolo.tsx`:
| Line | Old | New |
|---|---|---|
| 10 | `const PLAYER_NAME = 'Vous';` | source from `t('solo.truthOrDare.playerName')` — since this is likely a module-level constant, move it inside the component body as `const PLAYER_NAME = t('solo.truthOrDare.playerName');` |
| 78 | `Catégories` | `{t('solo.truthOrDare.categoriesHeading')}` |
| 92 | `{category.label}` | `{t(\`truthOrDareCategories.${category.id}.label\`)}` |
| 93 | `{category.description}` | `{t(\`truthOrDareCategories.${category.id}.description\`)}` |
| 99 | `Faites tourner la roue pour désigner qui doit relever le défi.` | `{t('solo.truthOrDare.spinInstruction')}` |
| 101 | `Tourner la roue` | `{t('solo.truthOrDare.spinButton')}` |
| 117 | `` ` doit choisir : Action ou Vérité ?` `` (suffix after `{PLAYER_NAME}`) | `{t('solo.truthOrDare.promptSuffix')}` (keep `{PLAYER_NAME}` prefix as-is) |
| 120 | `Vérité` | `{t('solo.truthOrDare.truthButton')}` |
| 123 | `Action` | `{t('solo.truthOrDare.dareButton')}` |
| 133 | `'Vérité'` / `'Action'` | `t('solo.truthOrDare.revealTruth')` / `t('solo.truthOrDare.revealDare')` (keep the existing ternary) |

`frontend/src/games/solo/WouldYouRatherSolo.tsx`:
| Line | Old | New |
|---|---|---|
| 50 | `` `Vous : « ${dilemma[result.playerChoice]} »` `` | `t('solo.wouldYouRather.yourChoice', { choice: dilemma[result.playerChoice] })` |
| 51-53 | template + ternary `'— même longueur d'onde !'` / `'— pas d'accord cette fois.'` | replace whole line with `result.playerChoice === result.machineChoice ? t('solo.wouldYouRather.aiSame', { choice: dilemma[result.machineChoice] }) : t('solo.wouldYouRather.aiDifferent', { choice: dilemma[result.machineChoice] })` |
| 58 | `Tu préfères...` | `{t('solo.wouldYouRather.instructions')}` |
| 85 | `'Prochain dilemme'` / `'Nouveau dilemme'` | `t('solo.wouldYouRather.nextDilemmaButton')` / `t('solo.wouldYouRather.newDilemmaButton')` (keep the existing ternary) |

`frontend/src/games/solo/TwentyQuestionsSolo.tsx`:
| Line | Old | New |
|---|---|---|
| 22 | `Devinez le mot en 20 essais maximum.` | `t('solo.twentyQuestions.instructions')` |
| 44 | `Nouveau mot ! Devinez-le en 20 essais maximum.` | `t('solo.twentyQuestions.newRound')` |
| 67 | `` `Non, ce n'est pas ça. Essai ${nextAttempts}/${MAX_ATTEMPTS}.` `` | `t('solo.twentyQuestions.wrongGuess', { attempt: nextAttempts, max: MAX_ATTEMPTS })` |
| 77 | `` `Bravo, c'était bien "${roundResult.answer}" !` `` | `t('solo.twentyQuestions.won', { answer: roundResult.answer })` |
| 78 | `` `Essais épuisés. Le mot était "${roundResult.answer}".` `` | `t('solo.twentyQuestions.lost', { answer: roundResult.answer })` |
| 92 | `` `Trouvé : ${roundResult.answer} !` `` / `` `Le mot était : ${roundResult.answer}` `` | `t('solo.twentyQuestions.revealWon', { answer: roundResult.answer })` / `t('solo.twentyQuestions.revealLost', { answer: roundResult.answer })` (keep the existing ternary) |
| 93 | `` `En ${roundResult.triesUsed} essai(s).` `` | `t('solo.twentyQuestions.revealDetail', { tries: roundResult.triesUsed })` |
| 101 | `Indice :` | `{t('solo.twentyQuestions.hintLabel')}` |
| 115 | `placeholder="Votre proposition"` | `placeholder={t('solo.twentyQuestions.guessPlaceholder')}` |
| 119 | `Valider` | `{t('solo.twentyQuestions.submitButton')}` |
| 127 | `Manche suivante` | `{t('solo.twentyQuestions.nextRoundButton')}` |

`frontend/src/games/solo/TwoTruthsOneLieSolo.tsx`:
| Line | Old | New |
|---|---|---|
| 65 | `'Bien joué, vous avez trouvé le mensonge !'` / `'Perdu, ce n'était pas le mensonge.'` | `t('solo.twoTruthsOneLie.won')` / `t('solo.twoTruthsOneLie.lost')` (keep the existing ternary) |
| 66 | `` `Le mensonge était : "${roundResult.lieText}"` `` | `t('solo.twoTruthsOneLie.detail', { lie: roundResult.lieText })` |
| 71 | `L'IA affirme 3 choses sur elle. Trouvez le mensonge.` | `t('solo.twoTruthsOneLie.instructions')` |
| 92 | `Série suivante` | `{t('solo.twoTruthsOneLie.nextSetButton')}` |

- [ ] **Step 4: Type-check and test**

Run from `frontend/`: `npx tsc --noEmit` then `npm test`.
Expected: both pass. This is also the point flagged in Task 2 Step 9 to confirm every `GameTheme`/`UiTheme` consumer has been migrated — `tsc --noEmit` should now be fully clean across the whole `frontend/src` tree.

- [ ] **Step 5: Manual check**

`npm run dev`, play through each of the 6 solo games end to end (RPS, Odd/Even, Truth or Dare, Would You Rather, 20 Questions, Two Truths One Lie) in both languages, confirming instructions, outcome messages, reveal screens, and the match-end overlay all read correctly with no leftover French in English mode.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/solo frontend/src/games/solo frontend/src/locales
git commit -m "feat: translate solo games and shared solo UI"
```

---

### Task 6: Multiplayer games

**Files:**
- Modify: `frontend/src/games/multiplayer/RpsMultiplayer.tsx`
- Modify: `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx`
- Modify: `frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx`
- Modify: `frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx`
- Modify: `frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx`
- Modify: `frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx`
- Modify: `frontend/src/locales/fr/translation.json`, `frontend/src/locales/en/translation.json`

**Interfaces:**
- Consumes: `solo.rps.moves.*`, `solo.matchEnd.*` (Task 5) — several multiplayer files reuse the RPS move-name map and the shared match-end overlay's override strings; reuse those exact keys instead of duplicating.

- [ ] **Step 1: Add translation keys**

Add to `frontend/src/locales/fr/translation.json`:
```json
{
  "multiplayer": {
    "common": {
      "youSuffix": " (vous)",
      "youFallback": "Vous",
      "opponentFallback": "Adversaire",
      "opponentFallbackAlt": "l'adversaire"
    },
    "rps": {
      "waitingOpponent": "Choix envoyé, en attente de l'adversaire...",
      "instructions": "Choisissez pierre, feuille ou ciseau."
    },
    "truthOrDare": {
      "spinInstruction": "Faites tourner la roue pour désigner qui doit relever le défi.",
      "spinButton": "Tourner la roue",
      "promptSelf": "À vous de choisir : Action ou Vérité ?",
      "truthButton": "Vérité",
      "dareButton": "Action",
      "waitingChoice": "En attente du choix de {{name}}...",
      "contentTruth": "Vérité",
      "contentDare": "Action",
      "answerPlaceholder": "Écrivez votre réponse...",
      "sendAnswerButton": "Envoyer la réponse",
      "waitingWrittenAnswer": "En attente de la réponse écrite de {{name}}...",
      "answerLabel": "Réponse :",
      "waitingValidation": "En attente de la validation de {{name}}...",
      "validateButton": "Valider",
      "refuseButton": "Refuser",
      "resultValidated": "Validé ! +1 point.",
      "resultRefused": "Refusé, 0 point.",
      "resultOpponentGains": "{{name}} gagne 1 point.",
      "resultOpponentNoGain": "{{name}} ne gagne pas de point."
    },
    "twoTruthsOneLie": {
      "won": "Bien joué, vous avez trouvé le mensonge !",
      "lost": "Perdu, ce n'était pas le mensonge.",
      "opponentFound": "{{name}} a trouvé votre mensonge.",
      "opponentMissed": "{{name}} s'est trompé, vous gagnez le point !",
      "lieWas": "La phrase {{index}} était le mensonge.",
      "instructions": "{{name}} a soumis 3 affirmations. Votez pour le mensonge.",
      "waitingVote": "Affirmations envoyées. En attente du vote de {{name}}...",
      "writeInstructions": "C'est à vous ! Écrivez 2 vérités et 1 mensonge sur vous, puis indiquez laquelle est fausse.",
      "statementPlaceholder": "Affirmation {{index}}",
      "markLie": "Mensonge",
      "markTruth": "Vérité ✓",
      "submitButton": "Soumettre",
      "waitingOpponentWriting": "C'est au tour de {{name}} de rédiger ses 3 affirmations. Patientez...",
      "waitingRoundStart": "En attente du début de la manche..."
    },
    "twentyQuestions": {
      "opponentFallback": "l'autre joueur",
      "resetButton": "Réinitialiser",
      "myScore": "{{name}} (vous) : {{score}} pt(s)",
      "opponentScore": "{{name}} : {{score}} pt(s)",
      "rules": "La partie se joue en {{total}} tours. Celui qui a le plus de points à la fin gagne.",
      "wonRound": "Bravo, vous avez trouvé le mot ! +{{points}} point(s).",
      "opponentWonRound": "{{name}} a trouvé le mot secret.",
      "roundExhausted": "Essais épuisés pour ce tour, personne ne marque de point.",
      "roundSummary": "Tour {{turn}} / {{total}} terminé.",
      "turnStatus": "Tour {{turn}} / {{total}} — {{attempts}} essai(s) restant(s)",
      "secretWordBadge": "Votre mot secret : {{word}}",
      "leaderInstructions": "C'est vous le meneur ! Pensez à un mot secret que {{name}} devra deviner, puis écrivez-le ci-dessous. {{name}} ne le verra pas.",
      "secretWordPlaceholder": "Écrivez ici le mot secret (ex : éléphant)",
      "validateSecretWordButton": "Valider le mot secret",
      "guesserPrompt": "{{name}} vous a envoyé ceci — une question ou une proposition de mot :",
      "guessQuote": "« {{guess}} »",
      "guesserInstructions": "Est-ce exactement votre mot secret ? Si oui, cliquez sur « Mot trouvé ». Sinon, répondez à sa question et/ou donnez-lui un indice ci-dessous, puis cliquez sur « Répondre ».",
      "hintPlaceholder": "Ex : Oui, et il vit dans la savane",
      "wordFoundButton": "Mot trouvé",
      "replyButton": "Répondre",
      "waitingWordRegistered": "Mot secret enregistré ! Attendez que {{name}} propose une réponse.",
      "waitingGuessSent": "Votre proposition a été envoyée. Attendez que {{name}} vous dise si c'est le bon mot.",
      "opponentReplyLabel": "Réponse de {{name}} :",
      "askerInstructions": "{{name}} a choisi un mot secret. À chaque essai, vous pouvez soit poser une question (par exemple « Est-ce que ça se mange ? »), soit proposer directement un mot. {{name}} vous répondra et pourra vous donner un indice si ce n'est pas encore ça.",
      "askPlaceholder": "Votre question ou votre proposition de mot",
      "sendButton": "Envoyer",
      "waitingOpponentSecret": "C'est {{name}} qui a choisi le mot secret. Patientez pendant qu'il/elle l'écrit...",
      "waitingTurnStart": "En attente du début du tour..."
    },
    "oddOrEven": {
      "outcomeBothRight": "Somme {{sum}} ({{parity}}) — vous avez tous les deux raison, +1 chacun !",
      "outcome": "Somme {{sum}} ({{parity}})",
      "waitingOpponent": "Choix envoyé, en attente de l'adversaire...",
      "instructions": "Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme."
    },
    "wouldYouRather": {
      "yourChoice": "Vous : « {{choice}} »",
      "opponentSame": "{{name}} : « {{choice}} » — même choix, +1 chacun !",
      "opponentDifferent": "{{name}} : « {{choice}} » — choix différents cette fois.",
      "waitingOpponent": "Choix envoyé, en attente de l'adversaire...",
      "instructions": "Tu préfères...",
      "loading": "Chargement du dilemme...",
      "wonTogether": "Vous avez gagné ensemble !",
      "lostTogether": "Vous avez perdu ensemble...",
      "detailIdentical": "{{name}} et vous avez trouvé 5 choix identiques !",
      "detailDifferent": "{{name}} et vous avez fait 5 choix différents avant de vous accorder. Retentez votre chance !"
    }
  }
}
```

Add the matching English block to `frontend/src/locales/en/translation.json`:
```json
{
  "multiplayer": {
    "common": {
      "youSuffix": " (you)",
      "youFallback": "You",
      "opponentFallback": "Opponent",
      "opponentFallbackAlt": "the opponent"
    },
    "rps": {
      "waitingOpponent": "Choice sent, waiting for the opponent...",
      "instructions": "Choose rock, paper, or scissors."
    },
    "truthOrDare": {
      "spinInstruction": "Spin the wheel to pick who takes the challenge.",
      "spinButton": "Spin the wheel",
      "promptSelf": "Your turn to choose: Truth or Dare?",
      "truthButton": "Truth",
      "dareButton": "Dare",
      "waitingChoice": "Waiting for {{name}}'s choice...",
      "contentTruth": "Truth",
      "contentDare": "Dare",
      "answerPlaceholder": "Write your answer...",
      "sendAnswerButton": "Send answer",
      "waitingWrittenAnswer": "Waiting for {{name}}'s written answer...",
      "answerLabel": "Answer:",
      "waitingValidation": "Waiting for {{name}} to approve...",
      "validateButton": "Approve",
      "refuseButton": "Reject",
      "resultValidated": "Approved! +1 point.",
      "resultRefused": "Rejected, 0 points.",
      "resultOpponentGains": "{{name}} gains 1 point.",
      "resultOpponentNoGain": "{{name}} doesn't gain a point."
    },
    "twoTruthsOneLie": {
      "won": "Nice, you found the lie!",
      "lost": "Nope, that wasn't the lie.",
      "opponentFound": "{{name}} found your lie.",
      "opponentMissed": "{{name}} got it wrong, you win the point!",
      "lieWas": "Statement {{index}} was the lie.",
      "instructions": "{{name}} submitted 3 statements. Vote for the lie.",
      "waitingVote": "Statements sent. Waiting for {{name}}'s vote...",
      "writeInstructions": "Your turn! Write 2 truths and 1 lie about yourself, then mark which one is false.",
      "statementPlaceholder": "Statement {{index}}",
      "markLie": "Lie",
      "markTruth": "Truth ✓",
      "submitButton": "Submit",
      "waitingOpponentWriting": "It's {{name}}'s turn to write their 3 statements. Please wait...",
      "waitingRoundStart": "Waiting for the round to start..."
    },
    "twentyQuestions": {
      "opponentFallback": "the other player",
      "resetButton": "Reset",
      "myScore": "{{name}} (you): {{score}} pt(s)",
      "opponentScore": "{{name}}: {{score}} pt(s)",
      "rules": "The match is played over {{total}} turns. Whoever has the most points at the end wins.",
      "wonRound": "Well done, you found the word! +{{points}} point(s).",
      "opponentWonRound": "{{name}} found the secret word.",
      "roundExhausted": "Out of tries for this turn, nobody scores.",
      "roundSummary": "Turn {{turn}} / {{total}} done.",
      "turnStatus": "Turn {{turn}} / {{total}} — {{attempts}} tr(ies) left",
      "secretWordBadge": "Your secret word: {{word}}",
      "leaderInstructions": "You're the leader! Think of a secret word for {{name}} to guess, then write it below. {{name}} won't see it.",
      "secretWordPlaceholder": "Type the secret word here (e.g.: elephant)",
      "validateSecretWordButton": "Confirm secret word",
      "guesserPrompt": "{{name}} sent you this — a question or a word guess:",
      "guessQuote": "“{{guess}}”",
      "guesserInstructions": "Is this exactly your secret word? If so, click “Word found”. Otherwise, answer their question and/or give them a hint below, then click “Reply”.",
      "hintPlaceholder": "E.g.: Yes, and it lives in the savanna",
      "wordFoundButton": "Word found",
      "replyButton": "Reply",
      "waitingWordRegistered": "Secret word saved! Wait for {{name}} to send a guess.",
      "waitingGuessSent": "Your guess has been sent. Wait for {{name}} to tell you if it's right.",
      "opponentReplyLabel": "{{name}}'s reply:",
      "askerInstructions": "{{name}} picked a secret word. On each try, you can either ask a question (e.g. “Is it edible?”) or guess a word directly. {{name}} will reply and may give you a hint if it's not quite right yet.",
      "askPlaceholder": "Your question or word guess",
      "sendButton": "Send",
      "waitingOpponentSecret": "{{name}} picked the secret word. Please wait while they write it...",
      "waitingTurnStart": "Waiting for the turn to start..."
    },
    "oddOrEven": {
      "outcomeBothRight": "Sum {{sum}} ({{parity}}) — you were both right, +1 each!",
      "outcome": "Sum {{sum}} ({{parity}})",
      "waitingOpponent": "Choice sent, waiting for the opponent...",
      "instructions": "Pick a digit from 1 to 9 and predict whether the sum will be odd or even."
    },
    "wouldYouRather": {
      "yourChoice": "You: “{{choice}}”",
      "opponentSame": "{{name}}: “{{choice}}” — same choice, +1 each!",
      "opponentDifferent": "{{name}}: “{{choice}}” — different choices this time.",
      "waitingOpponent": "Choice sent, waiting for the opponent...",
      "instructions": "Would you rather...",
      "loading": "Loading dilemma...",
      "wonTogether": "You won together!",
      "lostTogether": "You lost together...",
      "detailIdentical": "You and {{name}} matched 5 identical choices!",
      "detailDifferent": "You and {{name}} made 5 different choices before agreeing. Try again!"
    }
  }
}
```

- [ ] **Step 2: Update the 6 multiplayer game files**

Read each file first, add `useTranslation`, `const { t } = useTranslation();`, then apply. All 6 files share the same `` `${me?.name ?? 'Vous'} (vous)` `` and `'Adversaire'` fallback pattern — use `multiplayer.common.youFallback`, `multiplayer.common.youSuffix`, `multiplayer.common.opponentFallback` / `opponentFallbackAlt` consistently.

`frontend/src/games/multiplayer/RpsMultiplayer.tsx`:
| Line | Old | New |
|---|---|---|
| 15-17 | `moveLabels` map (same as solo) | build from `t('solo.rps.moves.pierre')` etc. inside the component body, reusing the Task 5 keys (do not duplicate) |
| 125 | `` `${me?.name ?? 'Vous'} (vous)` `` | `` `${me?.name ?? t('multiplayer.common.youFallback')}${t('multiplayer.common.youSuffix')}` `` |
| 126 | `'Adversaire'` fallback | `t('multiplayer.common.opponentFallback')` |
| 142 | `'Choix envoyé, en attente de l'adversaire...'` / `'Choisissez pierre, feuille ou ciseau.'` | `t('multiplayer.rps.waitingOpponent')` / `t('multiplayer.rps.instructions')` (keep ternary) |
| 162 | `'Adversaire'` fallback | `t('multiplayer.common.opponentFallback')` |

`frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx`:
| Line | Old | New |
|---|---|---|
| 186 | `` `${me?.name ?? 'Vous'} (vous)` `` | same pattern as above |
| 187 | `'Adversaire'` | `t('multiplayer.common.opponentFallback')` |
| 193 | `Faites tourner la roue pour désigner qui doit relever le défi.` | `{t('multiplayer.truthOrDare.spinInstruction')}` |
| 195 | `Tourner la roue` | `{t('multiplayer.truthOrDare.spinButton')}` |
| 212 | `À vous de choisir : Action ou Vérité ?` | `{t('multiplayer.truthOrDare.promptSelf')}` |
| 215 | `Vérité` | `{t('multiplayer.truthOrDare.truthButton')}` |
| 217 | `Action` | `{t('multiplayer.truthOrDare.dareButton')}` |
| 223 | `` `En attente du choix de ${activePlayerName}...` `` | `t('multiplayer.truthOrDare.waitingChoice', { name: activePlayerName })` |
| 231 | `'Vérité'` / `'Action'` | `t('multiplayer.truthOrDare.contentTruth')` / `t('multiplayer.truthOrDare.contentDare')` (keep ternary) |
| 242 | `placeholder="Écrivez votre réponse..."` | `placeholder={t('multiplayer.truthOrDare.answerPlaceholder')}` |
| 247 | `Envoyer la réponse` | `{t('multiplayer.truthOrDare.sendAnswerButton')}` |
| 251 | `` `En attente de la réponse écrite de ${activePlayerName}...` `` | `t('multiplayer.truthOrDare.waitingWrittenAnswer', { name: activePlayerName })` |
| 257 | `Réponse :` | `{t('multiplayer.truthOrDare.answerLabel')}` |
| 263 | `` `En attente de la validation de ${opponent?.name ?? 'l'adversaire'}...` `` | `t('multiplayer.truthOrDare.waitingValidation', { name: opponent?.name ?? t('multiplayer.common.opponentFallbackAlt') })` |
| 267 | `Valider` | `{t('multiplayer.truthOrDare.validateButton')}` |
| 269 | `Refuser` | `{t('multiplayer.truthOrDare.refuseButton')}` |
| 284-288 | nested ternary of 4 strings | `t('multiplayer.truthOrDare.resultValidated')` / `t('multiplayer.truthOrDare.resultRefused')` / `t('multiplayer.truthOrDare.resultOpponentGains', { name: activePlayerName })` / `t('multiplayer.truthOrDare.resultOpponentNoGain', { name: activePlayerName })` (keep the existing nested ternary structure) |
| 294 | `'Adversaire'` | `t('multiplayer.common.opponentFallback')` |

`frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx`:
| Line | Old | New |
|---|---|---|
| 115 | `'Adversaire'` fallback | `t('multiplayer.common.opponentFallback')` |
| 179 | `` `${me?.name ?? 'Vous'} (vous)` `` | same pattern |
| 190 | `'Bien joué, vous avez trouvé le mensonge !'` | `t('multiplayer.twoTruthsOneLie.won')` |
| 191 | `'Perdu, ce n'était pas le mensonge.'` | `t('multiplayer.twoTruthsOneLie.lost')` |
| 193 | `` `${opponentName} a trouvé votre mensonge.` `` | `t('multiplayer.twoTruthsOneLie.opponentFound', { name: opponentName })` |
| 194 | `` `${opponentName} s'est trompé, vous gagnez le point !` `` | `t('multiplayer.twoTruthsOneLie.opponentMissed', { name: opponentName })` |
| 196 | `` `La phrase ${result.lieIndex + 1} était le mensonge.` `` | `t('multiplayer.twoTruthsOneLie.lieWas', { index: result.lieIndex + 1 })` |
| 201 | `` `${opponentName} a soumis 3 affirmations. Votez pour le mensonge.` `` | `t('multiplayer.twoTruthsOneLie.instructions', { name: opponentName })` |
| 218 | `` `Affirmations envoyées. En attente du vote de ${opponentName}...` `` | `t('multiplayer.twoTruthsOneLie.waitingVote', { name: opponentName })` |
| 222 | `C'est à vous ! Écrivez 2 vérités et 1 mensonge sur vous, puis indiquez laquelle est fausse.` | `t('multiplayer.twoTruthsOneLie.writeInstructions')` |
| 235 | `` `Affirmation ${index + 1}` `` (placeholder) | `t('multiplayer.twoTruthsOneLie.statementPlaceholder', { index: index + 1 })` |
| 246 | `'Mensonge '` / `'verité ✓'` | `t('multiplayer.twoTruthsOneLie.markLie')` / `t('multiplayer.twoTruthsOneLie.markTruth')` — this also fixes the pre-existing typo/inconsistent capitalization noted in the extraction ("verité" lowercase, mismatched wording), now correctly cased in both languages |
| 252 | `Soumettre` | `{t('multiplayer.twoTruthsOneLie.submitButton')}` |
| 257 | `` `C'est au tour de ${opponentName} de rédiger ses 3 affirmations. Patientez...` `` | `t('multiplayer.twoTruthsOneLie.waitingOpponentWriting', { name: opponentName })` |
| 260 | `En attente du début de la manche...` | `t('multiplayer.twoTruthsOneLie.waitingRoundStart')` |

`frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx`:
| Line | Old | New |
|---|---|---|
| 158 | `'l'autre joueur'` fallback | `t('multiplayer.twentyQuestions.opponentFallback')` |
| 221 | `Réinitialiser` | `{t('multiplayer.twentyQuestions.resetButton')}` |
| 225 | `` `${me?.name ?? 'Vous'} (vous) : ${myScore} pt(s)` `` | `t('multiplayer.twentyQuestions.myScore', { name: me?.name ?? t('multiplayer.common.youFallback'), score: myScore })` |
| 226 | `` `${opponentName} : ${opponentScore} pt(s)` `` | `t('multiplayer.twentyQuestions.opponentScore', { name: opponentName, score: opponentScore })` |
| 229 | `` `La partie se joue en ${TOTAL_TURNS} tours. ...` `` | `t('multiplayer.twentyQuestions.rules', { total: TOTAL_TURNS })` |
| 239 | `` `Bravo, vous avez trouvé le mot ! +${roundResult.attemptsRemaining} point(s).` `` | `t('multiplayer.twentyQuestions.wonRound', { points: roundResult.attemptsRemaining })` |
| 240 | `` `${opponentName} a trouvé le mot secret.` `` | `t('multiplayer.twentyQuestions.opponentWonRound', { name: opponentName })` |
| 241 | `'Essais épuisés pour ce tour, personne ne marque de point.'` | `t('multiplayer.twentyQuestions.roundExhausted')` |
| 243 | `` `Tour ${roundResult.turnIndex} / ${TOTAL_TURNS} terminé.` `` | `t('multiplayer.twentyQuestions.roundSummary', { turn: roundResult.turnIndex, total: TOTAL_TURNS })` |
| 249 | `` `Tour ${turnIndex} / ${TOTAL_TURNS} — ${attemptsRemaining} essai(s) restant(s)` `` | `t('multiplayer.twentyQuestions.turnStatus', { turn: turnIndex, total: TOTAL_TURNS, attempts: attemptsRemaining })` |
| 253 | `` `Votre mot secret : ${wordDraft}` `` | `t('multiplayer.twentyQuestions.secretWordBadge', { word: wordDraft })` |
| 260-263 | `` `C'est vous le meneur ! Pensez à un mot secret que ${opponentName} devra deviner...` `` | `t('multiplayer.twentyQuestions.leaderInstructions', { name: opponentName })` |
| 273 | `placeholder="Écrivez ici le mot secret (ex : éléphant)"` | `placeholder={t('multiplayer.twentyQuestions.secretWordPlaceholder')}` |
| 277 | `Valider le mot secret` | `{t('multiplayer.twentyQuestions.validateSecretWordButton')}` |
| 283-285 | `` `${opponentName} vous a envoyé ceci — une question ou une proposition de mot :` `` | `t('multiplayer.twentyQuestions.guesserPrompt', { name: opponentName })` |
| 287-288 | `` `« ${pendingGuess} »` `` | `t('multiplayer.twentyQuestions.guessQuote', { guess: pendingGuess })` |
| 289-291 | `` `Est-ce exactement votre mot secret ? ...` `` | `t('multiplayer.twentyQuestions.guesserInstructions')` |
| 301 | `placeholder="Ex : Oui, et il vit dans la savane"` | `placeholder={t('multiplayer.twentyQuestions.hintPlaceholder')}` |
| 306 | `Mot trouvé` | `{t('multiplayer.twentyQuestions.wordFoundButton')}` |
| 309 | `Répondre` | `{t('multiplayer.twentyQuestions.replyButton')}` |
| 314-316 | `` `Mot secret enregistré ! Attendez que ${opponentName} propose une réponse.` `` | `t('multiplayer.twentyQuestions.waitingWordRegistered', { name: opponentName })` |
| 318-320 | `` `Votre proposition a été envoyée. Attendez que ${opponentName} vous dise si c'est le bon mot.` `` | `t('multiplayer.twentyQuestions.waitingGuessSent', { name: opponentName })` |
| 325 | `` `Réponse de ${opponentName} :` `` | `t('multiplayer.twentyQuestions.opponentReplyLabel', { name: opponentName })` |
| 328-331 | `` `${opponentName} a choisi un mot secret. ...` `` | `t('multiplayer.twentyQuestions.askerInstructions', { name: opponentName })` |
| 342 | `placeholder="Votre question ou votre proposition de mot"` | `placeholder={t('multiplayer.twentyQuestions.askPlaceholder')}` |
| 346 | `Envoyer` | `{t('multiplayer.twentyQuestions.sendButton')}` |
| 351-353 | `` `C'est ${opponentName} qui a choisi le mot secret. ...` `` | `t('multiplayer.twentyQuestions.waitingOpponentSecret', { name: opponentName })` |
| 355 | `En attente du début du tour...` | `t('multiplayer.twentyQuestions.waitingTurnStart')` |

`frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx`:
| Line | Old | New |
|---|---|---|
| 129 | `` `${me?.name ?? 'Vous'} (vous)` `` | same pattern as RPS |
| 130 | `'Adversaire'` | `t('multiplayer.common.opponentFallback')` |
| 142 | `` `Somme ${round.sum} (${round.parity}) — vous avez tous les deux raison, +1 chacun !` `` | `t('multiplayer.oddOrEven.outcomeBothRight', { sum: round.sum, parity: round.parity })` |
| 143 | `` `Somme ${round.sum} (${round.parity})` `` | `t('multiplayer.oddOrEven.outcome', { sum: round.sum, parity: round.parity })` |
| 150 | `'Choix envoyé, en attente de l'adversaire...'` / `'Choisissez un chiffre de 1 à 9...'` | `t('multiplayer.oddOrEven.waitingOpponent')` / `t('multiplayer.oddOrEven.instructions')` (keep ternary) |
| 164 | `'Pair'` / `'Impair'` | reuse `t('solo.oddOrEven.even')` / `t('solo.oddOrEven.odd')` from Task 5 (same labels) |
| 170 | `Jouer la manche` | reuse `t('solo.oddOrEven.playButton')` from Task 5 |
| 175 | `'Adversaire'` | `t('multiplayer.common.opponentFallback')` |

`frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx`:
| Line | Old | New |
|---|---|---|
| 137 | `` `${me?.name ?? 'Vous'} (vous)` `` | same pattern |
| 138 | `'Adversaire'` | `t('multiplayer.common.opponentFallback')` |
| 145 | `` `Vous : « ${prompt[round.yourChoice]} »` `` | `t('multiplayer.wouldYouRather.yourChoice', { choice: prompt[round.yourChoice] })` |
| 146-147 | template + ternary | `round.sameChoice ? t('multiplayer.wouldYouRather.opponentSame', { name: opponent?.name ?? t('multiplayer.common.opponentFallback'), choice: prompt[round.opponentChoice] }) : t('multiplayer.wouldYouRather.opponentDifferent', { name: opponent?.name ?? t('multiplayer.common.opponentFallback'), choice: prompt[round.opponentChoice] })` |
| 153 | `'Choix envoyé, en attente de l'adversaire...'` / `'Tu préfères...'` | `t('multiplayer.wouldYouRather.waitingOpponent')` / `t('multiplayer.wouldYouRather.instructions')` (keep ternary) |
| 175 | `Chargement du dilemme...` | `{t('multiplayer.wouldYouRather.loading')}` |
| 181 | `'Vous avez gagné ensemble !'` / `'Vous avez perdu ensemble...'` | `t('multiplayer.wouldYouRather.wonTogether')` / `t('multiplayer.wouldYouRather.lostTogether')` (keep ternary — this overrides the shared `MatchEndOverlay` default headline) |
| 183-187 | nested ternary | `t('multiplayer.wouldYouRather.detailIdentical', { name: opponent?.name ?? t('multiplayer.common.opponentFallback') })` / `t('multiplayer.wouldYouRather.detailDifferent', { name: opponent?.name ?? t('multiplayer.common.opponentFallback') })` |

- [ ] **Step 3: Type-check and test**

Run from `frontend/`: `npx tsc --noEmit` then `npm test`.
Expected: both pass, zero errors, zero test regressions.

- [ ] **Step 4: Manual check**

`npm run dev`, open two browser tabs, create a room and play through each of the 6 multiplayer games end to end in both languages (set one tab to French and the other to English to also confirm each player's language setting is independent — language is a per-browser `localStorage` preference, not synced between players). Confirm no leftover French text anywhere in English mode.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/multiplayer frontend/src/locales
git commit -m "feat: translate multiplayer games"
```

---

### Task 7: Final sweep and verification

**Files:**
- No new files expected — this task only fixes stragglers found during the sweep.

**Interfaces:**
- None (verification-only task).

- [ ] **Step 1: Grep for remaining hardcoded French text**

Run from the repo root:
```bash
grep -rEn "'[A-ZÀ-Ü][a-zà-ÿ' ]{5,}'|\"[A-ZÀ-Ü][a-zà-ÿ\" ]{5,}\"" frontend/src --include=*.tsx | grep -v -E "Lobby\.tsx|ControlPanel\.tsx|ScoreBoard\.tsx|GameSelection\.tsx|ModeSelection\.tsx|ThemeSelection\.tsx"
```
Expected: no matches outside of non-UI strings (e.g. CSS class names, `aria-*` technical values, `to=`/`href=` route paths — inspect any hit and confirm it isn't user-facing French copy before ignoring it). If a leftover user-facing string is found, add the missing key to both translation JSON files and swap it in, following the same pattern as the task that owns that file.

- [ ] **Step 2: Confirm both translation files stay in sync**

Run from `frontend/` (requires Node; a simple ad-hoc script, not a permanent test file):
```bash
node -e "
const fr = require('./src/locales/fr/translation.json');
const en = require('./src/locales/en/translation.json');
function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, prefix + k + '.') : [prefix + k]
  );
}
const frKeys = new Set(keys(fr));
const enKeys = new Set(keys(en));
const onlyFr = [...frKeys].filter(k => !enKeys.has(k));
const onlyEn = [...enKeys].filter(k => !frKeys.has(k));
if (onlyFr.length || onlyEn.length) {
  console.error('Mismatch! Only in fr:', onlyFr, 'Only in en:', onlyEn);
  process.exit(1);
}
console.log('OK: ' + frKeys.size + ' keys match in both files.');
"
```
Expected: `OK: N keys match in both files.` with zero mismatches. Fix any mismatch by adding the missing key(s) to whichever file is short.

- [ ] **Step 3: Full type-check, lint (if configured), and test run**

Run from `frontend/`:
```bash
npx tsc --noEmit
npm test
npm run build
```
Expected: all three succeed with no errors. `npm run build` in particular catches any accidental leftover reference to a removed `title`/`description` field that `tsc --noEmit` might not surface depending on `tsconfig` strictness.

- [ ] **Step 4: Full manual walkthrough**

Following the manual-check flow from each earlier task, do one final end-to-end pass in **English only** (French was already the app's original state and is well-covered by existing usage): home → game mode selection → solo play through one game → back home → create a multiplayer room in one tab, join from a second tab → waiting room categories → play a multiplayer game to the results page → leaderboard → profile → trigger the reconnecting overlay. Confirm the language choice persists through navigation and a hard reload, and that switching back to French at any point immediately re-renders all visible text.

- [ ] **Step 5: Commit (if any fixes were needed in Steps 1–2)**

```bash
git add frontend/src
git commit -m "fix: address i18n sweep findings (missing keys / leftover French strings)"
```
(Skip this step if the sweep found nothing to fix.)

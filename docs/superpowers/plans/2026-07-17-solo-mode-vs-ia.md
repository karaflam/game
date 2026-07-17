# Mode Solo vs IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les 6 mini-jeux jouables en solo contre une IA locale (aucun appel réseau), avec score persistant en session, condition de victoire par score cible pour les 4 jeux compétitifs, et animations de victoire/défaite.

**Architecture:** Logique de jeu pure et testable (`frontend/src/lib/*.ts`) séparée des composants React (`frontend/src/games/solo/*.tsx`). Un hook partagé `useSoloScore` gère le score et la condition de fin de partie. `SoloPlayPage.tsx` route vers le bon composant selon `gameId`. Suppression du code mort qui préexistait (composants non routés avec styles inline incohérents).

**Tech Stack:** React 18, TypeScript, Vite, Tailwind v4, framer-motion, lucide-react, shadcn `Button`. Vitest pour les tests unitaires de la logique pure (nouveau, à ajouter).

## Global Constraints

- 100% client-side : aucun appel backend/socket pour le mode solo (spec approuvée).
- IA toujours aléatoire uniforme, pas de niveaux de difficulté (hors scope).
- Pas de persistance du score entre sessions (reset au rechargement).
- Pas de redirection vers `ResultsPage` en fin de partie solo — le score reste affiché en continu.
- Scores cibles fixés : RPS = 5, Pair ou Impair = 5, 20 Questions = 3, 2 Vérités 1 Mensonge = 5.
- Style : suivre le design system existant (`rounded-3xl border border-border bg-background p-8`, composant `Button` de `@/components/ui/button`, animations `framer-motion` légères).
- Import alias `@/*` → `src/*` disponible dans les fichiers `.tsx` (configuré dans `vite.config.ts` et `tsconfig.json`). Les fichiers `.ts` purs testés par vitest utilisent des imports **relatifs** (pas d'alias) pour éviter de configurer la résolution d'alias dans vitest.

---

### Task 1: Mettre en place Vitest pour les tests unitaires

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/lib/__smoke__.test.ts` (supprimé à la fin de la tâche, sert uniquement à valider l'installation)

**Interfaces:**
- Produces: commande `npm test` (= `vitest run`) exécutable depuis `frontend/`, utilisée par toutes les tâches suivantes pour lancer leurs tests.

- [ ] **Step 1: Installer vitest**

```bash
cd frontend
npm install -D vitest
```

- [ ] **Step 2: Ajouter le script de test dans package.json**

Dans `frontend/package.json`, ajouter dans `"scripts"` :

```json
"test": "vitest run"
```

Le bloc `"scripts"` complet devient :

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run"
},
```

- [ ] **Step 3: Créer la config vitest**

Créer `frontend/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
```

- [ ] **Step 4: Écrire un test de fumée**

Créer `frontend/src/lib/__smoke__.test.ts` :

```ts
import { describe, expect, it } from 'vitest';

describe('vitest setup', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Lancer les tests pour vérifier l'installation**

Run: `cd frontend && npm test`
Expected: `1 passed` (le test de fumée passe).

- [ ] **Step 6: Supprimer le fichier de fumée**

```bash
rm frontend/src/lib/__smoke__.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add vitest for unit testing pure game logic"
```

(Si le dossier n'est pas un dépôt git, ignorer ce step — pas de commit possible, passer à la tâche suivante.)

---

### Task 2: Logique pure du score de match (`soloScore.ts`)

**Files:**
- Create: `frontend/src/lib/soloScore.ts`
- Test: `frontend/src/lib/soloScore.test.ts`

**Interfaces:**
- Produces:
  - `type ScoreState = { player: number; machine: number }`
  - `type RoundOutcome = 'player' | 'machine' | 'draw'`
  - `type Winner = 'player' | 'machine' | null`
  - `createInitialScore(): ScoreState`
  - `applyRoundOutcome(state: ScoreState, outcome: RoundOutcome): ScoreState`
  - `getWinner(state: ScoreState, targetScore: number): Winner`
- Consumed by: Task 3 (`useSoloScore` hook).

- [ ] **Step 1: Write the failing tests**

Créer `frontend/src/lib/soloScore.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { applyRoundOutcome, createInitialScore, getWinner } from './soloScore';

describe('createInitialScore', () => {
  it('starts both scores at 0', () => {
    expect(createInitialScore()).toEqual({ player: 0, machine: 0 });
  });
});

describe('applyRoundOutcome', () => {
  it('increments player score on player outcome', () => {
    const state = applyRoundOutcome({ player: 1, machine: 2 }, 'player');
    expect(state).toEqual({ player: 2, machine: 2 });
  });

  it('increments machine score on machine outcome', () => {
    const state = applyRoundOutcome({ player: 1, machine: 2 }, 'machine');
    expect(state).toEqual({ player: 1, machine: 3 });
  });

  it('leaves both scores unchanged on draw', () => {
    const state = applyRoundOutcome({ player: 1, machine: 2 }, 'draw');
    expect(state).toEqual({ player: 1, machine: 2 });
  });
});

describe('getWinner', () => {
  it('returns null when neither score reached the target', () => {
    expect(getWinner({ player: 2, machine: 3 }, 5)).toBeNull();
  });

  it('returns "player" when the player reached the target', () => {
    expect(getWinner({ player: 5, machine: 3 }, 5)).toBe('player');
  });

  it('returns "machine" when the machine reached the target', () => {
    expect(getWinner({ player: 2, machine: 5 }, 5)).toBe('machine');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- soloScore`
Expected: FAIL — `Cannot find module './soloScore'`.

- [ ] **Step 3: Write the implementation**

Créer `frontend/src/lib/soloScore.ts` :

```ts
export type ScoreState = { player: number; machine: number };
export type RoundOutcome = 'player' | 'machine' | 'draw';
export type Winner = 'player' | 'machine' | null;

export function createInitialScore(): ScoreState {
  return { player: 0, machine: 0 };
}

export function applyRoundOutcome(state: ScoreState, outcome: RoundOutcome): ScoreState {
  if (outcome === 'draw') {
    return state;
  }

  if (outcome === 'player') {
    return { ...state, player: state.player + 1 };
  }

  return { ...state, machine: state.machine + 1 };
}

export function getWinner(state: ScoreState, targetScore: number): Winner {
  if (state.player >= targetScore) {
    return 'player';
  }

  if (state.machine >= targetScore) {
    return 'machine';
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- soloScore`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/soloScore.ts frontend/src/lib/soloScore.test.ts
git commit -m "feat: add pure solo score logic"
```

---

### Task 3: Hook `useSoloScore`

**Files:**
- Create: `frontend/src/hooks/useSoloScore.ts`

**Interfaces:**
- Consumes: `createInitialScore`, `applyRoundOutcome`, `getWinner`, `ScoreState`, `RoundOutcome`, `Winner` from `../lib/soloScore` (Task 2).
- Produces: `useSoloScore(targetScore: number): { score: ScoreState; winner: Winner; isMatchOver: boolean; recordRound: (outcome: RoundOutcome) => void; reset: () => void; targetScore: number }`. Consommé par tous les composants de jeu compétitifs (Tasks 10, 11, 12, 13) et par `ScorePill`/`MatchEndOverlay` (Task 9) via les valeurs qu'il retourne.

Pas de test automatisé dédié : ce hook est un fin wrapper React au-dessus de `soloScore.ts` (déjà testé). Il sera vérifié manuellement dans la Task 18 (playtest dans le navigateur).

- [ ] **Step 1: Implémenter le hook**

Créer `frontend/src/hooks/useSoloScore.ts` :

```ts
import { useMemo, useState } from 'react';
import {
  applyRoundOutcome,
  createInitialScore,
  getWinner,
  type RoundOutcome,
  type ScoreState
} from '../lib/soloScore';

export function useSoloScore(targetScore: number) {
  const [score, setScore] = useState<ScoreState>(createInitialScore());

  const winner = useMemo(() => getWinner(score, targetScore), [score, targetScore]);
  const isMatchOver = winner !== null;

  const recordRound = (outcome: RoundOutcome) => {
    if (isMatchOver) {
      return;
    }
    setScore(prev => applyRoundOutcome(prev, outcome));
  };

  const reset = () => setScore(createInitialScore());

  return { score, winner, isMatchOver, recordRound, reset, targetScore };
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `useSoloScore.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useSoloScore.ts
git commit -m "feat: add useSoloScore hook"
```

---

### Task 4: Logique pure Pierre-Feuille-Ciseau

**Files:**
- Create: `frontend/src/lib/rpsLogic.ts`
- Test: `frontend/src/lib/rpsLogic.test.ts`

**Interfaces:**
- Produces:
  - `const RPS_MOVES: readonly ['pierre', 'feuille', 'ciseau']`
  - `type RpsMove = 'pierre' | 'feuille' | 'ciseau'`
  - `getRpsOutcome(player: RpsMove, machine: RpsMove): 'player' | 'machine' | 'draw'`
  - `pickRandomRpsMove(random?: () => number): RpsMove`
- Consumed by: Task 10 (`RpsSolo.tsx`).

- [ ] **Step 1: Write the failing tests**

Créer `frontend/src/lib/rpsLogic.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { RPS_MOVES, getRpsOutcome, pickRandomRpsMove } from './rpsLogic';

describe('getRpsOutcome', () => {
  it('returns draw when both play the same move', () => {
    expect(getRpsOutcome('pierre', 'pierre')).toBe('draw');
  });

  it('returns player when pierre beats ciseau', () => {
    expect(getRpsOutcome('pierre', 'ciseau')).toBe('player');
  });

  it('returns player when feuille beats pierre', () => {
    expect(getRpsOutcome('feuille', 'pierre')).toBe('player');
  });

  it('returns player when ciseau beats feuille', () => {
    expect(getRpsOutcome('ciseau', 'feuille')).toBe('player');
  });

  it('returns machine when the machine move beats the player move', () => {
    expect(getRpsOutcome('ciseau', 'pierre')).toBe('machine');
  });
});

describe('pickRandomRpsMove', () => {
  it('returns the first move when random() returns 0', () => {
    expect(pickRandomRpsMove(() => 0)).toBe(RPS_MOVES[0]);
  });

  it('returns the last move when random() returns just under 1', () => {
    expect(pickRandomRpsMove(() => 0.999)).toBe(RPS_MOVES[RPS_MOVES.length - 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- rpsLogic`
Expected: FAIL — `Cannot find module './rpsLogic'`.

- [ ] **Step 3: Write the implementation**

Créer `frontend/src/lib/rpsLogic.ts` :

```ts
export const RPS_MOVES = ['pierre', 'feuille', 'ciseau'] as const;
export type RpsMove = (typeof RPS_MOVES)[number];

const beats: Record<RpsMove, RpsMove> = {
  pierre: 'ciseau',
  feuille: 'pierre',
  ciseau: 'feuille'
};

export function getRpsOutcome(player: RpsMove, machine: RpsMove): 'player' | 'machine' | 'draw' {
  if (player === machine) {
    return 'draw';
  }
  return beats[player] === machine ? 'player' : 'machine';
}

export function pickRandomRpsMove(random: () => number = Math.random): RpsMove {
  return RPS_MOVES[Math.floor(random() * RPS_MOVES.length)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- rpsLogic`
Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/rpsLogic.ts frontend/src/lib/rpsLogic.test.ts
git commit -m "feat: add pure RPS game logic"
```

---

### Task 5: Logique pure Pair ou Impair

**Files:**
- Create: `frontend/src/lib/oddOrEvenLogic.ts`
- Test: `frontend/src/lib/oddOrEvenLogic.test.ts`

**Interfaces:**
- Produces:
  - `type Parity = 'pair' | 'impair'`
  - `getParity(sum: number): Parity`
  - `getOddOrEvenOutcome(playerNumber: number, prediction: Parity, machineNumber: number): 'player' | 'machine'`
  - `pickRandomNumber(random?: () => number): number` (retourne un entier entre 1 et 9 inclus)
- Consumed by: Task 11 (`OddOrEvenSolo.tsx`).

- [ ] **Step 1: Write the failing tests**

Créer `frontend/src/lib/oddOrEvenLogic.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { getOddOrEvenOutcome, getParity, pickRandomNumber } from './oddOrEvenLogic';

describe('getParity', () => {
  it('returns pair for an even sum', () => {
    expect(getParity(4)).toBe('pair');
  });

  it('returns impair for an odd sum', () => {
    expect(getParity(5)).toBe('impair');
  });
});

describe('getOddOrEvenOutcome', () => {
  it('returns player when the prediction matches the actual parity', () => {
    // 3 + 4 = 7 -> impair
    expect(getOddOrEvenOutcome(3, 'impair', 4)).toBe('player');
  });

  it('returns machine when the prediction does not match the actual parity', () => {
    // 3 + 4 = 7 -> impair, player predicted pair
    expect(getOddOrEvenOutcome(3, 'pair', 4)).toBe('machine');
  });
});

describe('pickRandomNumber', () => {
  it('returns 1 when random() returns 0', () => {
    expect(pickRandomNumber(() => 0)).toBe(1);
  });

  it('returns 9 when random() returns just under 1', () => {
    expect(pickRandomNumber(() => 0.999)).toBe(9);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- oddOrEvenLogic`
Expected: FAIL — `Cannot find module './oddOrEvenLogic'`.

- [ ] **Step 3: Write the implementation**

Créer `frontend/src/lib/oddOrEvenLogic.ts` :

```ts
export type Parity = 'pair' | 'impair';

export function getParity(sum: number): Parity {
  return sum % 2 === 0 ? 'pair' : 'impair';
}

export function getOddOrEvenOutcome(
  playerNumber: number,
  prediction: Parity,
  machineNumber: number
): 'player' | 'machine' {
  const actual = getParity(playerNumber + machineNumber);
  return prediction === actual ? 'player' : 'machine';
}

export function pickRandomNumber(random: () => number = Math.random): number {
  return Math.floor(random() * 9) + 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- oddOrEvenLogic`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/oddOrEvenLogic.ts frontend/src/lib/oddOrEvenLogic.test.ts
git commit -m "feat: add pure odd-or-even game logic"
```

---

### Task 6: Sélecteur aléatoire générique + logique 20 Questions

**Files:**
- Create: `frontend/src/lib/randomPick.ts`
- Create: `frontend/src/lib/twentyQuestionsLogic.ts`
- Test: `frontend/src/lib/randomPick.test.ts`
- Test: `frontend/src/lib/twentyQuestionsLogic.test.ts`

**Interfaces:**
- Produces:
  - `pickRandomItem<T>(items: readonly T[], random?: () => number): T`
  - `normalizeGuess(value: string): string`
  - `isCorrectGuess(guess: string, answer: string): boolean`
  - `getHintForAttempt(hints: readonly string[], attempt: number): string`
- Consumed by: Task 12 (`TwentyQuestionsSolo.tsx`), Task 13 (`TwoTruthsOneLieSolo.tsx`), Task 14 (`TruthOrDareSolo.tsx`), Task 15 (`WouldYouRatherSolo.tsx`) pour `pickRandomItem`.

- [ ] **Step 1: Write the failing tests**

Créer `frontend/src/lib/randomPick.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { pickRandomItem } from './randomPick';

describe('pickRandomItem', () => {
  const items = ['a', 'b', 'c'] as const;

  it('returns the first item when random() returns 0', () => {
    expect(pickRandomItem(items, () => 0)).toBe('a');
  });

  it('returns the last item when random() returns just under 1', () => {
    expect(pickRandomItem(items, () => 0.999)).toBe('c');
  });
});
```

Créer `frontend/src/lib/twentyQuestionsLogic.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { getHintForAttempt, isCorrectGuess, normalizeGuess } from './twentyQuestionsLogic';

describe('normalizeGuess', () => {
  it('trims whitespace and lowercases the value', () => {
    expect(normalizeGuess('  Chat  ')).toBe('chat');
  });
});

describe('isCorrectGuess', () => {
  it('returns true for a case-insensitive, trimmed match', () => {
    expect(isCorrectGuess('  CHAT ', 'chat')).toBe(true);
  });

  it('returns false when the guess does not match', () => {
    expect(isCorrectGuess('chien', 'chat')).toBe(false);
  });
});

describe('getHintForAttempt', () => {
  const hints = ['indice 1', 'indice 2', 'indice 3'];

  it('returns the first hint for attempt 0', () => {
    expect(getHintForAttempt(hints, 0)).toBe('indice 1');
  });

  it('cycles back to the first hint once attempts exceed the hint count', () => {
    expect(getHintForAttempt(hints, 3)).toBe('indice 1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- randomPick twentyQuestionsLogic`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Write the implementation**

Créer `frontend/src/lib/randomPick.ts` :

```ts
export function pickRandomItem<T>(items: readonly T[], random: () => number = Math.random): T {
  return items[Math.floor(random() * items.length)];
}
```

Créer `frontend/src/lib/twentyQuestionsLogic.ts` :

```ts
export function normalizeGuess(value: string): string {
  return value.trim().toLowerCase();
}

export function isCorrectGuess(guess: string, answer: string): boolean {
  return normalizeGuess(guess) === normalizeGuess(answer);
}

export function getHintForAttempt(hints: readonly string[], attempt: number): string {
  return hints[attempt % hints.length];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- randomPick twentyQuestionsLogic`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/randomPick.ts frontend/src/lib/randomPick.test.ts frontend/src/lib/twentyQuestionsLogic.ts frontend/src/lib/twentyQuestionsLogic.test.ts
git commit -m "feat: add random picker and 20-questions helpers"
```

---

### Task 7: Logique pure 2 Vérités 1 Mensonge (mélange du triplet)

**Files:**
- Create: `frontend/src/lib/twoTruthsLogic.ts`
- Test: `frontend/src/lib/twoTruthsLogic.test.ts`

**Interfaces:**
- Produces:
  - `type Triplet = { statements: [string, string, string]; lieIndex: 0 | 1 | 2 }`
  - `shuffleTriplet(triplet: Triplet, random?: () => number): Triplet`
- Consumed by: Task 13 (`TwoTruthsOneLieSolo.tsx`), Task 8 (type `LieTriplet` de `soloPrompts.ts` doit être compatible avec `Triplet`).

- [ ] **Step 1: Write the failing tests**

Créer `frontend/src/lib/twoTruthsLogic.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { shuffleTriplet, type Triplet } from './twoTruthsLogic';

const triplet: Triplet = {
  statements: ['vrai 1', 'mensonge', 'vrai 2'],
  lieIndex: 1
};

describe('shuffleTriplet', () => {
  it('preserves the same set of statements after shuffling', () => {
    const shuffled = shuffleTriplet(triplet, () => 0.5);
    expect(new Set(shuffled.statements)).toEqual(new Set(triplet.statements));
  });

  it('keeps the lieIndex pointing at the original lie statement', () => {
    const shuffled = shuffleTriplet(triplet, () => 0.5);
    expect(shuffled.statements[shuffled.lieIndex]).toBe('mensonge');
  });

  it('produces a deterministic order for a fixed random source', () => {
    const shuffled = shuffleTriplet(triplet, () => 0);
    expect(shuffled.statements[shuffled.lieIndex]).toBe('mensonge');
    expect(shuffled.statements).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- twoTruthsLogic`
Expected: FAIL — `Cannot find module './twoTruthsLogic'`.

- [ ] **Step 3: Write the implementation**

Créer `frontend/src/lib/twoTruthsLogic.ts` :

```ts
export type Triplet = { statements: [string, string, string]; lieIndex: 0 | 1 | 2 };

export function shuffleTriplet(triplet: Triplet, random: () => number = Math.random): Triplet {
  const order = [0, 1, 2];

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const statements = order.map(index => triplet.statements[index]) as [string, string, string];
  const lieIndex = order.indexOf(triplet.lieIndex) as 0 | 1 | 2;

  return { statements, lieIndex };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- twoTruthsLogic`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/twoTruthsLogic.ts frontend/src/lib/twoTruthsLogic.test.ts
git commit -m "feat: add pure two-truths-one-lie shuffle logic"
```

---

### Task 8: Données de contenu solo (`soloPrompts.ts`)

**Files:**
- Create: `frontend/src/data/soloPrompts.ts`

**Interfaces:**
- Consumes: `type Triplet` from `../lib/twoTruthsLogic` (Task 7), renommé `LieTriplet` en export.
- Produces:
  - `type TruthOrDarePrompt = { truth: string; dare: string }`
  - `type WouldYouRatherPrompt = { left: string; right: string }`
  - `type WordPrompt = { answer: string; hints: string[] }`
  - `type LieTriplet = Triplet`
  - `soloTruthOrDarePrompts: TruthOrDarePrompt[]` (8 entrées)
  - `soloWouldYouRatherPrompts: WouldYouRatherPrompt[]` (8 entrées)
  - `soloTwentyQuestionsWords: WordPrompt[]` (8 entrées, 4 indices chacune)
  - `soloTwoTruthsOneLieTriplets: LieTriplet[]` (8 entrées)
- Consumed by: Task 12, 13, 14, 15.

Pas de test dédié : fichier de données statique, la forme des types est déjà couverte par la compilation TypeScript (Step 2 ci-dessous) et par les tests des modules qui les consomment.

- [ ] **Step 1: Créer le fichier de données**

Créer `frontend/src/data/soloPrompts.ts` :

```ts
import type { Triplet } from '../lib/twoTruthsLogic';

export type TruthOrDarePrompt = { truth: string; dare: string };
export type WouldYouRatherPrompt = { left: string; right: string };
export type WordPrompt = { answer: string; hints: string[] };
export type LieTriplet = Triplet;

export const soloTruthOrDarePrompts: TruthOrDarePrompt[] = [
  { truth: 'Quelle est ta plus grande peur ?', dare: 'Chante le refrain de ta chanson préférée.' },
  { truth: 'Quel est ton plus grand secret ?', dare: 'Fais 10 sauts en étoile.' },
  { truth: 'Quel est ton rêve le plus étrange ?', dare: 'Imite un animal pendant 15 secondes.' },
  { truth: 'Quelle est la chose la plus embarrassante que tu aies faite ?', dare: 'Parle avec un accent au choix pendant 1 minute.' },
  { truth: 'Quel est ton plus grand regret ?', dare: 'Fais une danse improvisée pendant 20 secondes.' },
  { truth: 'As-tu déjà menti à un proche pour éviter un conflit ?', dare: 'Raconte une blague, même mauvaise.' },
  { truth: 'Quelle est la chose la plus folle que tu aimerais essayer un jour ?', dare: 'Fais 15 pompes, ou l’équivalent avec les genoux au sol.' },
  { truth: 'Quel est ton talent caché ?', dare: 'Imite la voix d’un personnage célèbre.' }
];

export const soloWouldYouRatherPrompts: WouldYouRatherPrompt[] = [
  { left: 'Vivre sans musique', right: 'Vivre sans films' },
  { left: 'Pouvoir voler', right: 'Être invisible' },
  { left: 'Avoir un jet privé', right: 'Avoir une île privée' },
  { left: 'Lire dans les pensées', right: 'Voir le futur' },
  { left: 'Ne plus jamais manger de sucré', right: 'Ne plus jamais manger de salé' },
  { left: 'Vivre à la montagne', right: 'Vivre à la mer' },
  { left: 'Avoir plus de temps libre', right: 'Avoir plus d’argent' },
  { left: 'Parler toutes les langues du monde', right: 'Jouer de tous les instruments de musique' }
];

export const soloTwentyQuestionsWords: WordPrompt[] = [
  { answer: 'chat', hints: ['Je suis un animal', 'Je ronronne', 'Je chasse les souris', 'On me trouve souvent chez les gens'] },
  { answer: 'vélo', hints: ['Je roule', 'J’ai deux roues', 'On me pousse avec les pieds', 'On peut me garer devant chez soi'] },
  { answer: 'ordinateur', hints: ['Je fais des calculs', 'Je suis électronique', 'On m’utilise pour travailler', 'J’ai souvent un clavier'] },
  { answer: 'guitare', hints: ['Je suis un instrument', 'J’ai des cordes', 'On me joue avec les doigts ou un médiator', 'Je peux être électrique ou acoustique'] },
  { answer: 'parapluie', hints: ['Je te protège', 'Je m’ouvre', 'On m’utilise quand il pleut', 'Je peux me retourner avec le vent'] },
  { answer: 'téléphone', hints: ['Je sers à communiquer', 'Je tiens dans la main', 'J’ai un écran', 'On m’utilise pour appeler ou envoyer des messages'] },
  { answer: 'montagne', hints: ['Je suis haute', 'On peut me gravir', 'J’ai parfois de la neige au sommet', 'Je fais partie du paysage'] },
  { answer: 'livre', hints: ['J’ai des pages', 'On me lit', 'Je raconte parfois une histoire', 'On me trouve dans une bibliothèque'] }
];

export const soloTwoTruthsOneLieTriplets: LieTriplet[] = [
  { statements: ['J’ai déjà mangé des insectes.', 'Je suis déjà monté sur un chameau.', 'J’ai déjà nagé avec des requins sans cage.'], lieIndex: 2 },
  { statements: ['Je parle trois langues.', 'J’ai déjà gagné un concours de talent.', 'J’ai un frère jumeau.'], lieIndex: 1 },
  { statements: ['J’ai peur des araignées.', 'J’ai déjà sauté en parachute.', 'Je n’ai jamais cassé un os.'], lieIndex: 1 },
  { statements: ['J’ai déjà rencontré un chanteur célèbre.', 'Je sais faire une roue (gymnastique).', 'J’ai déjà dormi dans un avion pendant 12 heures.'], lieIndex: 0 },
  { statements: ['Je suis allergique aux fraises.', 'J’ai déjà couru un marathon.', 'J’ai déjà perdu un pari stupide.'], lieIndex: 1 },
  { statements: ['J’ai déjà visité 4 continents.', 'Je sais faire du unicycle.', 'J’ai déjà chanté sur scène devant 100 personnes.'], lieIndex: 1 },
  { statements: ['J’ai un animal de compagnie exotique.', 'Je n’ai jamais pris l’avion.', 'J’ai déjà gagné à la loterie (un petit lot).'], lieIndex: 0 },
  { statements: ['Je sais faire du surf.', 'J’ai déjà rencontré un président.', 'J’ai déjà campé sous les étoiles sans tente.'], lieIndex: 1 }
];
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `soloPrompts.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/soloPrompts.ts
git commit -m "feat: add solo mode content data"
```

---

### Task 9: Composants partagés `ScorePill` et `MatchEndOverlay`

**Files:**
- Create: `frontend/src/components/solo/ScorePill.tsx`
- Create: `frontend/src/components/solo/MatchEndOverlay.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `type Winner` from `@/lib/soloScore` (Task 2), icons `RotateCcw`, `PartyPopper`, `Frown` from `lucide-react`, `motion`/`AnimatePresence` from `framer-motion`.
- Produces:
  - `ScorePill(props: { player: number; machine: number; targetScore: number; onReset: () => void }): JSX.Element`
  - `MatchEndOverlay(props: { winner: Winner; onReplay: () => void }): JSX.Element`
- Consumed by: Tasks 10, 11, 12, 13 (les 4 jeux compétitifs).

Pas de test automatisé : composants purement visuels, vérifiés manuellement dans la Task 18.

- [ ] **Step 1: Créer `ScorePill`**

Créer `frontend/src/components/solo/ScorePill.tsx` :

```tsx
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScorePillProps = {
  player: number;
  machine: number;
  targetScore: number;
  onReset: () => void;
};

export function ScorePill({ player, machine, targetScore, onReset }: ScorePillProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
      <div className="flex items-center gap-2 font-semibold">
        <span>Vous {player}</span>
        <span className="text-muted-foreground">—</span>
        <span>IA {machine}</span>
        <span className="text-xs font-normal text-muted-foreground">(premier à {targetScore})</span>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
        <RotateCcw className="h-4 w-4" />
        Réinitialiser
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Créer `MatchEndOverlay`**

Créer `frontend/src/components/solo/MatchEndOverlay.tsx` :

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import { Frown, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Winner } from '@/lib/soloScore';

type MatchEndOverlayProps = {
  winner: Winner;
  onReplay: () => void;
};

export function MatchEndOverlay({ winner, onReplay }: MatchEndOverlayProps) {
  return (
    <AnimatePresence>
      {winner ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex flex-col items-center gap-4 px-6 text-center"
          >
            {winner === 'player' ? (
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <PartyPopper className="h-8 w-8" />
              </motion.div>
            ) : (
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Frown className="h-8 w-8" />
              </div>
            )}
            <h3 className="text-2xl font-bold text-foreground">
              {winner === 'player' ? 'Vous avez gagné la partie !' : 'L’IA a gagné cette fois...'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {winner === 'player'
                ? 'Belle performance face à la machine.'
                : 'Retentez votre chance pour prendre votre revanche.'}
            </p>
            <Button type="button" onClick={onReplay}>
              Nouvelle partie
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée aux deux nouveaux fichiers.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/solo/ScorePill.tsx frontend/src/components/solo/MatchEndOverlay.tsx
git commit -m "feat: add shared ScorePill and MatchEndOverlay components"
```

---

### Task 10: Composant solo Pierre-Feuille-Ciseau

**Files:**
- Create: `frontend/src/games/solo/RpsSolo.tsx`

**Interfaces:**
- Consumes: `useSoloScore` (Task 3), `RPS_MOVES`, `getRpsOutcome`, `pickRandomRpsMove`, `type RpsMove` (Task 4), `ScorePill`, `MatchEndOverlay` (Task 9), `Button`.
- Produces: `RpsSolo(): JSX.Element`. Consommé par Task 16 (`SoloPlayPage.tsx`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/solo/RpsSolo.tsx` :

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { RPS_MOVES, getRpsOutcome, pickRandomRpsMove, type RpsMove } from '@/lib/rpsLogic';

const RPS_TARGET_SCORE = 5;

const moveLabels: Record<RpsMove, string> = {
  pierre: 'Pierre',
  feuille: 'Feuille',
  ciseau: 'Ciseau'
};

export function RpsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(RPS_TARGET_SCORE);
  const [message, setMessage] = useState('Choisissez pierre, feuille ou ciseau.');
  const [lastRound, setLastRound] = useState<{ player: RpsMove; machine: RpsMove } | null>(null);

  const playRound = (move: RpsMove) => {
    if (isMatchOver) {
      return;
    }

    const machineMove = pickRandomRpsMove();
    const outcome = getRpsOutcome(move, machineMove);
    setLastRound({ player: move, machine: machineMove });

    if (outcome === 'draw') {
      setMessage(`Égalité : vous avez joué ${moveLabels[move]}, l’IA aussi.`);
    } else if (outcome === 'player') {
      setMessage(`Vous gagnez la manche ! ${moveLabels[move]} bat ${moveLabels[machineMove]}.`);
    } else {
      setMessage(`Vous perdez la manche... ${moveLabels[machineMove]} bat ${moveLabels[move]}.`);
    }

    recordRound(outcome);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={RPS_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      {lastRound ? (
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Vous : {moveLabels[lastRound.player]} · IA : {moveLabels[lastRound.machine]}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {RPS_MOVES.map(move => (
          <Button key={move} type="button" onClick={() => playRound(move)} disabled={isMatchOver}>
            {moveLabels[move]}
          </Button>
        ))}
      </div>

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `RpsSolo.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/RpsSolo.tsx
git commit -m "feat: add solo RPS game component"
```

---

### Task 11: Composant solo Pair ou Impair

**Files:**
- Create: `frontend/src/games/solo/OddOrEvenSolo.tsx`

**Interfaces:**
- Consumes: `useSoloScore` (Task 3), `getOddOrEvenOutcome`, `getParity`, `pickRandomNumber`, `type Parity` (Task 5), `ScorePill`, `MatchEndOverlay` (Task 9), `Button`.
- Produces: `OddOrEvenSolo(): JSX.Element`. Consommé par Task 16.

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/solo/OddOrEvenSolo.tsx` :

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { getOddOrEvenOutcome, getParity, pickRandomNumber, type Parity } from '@/lib/oddOrEvenLogic';

const ODD_OR_EVEN_TARGET_SCORE = 5;
const PARITIES: Parity[] = ['pair', 'impair'];

export function OddOrEvenSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(ODD_OR_EVEN_TARGET_SCORE);
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [message, setMessage] = useState('Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme.');

  const playRound = () => {
    if (isMatchOver) {
      return;
    }

    const machineNumber = pickRandomNumber();
    const sum = playerNumber + machineNumber;
    const actualParity = getParity(sum);
    const outcome = getOddOrEvenOutcome(playerNumber, prediction, machineNumber);

    setMessage(
      `Vous avez joué ${playerNumber}, l’IA a joué ${machineNumber}. Somme ${sum} (${actualParity}). ${
        outcome === 'player' ? 'Vous gagnez la manche !' : 'Vous perdez la manche...'
      }`
    );

    recordRound(outcome);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={ODD_OR_EVEN_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm text-foreground">
          Votre chiffre (1-9) :
          <input
            type="number"
            min={1}
            max={9}
            value={playerNumber}
            onChange={event => setPlayerNumber(Math.min(9, Math.max(1, Number(event.target.value))))}
            disabled={isMatchOver}
            className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <div className="flex gap-3">
          {PARITIES.map(parity => (
            <Button
              key={parity}
              type="button"
              variant={prediction === parity ? 'default' : 'outline'}
              onClick={() => setPrediction(parity)}
              disabled={isMatchOver}
            >
              {parity === 'pair' ? 'Pair' : 'Impair'}
            </Button>
          ))}
        </div>

        <Button type="button" onClick={playRound} disabled={isMatchOver}>
          Jouer la manche
        </Button>
      </div>

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `OddOrEvenSolo.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/OddOrEvenSolo.tsx
git commit -m "feat: add solo odd-or-even game component"
```

---

### Task 12: Composant solo 20 Questions

**Files:**
- Create: `frontend/src/games/solo/TwentyQuestionsSolo.tsx`

**Interfaces:**
- Consumes: `useSoloScore` (Task 3), `pickRandomItem` (Task 6), `getHintForAttempt`, `isCorrectGuess` (Task 6), `soloTwentyQuestionsWords` (Task 8), `ScorePill`, `MatchEndOverlay` (Task 9), `Button`.
- Produces: `TwentyQuestionsSolo(): JSX.Element`. Consommé par Task 16.

**Important :** la fonction `startNewRound` ne doit **pas** vérifier `isMatchOver` avant de s'exécuter. Elle est appelée à la fois par un bouton normal (rendu seulement quand `!isMatchOver`) et par `MatchEndOverlay.onReplay` juste après `reset()` — à cet instant, `isMatchOver` capturé dans la closure vaut encore `true` (React batch les mises à jour d'état), donc un garde bloquerait le redémarrage après clic sur « Nouvelle partie ».

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/solo/TwentyQuestionsSolo.tsx` :

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwentyQuestionsWords } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';
import { getHintForAttempt, isCorrectGuess } from '@/lib/twentyQuestionsLogic';

const TWENTY_QUESTIONS_TARGET_SCORE = 3;
const MAX_ATTEMPTS = 20;

export function TwentyQuestionsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWENTY_QUESTIONS_TARGET_SCORE);
  const [word, setWord] = useState(() => pickRandomItem(soloTwentyQuestionsWords));
  const [attempts, setAttempts] = useState(0);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('Devinez le mot en 20 essais maximum.');
  const [roundOver, setRoundOver] = useState(false);

  const hint = getHintForAttempt(word.hints, attempts);

  const startNewRound = () => {
    setWord(pickRandomItem(soloTwentyQuestionsWords));
    setAttempts(0);
    setGuess('');
    setMessage('Nouveau mot ! Devinez-le en 20 essais maximum.');
    setRoundOver(false);
  };

  const submitGuess = () => {
    if (isMatchOver || roundOver || !guess.trim()) {
      return;
    }

    if (isCorrectGuess(guess, word.answer)) {
      setMessage(`Bravo, c’était bien "${word.answer}" !`);
      setRoundOver(true);
      recordRound('player');
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setGuess('');

    if (nextAttempts >= MAX_ATTEMPTS) {
      setMessage(`Essais épuisés. Le mot était "${word.answer}".`);
      setRoundOver(true);
      recordRound('machine');
      return;
    }

    setMessage(`Non, ce n’est pas ça. Essai ${nextAttempts}/${MAX_ATTEMPTS}.`);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWENTY_QUESTIONS_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
        <strong>Indice :</strong> {hint}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={guess}
          onChange={event => setGuess(event.target.value)}
          disabled={isMatchOver || roundOver}
          placeholder="Votre proposition"
          className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Button type="button" onClick={submitGuess} disabled={isMatchOver || roundOver}>
          Valider
        </Button>
      </div>

      {roundOver && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={startNewRound}>
          Manche suivante
        </Button>
      ) : null}

      <MatchEndOverlay
        winner={winner}
        onReplay={() => {
          reset();
          startNewRound();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `TwentyQuestionsSolo.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TwentyQuestionsSolo.tsx
git commit -m "feat: add solo 20-questions game component"
```

---

### Task 13: Composant solo 2 Vérités 1 Mensonge

**Files:**
- Create: `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx`

**Interfaces:**
- Consumes: `useSoloScore` (Task 3), `pickRandomItem` (Task 6), `shuffleTriplet` (Task 7), `soloTwoTruthsOneLieTriplets` (Task 8), `ScorePill`, `MatchEndOverlay` (Task 9), `Button`.
- Produces: `TwoTruthsOneLieSolo(): JSX.Element`. Consommé par Task 16.

**Important :** même remarque que Task 12 — `nextRound` ne doit pas garder sur `isMatchOver` pour la même raison de closure batchée.

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx` :

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwoTruthsOneLieTriplets } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';
import { shuffleTriplet } from '@/lib/twoTruthsLogic';

const TWO_TRUTHS_TARGET_SCORE = 5;

export function TwoTruthsOneLieSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWO_TRUTHS_TARGET_SCORE);
  const [triplet, setTriplet] = useState(() => shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('L’IA affirme 3 choses sur elle. Trouvez le mensonge.');

  const nextRound = () => {
    setTriplet(shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
    setSelected(null);
    setMessage('Nouvelle série ! Trouvez le mensonge.');
  };

  const chooseStatement = (index: number) => {
    if (isMatchOver || selected !== null) {
      return;
    }

    setSelected(index);
    const correct = index === triplet.lieIndex;
    setMessage(
      correct
        ? `Bien joué, "${triplet.statements[triplet.lieIndex]}" était bien le mensonge !`
        : `Perdu, le mensonge était : "${triplet.statements[triplet.lieIndex]}".`
    );
    recordRound(correct ? 'player' : 'machine');
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWO_TRUTHS_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      <div className="grid gap-3">
        {triplet.statements.map((statement, index) => {
          const isRevealedLie = selected !== null && index === triplet.lieIndex;
          const isPlayerPick = selected === index;
          return (
            <Button
              key={index}
              type="button"
              variant={isRevealedLie ? 'destructive' : isPlayerPick ? 'secondary' : 'outline'}
              onClick={() => chooseStatement(index)}
              disabled={isMatchOver || selected !== null}
              className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
            >
              {statement}
            </Button>
          );
        })}
      </div>

      {selected !== null && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={nextRound}>
          Série suivante
        </Button>
      ) : null}

      <MatchEndOverlay
        winner={winner}
        onReplay={() => {
          reset();
          nextRound();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `TwoTruthsOneLieSolo.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TwoTruthsOneLieSolo.tsx
git commit -m "feat: add solo two-truths-one-lie game component"
```

---

### Task 14: Composant solo Action ou Vérité (contenu, sans score)

**Files:**
- Create: `frontend/src/games/solo/TruthOrDareSolo.tsx`

**Interfaces:**
- Consumes: `pickRandomItem` (Task 6), `soloTruthOrDarePrompts` (Task 8), `Button`.
- Produces: `TruthOrDareSolo(): JSX.Element`. Consommé par Task 16.

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/solo/TruthOrDareSolo.tsx` :

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { soloTruthOrDarePrompts } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';

export function TruthOrDareSolo() {
  const [prompt, setPrompt] = useState(() => pickRandomItem(soloTruthOrDarePrompts));
  const [reveal, setReveal] = useState<'truth' | 'dare' | null>(null);

  const spin = () => {
    setPrompt(pickRandomItem(soloTruthOrDarePrompts));
    setReveal(null);
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      <p className="text-sm text-muted-foreground">L’IA a préparé un défi. Choisissez Action ou Vérité pour le découvrir.</p>

      <div className="flex gap-3">
        <Button type="button" variant={reveal === 'truth' ? 'default' : 'outline'} onClick={() => setReveal('truth')}>
          Vérité
        </Button>
        <Button type="button" variant={reveal === 'dare' ? 'default' : 'outline'} onClick={() => setReveal('dare')}>
          Action
        </Button>
      </div>

      {reveal ? (
        <motion.div
          key={reveal + prompt.truth}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground"
        >
          {reveal === 'truth' ? prompt.truth : prompt.dare}
        </motion.div>
      ) : null}

      <Button type="button" variant="secondary" onClick={spin}>
        Prochain tour
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `TruthOrDareSolo.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TruthOrDareSolo.tsx
git commit -m "feat: add solo truth-or-dare game component"
```

---

### Task 15: Composant solo Tu Préfères ? (contenu + comparaison, sans score)

**Files:**
- Create: `frontend/src/games/solo/WouldYouRatherSolo.tsx`

**Interfaces:**
- Consumes: `pickRandomItem` (Task 6), `soloWouldYouRatherPrompts` (Task 8), `Button`.
- Produces: `WouldYouRatherSolo(): JSX.Element`. Consommé par Task 16.

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/games/solo/WouldYouRatherSolo.tsx` :

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { soloWouldYouRatherPrompts } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';

const SIDES = ['left', 'right'] as const;
type Side = (typeof SIDES)[number];

export function WouldYouRatherSolo() {
  const [dilemma, setDilemma] = useState(() => pickRandomItem(soloWouldYouRatherPrompts));
  const [playerChoice, setPlayerChoice] = useState<Side | null>(null);
  const [machineChoice, setMachineChoice] = useState<Side | null>(null);

  const chooseOption = (side: Side) => {
    if (playerChoice) {
      return;
    }
    setPlayerChoice(side);
    setMachineChoice(pickRandomItem(SIDES));
  };

  const nextDilemma = () => {
    setDilemma(pickRandomItem(soloWouldYouRatherPrompts));
    setPlayerChoice(null);
    setMachineChoice(null);
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      <p className="text-sm text-muted-foreground">Tu préfères...</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant={playerChoice === 'left' ? 'default' : 'outline'}
          onClick={() => chooseOption('left')}
          disabled={!!playerChoice}
          className="h-auto whitespace-normal px-4 py-3 text-left"
        >
          {dilemma.left}
        </Button>
        <Button
          type="button"
          variant={playerChoice === 'right' ? 'default' : 'outline'}
          onClick={() => chooseOption('right')}
          disabled={!!playerChoice}
          className="h-auto whitespace-normal px-4 py-3 text-left"
        >
          {dilemma.right}
        </Button>
      </div>

      {playerChoice && machineChoice ? (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-foreground">
          Vous avez choisi « {dilemma[playerChoice]} », l’IA a choisi « {dilemma[machineChoice]} »
          {playerChoice === machineChoice ? ' — vous êtes sur la même longueur d’onde !' : ' — vous n’êtes pas d’accord cette fois.'}
        </motion.p>
      ) : null}

      <Button type="button" variant="secondary" onClick={nextDilemma}>
        Prochain dilemme
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur liée à `WouldYouRatherSolo.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/WouldYouRatherSolo.tsx
git commit -m "feat: add solo would-you-rather game component"
```

---

### Task 16: Brancher les 6 jeux dans `SoloPlayPage`

**Files:**
- Modify: `frontend/src/pages/SoloPlayPage.tsx`

**Interfaces:**
- Consumes: `RpsSolo` (Task 10), `OddOrEvenSolo` (Task 11), `TwentyQuestionsSolo` (Task 12), `TwoTruthsOneLieSolo` (Task 13), `TruthOrDareSolo` (Task 14), `WouldYouRatherSolo` (Task 15), `gameThemes` from `../data/gameThemes`.

- [ ] **Step 1: Remplacer le contenu de `SoloPlayPage.tsx`**

Remplacer entièrement le contenu de `frontend/src/pages/SoloPlayPage.tsx` par :

```tsx
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { gameThemes } from '../data/gameThemes';
import { RpsSolo } from '../games/solo/RpsSolo';
import { OddOrEvenSolo } from '../games/solo/OddOrEvenSolo';
import { TwentyQuestionsSolo } from '../games/solo/TwentyQuestionsSolo';
import { TruthOrDareSolo } from '../games/solo/TruthOrDareSolo';
import { WouldYouRatherSolo } from '../games/solo/WouldYouRatherSolo';
import { TwoTruthsOneLieSolo } from '../games/solo/TwoTruthsOneLieSolo';

export function SoloPlayPage() {
  const { gameId } = useParams();
  const game = gameThemes.find(item => item.id === gameId);

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <section className="rounded-[2rem] bg-card p-10 shadow-lg shadow-slate-900/5">
        <h1 className="text-4xl font-bold text-foreground">Mode solo — {game?.title ?? gameId?.replace(/-/g, ' ')}</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">Entraînez-vous contre l’IA.</p>

        <div className="mt-8">
          {gameId === 'rps' ? (
            <RpsSolo />
          ) : gameId === 'odd-or-even' ? (
            <OddOrEvenSolo />
          ) : gameId === '20-questions' ? (
            <TwentyQuestionsSolo />
          ) : gameId === 'truth-or-dare' ? (
            <TruthOrDareSolo />
          ) : gameId === 'would-you-rather' ? (
            <WouldYouRatherSolo />
          ) : gameId === 'two-truths-one-lie' ? (
            <TwoTruthsOneLieSolo />
          ) : (
            <div className="rounded-3xl border border-border bg-background p-8">
              <p className="text-sm leading-6 text-muted-foreground">Ce jeu n’est pas encore disponible en solo.</p>
            </div>
          )}
        </div>
      </section>
    </motion.main>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SoloPlayPage.tsx
git commit -m "feat: wire solo game components into SoloPlayPage"
```

---

### Task 17: Supprimer le code mort remplacé

**Files:**
- Delete: `frontend/src/games/RpsGame.tsx`
- Delete: `frontend/src/games/OddOrEvenGame.tsx`
- Delete: `frontend/src/games/TruthOrDareGame.tsx`
- Delete: `frontend/src/games/WouldYouRatherGame.tsx`
- Delete: `frontend/src/games/TwentyQuestionsGame.tsx`
- Delete: `frontend/src/games/TwoTruthsOneLieGame.tsx`
- Delete: `frontend/src/components/GameContent.tsx`
- Delete: `frontend/src/events.ts`
- Delete: `frontend/src/data/gamePrompts.ts`

Ces fichiers ne sont référencés par aucune route active de `App.tsx` : seul `GameContent.tsx` importait les 6 fichiers `games/*.tsx`, et rien n'importe `GameContent.tsx` (vérifié par recherche globale avant l'écriture de la spec).

- [ ] **Step 1: Vérifier une dernière fois qu'aucun fichier actif ne les importe**

Run (depuis la racine du repo) :

```bash
grep -rl "games/RpsGame\|games/OddOrEvenGame\|games/TruthOrDareGame\|games/WouldYouRatherGame\|games/TwentyQuestionsGame\|games/TwoTruthsOneLieGame\|components/GameContent\|from '\.\./events'\|from '\./events'\|data/gamePrompts" frontend/src --include="*.tsx" --include="*.ts" | grep -v "frontend/src/games/\|frontend/src/components/GameContent.tsx\|frontend/src/events.ts\|frontend/src/data/gamePrompts.ts"
```

Expected: aucune sortie (aucun fichier actif ne les référence).

- [ ] **Step 2: Supprimer les fichiers**

```bash
rm frontend/src/games/RpsGame.tsx
rm frontend/src/games/OddOrEvenGame.tsx
rm frontend/src/games/TruthOrDareGame.tsx
rm frontend/src/games/WouldYouRatherGame.tsx
rm frontend/src/games/TwentyQuestionsGame.tsx
rm frontend/src/games/TwoTruthsOneLieGame.tsx
rm frontend/src/components/GameContent.tsx
rm frontend/src/events.ts
rm frontend/src/data/gamePrompts.ts
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur (confirme qu'aucun fichier restant ne dépendait des fichiers supprimés).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead legacy solo-game components"
```

---

### Task 18: Vérification finale (build, tests, playtest manuel)

**Files:** aucun nouveau fichier — vérification de bout en bout.

- [ ] **Step 1: Lancer la suite de tests complète**

Run: `cd frontend && npm test`
Expected: tous les tests passent (Tasks 2, 4, 5, 6, 7 — 22 tests au total).

- [ ] **Step 2: Vérifier la compilation TypeScript complète**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier le build de production**

Run: `cd frontend && npm run build`
Expected: build réussi, pas d'erreur Tailwind ni TypeScript.

- [ ] **Step 4: Playtest manuel dans le navigateur**

Run: `cd frontend && npm run dev`, ouvrir `http://localhost:5173` dans un navigateur.

Pour chacun des 6 jeux, naviguer vers `/jeu/<gameId>/mode` → Solo, et vérifier :
- **Pierre-Feuille-Ciseau** : jouer plusieurs manches, vérifier que le score évolue, que l'overlay de victoire/défaite apparaît à 5 points, et que « Nouvelle partie » réinitialise correctement.
- **Pair ou Impair** : idem, avec saisie du chiffre et sélection pair/impair.
- **20 Questions** : deviner un mot correct, épuiser les 20 essais sur un mot, vérifier l'enchaînement de manches et la fin de partie à 3 points.
- **Action ou Vérité** : tirer plusieurs défis, vérifier qu'il n'y a pas de score ni d'écran de fin.
- **Tu Préfères ?** : choisir plusieurs dilemmes, vérifier l'affichage du choix de l'IA.
- **2 Vérités 1 Mensonge** : deviner juste et faux, vérifier la fin de partie à 5 points et le redémarrage via l'overlay.

Confirmer aussi que le score ne dépasse jamais le score cible affiché et que les boutons de jeu sont bien désactivés une fois l'overlay affiché.

- [ ] **Step 5: Commit final si des ajustements ont été faits pendant le playtest**

```bash
git add -A
git commit -m "fix: address issues found during solo mode manual playtest"
```

(Ne committer que s'il y a effectivement eu des changements.)

---

## Self-Review Notes

- **Spec coverage :** les 6 mécaniques (Task 10-15), le score cible par jeu compétitif (Tasks 10-13), l'overlay victoire/défaite (Task 9, branché dans 10-13), l'architecture 100% client (aucun composant n'importe de socket), et le nettoyage du code mort (Task 17) sont tous couverts.
- **Cohérence des types :** `RoundOutcome`/`Winner`/`ScoreState` (Task 2) sont réutilisés tels quels par `useSoloScore` (Task 3) et par `MatchEndOverlay` (Task 9) sans renommage. `Triplet` (Task 7) est réexporté tel quel comme `LieTriplet` (Task 8, alias de type uniquement, pas de redéfinition de champs).
- **Piège de closure identifié et documenté** dans les Tasks 12 et 13 (garde `isMatchOver` à ne pas appliquer sur les fonctions de redémarrage de manche appelées depuis `MatchEndOverlay.onReplay`).

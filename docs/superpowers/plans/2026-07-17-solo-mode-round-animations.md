# Solo Mode Round Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les micro-transitions texte du mode solo par des animations de révélation qui occupent tout l'espace de jeu, repenser les contrôles de RPS / Pair ou Impair / Action ou Vérité, et redessiner le badge de score et l'écran de fin de partie.

**Architecture:** Trois composants de révélation partagés (`DuelReveal`, `FlipReveal`, `BurstReveal`) dans `frontend/src/components/solo/reveals/`, chacun gérant sa propre temporisation via `useEffect`/`setTimeout` et appelant `onComplete` en fin de séquence. Chaque composant de jeu compétitif calcule le résultat de la manche de façon synchrone (logique pure déjà testée, inchangée), affiche le composant de révélation approprié à la place des contrôles pendant l'animation, puis applique le score et revient à l'état "choosing" dans `onComplete`. Aucun changement à `frontend/src/lib/*` (logique pure déjà testée) ni à `frontend/src/data/soloPrompts.ts`.

**Tech Stack:** React 18, TypeScript, Tailwind v4, framer-motion (déjà une dépendance), lucide-react.

## Global Constraints

- Toutes les animations de révélation de manche durent environ 1.8 à 2.2s et verrouillent les contrôles de jeu pendant leur exécution.
- Aucun nouveau test automatisé n'est requis pour cette passe : ce sont des composants de présentation qui consomment de la logique pure déjà testée (`frontend/src/lib/*`, inchangée). Chaque tâche se termine par `npx tsc --noEmit` propre. La tâche finale fait une vérification visuelle manuelle (captures d'écran headless Chrome) de chaque jeu.
- Style : suivre le design system existant (`rounded-3xl border border-border bg-background p-8`, `bg-card`, `bg-muted`, `text-primary`, composant `Button` de `@/components/ui/button` quand un bouton standard suffit ; les nouvelles cartes/jetons cliquables utilisent un `<button>` natif stylé directement, comme `GameCard.tsx` le fait déjà).
- Import alias `@/*` → `src/*` disponible dans tous les fichiers `.tsx` de `frontend/src`.
- Aucun changement à `frontend/src/pages/SoloPlayPage.tsx`, aux hooks (`useSoloScore`), ni à la logique pure (`rpsLogic.ts`, `oddOrEvenLogic.ts`, `twentyQuestionsLogic.ts`, `twoTruthsLogic.ts`, `randomPick.ts`, `soloScore.ts`).

---

### Task 1: `MatchEndOverlay` — emoji géant animé

**Files:**
- Modify: `frontend/src/components/solo/MatchEndOverlay.tsx`

**Interfaces:**
- Signature inchangée : `MatchEndOverlay(props: { winner: Winner; onReplay: () => void }): JSX.Element`. Aucun site d'appel à modifier.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/components/solo/MatchEndOverlay.tsx` par :

```tsx
import { AnimatePresence, motion } from 'framer-motion';
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
              <motion.span
                initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
                animate={{ scale: [0.3, 1.3, 1], rotate: [-20, 10, 0], opacity: 1, y: [0, -12, 0] }}
                transition={{ duration: 0.9, times: [0, 0.6, 1], repeat: Infinity, repeatDelay: 0.6, repeatType: 'loop' }}
                className="text-8xl"
              >
                🎉
              </motion.span>
            ) : (
              <motion.span
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, 4, 0] }}
                transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
                className="text-8xl"
              >
                😢
              </motion.span>
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

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/solo/MatchEndOverlay.tsx
git commit -m "feat: replace MatchEndOverlay icon with animated giant emoji"
```

---

### Task 2: Composant de révélation `DuelReveal` (RPS)

**Files:**
- Create: `frontend/src/components/solo/reveals/DuelReveal.tsx`

**Interfaces:**
- Produces: `DuelReveal(props: { playerEmoji: string; playerLabel: string; machineEmoji: string; machineLabel: string; outcome: 'player' | 'machine' | 'draw'; onComplete: () => void }): JSX.Element`
- Consumed by: Task 8 (`RpsSolo.tsx`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/components/solo/reveals/DuelReveal.tsx` :

```tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';

type DuelRevealProps = {
  playerEmoji: string;
  playerLabel: string;
  machineEmoji: string;
  machineLabel: string;
  outcome: 'player' | 'machine' | 'draw';
  onComplete: () => void;
};

const DURATION_MS = 2200;

const outcomeText: Record<DuelRevealProps['outcome'], string> = {
  player: 'Vous gagnez la manche !',
  machine: 'Vous perdez la manche...',
  draw: 'Égalité !'
};

export function DuelReveal({ playerEmoji, playerLabel, machineEmoji, machineLabel, outcome, onComplete }: DuelRevealProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex h-56 flex-col items-center justify-center gap-6 rounded-2xl bg-muted px-6">
      <div className="flex flex-1 items-center justify-center gap-10">
        <motion.div
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-6xl">{playerEmoji}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{playerLabel}</span>
        </motion.div>

        <motion.span
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1.1, 1] }}
          transition={{ duration: 0.6, delay: 0.5, times: [0, 0.35, 0.7, 1] }}
          className="text-xl font-black text-primary"
        >
          VS
        </motion.span>

        <motion.div
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-6xl">{machineEmoji}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{machineLabel}</span>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        className="pb-2 text-lg font-bold text-foreground"
      >
        {outcomeText[outcome]}
      </motion.p>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/solo/reveals/DuelReveal.tsx
git commit -m "feat: add DuelReveal round animation component"
```

---

### Task 3: Composant de révélation `FlipReveal` (Pair ou Impair, Action ou Vérité)

**Files:**
- Create: `frontend/src/components/solo/reveals/FlipReveal.tsx`

**Interfaces:**
- Produces:
  - `type FlipCard = { id: string; content: ReactNode; highlight?: boolean }`
  - `FlipReveal(props: { cards: FlipCard[]; outcomeLabel?: string; cardSize?: 'sm' | 'lg'; onComplete: () => void }): JSX.Element`
- Consumed by: Task 9 (`OddOrEvenSolo.tsx`, `cardSize` par défaut `'sm'`) et Task 10 (`TruthOrDareSolo.tsx`, `cardSize="lg"`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/components/solo/reveals/FlipReveal.tsx` :

```tsx
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export type FlipCard = { id: string; content: ReactNode; highlight?: boolean };

type FlipRevealProps = {
  cards: FlipCard[];
  outcomeLabel?: string;
  cardSize?: 'sm' | 'lg';
  onComplete: () => void;
};

const DURATION_MS = 2000;

const SIZE_CLASSES: Record<'sm' | 'lg', { wrapper: string; text: string }> = {
  sm: { wrapper: 'h-28 w-20', text: 'text-3xl font-bold' },
  lg: { wrapper: 'min-h-32 w-64 px-4 py-3', text: 'text-sm font-medium leading-6' }
};

export function FlipReveal({ cards, outcomeLabel, cardSize = 'sm', onComplete }: FlipRevealProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const sizeClasses = SIZE_CLASSES[cardSize];

  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-6 rounded-2xl bg-muted p-6">
      <div className="flex flex-wrap items-center justify-center gap-6">
        {cards.map((card, index) => (
          <div key={card.id} className={`relative ${sizeClasses.wrapper}`} style={{ perspective: 800 }}>
            <motion.div
              className="relative h-full w-full"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 180 }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.15, ease: 'easeInOut' }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground"
                style={{ backfaceVisibility: 'hidden' }}
              >
                ?
              </div>
              <div
                className={`absolute inset-0 flex items-center justify-center rounded-2xl border-2 bg-card text-center text-foreground ${sizeClasses.text} ${
                  card.highlight ? 'border-primary shadow-lg shadow-primary/30' : 'border-border'
                }`}
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                {card.content}
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {outcomeLabel ? (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + cards.length * 0.15 + 0.5, duration: 0.4 }}
          className="text-center text-sm font-semibold text-foreground"
        >
          {outcomeLabel}
        </motion.p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/solo/reveals/FlipReveal.tsx
git commit -m "feat: add FlipReveal round animation component"
```

---

### Task 4: Composant de révélation `BurstReveal` (20 Questions, Tu Préfères, 2 Vérités 1 Mensonge)

**Files:**
- Create: `frontend/src/components/solo/reveals/BurstReveal.tsx`

**Interfaces:**
- Produces: `BurstReveal(props: { icon: 'success' | 'fail' | 'neutral'; headline: string; detail?: string; onComplete: () => void }): JSX.Element`
- Consumed by: Task 11 (`TwentyQuestionsSolo.tsx`), Task 12 (`WouldYouRatherSolo.tsx`), Task 13 (`TwoTruthsOneLieSolo.tsx`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/components/solo/reveals/BurstReveal.tsx` :

```tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Minus, XCircle } from 'lucide-react';

type BurstRevealVariant = 'success' | 'fail' | 'neutral';

type BurstRevealProps = {
  icon: BurstRevealVariant;
  headline: string;
  detail?: string;
  onComplete: () => void;
};

const DURATION_MS = 1800;

const ICONS: Record<BurstRevealVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  fail: XCircle,
  neutral: Minus
};

const PARTICLE_OFFSETS = [
  { dx: -60, dy: -40 },
  { dx: 0, dy: -70 },
  { dx: 60, dy: -40 },
  { dx: -70, dy: 10 },
  { dx: 70, dy: 10 },
  { dx: -40, dy: 50 },
  { dx: 0, dy: 65 },
  { dx: 40, dy: 50 }
];

export function BurstReveal({ icon, headline, detail, onComplete }: BurstRevealProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const Icon = ICONS[icon];

  return (
    <div className="relative flex min-h-56 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-muted p-6 text-center">
      {PARTICLE_OFFSETS.map((offset, index) => (
        <motion.span
          key={index}
          className="absolute h-2 w-2 rounded-full bg-primary"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], x: offset.dx, y: offset.dy, scale: [0, 1, 1] }}
          transition={{ duration: 0.7, delay: 0.15 }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Icon className="h-7 w-7" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="text-lg font-bold text-foreground"
      >
        {headline}
      </motion.p>

      {detail ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          {detail}
        </motion.p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/solo/reveals/BurstReveal.tsx
git commit -m "feat: add BurstReveal round animation component"
```

---

### Task 5: `ScorePill` — refonte en barres de progression

**Files:**
- Modify: `frontend/src/components/solo/ScorePill.tsx`

**Interfaces:**
- Signature inchangée : `ScorePill(props: { player: number; machine: number; targetScore: number; onReset: () => void }): JSX.Element`. Aucun site d'appel (Tasks 8, 9, 11, 13) à modifier.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/components/solo/ScorePill.tsx` par :

```tsx
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScorePillProps = {
  player: number;
  machine: number;
  targetScore: number;
  onReset: () => void;
};

type RaceBarProps = {
  label: string;
  value: number;
  targetScore: number;
  colorClassName: string;
};

function RaceBar({ label, value, targetScore, colorClassName }: RaceBarProps) {
  const percent = Math.min(100, (value / targetScore) * 100);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-foreground">
        <span>{label}</span>
        <span>
          {value} / {targetScore}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ScorePill({ player, machine, targetScore, onReset }: ScorePillProps) {
  return (
    <div className="rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">
      <div className="mb-3 flex items-center justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </Button>
      </div>
      <div className="space-y-3">
        <RaceBar label="Vous" value={player} targetScore={targetScore} colorClassName="bg-primary" />
        <RaceBar label="IA" value={machine} targetScore={targetScore} colorClassName="bg-muted-foreground" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/solo/ScorePill.tsx
git commit -m "feat: redesign ScorePill as progress race bars"
```

---

### Task 6: `NumberTokenPicker` (Pair ou Impair)

**Files:**
- Create: `frontend/src/components/solo/NumberTokenPicker.tsx`

**Interfaces:**
- Produces: `NumberTokenPicker(props: { value: number; onChange: (value: number) => void; disabled?: boolean }): JSX.Element`
- Consumed by: Task 9 (`OddOrEvenSolo.tsx`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/components/solo/NumberTokenPicker.tsx` :

```tsx
type NumberTokenPickerProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NumberTokenPicker({ value, onChange, disabled }: NumberTokenPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-9">
      {NUMBERS.map(number => {
        const selected = number === value;
        return (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            disabled={disabled}
            className={`flex aspect-square items-center justify-center rounded-full text-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? 'scale-110 bg-primary text-primary-foreground shadow-lg shadow-primary/40'
                : 'border-2 border-border bg-card text-foreground hover:border-primary/40'
            }`}
          >
            {number}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/solo/NumberTokenPicker.tsx
git commit -m "feat: add NumberTokenPicker component"
```

---

### Task 7: `PlayerWheel` (Action ou Vérité)

**Files:**
- Create: `frontend/src/components/solo/PlayerWheel.tsx`

**Interfaces:**
- Produces: `PlayerWheel(props: { players: string[]; landedOn: string; spinning: boolean; onSpinComplete: () => void }): JSX.Element`
- Consumed by: Task 10 (`TruthOrDareSolo.tsx`).

- [ ] **Step 1: Créer le composant**

Créer `frontend/src/components/solo/PlayerWheel.tsx` :

```tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';

type PlayerWheelProps = {
  players: string[];
  landedOn: string;
  spinning: boolean;
  onSpinComplete: () => void;
};

const SPIN_DURATION_MS = 1500;
const DECORATIVE_DOTS = 2;

export function PlayerWheel({ players, landedOn, spinning, onSpinComplete }: PlayerWheelProps) {
  useEffect(() => {
    if (!spinning) {
      return;
    }
    const timer = setTimeout(onSpinComplete, SPIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [spinning, onSpinComplete]);

  const otherPlayers = players.filter(player => player !== landedOn).slice(0, 2);

  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl bg-muted py-8">
      {Array.from({ length: DECORATIVE_DOTS }).map((_, index) => (
        <div key={`left-${index}`} className="h-10 w-10 rounded-full bg-border opacity-40" />
      ))}

      <motion.div
        animate={
          spinning
            ? { x: [0, -14, 14, -8, 8, 0], opacity: [1, 0.6, 0.6, 0.8, 0.8, 1] }
            : { x: 0, opacity: 1 }
        }
        transition={{ duration: SPIN_DURATION_MS / 1000, ease: 'easeInOut' }}
        className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-primary text-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/40"
      >
        {landedOn}
      </motion.div>

      {otherPlayers.map(player => (
        <div
          key={player}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-xs font-semibold text-muted-foreground opacity-70"
        >
          {player}
        </div>
      ))}

      {Array.from({ length: DECORATIVE_DOTS }).map((_, index) => (
        <div key={`right-${index}`} className="h-10 w-10 rounded-full bg-border opacity-40" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/solo/PlayerWheel.tsx
git commit -m "feat: add PlayerWheel spin component"
```

---

### Task 8: Intégrer `RpsSolo` — cartes emoji + `DuelReveal`

**Files:**
- Modify: `frontend/src/games/solo/RpsSolo.tsx`

**Interfaces:**
- Consumes: `DuelReveal` (Task 2), `ScorePill` (Task 5, signature inchangée), `MatchEndOverlay` (Task 1, signature inchangée), logique pure inchangée de `@/lib/rpsLogic`.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/RpsSolo.tsx` par :

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { RPS_MOVES, getRpsOutcome, pickRandomRpsMove, type RpsMove } from '@/lib/rpsLogic';

const RPS_TARGET_SCORE = 5;

const moveLabels: Record<RpsMove, string> = {
  pierre: 'Pierre',
  feuille: 'Feuille',
  ciseau: 'Ciseau'
};

const moveEmojis: Record<RpsMove, string> = {
  pierre: '✊',
  feuille: '✋',
  ciseau: '✌️'
};

type RoundData = { player: RpsMove; machine: RpsMove; outcome: 'player' | 'machine' | 'draw' };

export function RpsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(RPS_TARGET_SCORE);
  const [message, setMessage] = useState('Choisissez pierre, feuille ou ciseau.');
  const [round, setRound] = useState<RoundData | null>(null);

  const playRound = (move: RpsMove) => {
    if (isMatchOver || round) {
      return;
    }

    const machineMove = pickRandomRpsMove();
    const outcome = getRpsOutcome(move, machineMove);
    setRound({ player: move, machine: machineMove, outcome });
  };

  const handleRevealComplete = () => {
    if (!round) {
      return;
    }

    if (round.outcome === 'draw') {
      setMessage(`Égalité : vous avez joué ${moveLabels[round.player]}, l’IA aussi.`);
    } else if (round.outcome === 'player') {
      setMessage(`Vous gagnez la manche ! ${moveLabels[round.player]} bat ${moveLabels[round.machine]}.`);
    } else {
      setMessage(`Vous perdez la manche... ${moveLabels[round.machine]} bat ${moveLabels[round.player]}.`);
    }

    recordRound(round.outcome);
    setRound(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={RPS_TARGET_SCORE} onReset={reset} />

      {round ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.player]}
          playerLabel={moveLabels[round.player]}
          machineEmoji={moveEmojis[round.machine]}
          machineLabel={moveLabels[round.machine]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : (
        <>
          <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
            {message}
          </motion.p>

          <div className="grid gap-3 sm:grid-cols-3">
            {RPS_MOVES.map(move => (
              <button
                key={move}
                type="button"
                onClick={() => playRound(move)}
                disabled={isMatchOver}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <span className="text-4xl">{moveEmojis[move]}</span>
                <span className="text-sm font-semibold text-foreground">{moveLabels[move]}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/RpsSolo.tsx
git commit -m "feat: integrate emoji move cards and DuelReveal into RpsSolo"
```

---

### Task 9: Intégrer `OddOrEvenSolo` — `NumberTokenPicker` + `FlipReveal`

**Files:**
- Modify: `frontend/src/games/solo/OddOrEvenSolo.tsx`

**Interfaces:**
- Consumes: `NumberTokenPicker` (Task 6), `FlipReveal` (Task 3, `cardSize` par défaut `'sm'`), `ScorePill` (Task 5), `MatchEndOverlay` (Task 1), logique pure inchangée de `@/lib/oddOrEvenLogic`.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/OddOrEvenSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { NumberTokenPicker } from '@/components/solo/NumberTokenPicker';
import { useSoloScore } from '@/hooks/useSoloScore';
import { getOddOrEvenOutcome, getParity, pickRandomNumber, type Parity } from '@/lib/oddOrEvenLogic';

const ODD_OR_EVEN_TARGET_SCORE = 5;
const PARITIES: Parity[] = ['pair', 'impair'];

type RoundData = { playerNumber: number; machineNumber: number; outcome: 'player' | 'machine' };

export function OddOrEvenSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(ODD_OR_EVEN_TARGET_SCORE);
  const [playerNumber, setPlayerNumber] = useState(1);
  const [prediction, setPrediction] = useState<Parity>('pair');
  const [message, setMessage] = useState('Choisissez un chiffre de 1 à 9 et prédisez la parité de la somme.');
  const [round, setRound] = useState<RoundData | null>(null);

  const playRound = () => {
    if (isMatchOver || round) {
      return;
    }

    const machineNumber = pickRandomNumber();
    const outcome = getOddOrEvenOutcome(playerNumber, prediction, machineNumber);
    setRound({ playerNumber, machineNumber, outcome });
  };

  const handleRevealComplete = () => {
    if (!round) {
      return;
    }

    const sum = round.playerNumber + round.machineNumber;
    const actualParity = getParity(sum);
    setMessage(
      `Vous avez joué ${round.playerNumber}, l’IA a joué ${round.machineNumber}. Somme ${sum} (${actualParity}). ${
        round.outcome === 'player' ? 'Vous gagnez la manche !' : 'Vous perdez la manche...'
      }`
    );

    recordRound(round.outcome);
    setRound(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={ODD_OR_EVEN_TARGET_SCORE} onReset={reset} />

      {round ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.playerNumber, highlight: round.outcome === 'player' },
            { id: 'machine', content: round.machineNumber, highlight: round.outcome === 'machine' }
          ]}
          outcomeLabel={`Somme ${round.playerNumber + round.machineNumber} (${getParity(round.playerNumber + round.machineNumber)})`}
          onComplete={handleRevealComplete}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>

          <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={isMatchOver} />

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
      )}

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/OddOrEvenSolo.tsx
git commit -m "feat: integrate NumberTokenPicker and FlipReveal into OddOrEvenSolo"
```

---

### Task 10: Intégrer `TruthOrDareSolo` — `PlayerWheel` + `FlipReveal`

**Files:**
- Modify: `frontend/src/games/solo/TruthOrDareSolo.tsx`

**Interfaces:**
- Consumes: `PlayerWheel` (Task 7), `FlipReveal` (Task 3, avec `cardSize="lg"`), `soloTruthOrDarePrompts`/`pickRandomItem` (inchangés).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/TruthOrDareSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerWheel } from '@/components/solo/PlayerWheel';
import { FlipReveal } from '@/components/solo/reveals/FlipReveal';
import { soloTruthOrDarePrompts } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';

type Phase = 'idle' | 'spinning' | 'landed' | 'revealing';

const PLAYER_NAME = 'Vous';

export function TruthOrDareSolo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [prompt, setPrompt] = useState(() => pickRandomItem(soloTruthOrDarePrompts));
  const [reveal, setReveal] = useState<'truth' | 'dare' | null>(null);

  const spin = () => {
    setPrompt(pickRandomItem(soloTruthOrDarePrompts));
    setReveal(null);
    setPhase('spinning');
  };

  const handleSpinComplete = () => {
    setPhase('landed');
  };

  const chooseType = (type: 'truth' | 'dare') => {
    setReveal(type);
    setPhase('revealing');
  };

  const handleRevealComplete = () => {
    setPhase('idle');
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      {phase === 'idle' ? (
        <>
          <p className="text-sm text-muted-foreground">Faites tourner la roue pour désigner qui doit relever le défi.</p>
          <Button type="button" onClick={spin}>
            Tourner la roue
          </Button>
        </>
      ) : null}

      {phase === 'spinning' || phase === 'landed' ? (
        <PlayerWheel
          players={[PLAYER_NAME]}
          landedOn={PLAYER_NAME}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : null}

      {phase === 'landed' ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">{PLAYER_NAME} doit choisir : Action ou Vérité ?</p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => chooseType('truth')}>
              Vérité
            </Button>
            <Button type="button" variant="outline" onClick={() => chooseType('dare')}>
              Action
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'revealing' && reveal ? (
        <FlipReveal
          cardSize="lg"
          cards={[{ id: 'prompt', content: reveal === 'truth' ? prompt.truth : prompt.dare }]}
          outcomeLabel={reveal === 'truth' ? 'Vérité' : 'Action'}
          onComplete={handleRevealComplete}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TruthOrDareSolo.tsx
git commit -m "feat: integrate PlayerWheel and FlipReveal into TruthOrDareSolo"
```

---

### Task 11: Intégrer `TwentyQuestionsSolo` — `BurstReveal`

**Files:**
- Modify: `frontend/src/games/solo/TwentyQuestionsSolo.tsx`

**Interfaces:**
- Consumes: `BurstReveal` (Task 4), `ScorePill` (Task 5), `MatchEndOverlay` (Task 1), logique pure inchangée de `@/lib/twentyQuestionsLogic`.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/TwentyQuestionsSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwentyQuestionsWords } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';
import { getHintForAttempt, isCorrectGuess } from '@/lib/twentyQuestionsLogic';

const TWENTY_QUESTIONS_TARGET_SCORE = 3;
const MAX_ATTEMPTS = 20;

type RoundResult = { outcome: 'player' | 'machine'; answer: string; triesUsed: number };

export function TwentyQuestionsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWENTY_QUESTIONS_TARGET_SCORE);
  const [word, setWord] = useState(() => pickRandomItem(soloTwentyQuestionsWords));
  const [attempts, setAttempts] = useState(0);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('Devinez le mot en 20 essais maximum.');
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
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
    if (isMatchOver || roundOver || roundResult || !guess.trim()) {
      return;
    }

    if (isCorrectGuess(guess, word.answer)) {
      setRoundResult({ outcome: 'player', answer: word.answer, triesUsed: attempts + 1 });
      return;
    }

    const nextAttempts = attempts + 1;
    setGuess('');
    setAttempts(nextAttempts);

    if (nextAttempts >= MAX_ATTEMPTS) {
      setRoundResult({ outcome: 'machine', answer: word.answer, triesUsed: nextAttempts });
      return;
    }

    setMessage(`Non, ce n’est pas ça. Essai ${nextAttempts}/${MAX_ATTEMPTS}.`);
  };

  const handleRevealComplete = () => {
    if (!roundResult) {
      return;
    }

    setMessage(
      roundResult.outcome === 'player'
        ? `Bravo, c’était bien "${roundResult.answer}" !`
        : `Essais épuisés. Le mot était "${roundResult.answer}".`
    );
    recordRound(roundResult.outcome);
    setRoundOver(true);
    setRoundResult(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWENTY_QUESTIONS_TARGET_SCORE} onReset={reset} />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? `Trouvé : ${roundResult.answer} !` : `Le mot était : ${roundResult.answer}`}
          detail={roundResult.outcome === 'player' ? `En ${roundResult.triesUsed} essai(s).` : undefined}
          onComplete={handleRevealComplete}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{message}</p>

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
        </>
      )}

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

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TwentyQuestionsSolo.tsx
git commit -m "feat: integrate BurstReveal into TwentyQuestionsSolo"
```

---

### Task 12: Intégrer `WouldYouRatherSolo` — `BurstReveal`

**Files:**
- Modify: `frontend/src/games/solo/WouldYouRatherSolo.tsx`

**Interfaces:**
- Consumes: `BurstReveal` (Task 4), `soloWouldYouRatherPrompts`/`pickRandomItem` (inchangés).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/WouldYouRatherSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { soloWouldYouRatherPrompts } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';

const SIDES = ['left', 'right'] as const;
type Side = (typeof SIDES)[number];

type RoundResult = { playerChoice: Side; machineChoice: Side };

export function WouldYouRatherSolo() {
  const [dilemma, setDilemma] = useState(() => pickRandomItem(soloWouldYouRatherPrompts));
  const [revealing, setRevealing] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);

  const chooseOption = (side: Side) => {
    if (revealing || result) {
      return;
    }
    setResult({ playerChoice: side, machineChoice: pickRandomItem(SIDES) });
    setRevealing(true);
  };

  const nextDilemma = () => {
    setDilemma(pickRandomItem(soloWouldYouRatherPrompts));
    setResult(null);
    setRevealing(false);
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-background p-8">
      {revealing && result ? (
        <BurstReveal
          icon="neutral"
          headline={`Vous : « ${dilemma[result.playerChoice]} »`}
          detail={`IA : « ${dilemma[result.machineChoice]} » ${
            result.playerChoice === result.machineChoice ? '— même longueur d’onde !' : '— pas d’accord cette fois.'
          }`}
          onComplete={() => setRevealing(false)}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Tu préfères...</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseOption('left')}
              disabled={!!result}
              className="h-auto whitespace-normal px-4 py-3 text-left"
            >
              {dilemma.left}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseOption('right')}
              disabled={!!result}
              className="h-auto whitespace-normal px-4 py-3 text-left"
            >
              {dilemma.right}
            </Button>
          </div>
        </>
      )}

      {!revealing ? (
        <Button type="button" variant="secondary" onClick={nextDilemma}>
          {result ? 'Prochain dilemme' : 'Nouveau dilemme'}
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/WouldYouRatherSolo.tsx
git commit -m "feat: integrate BurstReveal into WouldYouRatherSolo"
```

---

### Task 13: Intégrer `TwoTruthsOneLieSolo` — `BurstReveal`

**Files:**
- Modify: `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx`

**Interfaces:**
- Consumes: `BurstReveal` (Task 4), `ScorePill` (Task 5), `MatchEndOverlay` (Task 1), `shuffleTriplet`/`pickRandomItem` (inchangés).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx` par :

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { BurstReveal } from '@/components/solo/reveals/BurstReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwoTruthsOneLieTriplets } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';
import { shuffleTriplet } from '@/lib/twoTruthsLogic';

const TWO_TRUTHS_TARGET_SCORE = 5;

type RoundResult = { outcome: 'player' | 'machine'; lieText: string };

export function TwoTruthsOneLieSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWO_TRUTHS_TARGET_SCORE);
  const [triplet, setTriplet] = useState(() => shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundOver, setRoundOver] = useState(false);

  const nextRound = () => {
    setTriplet(shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
    setRoundOver(false);
  };

  const chooseStatement = (index: number) => {
    if (isMatchOver || roundOver || roundResult) {
      return;
    }

    const correct = index === triplet.lieIndex;
    setRoundResult({ outcome: correct ? 'player' : 'machine', lieText: triplet.statements[triplet.lieIndex] });
  };

  const handleRevealComplete = () => {
    if (!roundResult) {
      return;
    }
    recordRound(roundResult.outcome);
    setRoundOver(true);
    setRoundResult(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWO_TRUTHS_TARGET_SCORE} onReset={reset} />

      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? 'Bien joué, vous avez trouvé le mensonge !' : 'Perdu, ce n’était pas le mensonge.'}
          detail={`Le mensonge était : "${roundResult.lieText}"`}
          onComplete={handleRevealComplete}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">L’IA affirme 3 choses sur elle. Trouvez le mensonge.</p>

          <div className="grid gap-3">
            {triplet.statements.map((statement, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                onClick={() => chooseStatement(index)}
                disabled={isMatchOver || roundOver}
                className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
              >
                {statement}
              </Button>
            ))}
          </div>
        </>
      )}

      {roundOver && !isMatchOver ? (
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

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/games/solo/TwoTruthsOneLieSolo.tsx
git commit -m "feat: integrate BurstReveal into TwoTruthsOneLieSolo"
```

---

### Task 14: Vérification finale (build, tests existants, playtest visuel)

**Files:** aucun nouveau fichier — vérification de bout en bout.

- [ ] **Step 1: Lancer la suite de tests existante (logique pure, inchangée)**

Run: `cd frontend && npm test`
Expected: tous les tests passent toujours (30 tests, aucun nouveau nécessaire pour cette passe purement présentationnelle).

- [ ] **Step 2: Vérifier la compilation TypeScript complète**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier le build de production**

Run: `cd frontend && npm run build`
Expected: build réussi.

- [ ] **Step 4: Playtest visuel avec Chrome headless**

Démarrer le serveur de dev (`cd frontend && npm run dev`) puis, pour chaque jeu, capturer une manche en cours de révélation (le timing des animations rend un simple screenshot différé suffisant pour valider visuellement, pas besoin d'interaction complexe) :
- `/jeu/rps/salon/solo` : cliquer un coup, capturer pendant `DuelReveal` (les deux emojis + VS).
- `/jeu/odd-or-even/salon/solo` : sélectionner un jeton, cliquer "Jouer la manche", capturer pendant `FlipReveal`.
- `/jeu/truth-or-dare/salon/solo` : cliquer "Tourner la roue", capturer `PlayerWheel`, puis choisir Action/Vérité et capturer `FlipReveal` (carte large).
- `/jeu/20-questions/salon/solo` : soumettre une bonne réponse (mot visible dans les données `soloPrompts.ts`), capturer `BurstReveal`.
- `/jeu/would-you-rather/salon/solo` : choisir une option, capturer `BurstReveal`.
- `/jeu/two-truths-one-lie/salon/solo` : choisir une affirmation, capturer `BurstReveal`.

Vérifier aussi visuellement :
- Le nouveau `ScorePill` (barres de progression) sur RPS/Pair ou Impair/20 Questions/2 Vérités 1 Mensonge.
- `MatchEndOverlay` avec l'emoji géant, en gagnant puis en perdant une partie complète (jouer plusieurs manches jusqu'au score cible, dans un sens puis dans l'autre si possible).

Expected : chaque animation s'affiche sans erreur console, aucun texte tronqué ou superposé, les couleurs restent lisibles (cohérent avec le fix de contraste appliqué précédemment).

- [ ] **Step 5: Commit final si des ajustements ont été faits pendant le playtest**

```bash
git add -A
git commit -m "fix: address issues found during round animations playtest"
```

(Ne committer que s'il y a effectivement eu des changements.)

---

## Self-Review Notes

- **Spec coverage** : les 3 composants de révélation partagés (Tasks 2-4), les contrôles repensés (RPS emoji cards Task 8, jetons Task 6+9, roue Task 7+10), le badge de score (Task 5), et l'emoji géant de `MatchEndOverlay` (Task 1) couvrent l'intégralité de la spec `2026-07-17-solo-mode-round-animations-design.md`.
- **Cohérence des types** : `Winner` (de `@/lib/soloScore`, inchangé) reste le type utilisé par `MatchEndOverlay` ; les types `outcome: 'player' | 'machine' | 'draw'` (RPS) et `'player' | 'machine'` (les autres jeux compétitifs) correspondent exactement aux types déjà retournés par la logique pure existante (`getRpsOutcome`, `getOddOrEvenOutcome`, `isCorrectGuess`/comparaison manuelle, `shuffleTriplet`), aucune nouvelle valeur inventée.
- **Signatures inchangées** : `ScorePill` et `MatchEndOverlay` gardent exactement leurs props actuelles, donc aucun site d'appel autre que leur propre fichier n'a besoin d'être modifié au-delà des 6 fichiers de jeu déjà listés dans les tâches d'intégration.

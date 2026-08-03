# 3D Animations — RPS Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the 3D hand-duel scene built for RPS solo in the multiplayer version of Pierre-Feuille-Ciseaux, with automatic fallback to the existing 2D reveal.

**Architecture:** `RpsMultiplayer.tsx` gets the exact same integration `RpsSolo.tsx` already has — no new components. The only difference is the idle 3D scene must also render during the multiplayer-specific "waiting for opponent" state, not just when no round is active.

**Tech Stack:** React 18, TypeScript, existing `frontend/src/three/` module (GameCanvas, HandDuelScene, themeMaterials, useAdaptiveQuality, LowPolyHand) — all already built and reviewed in the RPS solo pilot. No new dependencies.

## Global Constraints

- No new files under `frontend/src/three/` — this sub-project only modifies `frontend/src/games/multiplayer/RpsMultiplayer.tsx`.
- The 3D layer is presentational only: the socket event handling, score state, and match-over logic in `RpsMultiplayer.tsx` must not change behavior — only the reveal/idle JSX changes.
- When `quality === 'fallback2d'`, behavior must be pixel-for-pixel identical to today's `DuelReveal` flow.
- The idle ambient 3D scene must render whenever `!round` is true — this already covers both the "choose your move" state and the "waiting for opponent" state in the current code (they're mutually exclusive with `round` being set), so no new state-tracking is needed beyond what already exists.
- Follow the exact same structure as `frontend/src/games/solo/RpsSolo.tsx`'s current implementation (read it before starting — it's the reference for every line below).

---

### Task 1: Integrate the 3D hand duel scene into RpsMultiplayer

**Files:**
- Modify: `frontend/src/games/multiplayer/RpsMultiplayer.tsx`

**Interfaces:**
- Consumes: `GameCanvas` (`@/three/GameCanvas`), `HandDuelScene` (`@/three/scenes/HandDuelScene`), `getThemeMaterial` (`@/three/themeMaterials`), `useAdaptiveQuality` (`@/three/useAdaptiveQuality`), `useTheme` (`@/hooks/useTheme`), and the preload URL constants `OPEN_HAND_URL`/`FIST_URL`/`PEACE_SIGN_URL` exported from `@/three/scenes/LowPolyHand` — all unchanged from the RPS solo pilot.
- Produces: nothing new for other tasks — this is the only task in this sub-project.

- [ ] **Step 1: Read the reference implementation**

Read `frontend/src/games/solo/RpsSolo.tsx` in full (it's short, ~157 lines) — this is the exact pattern to replicate. Read the current `frontend/src/games/multiplayer/RpsMultiplayer.tsx` in full too, to see where it structurally differs (it uses `round.yourMove`/`round.opponentMove` instead of `round.player`/`round.machine`, has a `waiting` boolean state, and its outcome type is `'player' | 'machine' | 'draw'` same as solo).

- [ ] **Step 2: Add the new imports and hooks**

At the top of `RpsMultiplayer.tsx`, add imports matching `RpsSolo.tsx`'s pattern:

```tsx
import { lazy, Suspense } from 'react';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import { OPEN_HAND_URL, FIST_URL, PEACE_SIGN_URL } from '@/three/scenes/LowPolyHand';
import useTheme from '@/hooks/useTheme';
import { useGLTF } from '@react-three/drei';
```

(Merge these with the file's existing imports — e.g. `useEffect`/`useState` from `react` are already imported, just add `lazy`/`Suspense` to that same import line rather than duplicating it.)

Below the existing imports, add the lazy component declarations exactly as in `RpsSolo.tsx`:

```tsx
const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const HandDuelScene = lazy(() =>
  import('@/three/scenes/HandDuelScene').then(m => ({ default: m.HandDuelScene }))
);
```

Inside the `RpsMultiplayer` function body, alongside the existing hook calls, add:

```tsx
const { theme } = useTheme();
const quality = useAdaptiveQuality();
```

And add the same preload effect `RpsSolo.tsx` has:

```tsx
useEffect(() => {
  // Preload the hand models once the player has actually navigated to this
  // game, rather than at app boot (see LowPolyHand.tsx for the pose->asset map).
  useGLTF.preload(OPEN_HAND_URL);
  useGLTF.preload(FIST_URL);
  useGLTF.preload(PEACE_SIGN_URL);
}, []);
```

- [ ] **Step 3: Add `isolate` to the root container**

Find the root `<div className="relative space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">` and add `isolate` right after `relative` (matching the fix already applied in `RpsSolo.tsx`, needed so the idle scene's `-z-10` layer doesn't get painted over by the card's own background):

```tsx
<div className="relative isolate space-y-6 rounded-3xl border border-border bg-background p-4 sm:p-8">
```

- [ ] **Step 4: Branch the reveal block on quality**

Replace:
```tsx
      {round ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.yourMove]}
          playerLabel={moveLabels[round.yourMove]}
          machineEmoji={moveEmojis[round.opponentMove]}
          machineLabel={moveLabels[round.opponentMove]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : (
```

With:
```tsx
      {round && quality === 'fallback2d' ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.yourMove]}
          playerLabel={moveLabels[round.yourMove]}
          machineEmoji={moveEmojis[round.opponentMove]}
          machineLabel={moveLabels[round.opponentMove]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : round ? (
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted sm:aspect-auto sm:h-72">
          <div className="absolute inset-0">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <HandDuelScene
                  round={{ player: round.yourMove, machine: round.opponentMove, outcome: round.outcome }}
                  material={getThemeMaterial(theme)}
                  onComplete={handleRevealComplete}
                />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="absolute inset-x-0 bottom-4 text-center text-lg font-bold text-foreground">
            {round.outcome === 'player'
              ? t('solo.rps.duelOutcomeWin')
              : round.outcome === 'machine'
                ? t('solo.rps.duelOutcomeLose')
                : t('solo.rps.duelOutcomeDraw')}
          </p>
        </div>
      ) : (
```

Note: unlike `RpsSolo.tsx`'s version of this block, this one doesn't need the `motion.p` fade-in wrapper for the outcome text — `RpsSolo.tsx` uses `framer-motion` for a delayed fade-in there, but keeping this task mechanical, a plain `<p>` is acceptable here since the existing `RpsMultiplayer.tsx` doesn't import `framer-motion` today. If you prefer visual parity with the solo version, you may import `motion` from `framer-motion` and use the same `initial`/`animate`/`transition` props as `RpsSolo.tsx:108-119` — either is acceptable, but don't introduce the import if you don't use it.

The trailing `) : (` matches the existing idle-state JSX block already in the file (the `<div className="space-y-4">...</div>` showing the move-picker or the waiting message) — only the reveal branch's content changes; the rest of the ternary and the file is untouched.

- [ ] **Step 5: Add the idle ambient scene**

Immediately before the closing `<MatchEndOverlay .../>` (i.e., right after the closing `)}` of the main reveal/idle ternary), add:

```tsx
      {!round && quality !== 'fallback2d' && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl opacity-60">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <HandDuelScene round={null} material={getThemeMaterial(theme)} onComplete={() => {}} />
            </GameCanvas>
          </Suspense>
        </div>
      )}
```

This covers both the "choose your move" and "waiting for opponent" states, since both leave `round` as `null` in the existing code.

- [ ] **Step 6: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all existing tests still pass (this file has no dedicated unit tests — socket/score logic is untouched, so no regressions are expected there).

- [ ] **Step 7: Manually verify in the browser with two sessions**

Run: `cd frontend && npm run dev`, open the RPS multiplayer flow in two separate browser tabs/windows (create a room in one, join with the room code in the other — follow the existing multiplayer room flow already in the app).

For at least 2 of the 4 themes (switch via the header toggle in one tab, independently in the other — theme is a per-tab local preference):
- Confirm the continuous idle 3D scene (drifting particles, faint idle hands) is visible behind the card in both tabs while waiting for a move — including specifically during the "waiting for opponent" state after one player has already played.
- Play a round from both tabs and confirm the hand duel animation plays correctly for both players, with each player seeing their own move on the "you" hand and the opponent's move on the other hand, and the correct win/lose/draw result and score update.
- Throttle CPU in DevTools (Performance tab → CPU 6x slowdown) in one tab and confirm it either simplifies the scene or falls back to the original 2D `DuelReveal` without breaking gameplay or desyncing the two sessions.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/games/multiplayer/RpsMultiplayer.tsx
git commit -m "feat: mount the 3D hand duel scene in RPS multiplayer with 2D fallback"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec (`docs/superpowers/specs/2026-08-03-3d-animations-rps-multiplayer-design.md`) calls for exact reuse of the sub-project 1 foundations with the idle scene also visible during the waiting state — Task 1 covers both, since `!round` already spans both states in the existing code.
- **Type consistency:** `HandDuelScene`'s `round` prop shape (`{ player, machine, outcome }`) is constructed inline from `round.yourMove`/`round.opponentMove`/`round.outcome` at the call site — no new type needs to be defined, and `RpsMultiplayer.tsx`'s local `RpsMove` type (structurally identical string union to `@/lib/rpsLogic`'s `RpsMove`) is compatible without conversion.
- **No placeholders:** the single task has fully specified code for every step; the only "manual verification" step is for multiplayer gameplay across two sessions, which isn't automatable in this project's test setup.

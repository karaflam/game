# 3D Animations — RPS Solo Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a continuous, theme-aware WebGL 3D scene (low-poly hands duel) to the Pierre-Feuille-Ciseaux solo game, with automatic performance-based fallback to the existing 2D reveal.

**Architecture:** A new `frontend/src/three/` module provides framework-agnostic pure logic (theme materials, easing, duel timeline, quality ratcheting) each covered by Vitest, plus thin React Three Fiber components (`GameCanvas`, `ParticleField`, `LowPolyHand`, `HandDuelScene`) that consume that logic and are verified manually in the browser (WebGL isn't testable in CI). `RpsSolo.tsx` mounts the 3D layer behind its existing UI and falls back to the current `DuelReveal` component untouched when quality degrades to `fallback2d`. No game logic (`rpsLogic.ts`, `useSoloScore`) is modified.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` (new deps). Existing: Tailwind, Framer Motion, i18next.

## Global Constraints

- Theme colors must be derived verbatim from the hex values already defined in `frontend/src/index.css` (`clair`, `sombre`, `luxueux`, `romantique` blocks) — do not invent new colors.
- The 3D layer is presentational only: `frontend/src/lib/rpsLogic.ts` and `frontend/src/hooks/useSoloScore.ts` must not change.
- Total duel animation duration must stay at 2200ms, matching the existing `DuelReveal` `DURATION_MS`, so `onComplete` timing/pacing doesn't shift.
- When quality is `fallback2d`, behavior must be pixel-for-pixel identical to today's `DuelReveal` flow — zero regression risk.
- Pure logic (theme material lookup, easing, timeline math, quality ratchet, finger-pose data) lives in plain `.ts` files under `frontend/src/three/` and is unit tested with Vitest (`environment: 'node'`, matching `frontend/vitest.config.ts`). React Three Fiber components (`.tsx`, WebGL-dependent) are not unit tested — each such task ends with a note to verify manually in the browser instead.
- Follow existing import alias convention: `@/*` → `frontend/src/*` (see `frontend/tsconfig.json` / `frontend/vite.config.ts`).

---

### Task 1: Install 3D dependencies

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` importable from any file under `frontend/src/`.

- [ ] **Step 1: Install packages**

Run from `frontend/`:
```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install -D @types/three
```

- [ ] **Step 2: Verify the project still builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors (the new packages aren't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add react-three-fiber and drei for 3D game scenes"
```

---

### Task 2: Theme material mapping

**Files:**
- Create: `frontend/src/three/themeMaterials.ts`
- Test: `frontend/src/three/themeMaterials.test.ts`

**Interfaces:**
- Consumes: `ThemeId` type from `frontend/src/hooks/useTheme.ts` (`'clair' | 'sombre' | 'luxueux' | 'romantique'`).
- Produces: `type ThemeMaterial = { baseColor: string; emissive: string; metalness: number; roughness: number; glowColor: string; particleColor: string }` and `function getThemeMaterial(theme: ThemeId): ThemeMaterial`, used by Task 9 (`GameCanvas`) and Task 11 (`HandDuelScene`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/themeMaterials.test.ts
import { describe, expect, it } from 'vitest';
import { getThemeMaterial } from './themeMaterials';

const THEMES = ['clair', 'sombre', 'luxueux', 'romantique'] as const;

describe('getThemeMaterial', () => {
  it.each(THEMES)('returns a complete material config for %s', theme => {
    const material = getThemeMaterial(theme);
    expect(material.baseColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.emissive).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.glowColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.particleColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(material.metalness).toBeGreaterThanOrEqual(0);
    expect(material.metalness).toBeLessThanOrEqual(1);
    expect(material.roughness).toBeGreaterThanOrEqual(0);
    expect(material.roughness).toBeLessThanOrEqual(1);
  });

  it('gives each theme a distinct glow color', () => {
    const glowColors = THEMES.map(theme => getThemeMaterial(theme).glowColor);
    expect(new Set(glowColors).size).toBe(THEMES.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/themeMaterials.test.ts`
Expected: FAIL with "Cannot find module './themeMaterials'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/themeMaterials.ts
import type { ThemeId } from '@/hooks/useTheme';

export type ThemeMaterial = {
  baseColor: string;
  emissive: string;
  metalness: number;
  roughness: number;
  glowColor: string;
  particleColor: string;
};

const THEME_MATERIALS: Record<ThemeId, ThemeMaterial> = {
  clair: {
    baseColor: '#FFFFFF',
    emissive: '#2563EB',
    metalness: 0.15,
    roughness: 0.35,
    glowColor: '#2563EB',
    particleColor: '#7C3AED'
  },
  sombre: {
    baseColor: '#0F1629',
    emissive: '#22D3EE',
    metalness: 0.4,
    roughness: 0.25,
    glowColor: '#22D3EE',
    particleColor: '#A855F7'
  },
  luxueux: {
    baseColor: '#1A1200',
    emissive: '#FBBF24',
    metalness: 0.75,
    roughness: 0.2,
    glowColor: '#FBBF24',
    particleColor: '#FDE047'
  },
  romantique: {
    baseColor: '#2D1020',
    emissive: '#F43F5E',
    metalness: 0.3,
    roughness: 0.4,
    glowColor: '#F43F5E',
    particleColor: '#F472B4'
  }
};

export function getThemeMaterial(theme: ThemeId): ThemeMaterial {
  return THEME_MATERIALS[theme];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/themeMaterials.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/themeMaterials.ts frontend/src/three/themeMaterials.test.ts
git commit -m "feat: add per-theme 3D material config"
```

---

### Task 3: Quality ratchet (adaptive performance logic)

**Files:**
- Create: `frontend/src/three/qualityTracker.ts`
- Test: `frontend/src/three/qualityTracker.test.ts`

**Interfaces:**
- Produces: `type Quality = 'high' | 'medium' | 'low' | 'fallback2d'` and `function createQualityTracker(): { recordFrame(deltaMs: number): Quality; getQuality(): Quality }`. Used by Task 7 (`useAdaptiveQuality`) and referenced as the `Quality` type by Tasks 9 and 11.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/qualityTracker.test.ts
import { describe, expect, it } from 'vitest';
import { createQualityTracker } from './qualityTracker';

function runFrames(tracker: ReturnType<typeof createQualityTracker>, count: number, deltaMs: number) {
  let last;
  for (let i = 0; i < count; i++) {
    last = tracker.recordFrame(deltaMs);
  }
  return last;
}

describe('createQualityTracker', () => {
  it('stays high during the 2s grace period regardless of framerate', () => {
    const tracker = createQualityTracker();
    // 16.7fps (60ms/frame) for 1.92s total — under the 2s grace period
    const quality = runFrames(tracker, 32, 60);
    expect(quality).toBe('high');
  });

  it('downgrades from high to medium once the grace period ends with a bad framerate', () => {
    const tracker = createQualityTracker();
    // At 60ms/frame (~16.7fps), elapsedSinceStart crosses 2000ms on frame 34,
    // which is also the first evaluation (windowElapsed == elapsedSinceStart
    // until the first reset) — so this frame both ends the grace period and
    // triggers the first quality check.
    const quality = runFrames(tracker, 34, 60);
    expect(quality).toBe('medium');
  });

  it('only steps down one quality level per measurement window', () => {
    const tracker = createQualityTracker();
    const afterFirstWindow = runFrames(tracker, 34, 60);
    expect(afterFirstWindow).toBe('medium');
    // Next window needs ~1000ms of frames post-reset: 17 frames * 60ms = 1020ms
    const afterSecondWindow = runFrames(tracker, 17, 60);
    expect(afterSecondWindow).toBe('low');
  });

  it('ratchets all the way down to fallback2d over consecutive bad windows', () => {
    const tracker = createQualityTracker();
    runFrames(tracker, 34, 60); // grace period ends + window 1: high -> medium
    runFrames(tracker, 17, 60); // window 2: medium -> low
    const quality = runFrames(tracker, 17, 60); // window 3: low -> fallback2d
    expect(quality).toBe('fallback2d');
  });

  it('stays at high when framerate is healthy', () => {
    const tracker = createQualityTracker();
    // 16ms/frame (62.5fps): grace period ends at frame 125 (2000ms), which
    // is also the first window evaluation — avgFps ~62.5 stays above the
    // high threshold (45), so quality never downgrades.
    const quality = runFrames(tracker, 150, 16);
    expect(quality).toBe('high');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/qualityTracker.test.ts`
Expected: FAIL with "Cannot find module './qualityTracker'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/qualityTracker.ts
export type Quality = 'high' | 'medium' | 'low' | 'fallback2d';

const GRACE_PERIOD_MS = 2000;
const WINDOW_MS = 1000;
const FPS_THRESHOLDS: Record<'high' | 'medium' | 'low', number> = {
  high: 45,
  medium: 30,
  low: 20
};

export function createQualityTracker() {
  let quality: Quality = 'high';
  let elapsedSinceStart = 0;
  let windowElapsed = 0;
  let windowFrames = 0;

  function recordFrame(deltaMs: number): Quality {
    elapsedSinceStart += deltaMs;
    windowElapsed += deltaMs;
    windowFrames += 1;

    if (elapsedSinceStart < GRACE_PERIOD_MS || windowElapsed < WINDOW_MS) {
      return quality;
    }

    const avgFps = (windowFrames / windowElapsed) * 1000;
    windowElapsed = 0;
    windowFrames = 0;

    if (quality === 'high' && avgFps < FPS_THRESHOLDS.high) {
      quality = 'medium';
    } else if (quality === 'medium' && avgFps < FPS_THRESHOLDS.medium) {
      quality = 'low';
    } else if (quality === 'low' && avgFps < FPS_THRESHOLDS.low) {
      quality = 'fallback2d';
    }

    return quality;
  }

  function getQuality(): Quality {
    return quality;
  }

  return { recordFrame, getQuality };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/qualityTracker.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/qualityTracker.ts frontend/src/three/qualityTracker.test.ts
git commit -m "feat: add framerate-based quality ratchet"
```

---

### Task 4: Easing helper

**Files:**
- Create: `frontend/src/three/easing.ts`
- Test: `frontend/src/three/easing.test.ts`

**Interfaces:**
- Produces: `function easeOutBack(t: number): number` (input clamped 0..1 by callers). Used by Task 10 (`LowPolyHand`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/easing.test.ts
import { describe, expect, it } from 'vitest';
import { easeOutBack } from './easing';

describe('easeOutBack', () => {
  it('starts at 0', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
  });

  it('ends at 1', () => {
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
  });

  it('overshoots past 1 partway through the motion', () => {
    expect(easeOutBack(0.75)).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/easing.test.ts`
Expected: FAIL with "Cannot find module './easing'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/easing.ts
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/easing.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/easing.ts frontend/src/three/easing.test.ts
git commit -m "feat: add overshoot easing helper for hand pose transitions"
```

---

### Task 5: Duel timeline (phase + progress math)

**Files:**
- Create: `frontend/src/three/scenes/duelTimeline.ts`
- Test: `frontend/src/three/scenes/duelTimeline.test.ts`

**Interfaces:**
- Produces: `DUEL_DURATION_MS = 2200`, `type DuelPhase = 'idle' | 'countdown' | 'transition' | 'advance' | 'outcome' | 'done'`, `function getDuelPhase(elapsedMs: number): DuelPhase`, `function getPhaseProgress(elapsedMs: number): number` (0..1 within the current phase). Used by Task 11 (`HandDuelScene`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/scenes/duelTimeline.test.ts
import { describe, expect, it } from 'vitest';
import { DUEL_DURATION_MS, getDuelPhase, getPhaseProgress } from './duelTimeline';

describe('getDuelPhase', () => {
  it('is idle before the round starts', () => {
    expect(getDuelPhase(-1)).toBe('idle');
  });

  it('is countdown right at the start', () => {
    expect(getDuelPhase(0)).toBe('countdown');
  });

  it('is countdown just before 900ms', () => {
    expect(getDuelPhase(899)).toBe('countdown');
  });

  it('is transition at 900ms', () => {
    expect(getDuelPhase(900)).toBe('transition');
  });

  it('is advance at 1150ms', () => {
    expect(getDuelPhase(1150)).toBe('advance');
  });

  it('is outcome at 1500ms', () => {
    expect(getDuelPhase(1500)).toBe('outcome');
  });

  it('is done at the full duration', () => {
    expect(getDuelPhase(DUEL_DURATION_MS)).toBe('done');
    expect(DUEL_DURATION_MS).toBe(2200);
  });
});

describe('getPhaseProgress', () => {
  it('is 0 at the very start of countdown', () => {
    expect(getPhaseProgress(0)).toBeCloseTo(0, 5);
  });

  it('is ~1 at the end of transition', () => {
    expect(getPhaseProgress(1149)).toBeCloseTo(1, 1);
  });

  it('is 0 at the start of advance', () => {
    expect(getPhaseProgress(1150)).toBeCloseTo(0, 5);
  });

  it('is 1 once done', () => {
    expect(getPhaseProgress(DUEL_DURATION_MS)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/scenes/duelTimeline.test.ts`
Expected: FAIL with "Cannot find module './duelTimeline'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/scenes/duelTimeline.ts
export type DuelPhase = 'idle' | 'countdown' | 'transition' | 'advance' | 'outcome' | 'done';

export const DUEL_DURATION_MS = 2200;

const COUNTDOWN_END_MS = 900;
const TRANSITION_END_MS = 1150;
const ADVANCE_END_MS = 1500;

export function getDuelPhase(elapsedMs: number): DuelPhase {
  if (elapsedMs < 0) return 'idle';
  if (elapsedMs < COUNTDOWN_END_MS) return 'countdown';
  if (elapsedMs < TRANSITION_END_MS) return 'transition';
  if (elapsedMs < ADVANCE_END_MS) return 'advance';
  if (elapsedMs < DUEL_DURATION_MS) return 'outcome';
  return 'done';
}

export function getPhaseProgress(elapsedMs: number): number {
  switch (getDuelPhase(elapsedMs)) {
    case 'idle':
      return 0;
    case 'countdown':
      return elapsedMs / COUNTDOWN_END_MS;
    case 'transition':
      return (elapsedMs - COUNTDOWN_END_MS) / (TRANSITION_END_MS - COUNTDOWN_END_MS);
    case 'advance':
      return (elapsedMs - TRANSITION_END_MS) / (ADVANCE_END_MS - TRANSITION_END_MS);
    case 'outcome':
      return (elapsedMs - ADVANCE_END_MS) / (DUEL_DURATION_MS - ADVANCE_END_MS);
    case 'done':
      return 1;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/scenes/duelTimeline.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/scenes/duelTimeline.ts frontend/src/three/scenes/duelTimeline.test.ts
git commit -m "feat: add duel scene timeline phase/progress calculator"
```

---

### Task 6: Finger pose data

**Superseded — see the design spec's revision note.**

**Files:**
- Create: `frontend/src/three/scenes/handPoses.ts`
- Test: `frontend/src/three/scenes/handPoses.test.ts`

**Interfaces:**
- Consumes: `RpsMove`, `RPS_MOVES` from `frontend/src/lib/rpsLogic.ts`.
- Produces: `type HandPose = RpsMove | 'neutral'`, `FINGER_CURLS: Record<HandPose, [number, number, number, number, number]>` (radians, `0` = extended, higher = curled into the palm). Used by Task 10 (`LowPolyHand`) and Task 11 (`HandDuelScene`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/scenes/handPoses.test.ts
import { describe, expect, it } from 'vitest';
import { RPS_MOVES } from '@/lib/rpsLogic';
import { FINGER_CURLS } from './handPoses';

describe('FINGER_CURLS', () => {
  it('has an entry for neutral plus every RPS move', () => {
    const keys = Object.keys(FINGER_CURLS).sort();
    expect(keys).toEqual([...RPS_MOVES, 'neutral'].sort());
  });

  it('gives every pose exactly 5 finger values within a sane curl range', () => {
    for (const curls of Object.values(FINGER_CURLS)) {
      expect(curls).toHaveLength(5);
      for (const curl of curls) {
        expect(curl).toBeGreaterThanOrEqual(0);
        expect(curl).toBeLessThanOrEqual(Math.PI / 2);
      }
    }
  });

  it('fully extends every finger for feuille (paper)', () => {
    expect(FINGER_CURLS.feuille).toEqual([0, 0, 0, 0, 0]);
  });

  it('curls every finger for pierre (rock)', () => {
    expect(FINGER_CURLS.pierre.every(curl => curl > 1)).toBe(true);
  });

  it('extends index and middle for ciseau (scissors) while curling the rest', () => {
    const [thumb, index, middle, ring, pinky] = FINGER_CURLS.ciseau;
    expect(index).toBe(0);
    expect(middle).toBe(0);
    expect(thumb).toBeGreaterThan(1);
    expect(ring).toBeGreaterThan(1);
    expect(pinky).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/scenes/handPoses.test.ts`
Expected: FAIL with "Cannot find module './handPoses'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/scenes/handPoses.ts
import type { RpsMove } from '@/lib/rpsLogic';

export type HandPose = RpsMove | 'neutral';

// Curl angle in radians per finger: [thumb, index, middle, ring, pinky].
// 0 = fully extended, ~1.4 = fully curled into the palm.
export const FINGER_CURLS: Record<HandPose, [number, number, number, number, number]> = {
  neutral: [0.5, 0.5, 0.5, 0.5, 0.5],
  pierre: [1.4, 1.4, 1.4, 1.4, 1.4],
  feuille: [0, 0, 0, 0, 0],
  ciseau: [1.3, 0, 0, 1.3, 1.3]
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/scenes/handPoses.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/scenes/handPoses.ts frontend/src/three/scenes/handPoses.test.ts
git commit -m "feat: add finger curl data per RPS hand pose"
```

---

### Task 7: Adaptive quality hook

**Files:**
- Create: `frontend/src/three/useAdaptiveQuality.ts`

**Interfaces:**
- Consumes: `createQualityTracker`, `Quality` from `./qualityTracker` (Task 3).
- Produces: `function useAdaptiveQuality(): Quality`. Used by Task 12 (`RpsSolo.tsx`).

- [ ] **Step 1: Write the implementation**

This is a thin `requestAnimationFrame` wrapper around the already-tested `qualityTracker`; it has no automated test (jsdom/React rendering isn't part of this project's test setup — see Global Constraints) and is verified manually in Task 12's browser check.

```ts
// frontend/src/three/useAdaptiveQuality.ts
import { useEffect, useRef, useState } from 'react';
import { createQualityTracker, type Quality } from './qualityTracker';

export function useAdaptiveQuality(): Quality {
  const [quality, setQuality] = useState<Quality>('high');
  const trackerRef = useRef(createQualityTracker());
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let frameId: number;

    const tick = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = time - lastTimeRef.current;
        const next = trackerRef.current.recordFrame(delta);
        setQuality(prev => (prev === next ? prev : next));
      }
      lastTimeRef.current = time;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return quality;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/useAdaptiveQuality.ts
git commit -m "feat: add adaptive quality hook wrapping the quality tracker"
```

---

### Task 8: Ambient particle field

**Files:**
- Create: `frontend/src/three/ambient/ParticleField.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (plain `three`/`@react-three/fiber`).
- Produces: `function ParticleField(props: { color: string; density: number }): JSX.Element`. Used by Task 9 (`GameCanvas`).

- [ ] **Step 1: Write the implementation**

WebGL-dependent, no automated test — verified manually as part of Task 12's browser check.

```tsx
// frontend/src/three/ambient/ParticleField.tsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type ParticleFieldProps = {
  color: string;
  density: number;
};

export function ParticleField({ color, density }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(density * 3);
    for (let i = 0; i < density; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
    }
    return arr;
  }, [density]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.035} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/ambient/ParticleField.tsx
git commit -m "feat: add ambient particle field for continuous 3D background"
```

---

### Task 9: GameCanvas wrapper

**Files:**
- Create: `frontend/src/three/GameCanvas.tsx`

**Interfaces:**
- Consumes: `getThemeMaterial` from `./themeMaterials` (Task 2), `Quality` from `./qualityTracker` (Task 3), `ParticleField` from `./ambient/ParticleField` (Task 8), `ThemeId` from `@/hooks/useTheme`.
- Produces: `function GameCanvas(props: { theme: ThemeId; quality: Quality; children?: ReactNode }): JSX.Element | null`. Used by Task 12 (`RpsSolo.tsx`).

- [ ] **Step 1: Write the implementation**

WebGL-dependent, no automated test — verified manually as part of Task 12's browser check.

```tsx
// frontend/src/three/GameCanvas.tsx
import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ParticleField } from './ambient/ParticleField';
import { getThemeMaterial } from './themeMaterials';
import type { ThemeId } from '@/hooks/useTheme';
import type { Quality } from './qualityTracker';

type GameCanvasProps = {
  theme: ThemeId;
  quality: Quality;
  children?: ReactNode;
};

export function GameCanvas({ theme, quality, children }: GameCanvasProps) {
  if (quality === 'fallback2d') {
    return null;
  }

  const material = getThemeMaterial(theme);
  const particleDensity = quality === 'high' ? 150 : quality === 'medium' ? 70 : 25;
  const bloomEnabled = quality === 'high' || quality === 'medium';

  return (
    <Canvas camera={{ position: [0, 0.6, 3.2], fov: 45 }} dpr={[1, quality === 'high' ? 2 : 1]}>
      <color attach="background" args={[material.baseColor]} />
      <fog attach="fog" args={[material.baseColor, 4, 9]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} color={material.glowColor} castShadow />
      <Suspense fallback={null}>
        <ParticleField color={material.particleColor} density={particleDensity} />
        {children}
      </Suspense>
      {bloomEnabled && (
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/GameCanvas.tsx
git commit -m "feat: add theme-aware GameCanvas wrapper with quality-gated bloom"
```

---

### Task 10: Low-poly hand component

**Superseded — see the design spec's revision note.**

**Files:**
- Create: `frontend/src/three/scenes/LowPolyHand.tsx`

**Interfaces:**
- Consumes: `FINGER_CURLS`, `HandPose` from `./handPoses` (Task 6), `easeOutBack` from `../easing` (Task 4), `ThemeMaterial` from `../themeMaterials` (Task 2).
- Produces: `function LowPolyHand(props: { pose: HandPose; position: [number, number, number]; mirrored: boolean; material: ThemeMaterial; transitionProgress: number }): JSX.Element`. Used by Task 11 (`HandDuelScene`).

- [ ] **Step 1: Write the implementation**

WebGL-dependent, no automated test — verified manually as part of Task 12's browser check.

```tsx
// frontend/src/three/scenes/LowPolyHand.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FINGER_CURLS, type HandPose } from './handPoses';
import { easeOutBack } from '../easing';
import type { ThemeMaterial } from '../themeMaterials';

type LowPolyHandProps = {
  pose: HandPose;
  position: [number, number, number];
  mirrored: boolean;
  material: ThemeMaterial;
  transitionProgress: number; // 0..1, where the hand's pose transition currently stands
};

const FINGER_COUNT = 5;
const FINGER_SPACING = 0.16;

export function LowPolyHand({ pose, position, mirrored, material, transitionProgress }: LowPolyHandProps) {
  const fingerRefs = useRef<(THREE.Group | null)[]>([]);
  const previousPoseRef = useRef<HandPose>(pose);
  const fromCurlsRef = useRef(FINGER_CURLS[pose]);

  if (previousPoseRef.current !== pose) {
    fromCurlsRef.current = FINGER_CURLS[previousPoseRef.current];
    previousPoseRef.current = pose;
  }

  useFrame(() => {
    const targetCurls = FINGER_CURLS[pose];
    const eased = easeOutBack(Math.min(Math.max(transitionProgress, 0), 1));
    for (let i = 0; i < FINGER_COUNT; i++) {
      const group = fingerRefs.current[i];
      if (!group) continue;
      const from = fromCurlsRef.current[i];
      const to = targetCurls[i];
      group.rotation.x = -(from + (to - from) * eased);
    }
  });

  const direction = mirrored ? -1 : 1;

  return (
    <group position={position} scale={[direction, 1, 1]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.65, 0.75, 0.22]} />
        <meshStandardMaterial
          color={material.baseColor}
          emissive={material.emissive}
          metalness={material.metalness}
          roughness={material.roughness}
        />
      </mesh>
      {Array.from({ length: FINGER_COUNT }).map((_, i) => (
        <group
          key={i}
          ref={el => {
            fingerRefs.current[i] = el;
          }}
          position={[-0.26 + i * FINGER_SPACING, 0.38, 0]}
        >
          <mesh castShadow position={[0, 0.22, 0]}>
            <boxGeometry args={[0.11, 0.44, 0.16]} />
            <meshStandardMaterial
              color={material.baseColor}
              emissive={material.emissive}
              metalness={material.metalness}
              roughness={material.roughness}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/scenes/LowPolyHand.tsx
git commit -m "feat: add low-poly hand mesh with pose-based finger curl animation"
```

---

### Task 11: Hand duel scene orchestration

**Files:**
- Create: `frontend/src/three/scenes/HandDuelScene.tsx`

**Interfaces:**
- Consumes: `LowPolyHand` (Task 10), `getDuelPhase`, `getPhaseProgress`, `DUEL_DURATION_MS` from `./duelTimeline` (Task 5), `ThemeMaterial` from `../themeMaterials` (Task 2), `RpsMove` from `@/lib/rpsLogic`.
- Produces: `type DuelOutcome = 'player' | 'machine' | 'draw'`, `function HandDuelScene(props: { round: { player: RpsMove; machine: RpsMove; outcome: DuelOutcome } | null; material: ThemeMaterial; onComplete: () => void }): JSX.Element`. Used by Task 12 (`RpsSolo.tsx`) — same `round` shape as the existing `RoundData` type in `RpsSolo.tsx`, and the same `onComplete` contract as the current `DuelReveal`.

- [ ] **Step 1: Write the implementation**

WebGL-dependent (drives itself via `useFrame`, not `setTimeout`, so it stays in sync with the render loop), no automated test — verified manually as part of Task 12's browser check.

```tsx
// frontend/src/three/scenes/HandDuelScene.tsx
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { LowPolyHand } from './LowPolyHand';
import { getDuelPhase, getPhaseProgress, DUEL_DURATION_MS } from './duelTimeline';
import type { ThemeMaterial } from '../themeMaterials';
import type { RpsMove } from '@/lib/rpsLogic';

export type DuelOutcome = 'player' | 'machine' | 'draw';

type HandDuelSceneProps = {
  round: { player: RpsMove; machine: RpsMove; outcome: DuelOutcome } | null;
  material: ThemeMaterial;
  onComplete: () => void;
};

const DIMMED_EMISSIVE = '#111111';

export function HandDuelScene({ round, material, onComplete }: HandDuelSceneProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (round) {
      startedRef.current = true;
      completedRef.current = false;
      setElapsedMs(0);
    } else {
      startedRef.current = false;
    }
  }, [round]);

  useFrame((_, delta) => {
    if (!startedRef.current || completedRef.current) return;
    setElapsedMs(prev => {
      const next = prev + delta * 1000;
      if (next >= DUEL_DURATION_MS && !completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return next;
    });
  });

  const phase = round ? getDuelPhase(elapsedMs) : 'idle';
  const progress = round ? getPhaseProgress(elapsedMs) : 0;
  const posedPhases = phase === 'transition' || phase === 'advance' || phase === 'outcome';

  const playerPose = round && posedPhases ? round.player : 'neutral';
  const machinePose = round && posedPhases ? round.machine : 'neutral';
  const transitionProgress = phase === 'transition' ? progress : posedPhases ? 1 : 0;

  const advanceOffset =
    phase === 'advance' ? progress * 0.5 : phase === 'outcome' ? 0.5 : 0;

  const playerDimmed = round?.outcome === 'machine' && phase === 'outcome';
  const machineDimmed = round?.outcome === 'player' && phase === 'outcome';

  return (
    <group>
      <LowPolyHand
        pose={playerPose}
        position={[-1.2 + advanceOffset, -0.3, 0]}
        mirrored={false}
        material={playerDimmed ? { ...material, emissive: DIMMED_EMISSIVE } : material}
        transitionProgress={transitionProgress}
      />
      <LowPolyHand
        pose={machinePose}
        position={[1.2 - advanceOffset, -0.3, 0]}
        mirrored
        material={machineDimmed ? { ...material, emissive: DIMMED_EMISSIVE } : material}
        transitionProgress={transitionProgress}
      />
    </group>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/scenes/HandDuelScene.tsx
git commit -m "feat: add hand duel scene choreography"
```

---

### Task 12: Integrate into RpsSolo and verify in the browser

**Files:**
- Modify: `frontend/src/games/solo/RpsSolo.tsx`

**Interfaces:**
- Consumes: `useAdaptiveQuality` (Task 7), `GameCanvas` (Task 9), `HandDuelScene` + `DuelOutcome` (Task 11), `getThemeMaterial` (Task 2), `useTheme` default export from `@/hooks/useTheme` (existing, same pattern already used in `Header.tsx` and `App.tsx`).
- Produces: nothing new for other tasks — this is the final integration point for this sub-project.

- [ ] **Step 1: Add the new imports and hooks to `RpsSolo.tsx`**

In `frontend/src/games/solo/RpsSolo.tsx`, replace the `DuelReveal` import and add the new ones:

```tsx
// before
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';

// after
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';
import { GameCanvas } from '@/three/GameCanvas';
import { HandDuelScene } from '@/three/scenes/HandDuelScene';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
```

Inside the `RpsSolo` function body, alongside the existing `useSoloScore`/`useState` calls, add:

```tsx
const { theme } = useTheme();
const quality = useAdaptiveQuality();
```

- [ ] **Step 2: Replace the reveal block to branch on quality**

Replace:
```tsx
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
```

With:
```tsx
      {round && quality === 'fallback2d' ? (
        <DuelReveal
          playerEmoji={moveEmojis[round.player]}
          playerLabel={moveLabels[round.player]}
          machineEmoji={moveEmojis[round.machine]}
          machineLabel={moveLabels[round.machine]}
          outcome={round.outcome}
          onComplete={handleRevealComplete}
        />
      ) : round ? (
        <div className="relative h-72 overflow-hidden rounded-2xl bg-muted">
          <div className="absolute inset-0">
            <GameCanvas theme={theme} quality={quality}>
              <HandDuelScene round={round} material={getThemeMaterial(theme)} onComplete={handleRevealComplete} />
            </GameCanvas>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="absolute inset-x-0 bottom-4 text-center text-lg font-bold text-foreground"
          >
            {round.outcome === 'player'
              ? t('solo.rps.duelOutcomeWin')
              : round.outcome === 'machine'
                ? t('solo.rps.duelOutcomeLose')
                : t('solo.rps.duelOutcomeDraw')}
          </motion.p>
        </div>
      ) : (
```

Note the trailing `) : (` at the end matches the existing `<>...</>` idle branch already in the file — only the reveal-branch content changes, the rest of the ternary and the file is untouched.

Also, when `quality !== 'fallback2d'`, mount a continuous idle scene outside the "round in progress" branch too, so the 3D background is visible even between rounds. Immediately before the closing `</div>` of the component's root (right after the idle `<>...</>` block and before `<MatchEndOverlay .../>`), add:

```tsx
      {!round && quality !== 'fallback2d' && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl opacity-60">
          <GameCanvas theme={theme} quality={quality}>
            <HandDuelScene round={null} material={getThemeMaterial(theme)} onComplete={() => {}} />
          </GameCanvas>
        </div>
      )}
```

- [ ] **Step 3: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all existing and new tests pass (RPS gameplay tests included — untouched logic).

- [ ] **Step 4: Manually verify in the browser**

Run: `cd frontend && npm run dev`, open the RPS solo page.
Check, for each of the 4 themes (switch via the theme toggle in the header):
- A continuous 3D scene (drifting particles, faint idle hands) is visible behind the card while waiting to play.
- Playing a move triggers the hand duel animation (countdown, pose transition with overshoot, advance, win/lose/draw dimming or glow) lasting ~2.2s, then the result text and score update exactly as before.
- Throttle CPU in DevTools (Performance tab → CPU 6x slowdown) and confirm the scene visibly simplifies (particles thin out, glow disappears) or the game falls back to the original 2D `DuelReveal` without breaking gameplay.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/solo/RpsSolo.tsx
git commit -m "feat: mount the 3D hand duel scene in RPS solo with 2D fallback"
```

---

## Self-Review Notes

- **Spec coverage:** `GameCanvas`/`themeMaterials` (theme-aware rendering + fondations), `useAdaptiveQuality`/`qualityTracker` (dégradation auto + fallback2d), `ParticleField` (scène continue), `HandDuelScene`/`LowPolyHand`/`duelTimeline`/`easing`/`handPoses` (choréographie du duel décrite dans le spec), Task 12 (intégration RpsSolo + vérification manuelle par thème) — all spec sections are covered.
- **Type consistency:** `Quality` defined once in `qualityTracker.ts` and imported everywhere else; `ThemeMaterial` defined once in `themeMaterials.ts`; `HandPose` defined once in `handPoses.ts`; `round`/`DuelOutcome` shape in `HandDuelScene` matches the existing `RoundData` in `RpsSolo.tsx` field-for-field (`player`, `machine`, `outcome`).
- **No placeholders:** every step has runnable code; the only "manual verification" steps are for WebGL rendering, explicitly called out as untestable in CI per the spec.

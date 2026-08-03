# Card Flip + Badge Burst 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `FlipReveal` (Truth or Dare solo) and `BurstReveal` (Truth or Dare multiplayer's result step, 20 Questions, Would You Rather, Two Truths One Lie — solo and multiplayer) with two 3D hero scenes — a flipping card and a popping/bursting badge — with automatic fallback to the existing 2D components.

**Architecture:** Reuses the sub-project 1 foundations unmodified (`GameCanvas`, `getThemeMaterial`, `useAdaptiveQuality`, the lazy-loading + Suspense pattern). Adds two independent scene families under `frontend/src/three/scenes/`. **Correction to the original design spec's assumption:** only `TruthOrDareSolo.tsx` actually uses a card-flip reveal (`FlipReveal`). `TruthOrDareMultiplayer.tsx` shows its truth/dare content as a static 2D box and only uses a flip-adjacent reveal (`BurstReveal`) for its final approve/refuse result — so it belongs to the badge-burst family, not the card family. The true file split is: **1 file gets `CardFlipScene`, 7 files get `BadgeBurstScene`.**

**Tech Stack:** React 18, TypeScript, `three`, `@react-three/fiber@^8.18.0`, `@react-three/drei@^9.122.0` (already installed). No `drei` `Text` component is used anywhere in this plan — every prompt/headline/detail stays as a 2D HTML overlay exactly as it is today (per the design spec), which also sidesteps the font-loading delay observed with `drei`'s `Text` in the Odd or Even sub-project.

**Important interaction-model decision (not explicit in the design spec — read carefully before implementing):** the existing `FlipReveal` and `BurstReveal` components are **click-to-continue**, not auto-timed — the whole reveal area is a `role="button"` that calls `onComplete` on click, with a "click to continue" hint. This is deliberate: the content here (prompts, hints, dare/truth text) is meant to be read at the player's own pace, unlike Pierre-Feuille-Ciseaux's instant hand moves or Odd or Even's single numbers. **`CardFlipScene` and `BadgeBurstScene` do not take an `onComplete` prop and do not auto-complete.** Each one just plays its flip/pop-in animation automatically on mount (a fresh instance is mounted each time a game conditionally renders it, exactly like `FlipReveal`/`BurstReveal` are conditionally rendered today — no reset-on-prop-change logic is needed). The calling game component keeps its own click-to-continue wrapper `<div role="button" onClick={handleRevealComplete}>` around the 3D scene, exactly matching the original component's outer shell.

## Global Constraints

- `quality === 'fallback2d'` must produce pixel-identical behavior to today's `FlipReveal`/`BurstReveal` flow, in every one of the 8 files touched.
- No game logic file (`frontend/src/lib/*.ts`, `frontend/src/data/soloPrompts.ts`) is touched by this plan.
- `CardFlipScene` and `BadgeBurstScene` take no `onComplete` prop — the calling component's existing click-to-continue wrapper and `handleRevealComplete`/equivalent function are preserved unchanged; only the *inner* visual (2D CSS flip/burst → 3D canvas) is replaced.
- No `drei` `Text` component anywhere in this plan — all text stays 2D HTML overlay.
- Pure logic (flip/pop timing curves) lives in plain `.ts` files under `frontend/src/three/scenes/`, tested with Vitest. WebGL components are not unit tested — verified manually in the final task.
- Reuse `easeOutBack` from the already-built, already-tested `frontend/src/three/easing.ts` — do not duplicate an easing curve.
- Follow the `@/*` → `frontend/src/*` import alias convention.

---

### Task 1: Card flip timeline

**Files:**
- Create: `frontend/src/three/scenes/cardFlipTimeline.ts`
- Test: `frontend/src/three/scenes/cardFlipTimeline.test.ts`

**Interfaces:**
- Consumes: `easeOutBack` from `../easing` (existing, tested).
- Produces: `FLIP_DURATION_MS = 700`, `function getCardRotationY(elapsedMs: number): number` (0 at `elapsedMs = 0`, `Math.PI` once settled, with the overshoot already baked into `easeOutBack`), `function isFlipSettled(elapsedMs: number): boolean`. Used by Task 3 (`CardFlipScene`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/scenes/cardFlipTimeline.test.ts
import { describe, expect, it } from 'vitest';
import { FLIP_DURATION_MS, getCardRotationY, isFlipSettled } from './cardFlipTimeline';

describe('cardFlipTimeline', () => {
  it('starts at 0 rotation', () => {
    expect(getCardRotationY(0)).toBeCloseTo(0, 5);
  });

  it('ends at exactly PI once settled', () => {
    expect(getCardRotationY(FLIP_DURATION_MS)).toBeCloseTo(Math.PI, 5);
  });

  it('overshoots past PI partway through (matches easeOutBack)', () => {
    expect(getCardRotationY(FLIP_DURATION_MS * 0.75)).toBeGreaterThan(Math.PI);
  });

  it('isFlipSettled is false before the duration and true at/after it', () => {
    expect(isFlipSettled(FLIP_DURATION_MS - 1)).toBe(false);
    expect(isFlipSettled(FLIP_DURATION_MS)).toBe(true);
    expect(isFlipSettled(FLIP_DURATION_MS + 500)).toBe(true);
  });

  it('clamps beyond the duration (does not keep rotating past PI)', () => {
    expect(getCardRotationY(FLIP_DURATION_MS * 3)).toBeCloseTo(Math.PI, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/scenes/cardFlipTimeline.test.ts`
Expected: FAIL with "Cannot find module './cardFlipTimeline'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/scenes/cardFlipTimeline.ts
import { easeOutBack } from '../easing';

export const FLIP_DURATION_MS = 700;

export function getCardRotationY(elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs / FLIP_DURATION_MS, 0), 1);
  return easeOutBack(t) * Math.PI;
}

export function isFlipSettled(elapsedMs: number): boolean {
  return elapsedMs >= FLIP_DURATION_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/scenes/cardFlipTimeline.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/scenes/cardFlipTimeline.ts frontend/src/three/scenes/cardFlipTimeline.test.ts
git commit -m "feat: add card flip rotation timeline"
```

---

### Task 2: Badge burst timeline

**Files:**
- Create: `frontend/src/three/scenes/burstTimeline.ts`
- Test: `frontend/src/three/scenes/burstTimeline.test.ts`

**Interfaces:**
- Consumes: `easeOutBack` from `../easing`.
- Produces: `BADGE_POP_DURATION_MS = 400`, `BURST_PARTICLE_DURATION_MS = 700`, `function getBadgeScale(elapsedMs: number): number` (0 at start, overshoots then settles at 1), `function getBurstProgress(elapsedMs: number): number` (0..1 linear over `BURST_PARTICLE_DURATION_MS`, clamped). Used by Task 4 (`BurstBadge`) and Task 5 (`BurstParticles`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/scenes/burstTimeline.test.ts
import { describe, expect, it } from 'vitest';
import { BADGE_POP_DURATION_MS, BURST_PARTICLE_DURATION_MS, getBadgeScale, getBurstProgress } from './burstTimeline';

describe('getBadgeScale', () => {
  it('starts at 0', () => {
    expect(getBadgeScale(0)).toBeCloseTo(0, 5);
  });

  it('settles at exactly 1', () => {
    expect(getBadgeScale(BADGE_POP_DURATION_MS)).toBeCloseTo(1, 5);
    expect(getBadgeScale(BADGE_POP_DURATION_MS * 5)).toBeCloseTo(1, 5);
  });

  it('overshoots past 1 partway through the pop', () => {
    expect(getBadgeScale(BADGE_POP_DURATION_MS * 0.75)).toBeGreaterThan(1);
  });
});

describe('getBurstProgress', () => {
  it('starts at 0 and ends at 1', () => {
    expect(getBurstProgress(0)).toBeCloseTo(0, 5);
    expect(getBurstProgress(BURST_PARTICLE_DURATION_MS)).toBeCloseTo(1, 5);
  });

  it('clamps at 1 beyond the duration', () => {
    expect(getBurstProgress(BURST_PARTICLE_DURATION_MS * 3)).toBe(1);
  });

  it('is monotonically increasing', () => {
    let previous = getBurstProgress(0);
    for (let t = 50; t <= BURST_PARTICLE_DURATION_MS; t += 50) {
      const current = getBurstProgress(t);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/scenes/burstTimeline.test.ts`
Expected: FAIL with "Cannot find module './burstTimeline'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/scenes/burstTimeline.ts
import { easeOutBack } from '../easing';

export const BADGE_POP_DURATION_MS = 400;
export const BURST_PARTICLE_DURATION_MS = 700;

export function getBadgeScale(elapsedMs: number): number {
  const t = Math.min(Math.max(elapsedMs / BADGE_POP_DURATION_MS, 0), 1);
  return easeOutBack(t);
}

export function getBurstProgress(elapsedMs: number): number {
  return Math.min(Math.max(elapsedMs / BURST_PARTICLE_DURATION_MS, 0), 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/scenes/burstTimeline.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/scenes/burstTimeline.ts frontend/src/three/scenes/burstTimeline.test.ts
git commit -m "feat: add badge pop-in and particle burst timelines"
```

---

### Task 3: `CardFlipScene` component

**Files:**
- Create: `frontend/src/three/scenes/CardFlipScene.tsx`

**Interfaces:**
- Consumes: `FLIP_DURATION_MS`, `getCardRotationY` from `./cardFlipTimeline` (Task 1); `ThemeMaterial` from `../themeMaterials`.
- Produces: `function CardFlipScene(props: { material: ThemeMaterial }): JSX.Element`. No `onComplete` prop (see plan header). Used by Task 7 (`TruthOrDareSolo.tsx`).

No automated test — WebGL component, verified manually in the final task.

- [ ] **Step 1: Write the implementation**

```tsx
// frontend/src/three/scenes/CardFlipScene.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCardRotationY } from './cardFlipTimeline';
import type { ThemeMaterial } from '../themeMaterials';

type CardFlipSceneProps = {
  material: ThemeMaterial;
};

export function CardFlipScene({ material }: CardFlipSceneProps) {
  const cardRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const card = cardRef.current;
    if (!card) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    card.rotation.y = getCardRotationY(elapsedMs);
  });

  return (
    <group ref={cardRef}>
      {/* Back face: visible at rest (rotation 0), theme-decorative side. */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.4, 1.9]} />
        <meshStandardMaterial color={material.baseColor} emissive={material.emissive} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      {/* Front face: revealed once the card has rotated past 90°, faces the opposite way. */}
      <mesh position={[0, 0, -0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.4, 1.9]} />
        <meshStandardMaterial color={material.sceneBackground} emissive={material.glowColor} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/scenes/CardFlipScene.tsx
git commit -m "feat: add 3D card flip scene"
```

---

### Task 4: `BurstBadge` component

**Files:**
- Create: `frontend/src/three/scenes/BurstBadge.tsx`

**Interfaces:**
- Consumes: `getBadgeScale` from `./burstTimeline` (Task 2); `ThemeMaterial` from `../themeMaterials`.
- Produces: `type BurstVariant = 'success' | 'fail' | 'neutral'`, `function BurstBadge(props: { variant: BurstVariant; material: ThemeMaterial }): JSX.Element`. Used by Task 6 (`BadgeBurstScene`).

No automated test — WebGL component, verified manually in the final task.

- [ ] **Step 1: Write the implementation**

```tsx
// frontend/src/three/scenes/BurstBadge.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBadgeScale } from './burstTimeline';
import type { ThemeMaterial } from '../themeMaterials';

export type BurstVariant = 'success' | 'fail' | 'neutral';

type BurstBadgeProps = {
  variant: BurstVariant;
  material: ThemeMaterial;
};

const VARIANT_COLOR: Record<BurstVariant, (material: ThemeMaterial) => string> = {
  success: material => material.glowColor,
  fail: () => '#7a2b2b',
  neutral: material => material.particleColor
};

function IconShape({ variant, color }: { variant: BurstVariant; color: string }) {
  if (variant === 'success') {
    // Checkmark: two short bars meeting at an angle.
    return (
      <group>
        <mesh position={[-0.08, -0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.22, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
        <mesh position={[0.06, 0.05, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.34, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
      </group>
    );
  }
  if (variant === 'fail') {
    // X: two crossed bars.
    return (
      <group>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.4, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.4, 0.08, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} />
        </mesh>
      </group>
    );
  }
  // Neutral: a single horizontal dash.
  return (
    <mesh>
      <boxGeometry args={[0.32, 0.08, 0.08]} />
      <meshStandardMaterial color={color} emissive={color} />
    </mesh>
  );
}

export function BurstBadge({ variant, material }: BurstBadgeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    group.scale.setScalar(getBadgeScale(elapsedMs));
  });

  const color = VARIANT_COLOR[variant](material);

  return (
    <group ref={groupRef}>
      <mesh>
        <circleGeometry args={[0.45, 32]} />
        <meshStandardMaterial color={material.baseColor} emissive={color} metalness={material.metalness} roughness={material.roughness} />
      </mesh>
      <group position={[0, 0, 0.02]}>
        <IconShape variant={variant} color={color} />
      </group>
    </group>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/scenes/BurstBadge.tsx
git commit -m "feat: add 3D badge icon (success/fail/neutral) with pop-in"
```

---

### Task 5: `BurstParticles` component

**Files:**
- Create: `frontend/src/three/scenes/BurstParticles.tsx`

**Interfaces:**
- Consumes: `getBurstProgress` from `./burstTimeline` (Task 2).
- Produces: `function BurstParticles(props: { color: string }): JSX.Element`. Used by Task 6 (`BadgeBurstScene`). One-shot outward-expanding, fading particle burst — distinct from the continuous ambient `ParticleField` (sub-project 1), which drifts forever and never fades.

No automated test — WebGL component, verified manually in the final task.

- [ ] **Step 1: Write the implementation**

```tsx
// frontend/src/three/scenes/BurstParticles.tsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBurstProgress } from './burstTimeline';

type BurstParticlesProps = {
  color: string;
};

const PARTICLE_COUNT = 24;

export function BurstParticles({ color }: BurstParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const startTimeRef = useRef<number | null>(null);

  const directions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.5;
      arr[i * 3] = Math.cos(angle) * radius;
      arr[i * 3 + 1] = Math.sin(angle) * radius;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return arr;
  }, []);

  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    const mat = materialRef.current;
    if (!points || !mat) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    const progress = getBurstProgress(elapsedMs);

    const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      posAttr.array[i * 3] = directions[i * 3] * progress;
      posAttr.array[i * 3 + 1] = directions[i * 3 + 1] * progress;
      posAttr.array[i * 3 + 2] = directions[i * 3 + 2] * progress;
    }
    posAttr.needsUpdate = true;
    mat.opacity = 1 - progress;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={materialRef} color={color} size={0.06} sizeAttenuation transparent opacity={1} />
    </points>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/scenes/BurstParticles.tsx
git commit -m "feat: add one-shot expanding/fading burst particle effect"
```

---

### Task 6: `BadgeBurstScene` orchestration

**Files:**
- Create: `frontend/src/three/scenes/BadgeBurstScene.tsx`

**Interfaces:**
- Consumes: `BurstBadge`, `BurstVariant` (Task 4); `BurstParticles` (Task 5); `ThemeMaterial` from `../themeMaterials`.
- Produces: `function BadgeBurstScene(props: { variant: BurstVariant; material: ThemeMaterial }): JSX.Element`. No `onComplete` prop. Used by Task 8-14 (7 game integrations).

No automated test — WebGL component, verified manually in the final task.

- [ ] **Step 1: Write the implementation**

```tsx
// frontend/src/three/scenes/BadgeBurstScene.tsx
import { BurstBadge, type BurstVariant } from './BurstBadge';
import { BurstParticles } from './BurstParticles';
import type { ThemeMaterial } from '../themeMaterials';

type BadgeBurstSceneProps = {
  variant: BurstVariant;
  material: ThemeMaterial;
};

export function BadgeBurstScene({ variant, material }: BadgeBurstSceneProps) {
  const burstColor = variant === 'success' ? material.glowColor : variant === 'fail' ? '#7a2b2b' : material.particleColor;

  return (
    <group>
      <BurstBadge variant={variant} material={material} />
      <BurstParticles color={burstColor} />
    </group>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/scenes/BadgeBurstScene.tsx
git commit -m "feat: add badge burst scene orchestration"
```

---

### Task 7: Integrate `CardFlipScene` into `TruthOrDareSolo.tsx`

**Files:**
- Modify: `frontend/src/games/solo/TruthOrDareSolo.tsx`

**Interfaces:**
- Consumes: `CardFlipScene` (Task 3), `GameCanvas` (`@/three/GameCanvas`), `getThemeMaterial` (`@/three/themeMaterials`), `useAdaptiveQuality` (`@/three/useAdaptiveQuality`), `useTheme` (`@/hooks/useTheme`).

- [ ] **Step 1: Read the current file and the RPS solo reference**

Read `frontend/src/games/solo/TruthOrDareSolo.tsx` in full (reproduced above) and `frontend/src/games/solo/RpsSolo.tsx` for the lazy-loading/Suspense/quality-branch pattern. Note this file's reveal only appears in the `phase === 'revealing' && reveal` branch — everything else (category picker, `PlayerWheel` spin, truth/dare choice buttons) is untouched.

- [ ] **Step 2: Add imports and hooks**

```tsx
import { lazy, Suspense } from 'react';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const CardFlipScene = lazy(() => import('@/three/scenes/CardFlipScene').then(m => ({ default: m.CardFlipScene })));
```

Inside the component body:
```tsx
const { theme } = useTheme();
const quality = useAdaptiveQuality();
```

- [ ] **Step 3: Replace the reveal block, preserving the click-to-continue wrapper**

Replace:
```tsx
      {phase === 'revealing' && reveal ? (
        <FlipReveal
          cardSize="lg"
          cards={[{ id: 'prompt', content: reveal === 'truth' ? prompt.truth : prompt.dare }]}
          outcomeLabel={reveal === 'truth' ? t('solo.truthOrDare.revealTruth') : t('solo.truthOrDare.revealDare')}
          onComplete={handleRevealComplete}
        />
      ) : null}
```

With:
```tsx
      {phase === 'revealing' && reveal && quality === 'fallback2d' ? (
        <FlipReveal
          cardSize="lg"
          cards={[{ id: 'prompt', content: reveal === 'truth' ? prompt.truth : prompt.dare }]}
          outcomeLabel={reveal === 'truth' ? t('solo.truthOrDare.revealTruth') : t('solo.truthOrDare.revealDare')}
          onComplete={handleRevealComplete}
        />
      ) : phase === 'revealing' && reveal ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-64 w-48">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <CardFlipScene material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-medium text-foreground">{reveal === 'truth' ? prompt.truth : prompt.dare}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {reveal === 'truth' ? t('solo.truthOrDare.revealTruth') : t('solo.truthOrDare.revealDare')}
          </p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : null}
```

Note the outer `role="button"`/`onClick={handleRevealComplete}`/`continueHint` text is copied from `FlipReveal`'s own markup — this preserves the exact click-to-continue affordance the 2D version has, just with the 3D canvas replacing the CSS-transform card.

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass (this file's spin/category logic is untouched).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/solo/TruthOrDareSolo.tsx
git commit -m "feat: mount the 3D card flip scene in Truth or Dare solo with 2D fallback"
```

---

### Task 8: Integrate `BadgeBurstScene` into `TruthOrDareMultiplayer.tsx`

**Files:**
- Modify: `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx`

**Interfaces:**
- Consumes: `BadgeBurstScene` (Task 6), `GameCanvas`, `getThemeMaterial`, `useAdaptiveQuality`, `useTheme`.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx` in full (reproduced above). Only the `phase === 'result'` branch (currently `<BurstReveal icon={...} headline={...} onComplete={handleResultRevealComplete} />`) changes — the spin/choice/content/answer/validate phases are untouched.

- [ ] **Step 2: Add imports and hooks**

Same pattern as Task 7, Step 2, but importing `BadgeBurstScene` instead of `CardFlipScene`:

```tsx
import { lazy, Suspense } from 'react';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const BadgeBurstScene = lazy(() => import('@/three/scenes/BadgeBurstScene').then(m => ({ default: m.BadgeBurstScene })));
```

```tsx
const { theme } = useTheme();
const quality = useAdaptiveQuality();
```

- [ ] **Step 3: Replace the result block, preserving the click-to-continue wrapper**

Replace:
```tsx
      {phase === 'result' ? (
        <BurstReveal
          icon={resultApproved ? 'success' : 'fail'}
          headline={
            isActive
              ? resultApproved
                ? t('multiplayer.truthOrDare.resultValidated')
                : t('multiplayer.truthOrDare.resultRefused')
              : resultApproved
                ? t('multiplayer.truthOrDare.resultOpponentGains', { name: activePlayerName })
                : t('multiplayer.truthOrDare.resultOpponentNoGain', { name: activePlayerName })
          }
          onComplete={handleResultRevealComplete}
        />
      ) : null}
```

With:
```tsx
      {phase === 'result' && quality === 'fallback2d' ? (
        <BurstReveal
          icon={resultApproved ? 'success' : 'fail'}
          headline={
            isActive
              ? resultApproved
                ? t('multiplayer.truthOrDare.resultValidated')
                : t('multiplayer.truthOrDare.resultRefused')
              : resultApproved
                ? t('multiplayer.truthOrDare.resultOpponentGains', { name: activePlayerName })
                : t('multiplayer.truthOrDare.resultOpponentNoGain', { name: activePlayerName })
          }
          onComplete={handleResultRevealComplete}
        />
      ) : phase === 'result' ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleResultRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleResultRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant={resultApproved ? 'success' : 'fail'} material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">
            {isActive
              ? resultApproved
                ? t('multiplayer.truthOrDare.resultValidated')
                : t('multiplayer.truthOrDare.resultRefused')
              : resultApproved
                ? t('multiplayer.truthOrDare.resultOpponentGains', { name: activePlayerName })
                : t('multiplayer.truthOrDare.resultOpponentNoGain', { name: activePlayerName })}
          </p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : null}
```

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass; socket logic untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx
git commit -m "feat: mount the 3D badge burst scene in Truth or Dare multiplayer's result step"
```

---

### Task 9: Integrate `BadgeBurstScene` into `TwentyQuestionsSolo.tsx`

**Files:**
- Modify: `frontend/src/games/solo/TwentyQuestionsSolo.tsx`

**Interfaces:**
- Consumes: same as Task 8.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/solo/TwentyQuestionsSolo.tsx` in full (reproduced above).

- [ ] **Step 2: Add imports and hooks**

Same as Task 8, Step 2.

- [ ] **Step 3: Replace the reveal block**

Replace:
```tsx
      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={
            roundResult.outcome === 'player'
              ? t('solo.twentyQuestions.revealWon', { answer: roundResult.answer })
              : t('solo.twentyQuestions.revealLost', { answer: roundResult.answer })
          }
          detail={roundResult.outcome === 'player' ? t('solo.twentyQuestions.revealDetail', { tries: roundResult.triesUsed }) : undefined}
          onComplete={handleRevealComplete}
        />
      ) : (
```

With:
```tsx
      {roundResult && quality === 'fallback2d' ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={
            roundResult.outcome === 'player'
              ? t('solo.twentyQuestions.revealWon', { answer: roundResult.answer })
              : t('solo.twentyQuestions.revealLost', { answer: roundResult.answer })
          }
          detail={roundResult.outcome === 'player' ? t('solo.twentyQuestions.revealDetail', { tries: roundResult.triesUsed }) : undefined}
          onComplete={handleRevealComplete}
        />
      ) : roundResult ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant={roundResult.outcome === 'player' ? 'success' : 'fail'} material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">
            {roundResult.outcome === 'player'
              ? t('solo.twentyQuestions.revealWon', { answer: roundResult.answer })
              : t('solo.twentyQuestions.revealLost', { answer: roundResult.answer })}
          </p>
          {roundResult.outcome === 'player' ? (
            <p className="text-sm text-muted-foreground">{t('solo.twentyQuestions.revealDetail', { tries: roundResult.triesUsed })}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : (
```

The trailing `) : (` matches the existing idle-state block already in the file.

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass; `twentyQuestionsLogic.ts` untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/solo/TwentyQuestionsSolo.tsx
git commit -m "feat: mount the 3D badge burst scene in 20 Questions solo with 2D fallback"
```

---

### Task 10: Integrate `BadgeBurstScene` into `TwentyQuestionsMultiplayer.tsx`

**Files:**
- Modify: `frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx`

**Interfaces:**
- Consumes: same as Task 8.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx` in full (reproduced above).

- [ ] **Step 2: Add imports and hooks**

Same as Task 8, Step 2.

- [ ] **Step 3: Replace the reveal block**

Replace:
```tsx
      {roundResult ? (
        <BurstReveal
          icon={roundResult.correct ? 'success' : 'fail'}
          headline={
            roundResult.correct
              ? isGuesser
                ? t('multiplayer.twentyQuestions.wonRound', { points: roundResult.attemptsRemaining })
                : t('multiplayer.twentyQuestions.opponentWonRound', { name: opponentName })
              : t('multiplayer.twentyQuestions.roundExhausted')
          }
          detail={t('multiplayer.twentyQuestions.roundSummary', { turn: roundResult.turnIndex, total: TOTAL_TURNS })}
          onComplete={handleRoundRevealComplete}
        />
      ) : (
```

With:
```tsx
      {roundResult && quality === 'fallback2d' ? (
        <BurstReveal
          icon={roundResult.correct ? 'success' : 'fail'}
          headline={
            roundResult.correct
              ? isGuesser
                ? t('multiplayer.twentyQuestions.wonRound', { points: roundResult.attemptsRemaining })
                : t('multiplayer.twentyQuestions.opponentWonRound', { name: opponentName })
              : t('multiplayer.twentyQuestions.roundExhausted')
          }
          detail={t('multiplayer.twentyQuestions.roundSummary', { turn: roundResult.turnIndex, total: TOTAL_TURNS })}
          onComplete={handleRoundRevealComplete}
        />
      ) : roundResult ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRoundRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRoundRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant={roundResult.correct ? 'success' : 'fail'} material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">
            {roundResult.correct
              ? isGuesser
                ? t('multiplayer.twentyQuestions.wonRound', { points: roundResult.attemptsRemaining })
                : t('multiplayer.twentyQuestions.opponentWonRound', { name: opponentName })
              : t('multiplayer.twentyQuestions.roundExhausted')}
          </p>
          <p className="text-sm text-muted-foreground">{t('multiplayer.twentyQuestions.roundSummary', { turn: roundResult.turnIndex, total: TOTAL_TURNS })}</p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : (
```

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass; socket logic untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/multiplayer/TwentyQuestionsMultiplayer.tsx
git commit -m "feat: mount the 3D badge burst scene in 20 Questions multiplayer with 2D fallback"
```

---

### Task 11: Integrate `BadgeBurstScene` into `WouldYouRatherSolo.tsx`

**Files:**
- Modify: `frontend/src/games/solo/WouldYouRatherSolo.tsx`

**Interfaces:**
- Consumes: same as Task 8.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/solo/WouldYouRatherSolo.tsx` in full (reproduced above). Note this file's reveal condition is `revealing && result` (two separate state variables), and the reveal always uses `icon="neutral"`.

- [ ] **Step 2: Add imports and hooks**

Same as Task 8, Step 2.

- [ ] **Step 3: Replace the reveal block**

Replace:
```tsx
      {revealing && result ? (
        <BurstReveal
          icon="neutral"
          headline={t('solo.wouldYouRather.yourChoice', { choice: dilemma[result.playerChoice] })}
          detail={
            result.playerChoice === result.machineChoice
              ? t('solo.wouldYouRather.aiSame', { choice: dilemma[result.machineChoice] })
              : t('solo.wouldYouRather.aiDifferent', { choice: dilemma[result.machineChoice] })
          }
          onComplete={() => setRevealing(false)}
        />
      ) : (
```

With:
```tsx
      {revealing && result && quality === 'fallback2d' ? (
        <BurstReveal
          icon="neutral"
          headline={t('solo.wouldYouRather.yourChoice', { choice: dilemma[result.playerChoice] })}
          detail={
            result.playerChoice === result.machineChoice
              ? t('solo.wouldYouRather.aiSame', { choice: dilemma[result.machineChoice] })
              : t('solo.wouldYouRather.aiDifferent', { choice: dilemma[result.machineChoice] })
          }
          onComplete={() => setRevealing(false)}
        />
      ) : revealing && result ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setRevealing(false)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              setRevealing(false);
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant="neutral" material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">{t('solo.wouldYouRather.yourChoice', { choice: dilemma[result.playerChoice] })}</p>
          <p className="text-sm text-muted-foreground">
            {result.playerChoice === result.machineChoice
              ? t('solo.wouldYouRather.aiSame', { choice: dilemma[result.machineChoice] })
              : t('solo.wouldYouRather.aiDifferent', { choice: dilemma[result.machineChoice] })}
          </p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : (
```

Add the imports/hooks (`theme`, `quality`) alongside this file's existing `useState` calls — this file has no `useSoloScore`/`ScorePill` (unlike most other solo games), so just add the new hooks without assuming those exist.

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/solo/WouldYouRatherSolo.tsx
git commit -m "feat: mount the 3D badge burst scene in Would You Rather solo with 2D fallback"
```

---

### Task 12: Integrate `BadgeBurstScene` into `WouldYouRatherMultiplayer.tsx`

**Files:**
- Modify: `frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx`

**Interfaces:**
- Consumes: same as Task 8.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx` in full (reproduced above). Note the reveal condition is `round && prompt`, and the icon is `round.sameChoice ? 'success' : 'neutral'`.

- [ ] **Step 2: Add imports and hooks**

Same as Task 8, Step 2.

- [ ] **Step 3: Replace the reveal block**

Replace:
```tsx
      {round && prompt ? (
        <BurstReveal
          icon={round.sameChoice ? 'success' : 'neutral'}
          headline={t('multiplayer.wouldYouRather.yourChoice', { choice: prompt[round.yourChoice] })}
          detail={
            round.sameChoice
              ? t('multiplayer.wouldYouRather.opponentSame', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })
              : t('multiplayer.wouldYouRather.opponentDifferent', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })
          }
          onComplete={handleRevealComplete}
        />
      ) : prompt && !awaitingNextRound ? (
```

With:
```tsx
      {round && prompt && quality === 'fallback2d' ? (
        <BurstReveal
          icon={round.sameChoice ? 'success' : 'neutral'}
          headline={t('multiplayer.wouldYouRather.yourChoice', { choice: prompt[round.yourChoice] })}
          detail={
            round.sameChoice
              ? t('multiplayer.wouldYouRather.opponentSame', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })
              : t('multiplayer.wouldYouRather.opponentDifferent', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })
          }
          onComplete={handleRevealComplete}
        />
      ) : round && prompt ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant={round.sameChoice ? 'success' : 'neutral'} material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">{t('multiplayer.wouldYouRather.yourChoice', { choice: prompt[round.yourChoice] })}</p>
          <p className="text-sm text-muted-foreground">
            {round.sameChoice
              ? t('multiplayer.wouldYouRather.opponentSame', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })
              : t('multiplayer.wouldYouRather.opponentDifferent', {
                  name: opponent?.name ?? t('multiplayer.common.opponentFallback'),
                  choice: prompt[round.opponentChoice]
                })}
          </p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : prompt && !awaitingNextRound ? (
```

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass; socket logic untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/multiplayer/WouldYouRatherMultiplayer.tsx
git commit -m "feat: mount the 3D badge burst scene in Would You Rather multiplayer with 2D fallback"
```

---

### Task 13: Integrate `BadgeBurstScene` into `TwoTruthsOneLieSolo.tsx`

**Files:**
- Modify: `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx`

**Interfaces:**
- Consumes: same as Task 8.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/solo/TwoTruthsOneLieSolo.tsx` in full (reproduced above).

- [ ] **Step 2: Add imports and hooks**

Same as Task 8, Step 2.

- [ ] **Step 3: Replace the reveal block**

Replace:
```tsx
      {roundResult ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? t('solo.twoTruthsOneLie.won') : t('solo.twoTruthsOneLie.lost')}
          detail={t('solo.twoTruthsOneLie.detail', { lie: roundResult.lieText })}
          onComplete={handleRevealComplete}
        />
      ) : (
```

With:
```tsx
      {roundResult && quality === 'fallback2d' ? (
        <BurstReveal
          icon={roundResult.outcome === 'player' ? 'success' : 'fail'}
          headline={roundResult.outcome === 'player' ? t('solo.twoTruthsOneLie.won') : t('solo.twoTruthsOneLie.lost')}
          detail={t('solo.twoTruthsOneLie.detail', { lie: roundResult.lieText })}
          onComplete={handleRevealComplete}
        />
      ) : roundResult ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant={roundResult.outcome === 'player' ? 'success' : 'fail'} material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">
            {roundResult.outcome === 'player' ? t('solo.twoTruthsOneLie.won') : t('solo.twoTruthsOneLie.lost')}
          </p>
          <p className="text-sm text-muted-foreground">{t('solo.twoTruthsOneLie.detail', { lie: roundResult.lieText })}</p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : (
```

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass; `twoTruthsLogic.ts` untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/solo/TwoTruthsOneLieSolo.tsx
git commit -m "feat: mount the 3D badge burst scene in Two Truths One Lie solo with 2D fallback"
```

---

### Task 14: Integrate `BadgeBurstScene` into `TwoTruthsOneLieMultiplayer.tsx`

**Files:**
- Modify: `frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx`

**Interfaces:**
- Consumes: same as Task 8.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx` in full (reproduced above). Note the reveal condition is `result && myOutcome`, where `myOutcome` is derived (`'success' | 'fail' | null`) from whether the current player was the voter and guessed correctly.

- [ ] **Step 2: Add imports and hooks**

Same as Task 8, Step 2.

- [ ] **Step 3: Replace the reveal block**

Replace:
```tsx
      {result && myOutcome ? (
        <BurstReveal
          icon={myOutcome === 'success' ? 'success' : 'fail'}
          headline={
            result.voterSocketId === socketId
              ? result.correct
                ? t('multiplayer.twoTruthsOneLie.won')
                : t('multiplayer.twoTruthsOneLie.lost')
              : result.correct
                ? t('multiplayer.twoTruthsOneLie.opponentFound', { name: opponentName })
                : t('multiplayer.twoTruthsOneLie.opponentMissed', { name: opponentName })
          }
          detail={t('multiplayer.twoTruthsOneLie.lieWas', { index: result.lieIndex + 1 })}
          onComplete={handleRevealComplete}
        />
      ) : votingStatements && isVoter ? (
```

With:
```tsx
      {result && myOutcome && quality === 'fallback2d' ? (
        <BurstReveal
          icon={myOutcome === 'success' ? 'success' : 'fail'}
          headline={
            result.voterSocketId === socketId
              ? result.correct
                ? t('multiplayer.twoTruthsOneLie.won')
                : t('multiplayer.twoTruthsOneLie.lost')
              : result.correct
                ? t('multiplayer.twoTruthsOneLie.opponentFound', { name: opponentName })
                : t('multiplayer.twoTruthsOneLie.opponentMissed', { name: opponentName })
          }
          detail={t('multiplayer.twoTruthsOneLie.lieWas', { index: result.lieIndex + 1 })}
          onComplete={handleRevealComplete}
        />
      ) : result && myOutcome ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleRevealComplete}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleRevealComplete();
            }
          }}
          className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-muted p-6 text-center"
        >
          <div className="relative h-40 w-40">
            <Suspense fallback={null}>
              <GameCanvas theme={theme} quality={quality}>
                <BadgeBurstScene variant={myOutcome} material={getThemeMaterial(theme)} />
              </GameCanvas>
            </Suspense>
          </div>
          <p className="max-w-sm text-sm font-semibold text-foreground">
            {result.voterSocketId === socketId
              ? result.correct
                ? t('multiplayer.twoTruthsOneLie.won')
                : t('multiplayer.twoTruthsOneLie.lost')
              : result.correct
                ? t('multiplayer.twoTruthsOneLie.opponentFound', { name: opponentName })
                : t('multiplayer.twoTruthsOneLie.opponentMissed', { name: opponentName })}
          </p>
          <p className="text-sm text-muted-foreground">{t('multiplayer.twoTruthsOneLie.lieWas', { index: result.lieIndex + 1 })}</p>
          <p className="text-xs text-muted-foreground">{t('solo.reveals.continueHint')}</p>
        </div>
      ) : votingStatements && isVoter ? (
```

`myOutcome`'s type is `'success' | 'fail' | null` (already narrowed truthy by the `result && myOutcome` guard), matching `BurstVariant`'s `'success' | 'fail'` members exactly for the `variant={myOutcome}` prop — no cast needed.

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass; socket logic untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/multiplayer/TwoTruthsOneLieMultiplayer.tsx
git commit -m "feat: mount the 3D badge burst scene in Two Truths One Lie multiplayer with 2D fallback"
```

---

### Task 15: Manual verification in the browser

**Files:** none — verification only.

- [ ] **Step 1: Truth or Dare (both modes)**

Run `cd frontend && npm run dev`. In solo: spin, choose truth or dare, confirm the 3D card flips (back → front) and shows the prompt text, and clicking the card/overlay advances past it. In multiplayer (two sessions): spin, choose, answer if truth, validate/refuse, confirm the 3D badge (✓/✗) pops in with a particle burst on the result step for both players, and clicking advances.

- [ ] **Step 2: 20 Questions, Would You Rather, Two Truths One Lie (both modes)**

For each of the 3 games, in both solo and multiplayer: play a round to its reveal, confirm the 3D badge (success/fail/neutral) pops in with the correct icon and a particle burst, the correct headline/detail text shows, and clicking the reveal area advances to the next round/state exactly as the 2D version did.

- [ ] **Step 3: Fallback verification**

Throttle CPU heavily (DevTools Performance tab → CPU 6x slowdown) and confirm each of the 8 screens either simplifies or falls back to `FlipReveal`/`BurstReveal` without breaking the click-to-continue flow.

- [ ] **Step 4: Theme spot-check**

Switch through at least 2 of the 4 themes and confirm the card/badge colors follow the theme (via `getThemeMaterial`) rather than looking identical across themes.

---

## Self-Review Notes

- **Spec coverage:** the design spec (`docs/superpowers/specs/2026-08-03-3d-animations-card-badge-design.md`) calls for two hero scenes (card flip, badge burst) reusing sub-project 1's foundations, with text staying 2D overlay — Tasks 1-6 build each piece, Tasks 7-14 wire them into the correct 7 vs. 1 file split (corrected from the spec's original assumption), Task 15 verifies the click-to-continue behavior explicitly.
- **Type consistency:** `BurstVariant` defined once in `BurstBadge.tsx`, consumed identically by `BadgeBurstScene.tsx` and every integration task; `CardFlipScene`/`BadgeBurstScene` both take no `onComplete` prop, consistently across all 8 integration tasks — this was the one interaction-model decision most likely to be inconsistently applied, and every task's diff explicitly preserves the caller's own click-to-continue wrapper instead.
- **No placeholders:** every task has complete, runnable code; WebGL-only tasks (3-6) are explicitly marked as manually verified in Task 15 rather than unit tested, consistent with this project's established convention.

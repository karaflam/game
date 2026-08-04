# 3D Player Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 2D SVG `PlayerWheel` (used to pick whose turn it is in Truth or Dare, both solo and multiplayer) with a realistic, procedurally-built 3D wheel — real wedge thickness, metallic rim, tilted camera — while keeping the exact same fallback behavior for low-end devices.

**Architecture:** A new pure-logic module (`wheelTimeline.ts`, spin-angle math, Vitest-tested) and a new WebGL scene (`PlayerWheelScene.tsx`, manually verified) under `frontend/src/three/scenes/`, reusing the existing `GameCanvas`/`getThemeMaterial`/`useAdaptiveQuality` foundations. The existing SVG `PlayerWheel` component is untouched and becomes the `quality === 'fallback2d'` branch at each of the two call sites.

**Tech Stack:** React 18, TypeScript, `three`, `@react-three/fiber`, `@react-three/drei` (`Text`, already used by the Odd or Even carousel — see Global Constraints for why this scene uses it despite the card/badge sub-project avoiding it).

## Global Constraints

- `quality === 'fallback2d'` must render the existing SVG `PlayerWheel` component completely unchanged (same props, same visuals, same behavior) in both `frontend/src/games/solo/TruthOrDareSolo.tsx` and `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx`.
- No game logic file (`frontend/src/lib/*.ts`, `frontend/src/data/soloPrompts.ts`) is touched by this plan.
- `PlayerWheelScene` takes the same prop shape the existing `PlayerWheel` takes — `players: string[]`, `landedOn: string`, `spinning: boolean`, `onSpinComplete: () => void` — plus `material: ThemeMaterial`. Reuses `SPIN_DURATION_S = 2.8` (as `WHEEL_SPIN_DURATION_MS = 2800`) so `onSpinComplete` timing is unchanged for callers.
- `drei`'s `Text` component IS used in this scene (unlike the card-flip/badge-burst sub-project, which avoided it for simpler flat, non-rotating content). Here the wheel spins and tilts continuously, so text needs to be genuinely part of the 3D wedge geometry. Follow the robustness pattern already proven for exactly this case in `frontend/src/three/scenes/NumberDrum.tsx`: unlit-safe material choices and `<Text key={...material.glowColor}>` so a live theme switch forces a clean remount instead of leaving the SDF glyph render stuck blank (see `frontend/src/three/scenes/NumberDrum.tsx`'s `key={isMasked ? 'masked' : material.glowColor}` comment for the full rationale).
- The camera's ~35° tilt for this scene is applied imperatively from inside `PlayerWheelScene.tsx` itself (a local `WheelCamera` child component using `useThree`) — `frontend/src/three/GameCanvas.tsx` is NOT modified. This keeps the tilt scoped to this one scene, the same way `GameCanvas`'s own `ResponsiveCamera` correction is scoped to specific container aspects rather than changing every scene's framing.
- `GameCanvas` and `PlayerWheelScene` are imported via the `lazy()` dynamic-import pattern in both integration files — `const X = lazy(() => import('...').then(m => ({ default: m.X })));` — not plain static imports. (This was a real defect caught and fixed in the card/badge sub-project's Task 11 review; both integration files below already have this pattern established for their existing `GameCanvas`/other-scene imports — match it exactly for the new import.)
- Follow the `@/*` → `frontend/src/*` import alias convention.
- Reuse `DRUM_FONT_URL` from the existing `frontend/src/three/scenes/textFont.ts` — do not create a new font-loading module.

---

### Task 1: Wheel spin-angle timeline

**Files:**
- Create: `frontend/src/three/scenes/wheelTimeline.ts`
- Test: `frontend/src/three/scenes/wheelTimeline.test.ts`

**Interfaces:**
- Consumes: nothing (pure math, no dependencies on other tasks).
- Produces: `WHEEL_SPIN_DURATION_MS = 2800`, `function wedgeCenterAngle(index: number, wedgeCount: number): number`, `function getWheelTargetRotation(targetIndex: number, wedgeCount: number, spinSeed: number): number`, `function getWheelRotation(elapsedMs: number, targetIndex: number, wedgeCount: number, spinSeed: number): number`, `function isWheelSpinSettled(elapsedMs: number): boolean`. Used by Task 2 (`PlayerWheelScene`).

**Angle convention (read before writing code):** all angles are radians, measured **clockwise from "up"** (the fixed pointer position), matching the pre-existing 2D wheel's `polarToCartesian` convention in `frontend/src/components/solo/PlayerWheel.tsx` — wedge 0 starts at "up" and wedges proceed clockwise as index increases. `wedgeCenterAngle` and `getWheelTargetRotation` are the ONLY place this convention is defined; Task 2's wedge geometry must derive positions from `wedgeCenterAngle` rather than re-deriving its own angle formula, so the visual wedge layout and the landing-rotation math can never drift out of sync with each other.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/scenes/wheelTimeline.test.ts
import { describe, expect, it } from 'vitest';
import {
  WHEEL_SPIN_DURATION_MS,
  getWheelRotation,
  getWheelTargetRotation,
  isWheelSpinSettled,
  wedgeCenterAngle
} from './wheelTimeline';

const TWO_PI = Math.PI * 2;

function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

describe('wheelTimeline', () => {
  it('isWheelSpinSettled is false before WHEEL_SPIN_DURATION_MS and true at/after it', () => {
    expect(isWheelSpinSettled(0)).toBe(false);
    expect(isWheelSpinSettled(WHEEL_SPIN_DURATION_MS - 1)).toBe(false);
    expect(isWheelSpinSettled(WHEEL_SPIN_DURATION_MS)).toBe(true);
    expect(isWheelSpinSettled(WHEEL_SPIN_DURATION_MS + 500)).toBe(true);
  });

  it('wedgeCenterAngle divides the wheel evenly, starting half a wedge past "up"', () => {
    expect(wedgeCenterAngle(0, 4)).toBeCloseTo(Math.PI / 4, 10);
    expect(wedgeCenterAngle(1, 4)).toBeCloseTo((3 * Math.PI) / 4, 10);
    expect(wedgeCenterAngle(2, 4)).toBeCloseTo((5 * Math.PI) / 4, 10);
    expect(wedgeCenterAngle(3, 4)).toBeCloseTo((7 * Math.PI) / 4, 10);
  });

  it('getWheelRotation lands within the target wedge for every wedge and several wheel sizes', () => {
    // wedgeCount === 1 is skipped: a single wedge spans the whole circle, so
    // "within the wedge" is trivially always true and not a meaningful check.
    for (const wedgeCount of [2, 3, 5, 8]) {
      for (let targetIndex = 0; targetIndex < wedgeCount; targetIndex++) {
        const wedgeAngle = TWO_PI / wedgeCount;
        const rotation = getWheelRotation(WHEEL_SPIN_DURATION_MS, targetIndex, wedgeCount, 1);
        const landedAngle = normalizeAngle(wedgeCenterAngle(targetIndex, wedgeCount) + rotation);
        const distanceFromUp = Math.min(landedAngle, TWO_PI - landedAngle);
        expect(distanceFromUp).toBeLessThan(wedgeAngle / 2);
      }
    }
  });

  it('getWheelRotation matches getWheelTargetRotation exactly once settled', () => {
    expect(getWheelRotation(WHEEL_SPIN_DURATION_MS, 2, 6, 3)).toBeCloseTo(getWheelTargetRotation(2, 6, 3), 10);
  });

  it('getWheelRotation starts at 0 and increases monotonically toward the settled value', () => {
    let prev = -1;
    for (let ms = 0; ms <= WHEEL_SPIN_DURATION_MS; ms += 100) {
      const rotation = getWheelRotation(ms, 3, 6, 5);
      expect(rotation).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = rotation;
    }
    expect(getWheelRotation(0, 3, 6, 5)).toBeCloseTo(0, 10);
  });

  it('different spin seeds land at different jittered offsets within the same wedge', () => {
    const rotationA = getWheelTargetRotation(1, 8, 1);
    const rotationB = getWheelTargetRotation(1, 8, 2);
    expect(rotationA).not.toBeCloseTo(rotationB, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/scenes/wheelTimeline.test.ts`
Expected: FAIL with "Cannot find module './wheelTimeline'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/scenes/wheelTimeline.ts
export const WHEEL_SPIN_DURATION_MS = 2800;
const MIN_FULL_TURNS = 5;
const TWO_PI = Math.PI * 2;

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

// Angle convention: radians, measured clockwise from "up" (the fixed pointer
// position at the top of the wheel), matching the pre-existing 2D wheel's
// polarToCartesian convention. Wedge 0 starts at "up" and wedges proceed
// clockwise as index increases. This is the single source of truth for that
// convention — the 3D wedge geometry (Task 2) must derive its positions from
// this function rather than re-deriving its own angle formula.
export function wedgeCenterAngle(index: number, wedgeCount: number): number {
  const wedgeAngle = TWO_PI / wedgeCount;
  return index * wedgeAngle + wedgeAngle / 2;
}

// Deterministic jitter within the wedge so the wheel doesn't always stop
// dead-center, without ever landing close enough to a divider to look
// ambiguous — same LCG-style formula as the 2D wheel (PlayerWheel.tsx),
// seeded by spinSeed so repeated spins land at different offsets.
function wedgeJitter(spinSeed: number, wedgeAngle: number): number {
  return (((spinSeed * 9301 + 49297) % 233280) / 233280 - 0.5) * wedgeAngle * 0.5;
}

// Total clockwise rotation (radians) the wheel must turn so that
// targetIndex's wedge ends up at "up", under the fixed pointer, after
// several full spins.
export function getWheelTargetRotation(targetIndex: number, wedgeCount: number, spinSeed: number): number {
  const wedgeAngle = TWO_PI / wedgeCount;
  const jitter = wedgeJitter(spinSeed, wedgeAngle);
  return MIN_FULL_TURNS * TWO_PI + (TWO_PI - wedgeCenterAngle(targetIndex, wedgeCount)) + jitter;
}

// The wheel's clockwise rotation at a given point in the spin animation —
// eases out to getWheelTargetRotation's exact value once settled.
export function getWheelRotation(elapsedMs: number, targetIndex: number, wedgeCount: number, spinSeed: number): number {
  const t = easeOutCubic(elapsedMs / WHEEL_SPIN_DURATION_MS);
  return getWheelTargetRotation(targetIndex, wedgeCount, spinSeed) * t;
}

export function isWheelSpinSettled(elapsedMs: number): boolean {
  return elapsedMs >= WHEEL_SPIN_DURATION_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/scenes/wheelTimeline.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/scenes/wheelTimeline.ts frontend/src/three/scenes/wheelTimeline.test.ts
git commit -m "feat: add 3D player wheel spin-angle timeline"
```

---

### Task 2: `PlayerWheelScene` component

**Files:**
- Create: `frontend/src/three/scenes/PlayerWheelScene.tsx`

**Interfaces:**
- Consumes: `WHEEL_SPIN_DURATION_MS`, `getWheelRotation`, `isWheelSpinSettled`, `wedgeCenterAngle` from `./wheelTimeline` (Task 1); `DRUM_FONT_URL` from `./textFont` (existing); `ThemeMaterial` from `../themeMaterials` (existing).
- Produces: `function PlayerWheelScene(props: { players: string[]; landedOn: string; spinning: boolean; onSpinComplete: () => void; material: ThemeMaterial }): JSX.Element`. Used by Task 3 (`TruthOrDareSolo.tsx`) and Task 4 (`TruthOrDareMultiplayer.tsx`).

No automated test — WebGL component, verified manually in Task 5.

- [ ] **Step 1: Write the implementation**

```tsx
// frontend/src/three/scenes/PlayerWheelScene.tsx
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { WHEEL_SPIN_DURATION_MS, getWheelRotation, isWheelSpinSettled, wedgeCenterAngle } from './wheelTimeline';
import { DRUM_FONT_URL } from './textFont';
import type { ThemeMaterial } from '../themeMaterials';

type PlayerWheelSceneProps = {
  players: string[];
  landedOn: string;
  spinning: boolean;
  onSpinComplete: () => void;
  material: ThemeMaterial;
};

const WHEEL_RADIUS = 1.1;
const WEDGE_THICKNESS = 0.15;
const RIM_RADIUS = 1.18;
const RIM_THICKNESS = 0.08;
const HUB_RADIUS = 0.18;
const HUB_HEIGHT = 0.2;

// Camera looks down at the wheel from ~36° above the horizontal instead of
// straight overhead, so the wedges' thickness, bevel, and metal shading are
// actually visible — a flat top-down view reads as "almost 2D" even with
// real geometry underneath (the same lesson the Odd or Even carousel needed
// its coverflow tilt for). Scoped to this scene only via an imperative
// camera update, not a change to GameCanvas's shared default camera.
function WheelCamera() {
  const camera = useThree(state => state.camera);

  useEffect(() => {
    camera.position.set(0, 2.2, 3.0);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}

// Converts wheelTimeline's "clockwise radians from up" angle convention into
// the standard math-angle convention THREE.Shape.absarc expects (0 = +X
// axis, increasing counter-clockwise).
function clockwiseToMathAngle(clockwiseAngle: number): number {
  return Math.PI / 2 - clockwiseAngle;
}

function buildWedgeGeometry(index: number, wedgeCount: number): THREE.ExtrudeGeometry {
  const wedgeAngle = (2 * Math.PI) / wedgeCount;
  const mathStart = clockwiseToMathAngle(index * wedgeAngle);
  const mathEnd = clockwiseToMathAngle((index + 1) * wedgeAngle);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.absarc(0, 0, WHEEL_RADIUS, mathStart, mathEnd, true);
  shape.lineTo(0, 0);

  return new THREE.ExtrudeGeometry(shape, {
    depth: WEDGE_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2
  });
}

function truncateLabel(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

export function PlayerWheelScene({ players, landedOn, spinning, onSpinComplete, material }: PlayerWheelSceneProps) {
  const wedgeGroupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const spinSeedRef = useRef(0);

  const wedgeCount = Math.max(1, players.length);
  const targetIndex = Math.max(0, players.indexOf(landedOn));

  // Fires whenever `spinning` transitions to true — a fresh spin — mirroring
  // the 2D wheel's own `[spinning]`-dependent effect in PlayerWheel.tsx.
  useEffect(() => {
    if (!spinning) return;
    spinSeedRef.current += 1;
    startTimeRef.current = null;
    completedRef.current = false;
  }, [spinning]);

  useFrame(({ clock }) => {
    const wedgeGroup = wedgeGroupRef.current;
    if (!wedgeGroup) return;

    if (!spinning) {
      // Settled/idle: hold the wheel at its fully-landed rotation for the
      // current target so it doesn't snap back to 0 between spins.
      wedgeGroup.rotation.z = -getWheelRotation(WHEEL_SPIN_DURATION_MS, targetIndex, wedgeCount, spinSeedRef.current);
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.getElapsedTime() * 1000;
    }
    const elapsedMs = clock.getElapsedTime() * 1000 - startTimeRef.current;
    // Negated: wheelTimeline's convention is clockwise-positive, but
    // Three.js's rotation.z is counter-clockwise-positive when viewed from
    // this camera's general position — negating converts one into the
    // other so the wheel visibly spins clockwise.
    wedgeGroup.rotation.z = -getWheelRotation(elapsedMs, targetIndex, wedgeCount, spinSeedRef.current);

    if (isWheelSpinSettled(elapsedMs) && !completedRef.current) {
      completedRef.current = true;
      onSpinComplete();
    }
  });

  const wedgeGeometries = useMemo(
    () => Array.from({ length: wedgeCount }, (_, i) => buildWedgeGeometry(i, wedgeCount)),
    [wedgeCount]
  );

  return (
    <group>
      <WheelCamera />

      {/* Rim: a slightly larger metal disc behind the wedges, peeking out
          around the edge — the "sleek modern metallic" look, driven entirely
          by theme metalness/roughness so it reads differently per theme
          without any wheel-specific color logic. */}
      <mesh position={[0, 0, -RIM_THICKNESS / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[RIM_RADIUS, RIM_RADIUS, RIM_THICKNESS, 48]} />
        <meshStandardMaterial
          color={material.baseColor}
          metalness={Math.min(1, material.metalness + 0.3)}
          roughness={Math.max(0.1, material.roughness - 0.1)}
        />
      </mesh>

      {/* Fixed pointer, outside the rotating group — stays at "up" regardless
          of wheel rotation, matching the 2D wheel's fixed pointer. */}
      <mesh position={[0, WHEEL_RADIUS + 0.12, 0.05]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.09, 0.18, 3]} />
        <meshStandardMaterial color={material.glowColor} emissive={material.glowColor} emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
      </mesh>

      <group ref={wedgeGroupRef}>
        {Array.from({ length: wedgeCount }).map((_, i) => {
          const fillColor = i % 2 === 0 ? material.baseColor : material.particleColor;
          const textAngle = wedgeCenterAngle(i, wedgeCount);
          const mathAngle = clockwiseToMathAngle(textAngle);
          const textRadius = WHEEL_RADIUS * 0.62;

          return (
            <group key={i}>
              <mesh geometry={wedgeGeometries[i]}>
                <meshStandardMaterial color={fillColor} metalness={material.metalness} roughness={material.roughness} />
              </mesh>
              {/* Keyed on the color it renders: switching themes live changes
                  this color in place on an existing troika-three-text
                  instance, which can leave its SDF glyph render stuck blank
                  instead of redrawing — see NumberDrum.tsx's identical fix. */}
              <Text
                key={`${i}-${material.glowColor}`}
                position={[textRadius * Math.cos(mathAngle), textRadius * Math.sin(mathAngle), WEDGE_THICKNESS + 0.01]}
                rotation={[0, 0, -textAngle]}
                fontSize={0.14}
                color={material.glowColor}
                anchorX="center"
                anchorY="middle"
                font={DRUM_FONT_URL}
              >
                {truncateLabel(players[i] ?? '')}
              </Text>
            </group>
          );
        })}
      </group>

      {/* Hub: sits in front of the wedges, covering their inner point. */}
      <mesh position={[0, 0, WEDGE_THICKNESS + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[HUB_RADIUS, HUB_RADIUS, HUB_HEIGHT, 24]} />
        <meshStandardMaterial
          color={material.baseColor}
          metalness={Math.min(1, material.metalness + 0.3)}
          roughness={Math.max(0.1, material.roughness - 0.1)}
        />
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
git add frontend/src/three/scenes/PlayerWheelScene.tsx
git commit -m "feat: add realistic 3D player wheel scene"
```

---

### Task 3: Integrate `PlayerWheelScene` into `TruthOrDareSolo.tsx`

**Files:**
- Modify: `frontend/src/games/solo/TruthOrDareSolo.tsx`

**Interfaces:**
- Consumes: `PlayerWheelScene` (Task 2); `GameCanvas`, `getThemeMaterial`, `useAdaptiveQuality`, `useTheme` (all already imported in this file from the earlier card-flip integration — see Global Constraints).

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/solo/TruthOrDareSolo.tsx` in full. `theme`, `quality`, `GameCanvas` (lazy), `getThemeMaterial`, and `Suspense` are already present (used by the existing `CardFlipScene` integration) — only a new lazy import and the wheel render block change.

- [ ] **Step 2: Add the lazy import**

Add alongside the existing `CardFlipScene` lazy import:

```tsx
const PlayerWheelScene = lazy(() => import('@/three/scenes/PlayerWheelScene').then(m => ({ default: m.PlayerWheelScene })));
```

- [ ] **Step 3: Replace the wheel render block**

Replace:
```tsx
      {phase === 'spinning' || phase === 'landed' ? (
        <PlayerWheel
          players={[PLAYER_NAME]}
          landedOn={PLAYER_NAME}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : null}
```

With:
```tsx
      {(phase === 'spinning' || phase === 'landed') && quality === 'fallback2d' ? (
        <PlayerWheel
          players={[PLAYER_NAME]}
          landedOn={PLAYER_NAME}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : phase === 'spinning' || phase === 'landed' ? (
        <div className="relative -mx-4 aspect-square w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[24rem] sm:w-full">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <PlayerWheelScene
                players={[PLAYER_NAME]}
                landedOn={PLAYER_NAME}
                spinning={phase === 'spinning'}
                onSpinComplete={handleSpinComplete}
                material={getThemeMaterial(theme)}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : null}
```

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass (this file's category/spin logic is untouched).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/solo/TruthOrDareSolo.tsx
git commit -m "feat: mount the 3D player wheel in Truth or Dare solo with 2D fallback"
```

---

### Task 4: Integrate `PlayerWheelScene` into `TruthOrDareMultiplayer.tsx`

**Files:**
- Modify: `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx`

**Interfaces:**
- Consumes: same as Task 3.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx` in full. `theme`, `quality`, `GameCanvas` (lazy), `getThemeMaterial`, and `Suspense` are already present (used by the existing `BadgeBurstScene` result-step integration) — only a new lazy import and the wheel render block change. Note the reveal condition here is `phase === 'spinning' || (phase === 'choosing' && activePlayerName)`, not `phase === 'spinning' || phase === 'landed'` as in the solo version — this file has no separate `'landed'` phase; the wheel keeps showing through the start of `'choosing'` until the active player has made their choice UI appear.

- [ ] **Step 2: Add the lazy import**

Add alongside the existing `BadgeBurstScene` lazy import:

```tsx
const PlayerWheelScene = lazy(() => import('@/three/scenes/PlayerWheelScene').then(m => ({ default: m.PlayerWheelScene })));
```

- [ ] **Step 3: Replace the wheel render block**

Replace:
```tsx
      {(phase === 'spinning' || (phase === 'choosing' && activePlayerName)) ? (
        <PlayerWheel
          players={players.map(player => player.name)}
          landedOn={activePlayerName ?? ''}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : null}
```

With:
```tsx
      {(phase === 'spinning' || (phase === 'choosing' && activePlayerName)) && quality === 'fallback2d' ? (
        <PlayerWheel
          players={players.map(player => player.name)}
          landedOn={activePlayerName ?? ''}
          spinning={phase === 'spinning'}
          onSpinComplete={handleSpinComplete}
        />
      ) : phase === 'spinning' || (phase === 'choosing' && activePlayerName) ? (
        <div className="relative -mx-4 aspect-square w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-muted sm:mx-0 sm:aspect-auto sm:h-[24rem] sm:w-full">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <PlayerWheelScene
                players={players.map(player => player.name)}
                landedOn={activePlayerName ?? ''}
                spinning={phase === 'spinning'}
                onSpinComplete={handleSpinComplete}
                material={getThemeMaterial(theme)}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : null}
```

- [ ] **Step 4: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass; socket logic untouched.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/games/multiplayer/TruthOrDareMultiplayer.tsx
git commit -m "feat: mount the 3D player wheel in Truth or Dare multiplayer with 2D fallback"
```

---

### Task 5: Manual verification in the browser

**Files:** none — verification only.

- [ ] **Step 1: Solo mode**

Run `cd frontend && npm run dev`. Open Truth or Dare solo, spin the wheel, confirm: the 3D wheel appears (metallic rim, beveled single wedge since there's only one player), spins smoothly, decelerates, and lands — `onSpinComplete` fires correctly (the truth/dare choice buttons appear after landing, exactly as with the 2D wheel today).

- [ ] **Step 2: Multiplayer mode**

Open two sessions in the same room. Start a round, confirm: the wheel shows one wedge per player with correct, readable names, spins, and lands with the correct player's wedge under the pointer — cross-check the wedge that visually stops at the pointer against the "your turn" / "waiting for X" text that appears afterward; they must always agree (this is the one correctness property Task 1's tests establish mathematically — confirm it holds visually too).

- [ ] **Step 3: Theme spot-check**

Switch through at least 2 of the 4 themes (including at least one dark theme — sombre or luxueux) while the wheel is visible or mid-spin. Confirm: rim/hub color and metalness read differently per theme, wedge text stays legible and doesn't go blank (this exercises the same live-theme-switch text bug fixed in `NumberDrum.tsx` this session — confirm the fix pattern used here works too), and text orientation on each wedge is readable (not upside-down or excessively skewed) at the tilted camera angle.

- [ ] **Step 4: Fallback verification**

Throttle CPU heavily (DevTools Performance tab → CPU 6x slowdown) and confirm both solo and multiplayer fall back to the 2D SVG `PlayerWheel` without breaking the spin → land → choose flow.

---

## Self-Review Notes

- **Spec coverage:** the design spec (`docs/superpowers/specs/2026-08-04-3d-player-wheel-design.md`) calls for a procedural wheel (Tasks 1-2), theme-driven materials via `getThemeMaterial` (Task 2), a scene-local ~35° camera tilt (Task 2's `WheelCamera`), `drei` `Text` mounted on rotating wedges with the theme-color-key robustness fix (Task 2), unchanged `fallback2d` behavior and mobile-bled sizing (Tasks 3-4), and manual verification across both modes/themes/fallback (Task 5) — every section of the spec has a corresponding task.
- **Type consistency:** `PlayerWheelScene`'s prop shape (`players`, `landedOn`, `spinning`, `onSpinComplete`, `material`) is defined once in Task 2 and consumed identically in Tasks 3-4. The angle convention (`wedgeCenterAngle`, clockwise-from-up radians) is defined once in Task 1 and is the only angle formula Task 2's geometry code uses — no second, independently-derived angle formula exists anywhere in the plan, which is what guarantees the visual wedge layout and the landing-rotation math can't drift out of sync (the exact class of bug — inconsistent rotation conventions between two independently-written pieces of code — that required rework twice earlier in this project's Odd or Even sub-project).
- **No placeholders:** every task has complete, runnable code; Task 2 (WebGL) is explicitly marked as manually verified in Task 5 rather than unit tested, consistent with this project's established convention for every other 3D scene.

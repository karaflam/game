# Odd or Even 3D Number Drum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `NumberTokenPicker` (number selection) and `FlipReveal` (result reveal) in Pair ou Impair — solo and multiplayer — with a 3D number drum: a draggable cylinder of 9 faces for choosing your own number, and a masked/rolling drum for the opponent's/machine's number, separated by a floating 3D "+" and followed by a floating 3D result plate (sum + parity), all with automatic fallback to the existing 2D components.

**Architecture:** Reuses every foundation from the RPS sub-projects (`GameCanvas`, `getThemeMaterial`, `useAdaptiveQuality`, the lazy-loading + Suspense pattern) unmodified. Adds a new self-contained scene family under `frontend/src/three/scenes/`: pure rotation/timeline math (Vitest-tested) plus WebGL components (`NumberDrum`, `PlusSymbol3D`, `SumPlate3D`, `OddOrEvenDuelScene`) that are not unit-tested (WebGL, per the established project convention) but verified manually in the browser.

**Tech Stack:** React 18, TypeScript, `three`, `@react-three/fiber@^8.18.0`, `@react-three/drei@^9.122.0` (already installed — including `drei`'s `Text` component for in-scene digits, no new dependency). No physics engine — the "roll" is a controlled rotation animation, not a physics simulation (see the revised design spec, `docs/superpowers/specs/2026-08-03-3d-animations-odd-or-even-dice-design.md`).

## Global Constraints

- Numbers range 1-9 (`frontend/src/lib/oddOrEvenLogic.ts`'s `pickRandomNumber`) — the drum has exactly 9 faces, no more, no less.
- **The opponent's/machine's number must never be visible before the round result arrives.** The opponent drum's faces show `?` (not digits, not blank) until the exact moment the round data is known, at which point the faces are replaced with real digits and the drum then visibly spins before settling — never an instant pop-in of the correct face.
- Your own number (already chosen) is always visible on your own drum — no masking, no roll, just a direct display.
- `quality === 'fallback2d'` must produce pixel-identical behavior to today: `NumberTokenPicker` for selection, `FlipReveal` for the reveal — in both `OddOrEvenSolo.tsx` and `OddOrEvenMultiplayer.tsx`.
- The parity prediction buttons (pair/impair) stay exactly as they are today (plain 2D `Button` components) — only the number picker and the reveal change.
- Pure logic (angle↔face-index conversion, roll timeline) lives in plain `.ts` files under `frontend/src/three/scenes/` and is unit tested with Vitest. WebGL components are not unit tested — each such task ends with a note to verify manually in the browser instead.
- Follow the existing `@/*` → `frontend/src/*` import alias convention.

---

### Task 1: Drum face math (angle ↔ face index, drag sensitivity)

**Files:**
- Create: `frontend/src/three/scenes/drumMath.ts`
- Test: `frontend/src/three/scenes/drumMath.test.ts`

**Interfaces:**
- Produces: `FACE_COUNT = 9`, `FACE_STEP = (2 * Math.PI) / FACE_COUNT`, `function angleToFaceIndex(angleRadians: number): number` (0-8, nearest face for a given rotation angle), `function faceIndexToAngle(faceIndex: number): number` (the rotation angle that brings that face to the front), `function normalizeAngle(angleRadians: number): number` (wraps to `[0, 2π)`). Used by Task 3 (`NumberDrum`) and Task 2 (`rollTimeline`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/scenes/drumMath.test.ts
import { describe, expect, it } from 'vitest';
import { FACE_COUNT, FACE_STEP, angleToFaceIndex, faceIndexToAngle, normalizeAngle } from './drumMath';

describe('drumMath', () => {
  it('has 9 faces, one per number 1-9', () => {
    expect(FACE_COUNT).toBe(9);
    expect(FACE_STEP).toBeCloseTo((2 * Math.PI) / 9, 10);
  });

  it('normalizeAngle wraps negative and large angles into [0, 2π)', () => {
    expect(normalizeAngle(-FACE_STEP)).toBeCloseTo(2 * Math.PI - FACE_STEP, 10);
    expect(normalizeAngle(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 10);
    expect(normalizeAngle(0)).toBeCloseTo(0, 10);
  });

  it('faceIndexToAngle and angleToFaceIndex round-trip for every face', () => {
    for (let i = 0; i < FACE_COUNT; i++) {
      expect(angleToFaceIndex(faceIndexToAngle(i))).toBe(i);
    }
  });

  it('angleToFaceIndex snaps to the nearest face, not just floor', () => {
    // Slightly past face 3's angle should still snap to 3, not roll over to 4.
    expect(angleToFaceIndex(faceIndexToAngle(3) + FACE_STEP * 0.4)).toBe(3);
    // Slightly before face 3's angle should also snap to 3.
    expect(angleToFaceIndex(faceIndexToAngle(3) - FACE_STEP * 0.4)).toBe(3);
  });

  it('angleToFaceIndex wraps around at the 8→0 boundary', () => {
    expect(angleToFaceIndex(faceIndexToAngle(8) + FACE_STEP * 0.6)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/scenes/drumMath.test.ts`
Expected: FAIL with "Cannot find module './drumMath'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/scenes/drumMath.ts
export const FACE_COUNT = 9;
export const FACE_STEP = (2 * Math.PI) / FACE_COUNT;

export function normalizeAngle(angleRadians: number): number {
  const twoPi = 2 * Math.PI;
  return ((angleRadians % twoPi) + twoPi) % twoPi;
}

export function faceIndexToAngle(faceIndex: number): number {
  return faceIndex * FACE_STEP;
}

export function angleToFaceIndex(angleRadians: number): number {
  const normalized = normalizeAngle(angleRadians);
  const index = Math.round(normalized / FACE_STEP) % FACE_COUNT;
  return index;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/scenes/drumMath.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/scenes/drumMath.ts frontend/src/three/scenes/drumMath.test.ts
git commit -m "feat: add number drum face/angle math"
```

---

### Task 2: Roll timeline (opponent drum's spin-then-settle animation)

**Files:**
- Create: `frontend/src/three/scenes/rollTimeline.ts`
- Test: `frontend/src/three/scenes/rollTimeline.test.ts`

**Interfaces:**
- Consumes: `FACE_STEP`, `faceIndexToAngle` from `./drumMath` (Task 1).
- Produces: `ROLL_DURATION_MS = 1100`, `function getRollAngle(elapsedMs: number, targetFaceIndex: number, extraTurns?: number): number` — returns the drum's rotation angle at a given elapsed time, starting at 0 and ending exactly at `faceIndexToAngle(targetFaceIndex)` plus `extraTurns` full rotations (default 3) added at the start and eased out by the end, `function isRollSettled(elapsedMs: number): boolean` (`elapsedMs >= ROLL_DURATION_MS`). Used by Task 3 (`NumberDrum`) and Task 5 (`OddOrEvenDuelScene`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/three/scenes/rollTimeline.test.ts
import { describe, expect, it } from 'vitest';
import { faceIndexToAngle } from './drumMath';
import { ROLL_DURATION_MS, getRollAngle, isRollSettled } from './rollTimeline';

describe('rollTimeline', () => {
  it('starts at angle 0', () => {
    expect(getRollAngle(0, 4)).toBeCloseTo(0, 5);
  });

  it('ends exactly on the target face angle plus full turns, at the full duration', () => {
    const targetFace = 4;
    const finalAngle = getRollAngle(ROLL_DURATION_MS, targetFace, 3);
    const expected = faceIndexToAngle(targetFace) + 3 * 2 * Math.PI;
    expect(finalAngle).toBeCloseTo(expected, 5);
  });

  it('is monotonically increasing (the drum never spins backward)', () => {
    const targetFace = 2;
    let previous = getRollAngle(0, targetFace);
    for (let t = 50; t <= ROLL_DURATION_MS; t += 50) {
      const current = getRollAngle(t, targetFace);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('decelerates toward the end (later equal time-steps cover less angle)', () => {
    const targetFace = 6;
    const early = getRollAngle(200, targetFace) - getRollAngle(100, targetFace);
    const late = getRollAngle(ROLL_DURATION_MS, targetFace) - getRollAngle(ROLL_DURATION_MS - 100, targetFace);
    expect(late).toBeLessThan(early);
  });

  it('isRollSettled is false before the duration and true at/after it', () => {
    expect(isRollSettled(ROLL_DURATION_MS - 1)).toBe(false);
    expect(isRollSettled(ROLL_DURATION_MS)).toBe(true);
    expect(isRollSettled(ROLL_DURATION_MS + 500)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/three/scenes/rollTimeline.test.ts`
Expected: FAIL with "Cannot find module './rollTimeline'"

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/three/scenes/rollTimeline.ts
import { faceIndexToAngle } from './drumMath';

export const ROLL_DURATION_MS = 1100;
const DEFAULT_EXTRA_TURNS = 3;

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export function getRollAngle(elapsedMs: number, targetFaceIndex: number, extraTurns: number = DEFAULT_EXTRA_TURNS): number {
  const t = Math.min(Math.max(elapsedMs / ROLL_DURATION_MS, 0), 1);
  const eased = easeOutCubic(t);
  const totalAngle = extraTurns * 2 * Math.PI + faceIndexToAngle(targetFaceIndex);
  return totalAngle * eased;
}

export function isRollSettled(elapsedMs: number): boolean {
  return elapsedMs >= ROLL_DURATION_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/three/scenes/rollTimeline.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/three/scenes/rollTimeline.ts frontend/src/three/scenes/rollTimeline.test.ts
git commit -m "feat: add opponent drum roll timeline (spin-then-settle easing)"
```

---

### Task 3: `NumberDrum` component (interactive selection + masked/rolling result modes)

**Files:**
- Create: `frontend/src/three/scenes/NumberDrum.tsx`

**Interfaces:**
- Consumes: `FACE_COUNT`, `angleToFaceIndex`, `faceIndexToAngle` from `./drumMath` (Task 1); `getRollAngle`, `isRollSettled`, `ROLL_DURATION_MS` from `./rollTimeline` (Task 2); `ThemeMaterial` from `../themeMaterials`.
- Produces:
  ```tsx
  type NumberDrumMode =
    | { kind: 'interactive'; value: number; onChange: (value: number) => void }
    | { kind: 'masked' }
    | { kind: 'rolling'; targetValue: number; elapsedMs: number }
    | { kind: 'settled'; value: number };

  function NumberDrum(props: { mode: NumberDrumMode; material: ThemeMaterial; position: [number, number, number] }): JSX.Element
  ```
  Used by Task 6 and Task 7 (the game integrations) directly, and orchestrated by Task 5 (`OddOrEvenDuelScene`) for the result side.

No automated test — WebGL component with pointer interaction, not unit-testable in this project's setup (see Global Constraints). Verified manually in Task 8.

- [ ] **Step 1: Write the implementation**

```tsx
// frontend/src/three/scenes/NumberDrum.tsx
import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { FACE_COUNT, angleToFaceIndex, faceIndexToAngle } from './drumMath';
import { getRollAngle, isRollSettled } from './rollTimeline';
import type { ThemeMaterial } from '../themeMaterials';

export type NumberDrumMode =
  | { kind: 'interactive'; value: number; onChange: (value: number) => void }
  | { kind: 'masked' }
  | { kind: 'rolling'; targetValue: number; elapsedMs: number }
  | { kind: 'settled'; value: number };

type NumberDrumProps = {
  mode: NumberDrumMode;
  material: ThemeMaterial;
  position: [number, number, number];
};

const DRUM_RADIUS = 0.55;
const FACE_WIDTH = 0.5;
const FACE_HEIGHT = 0.32;
const DRAG_SENSITIVITY = 0.012; // radians per pixel of horizontal drag

function faceLabel(mode: NumberDrumMode, faceIndexZeroBased: number): string {
  if (mode.kind === 'masked') return '?';
  if (mode.kind === 'rolling') return String(faceIndexZeroBased + 1);
  return String(faceIndexZeroBased + 1);
}

export function NumberDrum({ mode, material, position }: NumberDrumProps) {
  const drumRef = useRef<THREE.Group>(null);
  const dragStateRef = useRef<{ dragging: boolean; lastX: number; angle: number }>({
    dragging: false,
    lastX: 0,
    angle: mode.kind === 'interactive' ? faceIndexToAngle(mode.value - 1) : 0
  });

  useFrame(() => {
    const drum = drumRef.current;
    if (!drum) return;

    if (mode.kind === 'rolling') {
      drum.rotation.x = getRollAngle(mode.elapsedMs, mode.targetValue - 1);
    } else if (mode.kind === 'settled') {
      drum.rotation.x = faceIndexToAngle(mode.value - 1);
    } else if (mode.kind === 'masked') {
      drum.rotation.x = 0;
    } else {
      drum.rotation.x = dragStateRef.current.angle;
    }
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (mode.kind !== 'interactive') return;
    dragStateRef.current.dragging = true;
    dragStateRef.current.lastX = event.clientX;
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (mode.kind !== 'interactive' || !dragStateRef.current.dragging) return;
    const dx = event.clientX - dragStateRef.current.lastX;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.angle += dx * DRAG_SENSITIVITY;
    // No re-render needed here: useFrame reads dragStateRef.current.angle every
    // frame and applies it directly to the mesh, so rotation stays smooth without
    // React state churn on every pointer-move event.
  };

  const handlePointerUp = () => {
    if (mode.kind !== 'interactive') return;
    dragStateRef.current.dragging = false;
    const snappedFace = angleToFaceIndex(dragStateRef.current.angle);
    dragStateRef.current.angle = faceIndexToAngle(snappedFace);
    mode.onChange(snappedFace + 1);
  };

  const isMasked = mode.kind === 'masked';

  return (
    <group position={position}>
      <group
        ref={drumRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {Array.from({ length: FACE_COUNT }).map((_, i) => (
          <group key={i} rotation={[i * ((2 * Math.PI) / FACE_COUNT), 0, 0]}>
            <mesh position={[0, 0, DRUM_RADIUS]}>
              <planeGeometry args={[FACE_WIDTH, FACE_HEIGHT]} />
              <meshStandardMaterial
                color={isMasked ? '#1a1a2444' : material.baseColor}
                emissive={isMasked ? '#000000' : material.emissive}
                metalness={material.metalness}
                roughness={material.roughness}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Text
              position={[0, 0, DRUM_RADIUS + 0.01]}
              fontSize={0.22}
              color={isMasked ? '#5b5f72' : material.glowColor}
              anchorX="center"
              anchorY="middle"
            >
              {faceLabel(mode, i)}
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}
```

**Note on the masked mode:** every face still shows `?` (via `faceLabel`), never a digit — this satisfies the Global Constraint that the opponent's number is never visible before the reveal. The `rolling`/`settled` modes always show real digits (1-9) on every face, since by the time either mode is active the round result is already known and being revealed.

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/three/scenes/NumberDrum.tsx
git commit -m "feat: add interactive/masked/rolling NumberDrum component"
```

---

### Task 4: `PlusSymbol3D` and `SumPlate3D`

**Files:**
- Create: `frontend/src/three/scenes/PlusSymbol3D.tsx`
- Create: `frontend/src/three/scenes/SumPlate3D.tsx`

**Interfaces:**
- Produces: `function PlusSymbol3D(props: { material: ThemeMaterial; position: [number, number, number] }): JSX.Element` and `function SumPlate3D(props: { sum: number; parityLabel: string; outcomeLabel: string; material: ThemeMaterial; position: [number, number, number]; visible: boolean }): JSX.Element`. Used by Task 5 (`OddOrEvenDuelScene`).

No automated test — WebGL components, verified manually in Task 8.

- [ ] **Step 1: Write `PlusSymbol3D`**

```tsx
// frontend/src/three/scenes/PlusSymbol3D.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ThemeMaterial } from '../themeMaterials';

type PlusSymbol3DProps = {
  material: ThemeMaterial;
  position: [number, number, number];
};

export function PlusSymbol3D({ material, position }: PlusSymbol3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();
    group.position.y = position[1] + Math.sin(t * 1.4) * 0.06;
    group.rotation.y = Math.sin(t * 0.6) * Math.PI;
    group.rotation.x = Math.sin(t * 0.4) * 0.15;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <boxGeometry args={[0.34, 0.1, 0.1]} />
        <meshStandardMaterial color={material.glowColor} emissive={material.emissive} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.1, 0.34, 0.1]} />
        <meshStandardMaterial color={material.glowColor} emissive={material.emissive} metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Write `SumPlate3D`**

```tsx
// frontend/src/three/scenes/SumPlate3D.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ThemeMaterial } from '../themeMaterials';

type SumPlate3DProps = {
  sum: number;
  parityLabel: string;
  outcomeLabel: string;
  material: ThemeMaterial;
  position: [number, number, number];
  visible: boolean;
};

export function SumPlate3D({ sum, parityLabel, outcomeLabel, material, position, visible }: SumPlate3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();
    group.position.y = position[1] + Math.sin(t * 1.1) * 0.05;
    group.scale.setScalar(visible ? 1 : 0.001);
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <planeGeometry args={[1.6, 0.6]} />
        <meshStandardMaterial
          color={material.baseColor}
          emissive={material.emissive}
          metalness={material.metalness}
          roughness={material.roughness}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
        />
      </mesh>
      <Text position={[0, 0.12, 0.01]} fontSize={0.16} color={material.glowColor} anchorX="center" anchorY="middle">
        {`${sum} — ${parityLabel}`}
      </Text>
      <Text position={[0, -0.14, 0.01]} fontSize={0.13} color={material.glowColor} anchorX="center" anchorY="middle">
        {outcomeLabel}
      </Text>
    </group>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/three/scenes/PlusSymbol3D.tsx frontend/src/three/scenes/SumPlate3D.tsx
git commit -m "feat: add floating plus-symbol and result-plate 3D components"
```

---

### Task 5: `OddOrEvenDuelScene` orchestration

**Files:**
- Create: `frontend/src/three/scenes/OddOrEvenDuelScene.tsx`

**Interfaces:**
- Consumes: `NumberDrum` + `NumberDrumMode` (Task 3), `PlusSymbol3D` (Task 4), `SumPlate3D` (Task 4), `ROLL_DURATION_MS` (Task 2), `ThemeMaterial` (`../themeMaterials`).
- Produces:
  ```tsx
  type OddOrEvenRound = {
    yourValue: number;
    opponentValue: number;
    sum: number;
    parityLabel: string;
    outcomeLabel: string;
  } | null;

  function OddOrEvenDuelScene(props: {
    round: OddOrEvenRound;
    material: ThemeMaterial;
    onComplete: () => void;
  }): JSX.Element
  ```
  Used by Task 6 (`OddOrEvenSolo.tsx`) and Task 7 (`OddOrEvenMultiplayer.tsx`) — the `round` prop's field names (`yourValue`/`opponentValue`) are deliberately generic so both games can map their own round-data shape onto it without new types.

No automated test — WebGL orchestration component, verified manually in Task 8. Uses `useFrame`'s own delta-time accumulation (not `setTimeout`), the same pattern already established and reviewed in `HandDuelScene.tsx` from the RPS sub-project — read that file for the accumulation pattern before writing this one.

- [ ] **Step 1: Write the implementation**

```tsx
// frontend/src/three/scenes/OddOrEvenDuelScene.tsx
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { NumberDrum } from './NumberDrum';
import { PlusSymbol3D } from './PlusSymbol3D';
import { SumPlate3D } from './SumPlate3D';
import { isRollSettled, ROLL_DURATION_MS } from './rollTimeline';
import type { ThemeMaterial } from '../themeMaterials';

export type OddOrEvenRound = {
  yourValue: number;
  opponentValue: number;
  sum: number;
  parityLabel: string;
  outcomeLabel: string;
} | null;

type OddOrEvenDuelSceneProps = {
  round: OddOrEvenRound;
  material: ThemeMaterial;
  onComplete: () => void;
};

const PLATE_DELAY_MS = ROLL_DURATION_MS + 200;
const TOTAL_DURATION_MS = PLATE_DELAY_MS + 1400;

export function OddOrEvenDuelScene({ round, material, onComplete }: OddOrEvenDuelSceneProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    setElapsedMs(0);
  }, [round]);

  useFrame((_, delta) => {
    if (!round || completedRef.current) return;
    setElapsedMs(prev => {
      const next = prev + delta * 1000;
      if (next >= TOTAL_DURATION_MS && !completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return next;
    });
  });

  if (!round) {
    return (
      <group>
        <NumberDrum mode={{ kind: 'masked' }} material={material} position={[-1, 0, 0]} />
        <PlusSymbol3D material={material} position={[0, 0, 0]} />
        <NumberDrum mode={{ kind: 'masked' }} material={material} position={[1, 0, 0]} />
      </group>
    );
  }

  const opponentSettled = isRollSettled(elapsedMs);
  const opponentMode = opponentSettled
    ? ({ kind: 'settled', value: round.opponentValue } as const)
    : ({ kind: 'rolling', targetValue: round.opponentValue, elapsedMs } as const);

  return (
    <group>
      <NumberDrum mode={{ kind: 'settled', value: round.yourValue }} material={material} position={[-1, 0, 0]} />
      <PlusSymbol3D material={material} position={[0, 0, 0]} />
      <NumberDrum mode={opponentMode} material={material} position={[1, 0, 0]} />
      <SumPlate3D
        sum={round.sum}
        parityLabel={round.parityLabel}
        outcomeLabel={round.outcomeLabel}
        material={material}
        position={[0, -0.9, 0]}
        visible={elapsedMs >= PLATE_DELAY_MS}
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
git add frontend/src/three/scenes/OddOrEvenDuelScene.tsx
git commit -m "feat: add odd-or-even duel scene orchestration"
```

---

### Task 6: Integrate into `OddOrEvenSolo.tsx`

**Files:**
- Modify: `frontend/src/games/solo/OddOrEvenSolo.tsx`

**Interfaces:**
- Consumes: `NumberDrum`/`NumberDrumMode` (Task 3), `OddOrEvenDuelScene`/`OddOrEvenRound` (Task 5), `GameCanvas` (`@/three/GameCanvas`), `getThemeMaterial` (`@/three/themeMaterials`), `useAdaptiveQuality` (`@/three/useAdaptiveQuality`), `useTheme` (`@/hooks/useTheme`), `getParity` (existing, `@/lib/oddOrEvenLogic`).

- [ ] **Step 1: Read the current file and the RPS solo reference**

Read `frontend/src/games/solo/OddOrEvenSolo.tsx` in full (reproduced in this plan's spec section above — re-read the live file for exact current line numbers before editing). Read `frontend/src/games/solo/RpsSolo.tsx` for the lazy-loading + `Suspense` + quality-branch + idle-scene pattern to replicate.

- [ ] **Step 2: Add imports, lazy components, and hooks**

Add to the top of the file, merging with existing imports, following the exact `RpsSolo.tsx` pattern:

```tsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
import { NumberDrum } from '@/three/scenes/NumberDrum';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const OddOrEvenDuelScene = lazy(() =>
  import('@/three/scenes/OddOrEvenDuelScene').then(m => ({ default: m.OddOrEvenDuelScene }))
);
```

`NumberDrum` is imported eagerly (not lazily) because it's needed immediately for number selection, before any round exists — unlike `HandDuelScene`/`GameCanvas` which only matter once 3D is confirmed available. However, `NumberDrum` itself must still render inside a `<GameCanvas>` (it's a Three.js component, not plain HTML), so the selection UI's 3D drum is also gated behind the lazy `GameCanvas` load — see Step 4.

Inside the component body:

```tsx
const { theme } = useTheme();
const quality = useAdaptiveQuality();
```

- [ ] **Step 3: Add `isolate` to the root container**

Change `<div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">` to `<div className="relative isolate space-y-6 rounded-3xl border border-border bg-background p-8">` (matching the fix already applied to the RPS games).

- [ ] **Step 4: Replace `NumberTokenPicker` with the 3D drum when quality allows, keep the 2D picker as fallback**

Replace:
```tsx
          <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={isMatchOver} />
```

With:
```tsx
          {quality === 'fallback2d' ? (
            <NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={isMatchOver} />
          ) : (
            <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-muted">
              <Suspense fallback={null}>
                <GameCanvas theme={theme} quality={quality}>
                  <NumberDrum
                    mode={{ kind: 'interactive', value: playerNumber, onChange: setPlayerNumber }}
                    material={getThemeMaterial(theme)}
                    position={[0, 0, 0]}
                  />
                </GameCanvas>
              </Suspense>
            </div>
          )}
```

- [ ] **Step 5: Branch the reveal block on quality**

Replace:
```tsx
      {round ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.playerNumber, highlight: round.outcome === 'player' },
            { id: 'machine', content: round.machineNumber, highlight: round.outcome === 'machine' }
          ]}
          outcomeLabel={t('solo.oddOrEven.sumLabel', {
            sum: round.playerNumber + round.machineNumber,
            parity: getParity(round.playerNumber + round.machineNumber)
          })}
          onComplete={handleRevealComplete}
        />
      ) : (
```

With:
```tsx
      {round && quality === 'fallback2d' ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.playerNumber, highlight: round.outcome === 'player' },
            { id: 'machine', content: round.machineNumber, highlight: round.outcome === 'machine' }
          ]}
          outcomeLabel={t('solo.oddOrEven.sumLabel', {
            sum: round.playerNumber + round.machineNumber,
            parity: getParity(round.playerNumber + round.machineNumber)
          })}
          onComplete={handleRevealComplete}
        />
      ) : round ? (
        <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-muted">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <OddOrEvenDuelScene
                round={{
                  yourValue: round.playerNumber,
                  opponentValue: round.machineNumber,
                  sum: round.playerNumber + round.machineNumber,
                  parityLabel:
                    getParity(round.playerNumber + round.machineNumber) === 'pair' ? t('solo.oddOrEven.even') : t('solo.oddOrEven.odd'),
                  outcomeLabel: round.outcome === 'player' ? t('solo.oddOrEven.outcomeWin') : t('solo.oddOrEven.outcomeLose')
                }}
                material={getThemeMaterial(theme)}
                onComplete={handleRevealComplete}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : (
```

The trailing `) : (` matches the existing idle-state JSX already in the file — only the reveal branch's content changes.

- [ ] **Step 6: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass (this file's game logic in `oddOrEvenLogic.ts` is untouched, so its existing tests are unaffected).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/games/solo/OddOrEvenSolo.tsx
git commit -m "feat: mount the 3D number drum in Odd or Even solo with 2D fallback"
```

---

### Task 7: Integrate into `OddOrEvenMultiplayer.tsx`

**Files:**
- Modify: `frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx`

**Interfaces:**
- Consumes: same as Task 6.

- [ ] **Step 1: Read the current file**

Read `frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx` in full (reproduced in this plan's spec section above — re-read the live file for exact current structure before editing). Note this file's round shape differs from solo's: `{ yourValue, yourPrediction, opponentValue, opponentPrediction, sum, parity, outcome, bothCorrect }` — both players choose their own number and prediction; neither is a "random machine roll." The opponent's number is still masked until the round result arrives (same UX requirement), even though it isn't randomly generated — it's simply hidden from you until both players have played, exactly like the opponent's move in RPS multiplayer.

- [ ] **Step 2: Add imports, lazy components, and hooks**

Same as Task 6, Step 2 — merge into this file's existing imports:

```tsx
import { lazy, Suspense } from 'react';
import { getThemeMaterial } from '@/three/themeMaterials';
import { useAdaptiveQuality } from '@/three/useAdaptiveQuality';
import useTheme from '@/hooks/useTheme';
import { NumberDrum } from '@/three/scenes/NumberDrum';

const GameCanvas = lazy(() => import('@/three/GameCanvas').then(m => ({ default: m.GameCanvas })));
const OddOrEvenDuelScene = lazy(() =>
  import('@/three/scenes/OddOrEvenDuelScene').then(m => ({ default: m.OddOrEvenDuelScene }))
);
```

Inside the component body:
```tsx
const { theme } = useTheme();
const quality = useAdaptiveQuality();
```

- [ ] **Step 3: Add `isolate` to the root container**

Same as Task 6, Step 3, applied to this file's root `<div>`.

- [ ] **Step 4: Replace `NumberTokenPicker` with the 3D drum**

Same pattern as Task 6, Step 4 — replace the `<NumberTokenPicker value={playerNumber} onChange={setPlayerNumber} disabled={waiting || matchOver} />` line with the same quality-branched block, using `disabled={waiting || matchOver}` as the condition gating interactivity (note: `NumberDrumMode`'s `interactive` variant doesn't have a `disabled` field in Task 3's interface — for this task, when `waiting || matchOver` is true, pass `mode={{ kind: 'settled', value: playerNumber }}` instead of `interactive`, so the drum simply stops accepting drag input by construction rather than needing a new disabled flag on the component).

- [ ] **Step 5: Branch the reveal block on quality, mapping this file's round shape**

Replace the `round ? <FlipReveal ... /> : (` block with the quality-branched version, following Task 6 Step 5's structure exactly, but mapping fields from this file's `RoundResult` type:

```tsx
      {round && quality === 'fallback2d' ? (
        <FlipReveal
          cards={[
            { id: 'player', content: round.yourValue, highlight: round.outcome === 'player' },
            { id: 'opponent', content: round.opponentValue, highlight: round.outcome === 'machine' || round.bothCorrect }
          ]}
          outcomeLabel={
            round.bothCorrect
              ? t('multiplayer.oddOrEven.outcomeBothRight', { sum: round.sum, parity: round.parity })
              : t('multiplayer.oddOrEven.outcome', { sum: round.sum, parity: round.parity })
          }
          onComplete={handleRevealComplete}
        />
      ) : round ? (
        <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-muted">
          <Suspense fallback={null}>
            <GameCanvas theme={theme} quality={quality}>
              <OddOrEvenDuelScene
                round={{
                  yourValue: round.yourValue,
                  opponentValue: round.opponentValue,
                  sum: round.sum,
                  parityLabel: round.parity === 'pair' ? t('solo.oddOrEven.even') : t('solo.oddOrEven.odd'),
                  outcomeLabel: round.bothCorrect
                    ? t('multiplayer.oddOrEven.outcomeBothRight', { sum: round.sum, parity: round.parity })
                    : t('multiplayer.oddOrEven.outcome', { sum: round.sum, parity: round.parity })
                }}
                material={getThemeMaterial(theme)}
                onComplete={handleRevealComplete}
              />
            </GameCanvas>
          </Suspense>
        </div>
      ) : (
```

- [ ] **Step 6: Compile and run the full test suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no TypeScript errors; all tests pass (socket/score logic untouched).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/games/multiplayer/OddOrEvenMultiplayer.tsx
git commit -m "feat: mount the 3D number drum in Odd or Even multiplayer with 2D fallback"
```

---

### Task 8: Manual verification in the browser

**Files:** none — verification only.

- [ ] **Step 1: Solo verification**

Run `cd frontend && npm run dev`, open the Odd or Even solo page. In at least 2 of the 4 themes:
- Drag the 3D drum left/right and confirm it snaps to a specific number (1-9) that updates the underlying selection (check that the parity prediction + play button still work with whatever number the drum settles on).
- Play a round and confirm: your number displays immediately and correctly on your drum; the opponent/machine drum shows `?` on every face until your number is confirmed, then its faces switch to real digits and the drum visibly spins for about a second before stopping on the actual machine number; the floating "+" idles continuously between the two drums; the result plate (sum + parity + win/lose text) appears after the opponent drum settles, not before.
- Confirm the score updates correctly and a new round can be started.

- [ ] **Step 2: Multiplayer verification**

Using two browser sessions (or two tabs with separate contexts), create and join a room for Odd or Even, and confirm the same checklist as Step 1 holds for both players — in particular that neither player ever sees the other's number before both have played, and that the `bothCorrect` case (both predictions right) displays correctly on the result plate.

- [ ] **Step 3: Fallback verification**

Throttle CPU heavily (DevTools Performance tab → CPU 6x slowdown) and confirm the drum/duel scene either simplifies or falls back to `NumberTokenPicker`/`FlipReveal` without breaking gameplay, in both solo and multiplayer.

---

## Self-Review Notes

- **Spec coverage:** `docs/superpowers/specs/2026-08-03-3d-animations-odd-or-even-dice-design.md` calls for a draggable drum (not a die), a masked-then-rolling opponent drum, a floating "+" separator, and a 3D result plate — Tasks 1-5 build each piece, Tasks 6-7 wire them into both game modes, Task 8 verifies the never-show-opponent-number-early requirement explicitly.
- **Type consistency:** `NumberDrumMode`'s `settled`/`rolling`/`masked`/`interactive` variants are defined once in `NumberDrum.tsx` and consumed identically by `OddOrEvenDuelScene.tsx`; `OddOrEvenRound`'s generic `yourValue`/`opponentValue` field names let both `OddOrEvenSolo.tsx` (mapping from `playerNumber`/`machineNumber`) and `OddOrEvenMultiplayer.tsx` (mapping from `yourValue`/`opponentValue` directly) reuse the same scene component without new types.
- **No placeholders:** every task has complete, runnable code; WebGL-only tasks (3, 4, 5) are explicitly marked as manually verified in Task 8 rather than unit tested, consistent with this project's established convention from the RPS sub-projects.

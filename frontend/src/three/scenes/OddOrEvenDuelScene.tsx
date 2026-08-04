// frontend/src/three/scenes/OddOrEvenDuelScene.tsx
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { NumberDrum } from './NumberDrum';
import { PlusSymbol3D } from './PlusSymbol3D';
import { SumPlate3D } from './SumPlate3D';
import { isRollSettled, ROLL_DURATION_MS } from './carouselTimeline';
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

  // Key the reset on the round's primitive values, not on object identity: callers
  // build `round` as a fresh object literal every render, so depending on `round`
  // itself would restart the reveal on any unrelated parent re-render.
  useEffect(() => {
    completedRef.current = false;
    setElapsedMs(0);
  }, [round?.yourValue, round?.opponentValue]);

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

  // Two carousels side by side: vertical orientation (cards stack above/below
  // center) instead of horizontal, so each carousel's neighbor cards spread
  // up and down within its own column instead of reaching sideways into the
  // other carousel's space and the plus sign between them.
  // The desktop reveal container keeps a fixed (non-responsive) 45° vertical
  // camera FOV, which at this scene's camera distance leaves only about
  // ±1.3 world units of vertical room in total — split between the
  // carousels and the plate below them. These values are sized to that
  // budget: the plate must stay above roughly y=-0.7 to remain on-screen.
  const DRUM_X = 1.05;
  const DRUM_Y = 0.55;
  const PLATE_Y = -0.45;

  if (!round) {
    return (
      <group>
        <NumberDrum mode={{ kind: 'masked' }} material={material} position={[-DRUM_X, DRUM_Y, 0]} orientation="vertical" />
        <PlusSymbol3D material={material} position={[0, DRUM_Y, 0]} />
        <NumberDrum mode={{ kind: 'masked' }} material={material} position={[DRUM_X, DRUM_Y, 0]} orientation="vertical" />
      </group>
    );
  }

  const opponentSettled = isRollSettled(elapsedMs);
  const opponentMode = opponentSettled
    ? ({ kind: 'settled', value: round.opponentValue } as const)
    : ({ kind: 'rolling', targetValue: round.opponentValue, elapsedMs } as const);

  return (
    <group>
      <NumberDrum
        mode={{ kind: 'settled', value: round.yourValue }}
        material={material}
        position={[-DRUM_X, DRUM_Y, 0]}
        orientation="vertical"
      />
      <PlusSymbol3D material={material} position={[0, DRUM_Y, 0]} />
      <NumberDrum mode={opponentMode} material={material} position={[DRUM_X, DRUM_Y, 0]} orientation="vertical" />
      <SumPlate3D
        sum={round.sum}
        parityLabel={round.parityLabel}
        outcomeLabel={round.outcomeLabel}
        material={material}
        position={[0, PLATE_Y, 0]}
        visible={elapsedMs >= PLATE_DELAY_MS}
      />
    </group>
  );
}

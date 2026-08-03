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

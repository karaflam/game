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

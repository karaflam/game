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

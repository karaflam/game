import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { RPS_MOVES, getRpsOutcome, pickRandomRpsMove, type RpsMove } from '@/lib/rpsLogic';

const RPS_TARGET_SCORE = 5;

const moveLabels: Record<RpsMove, string> = {
  pierre: 'Pierre',
  feuille: 'Feuille',
  ciseau: 'Ciseau'
};

export function RpsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(RPS_TARGET_SCORE);
  const [message, setMessage] = useState('Choisissez pierre, feuille ou ciseau.');
  const [lastRound, setLastRound] = useState<{ player: RpsMove; machine: RpsMove } | null>(null);

  const playRound = (move: RpsMove) => {
    if (isMatchOver) {
      return;
    }

    const machineMove = pickRandomRpsMove();
    const outcome = getRpsOutcome(move, machineMove);
    setLastRound({ player: move, machine: machineMove });

    if (outcome === 'draw') {
      setMessage(`Égalité : vous avez joué ${moveLabels[move]}, l’IA aussi.`);
    } else if (outcome === 'player') {
      setMessage(`Vous gagnez la manche ! ${moveLabels[move]} bat ${moveLabels[machineMove]}.`);
    } else {
      setMessage(`Vous perdez la manche... ${moveLabels[machineMove]} bat ${moveLabels[move]}.`);
    }

    recordRound(outcome);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={RPS_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      {lastRound ? (
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Vous : {moveLabels[lastRound.player]} · IA : {moveLabels[lastRound.machine]}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {RPS_MOVES.map(move => (
          <Button key={move} type="button" onClick={() => playRound(move)} disabled={isMatchOver}>
            {moveLabels[move]}
          </Button>
        ))}
      </div>

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}

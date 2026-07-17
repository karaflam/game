import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { DuelReveal } from '@/components/solo/reveals/DuelReveal';
import { useSoloScore } from '@/hooks/useSoloScore';
import { RPS_MOVES, getRpsOutcome, pickRandomRpsMove, type RpsMove } from '@/lib/rpsLogic';

const RPS_TARGET_SCORE = 5;

const moveLabels: Record<RpsMove, string> = {
  pierre: 'Pierre',
  feuille: 'Feuille',
  ciseau: 'Ciseau'
};

const moveEmojis: Record<RpsMove, string> = {
  pierre: '✊',
  feuille: '✋',
  ciseau: '✌️'
};

type RoundData = { player: RpsMove; machine: RpsMove; outcome: 'player' | 'machine' | 'draw' };

export function RpsSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(RPS_TARGET_SCORE);
  const [message, setMessage] = useState('Choisissez pierre, feuille ou ciseau.');
  const [round, setRound] = useState<RoundData | null>(null);

  const playRound = (move: RpsMove) => {
    if (isMatchOver || round) {
      return;
    }

    const machineMove = pickRandomRpsMove();
    const outcome = getRpsOutcome(move, machineMove);
    setRound({ player: move, machine: machineMove, outcome });
  };

  const handleRevealComplete = () => {
    if (!round) {
      return;
    }

    if (round.outcome === 'draw') {
      setMessage(`Égalité : vous avez joué ${moveLabels[round.player]}, l’IA aussi.`);
    } else if (round.outcome === 'player') {
      setMessage(`Vous gagnez la manche ! ${moveLabels[round.player]} bat ${moveLabels[round.machine]}.`);
    } else {
      setMessage(`Vous perdez la manche... ${moveLabels[round.machine]} bat ${moveLabels[round.player]}.`);
    }

    recordRound(round.outcome);
    setRound(null);
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={RPS_TARGET_SCORE} onReset={reset} />

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
        <>
          <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
            {message}
          </motion.p>

          <div className="grid gap-3 sm:grid-cols-3">
            {RPS_MOVES.map(move => (
              <button
                key={move}
                type="button"
                onClick={() => playRound(move)}
                disabled={isMatchOver}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <span className="text-4xl">{moveEmojis[move]}</span>
                <span className="text-sm font-semibold text-foreground">{moveLabels[move]}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <MatchEndOverlay winner={winner} onReplay={reset} />
    </div>
  );
}

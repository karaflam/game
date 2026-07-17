import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScorePill } from '@/components/solo/ScorePill';
import { MatchEndOverlay } from '@/components/solo/MatchEndOverlay';
import { useSoloScore } from '@/hooks/useSoloScore';
import { soloTwoTruthsOneLieTriplets } from '@/data/soloPrompts';
import { pickRandomItem } from '@/lib/randomPick';
import { shuffleTriplet } from '@/lib/twoTruthsLogic';

const TWO_TRUTHS_TARGET_SCORE = 5;

export function TwoTruthsOneLieSolo() {
  const { score, winner, isMatchOver, recordRound, reset } = useSoloScore(TWO_TRUTHS_TARGET_SCORE);
  const [triplet, setTriplet] = useState(() => shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('L’IA affirme 3 choses sur elle. Trouvez le mensonge.');

  const nextRound = () => {
    setTriplet(shuffleTriplet(pickRandomItem(soloTwoTruthsOneLieTriplets)));
    setSelected(null);
    setMessage('Nouvelle série ! Trouvez le mensonge.');
  };

  const chooseStatement = (index: number) => {
    if (isMatchOver || selected !== null) {
      return;
    }

    setSelected(index);
    const correct = index === triplet.lieIndex;
    setMessage(
      correct
        ? `Bien joué, "${triplet.statements[triplet.lieIndex]}" était bien le mensonge !`
        : `Perdu, le mensonge était : "${triplet.statements[triplet.lieIndex]}".`
    );
    recordRound(correct ? 'player' : 'machine');
  };

  return (
    <div className="relative space-y-6 rounded-3xl border border-border bg-background p-8">
      <ScorePill player={score.player} machine={score.machine} targetScore={TWO_TRUTHS_TARGET_SCORE} onReset={reset} />

      <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">
        {message}
      </motion.p>

      <div className="grid gap-3">
        {triplet.statements.map((statement, index) => {
          const isRevealedLie = selected !== null && index === triplet.lieIndex;
          const isPlayerPick = selected === index;
          return (
            <Button
              key={index}
              type="button"
              variant={isRevealedLie ? 'destructive' : isPlayerPick ? 'secondary' : 'outline'}
              onClick={() => chooseStatement(index)}
              disabled={isMatchOver || selected !== null}
              className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
            >
              {statement}
            </Button>
          );
        })}
      </div>

      {selected !== null && !isMatchOver ? (
        <Button type="button" variant="secondary" onClick={nextRound}>
          Série suivante
        </Button>
      ) : null}

      <MatchEndOverlay
        winner={winner}
        onReplay={() => {
          reset();
          nextRound();
        }}
      />
    </div>
  );
}
